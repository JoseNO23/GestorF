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
            calc_total_ingresos, count_vencidos,
        },
    },
    repositories::{accounts_repo, events_repo, events_repo::FinancialEventRow, periods_repo,
                   periods_repo::Period, settings_repo},
};

#[derive(Debug, Serialize)]
pub struct DashboardData {
    pub period: Period,
    pub dinero_real: i64,
    pub dinero_disponible: i64,
    pub dinero_futuro: i64,
    pub total_ingresos: i64,
    pub total_gastos: i64,
    pub alertas_vencidos: usize,
    pub movimientos_recientes: Vec<FinancialEventRow>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PeriodEvolution {
    pub year: i64,
    pub month: i64,
    pub total_ingresos: i64,
    pub total_gastos: i64,
}

/// Retorna totales de ingresos y gastos para los últimos N períodos (sin status rules).
/// Usado por la gráfica de evolución mensual.
#[tauri::command]
pub async fn get_evolution(
    pool: State<'_, DbPool>,
    months: i64,
) -> Result<Vec<PeriodEvolution>, String> {
    sqlx::query_as::<_, PeriodEvolution>(
        "SELECT
            p.year,
            p.month,
            COALESCE(SUM(CASE WHEN fe.type IN ('income','receivable')
                              AND fe.exclude_from_total = 0
                              THEN fe.amount_minor ELSE 0 END), 0) AS total_ingresos,
            COALESCE(SUM(CASE WHEN fe.type IN ('expense','debt_charge')
                              AND fe.exclude_from_total = 0
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
    .map(|mut v| { v.reverse(); v }) // orden cronológico ascendente para el gráfico
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

    Ok(DashboardData {
        period,
        dinero_real: calc_dinero_real(&events, &rules_map, opening).to_minor(),
        dinero_disponible: calc_dinero_disponible(&events, &rules_map, opening).to_minor(),
        dinero_futuro: calc_dinero_futuro(&events, &rules_map, opening).to_minor(),
        total_ingresos: calc_total_ingresos(&events).to_minor(),
        total_gastos: calc_total_gastos(&events).to_minor(),
        alertas_vencidos: count_vencidos(&events, &rules_map, &today),
        movimientos_recientes,
    })
}
