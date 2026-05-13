use chrono::{Datelike, Duration, Local, NaiveDate, NaiveDateTime};
use serde::Serialize;
use sqlx::FromRow;
use std::collections::HashMap;

use crate::db::connection::DbPool;

// ── Tipos públicos ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct NotificationItem {
    pub key: String, // "{notif_type}_{source_type}_{source_id}"
    pub notif_type: String,
    pub source_type: String,
    pub source_id: i64,
    pub title: String,
    pub message: String,
    pub priority: String, // "info" | "warning" | "critical"
    pub due_date: Option<String>,
    pub route_to: String,
    pub read_at: Option<String>,
    pub dismissed_at: Option<String>,
}

// ── Structs internos de query ─────────────────────────────────────────────────

#[derive(FromRow)]
struct EventRow {
    id: i64,
    title: String,
    event_date: String,
    purchase_id: Option<i64>,
    installment_number: Option<i64>,
}

#[derive(FromRow)]
struct CcRow {
    id: i64,
    name: String,
    payment_due_day: i64,
}

#[derive(FromRow)]
struct NotifStateRow {
    notif_type: String,
    source_type: String,
    source_id: i64,
    read_at: Option<String>,
    dismissed_at: Option<String>,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn last_day_of_month(year: i32, month: u32) -> u32 {
    let next_month = if month == 12 { 1 } else { month + 1 };
    let next_year = if month == 12 { year + 1 } else { year };
    NaiveDate::from_ymd_opt(next_year, next_month, 1)
        .unwrap()
        .pred_opt()
        .unwrap()
        .day()
}

fn cc_due_date(today: NaiveDate, due_day: u32) -> NaiveDate {
    let (year, month) = if today.day() <= due_day {
        (today.year(), today.month())
    } else if today.month() == 12 {
        (today.year() + 1, 1u32)
    } else {
        (today.year(), today.month() + 1)
    };
    let last = last_day_of_month(year, month);
    let clamped = due_day.min(last);
    NaiveDate::from_ymd_opt(year, month, clamped).unwrap()
}

fn days_message(days: i64) -> String {
    match days {
        d if d < -1 => format!("Vencido hace {} días", -d),
        -1 => "Venció ayer".to_string(),
        0 => "Vence hoy".to_string(),
        1 => "Vence mañana".to_string(),
        d => format!("Vence en {} días", d),
    }
}

fn get_state(
    map: &HashMap<String, (Option<String>, Option<String>)>,
    key: &str,
) -> (Option<String>, Option<String>) {
    map.get(key).cloned().unwrap_or((None, None))
}

// Una notificación descartada se oculta durante DISMISS_TTL_DAYS.
// Pasado ese plazo, reaparece si el problema financiero persiste.
// Esto evita confundir "descartada" con "solucionada".
const DISMISS_TTL_DAYS: i64 = 7;

/// Devuelve true si la notificación debe ocultarse porque fue descartada
/// recientemente (dentro del TTL). Pasado el TTL, vuelve a ser visible.
fn is_recently_dismissed(dismissed_at: &Option<String>) -> bool {
    let Some(dismissed_str) = dismissed_at else {
        return false;
    };
    let Ok(dismissed_dt) = NaiveDateTime::parse_from_str(dismissed_str, "%Y-%m-%d %H:%M:%S") else {
        return false;
    };
    let cutoff = (Local::now() - Duration::days(DISMISS_TTL_DAYS)).naive_local();
    dismissed_dt > cutoff
}

const NOT_PAID: &str =
    "NOT EXISTS (SELECT 1 FROM status_rules sr WHERE sr.status_id = fe.status_id AND sr.counts_as_paid = 1)";

/// Excluye eventos cuyo estado los saca del total (ej. "Cancelado").
/// Un evento cancelado no es una obligación activa y nunca debe generar alerta.
const NOT_EXCLUDED: &str =
    "NOT EXISTS (SELECT 1 FROM status_rules sr WHERE sr.status_id = fe.status_id AND sr.exclude_from_total_default = 1)";

// ── Funciones públicas ────────────────────────────────────────────────────────

pub async fn list_notifications(pool: &DbPool) -> Result<Vec<NotificationItem>, sqlx::Error> {
    let today = Local::now().date_naive();
    let today_str = today.format("%Y-%m-%d").to_string();
    let cutoff_str = (today + Duration::days(3)).format("%Y-%m-%d").to_string();

    // Cargar todos los estados persistidos del usuario
    let states: Vec<NotifStateRow> = sqlx::query_as(
        "SELECT notif_type, source_type, source_id, read_at, dismissed_at FROM notification_state",
    )
    .fetch_all(pool)
    .await?;

    let state_map: HashMap<String, (Option<String>, Option<String>)> = states
        .into_iter()
        .map(|s| {
            let key = format!("{}_{}_{}", s.notif_type, s.source_type, s.source_id);
            (key, (s.read_at, s.dismissed_at))
        })
        .collect();

    let mut items: Vec<NotificationItem> = Vec::new();

    // ── 1. Ingresos vencidos ──────────────────────────────────────────────────
    let rows: Vec<EventRow> = sqlx::query_as(&format!(
        "SELECT fe.id, fe.title, fe.event_date, fe.purchase_id, fe.installment_number
         FROM financial_events fe
         JOIN periods p ON p.id = fe.period_id
         WHERE fe.type = 'income'
           AND DATE(fe.event_date) < DATE('now', 'localtime')
           AND p.closed_at IS NULL
           AND {NOT_PAID}
           AND {NOT_EXCLUDED}
         ORDER BY fe.event_date"
    ))
    .fetch_all(pool)
    .await?;

    for row in rows {
        let due = NaiveDate::parse_from_str(&row.event_date, "%Y-%m-%d").unwrap_or(today);
        let days = (today - due).num_days() as i64;
        let key = format!("income_overdue_event_{}", row.id);
        let (read_at, dismissed_at) = get_state(&state_map, &key);
        if is_recently_dismissed(&dismissed_at) {
            continue;
        }
        items.push(NotificationItem {
            key,
            notif_type: "income_overdue".to_string(),
            source_type: "event".to_string(),
            source_id: row.id,
            title: row.title,
            message: format!(
                "Vencido hace {} día{}",
                days,
                if days == 1 { "" } else { "s" }
            ),
            priority: "critical".to_string(),
            due_date: Some(row.event_date),
            route_to: "/ingresos/movimientos".to_string(),
            read_at,
            dismissed_at,
        });
    }

    // ── 2. Ingresos que vencen hoy ────────────────────────────────────────────
    let rows: Vec<EventRow> = sqlx::query_as(&format!(
        "SELECT fe.id, fe.title, fe.event_date, fe.purchase_id, fe.installment_number
         FROM financial_events fe
         JOIN periods p ON p.id = fe.period_id
         WHERE fe.type = 'income'
           AND DATE(fe.event_date) = DATE('now', 'localtime')
           AND p.closed_at IS NULL
           AND {NOT_PAID}
           AND {NOT_EXCLUDED}
         ORDER BY fe.title"
    ))
    .fetch_all(pool)
    .await?;

    for row in rows {
        let key = format!("income_due_event_{}", row.id);
        let (read_at, dismissed_at) = get_state(&state_map, &key);
        if is_recently_dismissed(&dismissed_at) {
            continue;
        }
        items.push(NotificationItem {
            key,
            notif_type: "income_due".to_string(),
            source_type: "event".to_string(),
            source_id: row.id,
            title: row.title,
            message: "Cobro esperado hoy".to_string(),
            priority: "warning".to_string(),
            due_date: Some(today_str.clone()),
            route_to: "/ingresos/movimientos".to_string(),
            read_at,
            dismissed_at,
        });
    }

    // ── 3. Gastos vencidos ────────────────────────────────────────────────────
    let rows: Vec<EventRow> = sqlx::query_as(&format!(
        "SELECT fe.id, fe.title, fe.event_date, fe.purchase_id, fe.installment_number
         FROM financial_events fe
         JOIN periods p ON p.id = fe.period_id
         WHERE fe.type = 'expense'
           AND DATE(fe.event_date) < DATE('now', 'localtime')
           AND fe.exclude_from_total = 0
           AND p.closed_at IS NULL
           AND {NOT_PAID}
           AND {NOT_EXCLUDED}
         ORDER BY fe.event_date"
    ))
    .fetch_all(pool)
    .await?;

    for row in rows {
        let due = NaiveDate::parse_from_str(&row.event_date, "%Y-%m-%d").unwrap_or(today);
        let days = (today - due).num_days() as i64;
        let key = format!("expense_overdue_event_{}", row.id);
        let (read_at, dismissed_at) = get_state(&state_map, &key);
        if is_recently_dismissed(&dismissed_at) {
            continue;
        }
        let (route, suffix) = installment_meta(&row);
        items.push(NotificationItem {
            key,
            notif_type: "expense_overdue".to_string(),
            source_type: "event".to_string(),
            source_id: row.id,
            title: format!("{}{}", row.title, suffix),
            message: format!(
                "Vencido hace {} día{}",
                days,
                if days == 1 { "" } else { "s" }
            ),
            priority: "critical".to_string(),
            due_date: Some(row.event_date),
            route_to: route,
            read_at,
            dismissed_at,
        });
    }

    // ── 4. Gastos que vencen hoy ──────────────────────────────────────────────
    let rows: Vec<EventRow> = sqlx::query_as(&format!(
        "SELECT fe.id, fe.title, fe.event_date, fe.purchase_id, fe.installment_number
         FROM financial_events fe
         JOIN periods p ON p.id = fe.period_id
         WHERE fe.type = 'expense'
           AND DATE(fe.event_date) = DATE('now', 'localtime')
           AND fe.exclude_from_total = 0
           AND p.closed_at IS NULL
           AND {NOT_PAID}
           AND {NOT_EXCLUDED}
         ORDER BY fe.title"
    ))
    .fetch_all(pool)
    .await?;

    for row in rows {
        let key = format!("expense_due_event_{}", row.id);
        let (read_at, dismissed_at) = get_state(&state_map, &key);
        if is_recently_dismissed(&dismissed_at) {
            continue;
        }
        let (route, suffix) = installment_meta(&row);
        items.push(NotificationItem {
            key,
            notif_type: "expense_due".to_string(),
            source_type: "event".to_string(),
            source_id: row.id,
            title: format!("{}{}", row.title, suffix),
            message: "Pago vence hoy".to_string(),
            priority: "warning".to_string(),
            due_date: Some(today_str.clone()),
            route_to: route,
            read_at,
            dismissed_at,
        });
    }

    // ── 5. Gastos próximos (mañana + 2 días) ─────────────────────────────────
    let rows: Vec<EventRow> = sqlx::query_as(&format!(
        "SELECT fe.id, fe.title, fe.event_date, fe.purchase_id, fe.installment_number
         FROM financial_events fe
         JOIN periods p ON p.id = fe.period_id
         WHERE fe.type = 'expense'
           AND DATE(fe.event_date) > DATE('now', 'localtime')
           AND DATE(fe.event_date) <= ?
           AND fe.exclude_from_total = 0
           AND p.closed_at IS NULL
           AND {NOT_PAID}
           AND {NOT_EXCLUDED}
         ORDER BY fe.event_date, fe.title"
    ))
    .bind(&cutoff_str)
    .fetch_all(pool)
    .await?;

    for row in rows {
        let due = NaiveDate::parse_from_str(&row.event_date, "%Y-%m-%d").unwrap_or(today);
        let days = (due - today).num_days() as i64;
        let key = format!("expense_upcoming_event_{}", row.id);
        let (read_at, dismissed_at) = get_state(&state_map, &key);
        if is_recently_dismissed(&dismissed_at) {
            continue;
        }
        let (route, suffix) = installment_meta(&row);
        items.push(NotificationItem {
            key,
            notif_type: "expense_upcoming".to_string(),
            source_type: "event".to_string(),
            source_id: row.id,
            title: format!("{}{}", row.title, suffix),
            message: days_message(days),
            priority: "info".to_string(),
            due_date: Some(row.event_date),
            route_to: route,
            read_at,
            dismissed_at,
        });
    }

    // ── 6. Tarjetas de crédito con pago próximo (≤ 7 días) ───────────────────
    let cc_rows: Vec<CcRow> = sqlx::query_as(
        "SELECT pm.id, pm.name, pm.payment_due_day
         FROM payment_methods pm
         WHERE pm.kind = 'credit'
           AND pm.archived_at IS NULL
           AND pm.payment_due_day IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM financial_events fe
             WHERE fe.payment_method_id = pm.id
               AND NOT EXISTS (
                 SELECT 1 FROM status_rules sr
                 WHERE sr.status_id = fe.status_id AND sr.counts_as_paid = 1
               )
           )",
    )
    .fetch_all(pool)
    .await?;

