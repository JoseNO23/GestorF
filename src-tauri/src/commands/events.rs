use tauri::State;

use crate::{
    db::connection::DbPool,
    domain::credit_card::validate_parent_child,
    repositories::events_repo::{
        self, CreateEventInput, FinancialEventRow, UpdateEventInput,
    },
};

#[tauri::command]
pub async fn list_events(
    pool: State<'_, DbPool>,
    period_id: i64,
) -> Result<Vec<FinancialEventRow>, String> {
    events_repo::list_events(&pool, period_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_event(
    pool: State<'_, DbPool>,
    id: i64,
) -> Result<Option<FinancialEventRow>, String> {
    events_repo::get_event(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_event(
    pool: State<'_, DbPool>,
    input: CreateEventInput,
) -> Result<FinancialEventRow, String> {
    // Validar relación padre/hijo antes de insertar
    if let Some(parent_id) = input.parent_event_id {
        // El ID no existe aún; la validación es contra el propio input
        // La validación real de circularidad ocurre al tener un ID asignado;
        // aquí prevenimos casos donde el cliente enviara parent == 0 o negativo
        if parent_id <= 0 {
            return Err("parent_event_id inválido".to_string());
        }
    }
    events_repo::create_event(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_event(
    pool: State<'_, DbPool>,
    id: i64,
    input: UpdateEventInput,
) -> Result<FinancialEventRow, String> {
    // Prevenir que un evento sea su propio padre
    if let Some(parent_id) = input.parent_event_id {
        validate_parent_child(id, parent_id).map_err(|e| e)?;
    }
    events_repo::update_event(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_event(pool: State<'_, DbPool>, id: i64) -> Result<(), String> {
    events_repo::delete_event(&pool, id)
        .await
        .map_err(|e| e.to_string())
}
