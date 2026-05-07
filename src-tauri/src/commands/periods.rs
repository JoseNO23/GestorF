use chrono::{Datelike, Local};
use tauri::State;

use crate::{
    db::connection::DbPool,
    repositories::{periods_repo::{self, Period}, recurring_repo},
};

/// Devuelve el período activo. Si no hay ninguno configurado,
/// crea el mes actual y lo marca como activo automáticamente.
/// También genera los eventos recurrentes pendientes del período.
#[tauri::command]
pub async fn get_active_period(pool: State<'_, DbPool>) -> Result<Period, String> {
    let period = if let Some(p) = periods_repo::get_active_period(&pool)
        .await
        .map_err(|e| e.to_string())?
    {
        p
    } else {
        let now = Local::now();
        let p = periods_repo::get_or_create_period(&pool, now.year(), now.month())
            .await
            .map_err(|e| e.to_string())?;
        periods_repo::set_active_period(&pool, p.id)
            .await
            .map_err(|e| e.to_string())?;
        p
    };

    // Genera eventos recurrentes faltantes — seguro ejecutar repetidamente
    let _ = recurring_repo::generate_for_period(&pool, period.id, period.year, period.month).await;

    Ok(period)
}

#[tauri::command]
pub async fn list_periods(pool: State<'_, DbPool>) -> Result<Vec<Period>, String> {
    periods_repo::list_periods(&pool)
        .await
        .map_err(|e| e.to_string())
}

/// Cambia el período activo. Crea el mes si no existe aún.
/// También genera los eventos recurrentes pendientes del nuevo período.
#[tauri::command]
pub async fn set_active_period(
    pool: State<'_, DbPool>,
    year: i32,
    month: u32,
) -> Result<Period, String> {
    let period = periods_repo::get_or_create_period(&pool, year, month)
        .await
        .map_err(|e| e.to_string())?;

    periods_repo::set_active_period(&pool, period.id)
        .await
        .map_err(|e| e.to_string())?;

    // Genera eventos recurrentes faltantes — seguro ejecutar repetidamente
    let _ = recurring_repo::generate_for_period(&pool, period.id, period.year, period.month).await;

    Ok(period)
}

#[tauri::command]
pub async fn close_period(pool: State<'_, DbPool>, id: i64) -> Result<(), String> {
    periods_repo::close_period(&pool, id)
        .await
        .map_err(|e| e.to_string())
}
