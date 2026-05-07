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
    if let Some(parent_id) = input.parent_event_id {
        validate_parent_depth(&pool, 0, parent_id).await?;
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
    if let Some(parent_id) = input.parent_event_id {
        validate_parent_child(id, parent_id).map_err(|e| e)?;
        validate_parent_depth(&pool, id, parent_id).await?;
    }
    events_repo::update_event(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

/// Verifica que el padre no tenga a su vez un padre (máximo un nivel de anidamiento).
async fn validate_parent_depth(
    pool: &crate::db::connection::DbPool,
    event_id: i64,
    parent_id: i64,
) -> Result<(), String> {
    let parent = events_repo::get_event(pool, parent_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("El evento padre {parent_id} no existe"))?;

    if parent.parent_event_id.is_some() {
        return Err("No se puede anidar más de un nivel (el padre ya tiene un padre)".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_event(pool: State<'_, DbPool>, id: i64) -> Result<(), String> {
    events_repo::delete_event(&pool, id)
        .await
        .map_err(|e| e.to_string())
}
