use tauri::State;

use crate::{
    db::connection::DbPool,
    repositories::{
        accounts_repo::{self, Account, CreateAccountInput},
        settings_repo::{
            self, Category, CreateCategoryInput, CreatePaymentMethodInput, CreateStatusInput,
            PaymentMethod, StatusWithRules, UpsertStatusRulesInput,
        },
    },
};

// ── Categorías ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_categories(pool: State<'_, DbPool>) -> Result<Vec<Category>, String> {
    settings_repo::list_categories(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_category(
    pool: State<'_, DbPool>,
    input: CreateCategoryInput,
) -> Result<Category, String> {
    settings_repo::create_category(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn archive_category(pool: State<'_, DbPool>, id: i64) -> Result<(), String> {
    settings_repo::archive_category(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

// ── Estados ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_statuses_with_rules(
    pool: State<'_, DbPool>,
) -> Result<Vec<StatusWithRules>, String> {
    settings_repo::list_statuses_with_rules(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_status(
    pool: State<'_, DbPool>,
    input: CreateStatusInput,
) -> Result<crate::repositories::settings_repo::Status, String> {
    settings_repo::create_status(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upsert_status_rules(
    pool: State<'_, DbPool>,
    status_id: i64,
    input: UpsertStatusRulesInput,
) -> Result<(), String> {
    settings_repo::upsert_status_rules(&pool, status_id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_status(
    pool: State<'_, DbPool>,
    id: i64,
    enabled: bool,
) -> Result<(), String> {
    settings_repo::toggle_status(&pool, id, enabled)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_status(pool: State<'_, DbPool>, id: i64) -> Result<(), String> {
    settings_repo::delete_status(&pool, id)
        .await
        .map_err(|e| "No se puede eliminar: el estado está en uso por movimientos existentes. Deshabilitalo en su lugar.".to_string())
}

// ── Métodos de pago ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_payment_methods(
    pool: State<'_, DbPool>,
) -> Result<Vec<PaymentMethod>, String> {
    settings_repo::list_payment_methods(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_payment_method(
    pool: State<'_, DbPool>,
    input: CreatePaymentMethodInput,
) -> Result<PaymentMethod, String> {
    settings_repo::create_payment_method(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn archive_payment_method(pool: State<'_, DbPool>, id: i64) -> Result<(), String> {
    settings_repo::archive_payment_method(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

// ── Cuentas ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_accounts(pool: State<'_, DbPool>) -> Result<Vec<Account>, String> {
    accounts_repo::list_accounts(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_account(
    pool: State<'_, DbPool>,
    input: CreateAccountInput,
) -> Result<Account, String> {
    accounts_repo::create_account(&pool, input)
        .await
        .map_err(|e| e.to_string())
}
