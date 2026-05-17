use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
    SqlitePool,
};
use std::path::Path;
use std::fs;

use crate::config::AppConfig;

pub type DbPool = SqlitePool;

/// Inicializa el pool de la base de datos del perfil activo.
/// El app_dir ya debe existir antes de llamar a esta función.
pub async fn init(app_dir: &Path) -> Result<DbPool, Box<dyn std::error::Error>> {
    let config = AppConfig::load(app_dir)?;
    let db_path = config.active_db_path(app_dir);

    // Garantizar que el directorio del perfil exista
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let connect_options = SqliteConnectOptions::new()
        .filename(&db_path)
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
