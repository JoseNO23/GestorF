use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
    SqlitePool,
};
use std::{fs, str::FromStr};
use tauri::Manager;

pub type DbPool = SqlitePool;

pub async fn init(app: &tauri::App) -> Result<DbPool, Box<dyn std::error::Error>> {
    let app_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("gestermoney.db");

    let connect_options = SqliteConnectOptions::from_str(&format!(
        "sqlite:{}",
        db_path.to_string_lossy()
    ))?
    .create_if_missing(true)
    .foreign_keys(true)
    .journal_mode(SqliteJournalMode::Wal);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(connect_options)
        .await?;

    sqlx::migrate!("src/db/migrations").run(&pool).await?;

    Ok(pool)
}