    for row in cc_rows {
        let due_date = cc_due_date(today, row.payment_due_day as u32);
        let days = (due_date - today).num_days() as i64;
        if days > 7 {
            continue;
        }

        let priority = if days <= 2 {
            "critical"
        } else if days <= 5 {
            "warning"
        } else {
            "info"
        };
        let key = format!("credit_card_due_payment_method_{}", row.id);
        let (read_at, dismissed_at) = get_state(&state_map, &key);
        if is_recently_dismissed(&dismissed_at) {
            continue;
        }

        items.push(NotificationItem {
            key,
            notif_type: "credit_card_due".to_string(),
            source_type: "payment_method".to_string(),
            source_id: row.id,
            title: format!("Tarjeta {}", row.name),
            message: days_message(days),
            priority: priority.to_string(),
            due_date: Some(due_date.format("%Y-%m-%d").to_string()),
            route_to: "/tarjetas/balance".to_string(),
            read_at,
            dismissed_at,
        });
    }

    // ── 7. Recurrentes variables con monto sin confirmar ─────────────────────
    #[derive(FromRow)]
    struct VarRow { id: i64, title: String, event_date: String, event_type: String }

    let var_rows: Vec<VarRow> = sqlx::query_as(&format!(
        "SELECT fe.id, fe.title, fe.event_date, fe.type AS event_type
         FROM financial_events fe
         JOIN periods p ON p.id = fe.period_id
         WHERE fe.requires_amount_confirmation = 1
           AND DATE(fe.event_date) <= DATE('now', 'localtime')
           AND p.closed_at IS NULL
           AND {NOT_PAID}
           AND {NOT_EXCLUDED}
         ORDER BY fe.event_date, fe.type"
    ))
    .fetch_all(pool)
    .await?;

