use tauri::State;

use crate::{
    db::connection::DbPool,
    repositories::{
        accounts_repo::{self, Account, CreateAccountInput},
        settings_repo::{
            self, Category, CreateCategoryInput, CreatePaymentMethodInput, CreateStatusInput,
            CreditCardBalance, PaymentMethod, Status, StatusWithRules, UpsertStatusRulesInput,
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
pub async fn update_category(
    pool: State<'_, DbPool>,
    id: i64,
    input: CreateCategoryInput,
) -> Result<Category, String> {
    settings_repo::update_category(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_category(
    pool: State<'_, DbPool>,
    id: i64,
    enabled: bool,
) -> Result<(), String> {
    settings_repo::toggle_category(&pool, id, enabled)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_category(pool: State<'_, DbPool>, id: i64) -> Result<(), String> {
    settings_repo::delete_category(&pool, id)
        .await
        .map_err(|_| {
            "No se puede eliminar: la categoría está en uso. Deshabilitala en su lugar.".to_string()
        })
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
) -> Result<Status, String> {
    settings_repo::create_status(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_status(
    pool: State<'_, DbPool>,
    id: i64,
    input: CreateStatusInput,
) -> Result<Status, String> {
    settings_repo::update_status(&pool, id, input)
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
pub async fn toggle_status(pool: State<'_, DbPool>, id: i64, enabled: bool) -> Result<(), String> {
    settings_repo::toggle_status(&pool, id, enabled)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_status(pool: State<'_, DbPool>, id: i64) -> Result<(), String> {
    settings_repo::delete_status(&pool, id)
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("estado del sistema") {
                msg
            } else {
                "No se puede eliminar: el estado está en uso por movimientos existentes. Deshabilitalo en su lugar.".to_string()
            }
        })
}

// ── Métodos de pago ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_payment_methods(pool: State<'_, DbPool>) -> Result<Vec<PaymentMethod>, String> {
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
pub async fn update_payment_method(
    pool: State<'_, DbPool>,
    id: i64,
    input: CreatePaymentMethodInput,
) -> Result<PaymentMethod, String> {
    settings_repo::update_payment_method(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_payment_method(
    pool: State<'_, DbPool>,
    id: i64,
    enabled: bool,
) -> Result<(), String> {
    settings_repo::toggle_payment_method(&pool, id, enabled)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_payment_method(pool: State<'_, DbPool>, id: i64) -> Result<(), String> {
    settings_repo::delete_payment_method(&pool, id)
        .await
        .map_err(|_| {
            "No se puede eliminar: el método está en uso. Deshabilitalo en su lugar.".to_string()
        })
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

#[tauri::command]
pub async fn update_account(
    pool: State<'_, DbPool>,
    id: i64,
    input: CreateAccountInput,
) -> Result<Account, String> {
    accounts_repo::update_account(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_account(pool: State<'_, DbPool>, id: i64, enabled: bool) -> Result<(), String> {
    accounts_repo::toggle_account(&pool, id, enabled)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_account(pool: State<'_, DbPool>, id: i64) -> Result<(), String> {
    accounts_repo::delete_account(&pool, id).await.map_err(|_| {
        "No se puede eliminar: la cuenta está en uso. Deshabilitala en su lugar.".to_string()
    })
}

// ── Tarjetas de crédito ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn list_credit_card_balances(
    pool: State<'_, DbPool>,
    period_id: i64,
) -> Result<Vec<CreditCardBalance>, String> {
    settings_repo::list_credit_card_balances(&pool, period_id)
        .await
        .map_err(|e| e.to_string())
}
