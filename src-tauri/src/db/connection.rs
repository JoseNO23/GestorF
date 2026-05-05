use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::fs;
use tauri::Manager;

pub type DbPool = SqlitePool;

pub async fn init(app: &tauri::App) -> Result<DbPool, Box<dyn std::error::Error>> {
    let app_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("gestermoney.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.to_string_lossy());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    sqlx::migrate!("src/db/migrations").run(&pool).await?;

    Ok(pool)
}