    for row in var_rows {
        let is_income = row.event_type == "income" || row.event_type == "receivable";
        let notif_type = if is_income { "income_amount_pending" } else { "expense_amount_pending" };
        let route = if is_income { "/ingresos/movimientos" } else { "/gastos/movimientos" };
        let key = format!("{notif_type}_event_{}", row.id);
        let (read_at, dismissed_at) = get_state(&state_map, &key);
        if is_recently_dismissed(&dismissed_at) { continue; }
        let message = if is_income {
            "Confirma el monto real recibido".to_string()
        } else {
            "Ingresa el monto real del período".to_string()
        };
        items.push(NotificationItem {
            key,
            notif_type: notif_type.to_string(),
            source_type: "event".to_string(),
            source_id: row.id,
            title: row.title,
            message,
            priority: "warning".to_string(),
            due_date: Some(row.event_date),
            route_to: route.to_string(),
            read_at,
            dismissed_at,
        });
    }

    // Ordenar: critical → warning → info, luego por due_date
    items.sort_by(|a, b| {
        let prio = |p: &str| match p {
            "critical" => 0,
            "warning" => 1,
            _ => 2,
        };
        prio(&a.priority)
            .cmp(&prio(&b.priority))
            .then(a.due_date.cmp(&b.due_date))
    });

