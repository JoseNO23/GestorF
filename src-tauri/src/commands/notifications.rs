use tauri::State;

use crate::{
    db::connection::DbPool,
    repositories::notifications_repo::{self, NotificationItem},
};

#[tauri::command]
pub async fn list_notifications(pool: State<'_, DbPool>) -> Result<Vec<NotificationItem>, String> {
    notifications_repo::list_notifications(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn mark_notification_read(
    pool: State<'_, DbPool>,
    notif_type: String,
    source_type: String,
    source_id: i64,
) -> Result<(), String> {
    notifications_repo::mark_read(&pool, &notif_type, &source_type, source_id)
        .await
        .map_err(|e| e.to_string())
}

/// Descarta la alerta visualmente durante 7 días.
/// No modifica ningún estado financiero real.
#[tauri::command]
pub async fn mark_notification_dismissed(
    pool: State<'_, DbPool>,
    notif_type: String,
    source_type: String,
    source_id: i64,
) -> Result<(), String> {
    notifications_repo::mark_dismissed(&pool, &notif_type, &source_type, source_id)
        .await
        .map_err(|e| e.to_string())
}
