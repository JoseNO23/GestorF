use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

// ── Estado Tauri — directorio de datos de la app ─────────────────────────────

pub struct AppDir(pub PathBuf);

// ── Modelos ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub db_file: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub active_profile: String,
    pub profiles: Vec<Profile>,
}

impl AppConfig {
    /// Carga la configuración desde disco.
    /// Primera vez (sin config.json): crea uno apuntando al gestermoney.db existente.
    pub fn load(app_dir: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        let config_path = app_dir.join("config.json");

        if config_path.exists() {
            let content = fs::read_to_string(&config_path)?;
            return Ok(serde_json::from_str(&content)?);
        }

        // Migración automática: si ya hay un gestermoney.db, lo adopta como perfil Personal.
        let config = AppConfig {
            active_profile: "default".to_string(),
            profiles: vec![Profile {
                id: "default".to_string(),
                name: "Personal".to_string(),
                db_file: "gestermoney.db".to_string(),
                created_at: Local::now().to_rfc3339(),
            }],
        };
        config.save(app_dir)?;
        Ok(config)
    }

    pub fn save(&self, app_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let content = serde_json::to_string_pretty(self)?;
        fs::write(app_dir.join("config.json"), content)?;
        Ok(())
    }

    /// Ruta del archivo .db del perfil activo.
    pub fn active_db_path(&self, app_dir: &Path) -> PathBuf {
        let profile = self
            .profiles
            .iter()
            .find(|p| p.id == self.active_profile)
            .or_else(|| self.profiles.first());

        match profile {
            Some(p) => app_dir.join(&p.db_file),
            None => app_dir.join("gestermoney.db"),
        }
    }
}