    Ok(items)
}

pub async fn mark_read(
    pool: &DbPool,
    notif_type: &str,
    source_type: &str,
    source_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO notification_state (notif_type, source_type, source_id, read_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT (notif_type, source_type, source_id)
         DO UPDATE SET read_at = COALESCE(read_at, datetime('now'))",
    )
    .bind(notif_type)
    .bind(source_type)
    .bind(source_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Descarta la notificación: la oculta durante DISMISS_TTL_DAYS.
/// Pasado ese plazo vuelve a aparecer si el problema financiero persiste.
/// El descarte NO modifica ningún estado financiero real.
pub async fn mark_dismissed(
    pool: &DbPool,
    notif_type: &str,
    source_type: &str,
    source_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO notification_state (notif_type, source_type, source_id, read_at, dismissed_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT (notif_type, source_type, source_id)
         DO UPDATE SET
           read_at = COALESCE(read_at, datetime('now')),
           dismissed_at = datetime('now')",
    )
    .bind(notif_type)
    .bind(source_type)
    .bind(source_id)
    .execute(pool)
    .await?;
    Ok(())
}

// ── Helpers privados ──────────────────────────────────────────────────────────

fn installment_meta(row: &EventRow) -> (String, String) {
    let route = if row.purchase_id.is_some() {
        "/gastos/cuotas".to_string()
    } else {
        "/gastos/movimientos".to_string()
    };
    let suffix = if row.purchase_id.is_some() {
        row.installment_number
            .map(|n| format!(" (cuota {})", n))
            .unwrap_or_default()
    } else {
        String::new()
    };
    (route, suffix)
}
