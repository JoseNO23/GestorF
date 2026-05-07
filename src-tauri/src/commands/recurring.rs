use tauri::State;

use crate::{
    db::connection::DbPool,
    repositories::{
        periods_repo,
        recurring_repo::{self, CreateRecurringRuleInput, RecurringRule},
    },
};

#[tauri::command]
pub async fn list_recurring_rules(pool: State<'_, DbPool>) -> Result<Vec<RecurringRule>, String> {
    recurring_repo::list_recurring_rules(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_recurring_rule(
    pool: State<'_, DbPool>,
    input: CreateRecurringRuleInput,
) -> Result<RecurringRule, String> {
    recurring_repo::create_recurring_rule(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_recurring_rule(
    pool: State<'_, DbPool>,
    id: i64,
    input: CreateRecurringRuleInput,
) -> Result<RecurringRule, String> {
    recurring_repo::update_recurring_rule(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_recurring_rule(
    pool: State<'_, DbPool>,
    id: i64,
    enabled: bool,
) -> Result<(), String> {
    recurring_repo::toggle_recurring_rule(&pool, id, enabled)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_recurring_rule(pool: State<'_, DbPool>, id: i64) -> Result<(), String> {
    recurring_repo::delete_recurring_rule(&pool, id)
        .await
        .map_err(|_| "No se puede eliminar: la regla tiene movimientos asociados.".to_string())
}

/// Genera los movimientos faltantes del período a partir de las reglas activas.
/// Seguro ejecutar más de una vez: no duplica si ya existe el evento.
#[tauri::command]
pub async fn generate_recurring_events(
    pool: State<'_, DbPool>,
    period_id: i64,
) -> Result<u32, String> {
    let period = periods_repo::get_period(&pool, period_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Período {period_id} no existe"))?;

    recurring_repo::generate_for_period(&pool, period_id, period.year, period.month)
        .await
        .map_err(|e| e.to_string())
}
