use chrono::Local;
use tauri::State;

use crate::config::{AppConfig, AppDir, Profile};

#[tauri::command]
pub fn list_profiles(app_dir: State<'_, AppDir>) -> Result<Vec<Profile>, String> {
    AppConfig::load(&app_dir.0)
        .map(|c| c.profiles)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_active_profile_id(app_dir: State<'_, AppDir>) -> Result<String, String> {
    AppConfig::load(&app_dir.0)
        .map(|c| c.active_profile)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_profile(app_dir: State<'_, AppDir>, name: String) -> Result<Profile, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre del perfil no puede estar vacío.".to_string());
    }

    let mut config = AppConfig::load(&app_dir.0).map_err(|e| e.to_string())?;

    let id = Local::now().timestamp_millis().to_string();
    let profile = Profile {
        id: id.clone(),
        name,
        db_file: format!("gestermoney_{id}.db"),
        created_at: Local::now().to_rfc3339(),
    };

    config.profiles.push(profile.clone());
    config.save(&app_dir.0).map_err(|e| e.to_string())?;

    Ok(profile)
}

#[tauri::command]
pub fn switch_profile(
    app: tauri::AppHandle,
    app_dir: State<'_, AppDir>,
    id: String,
) -> Result<(), String> {
    let mut config = AppConfig::load(&app_dir.0).map_err(|e| e.to_string())?;

    if !config.profiles.iter().any(|p| p.id == id) {
        return Err(format!("Perfil '{id}' no encontrado."));
    }

    config.active_profile = id;
    config.save(&app_dir.0).map_err(|e| e.to_string())?;

    app.restart();
}

#[tauri::command]
pub fn rename_profile(
    app_dir: State<'_, AppDir>,
    id: String,
    name: String,
) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("El nombre no puede estar vacío.".to_string());
    }

    let mut config = AppConfig::load(&app_dir.0).map_err(|e| e.to_string())?;

    config
        .profiles
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("Perfil '{id}' no encontrado."))?
        .name = name;

    config.save(&app_dir.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_profile(app_dir: State<'_, AppDir>, id: String) -> Result<(), String> {
    let mut config = AppConfig::load(&app_dir.0).map_err(|e| e.to_string())?;

    if config.active_profile == id {
        return Err("No se puede eliminar el perfil activo. Cambia a otro primero.".to_string());
    }
    if config.profiles.len() <= 1 {
        return Err("No se puede eliminar el único perfil.".to_string());
    }

    config.profiles.retain(|p| p.id != id);
    config.save(&app_dir.0).map_err(|e| e.to_string())
}
