use chrono::Local;
use serde::Serialize;
use sqlx::FromRow;
use tauri::State;

use crate::{
    db::connection::DbPool,
    domain::{
        money::Money,
        projections::{
            calc_dinero_disponible, calc_dinero_futuro, calc_dinero_real, calc_total_gastos,
            calc_total_ingresos, calc_total_ingresos_esperados, count_vencidos,
        },
    },
    repositories::{
        accounts_repo,
        events_repo::{self, FinancialEventRow},
        periods_repo::{self, Period},
        settings_repo,
    },
};

#[derive(Debug, Serialize)]
pub struct DashboardData {
    pub period: Period,
    // ── Dinero propio (nunca incluye TC) ──────────────────────────────────────
    pub dinero_real: i64,
    pub dinero_disponible: i64,
    pub dinero_futuro: i64,
    // ── Mes actual ───────────────────────────────────────────────────────────
    pub total_ingresos: i64,           // realmente cobrado
    pub total_ingresos_esperados: i64, // proyección total del período
    pub total_gastos: i64,
    pub alertas_vencidos: usize,
    // ── Crédito TC (información separada — no es dinero propio) ─────────────
    pub tc_deuda_total: i64,
    pub tc_disponible_total: i64,
    pub tc_limite_total: i64,
    pub movimientos_recientes: Vec<FinancialEventRow>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PeriodEvolution {
    pub year: i64,
    pub month: i64,
    /// Ingresos realmente cobrados (received_amount_minor cuando existe).
    pub total_ingresos: i64,
    /// Ingresos esperados (amount_minor de todos los ingresos no cancelados).
    pub total_ingresos_esperados: i64,
    pub total_gastos: i64,
}

/// Retorna totales de ingresos y gastos para los últimos N períodos.
/// Diferencia ingresos cobrados (received) de esperados (amount).
#[tauri::command]
pub async fn get_evolution(
    pool: State<'_, DbPool>,
    months: i64,
) -> Result<Vec<PeriodEvolution>, String> {
    sqlx::query_as::<_, PeriodEvolution>(
        "SELECT
            p.year,
            p.month,
            -- Cobrado: para ingresos que ya impactan dinero real (affects_real=1),
            -- usar received_amount_minor si existe, si no amount_minor (ingreso completo).
            -- Esto evita que ingresos pagados sin received_amount_minor aparezcan como 0.
            COALESCE(SUM(CASE
                WHEN fe.type IN ('income','receivable')
                 AND fe.exclude_from_total = 0
                 AND EXISTS (
                   SELECT 1 FROM status_rules sr
                   WHERE sr.status_id = fe.status_id AND sr.affects_real = 1
                 )
                THEN COALESCE(fe.received_amount_minor, fe.amount_minor)
                ELSE 0 END), 0) AS total_ingresos,
            -- Esperado: todos los ingresos no cancelados (monto nominal)
            COALESCE(SUM(CASE
                WHEN fe.type IN ('income','receivable')
                 AND fe.exclude_from_total = 0
                 AND NOT EXISTS (
                   SELECT 1 FROM status_rules sr
                   WHERE sr.status_id = fe.status_id AND sr.exclude_from_total_default = 1
                 )
                THEN fe.amount_minor ELSE 0 END), 0) AS total_ingresos_esperados,
            -- Gastos: expenses y cargos TC no excluidos, no cancelados
            COALESCE(SUM(CASE
                WHEN fe.type IN ('expense','debt_charge')
                 AND fe.exclude_from_total = 0
                 AND NOT EXISTS (
                   SELECT 1 FROM status_rules sr
                   WHERE sr.status_id = fe.status_id AND sr.exclude_from_total_default = 1
                 )
                THEN fe.amount_minor ELSE 0 END), 0) AS total_gastos
         FROM periods p
         LEFT JOIN financial_events fe ON fe.period_id = p.id
         GROUP BY p.id, p.year, p.month
         ORDER BY p.year DESC, p.month DESC
         LIMIT ?",
    )
    .bind(months)
    .fetch_all(&*pool)
    .await
    .map(|mut v| {
        v.reverse();
        v
    })
    .map_err(|e| e.to_string())
}

/// Calcula todos los KPIs del período y los devuelve listos para renderizar.
/// React no calcula nada — solo muestra lo que este comando retorna.
#[tauri::command]
pub async fn get_dashboard(
    pool: State<'_, DbPool>,
    period_id: i64,
) -> Result<DashboardData, String> {
    let period = periods_repo::get_period(&pool, period_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("período {period_id} no encontrado"))?;

    let events = events_repo::list_events_for_calc(&pool, period_id)
        .await
        .map_err(|e| e.to_string())?;

    let rules_map = settings_repo::load_rules_map(&pool)
        .await
        .map_err(|e| e.to_string())?;

    let opening_minor = accounts_repo::get_asset_opening_balance(&pool)
        .await
        .map_err(|e| e.to_string())?;
    let opening = Money::from_minor(opening_minor);

    let today = Local::now().format("%Y-%m-%d").to_string();

    let movimientos_recientes = events_repo::list_events(&pool, period_id)
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .take(10)
        .collect();

    // Totales TC desde todas las compras/pagos históricas
    let tc_balances = settings_repo::list_credit_card_balances(&pool, period_id)
        .await
        .map_err(|e| e.to_string())?;

    let tc_deuda_total = tc_balances
        .iter()
        .map(|c| c.current_debt_minor)
        .sum::<i64>();
    let tc_disponible_total = tc_balances.iter().map(|c| c.available_minor).sum::<i64>();
    let tc_limite_total = tc_balances
        .iter()
        .map(|c| c.credit_limit_minor)
        .sum::<i64>();

    Ok(DashboardData {
        period,
        dinero_real: calc_dinero_real(&events, &rules_map, opening).to_minor(),
        dinero_disponible: calc_dinero_disponible(&events, &rules_map, opening).to_minor(),
        dinero_futuro: calc_dinero_futuro(&events, &rules_map, opening).to_minor(),
        total_ingresos: calc_total_ingresos(&events, &rules_map).to_minor(),
        total_ingresos_esperados: calc_total_ingresos_esperados(&events, &rules_map).to_minor(),
        total_gastos: calc_total_gastos(&events, &rules_map).to_minor(),
        alertas_vencidos: count_vencidos(&events, &rules_map, &today),
        tc_deuda_total,
        tc_disponible_total,
        tc_limite_total,
        movimientos_recientes,
    })
}
