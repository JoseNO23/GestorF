use tauri::State;

use crate::{
    db::connection::DbPool,
    repositories::credit_card_repo::{
        self, calc_installment_amount, calc_total_with_interest, CreateCreditCardPurchaseInput,
        CreditCardPurchase, CreditCardPurchaseWithProgress,
    },
};

/// Calcula la cuota mensual y el total con intereses antes de confirmar.
#[derive(serde::Serialize)]
pub struct InstallmentPreview {
    pub installment_amount_minor: i64,
    pub total_with_interest_minor: i64,
    pub total_interest_minor: i64,
}

#[tauri::command]
pub fn preview_installments(
    total_amount_minor: i64,
    installments: i64,
    monthly_interest_rate: f64,
) -> InstallmentPreview {
    let n = installments.max(1);
    let installment = calc_installment_amount(total_amount_minor, n, monthly_interest_rate);
    let total = calc_total_with_interest(installment, n);
    InstallmentPreview {
        installment_amount_minor: installment,
        total_with_interest_minor: total,
        total_interest_minor: total - total_amount_minor,
    }
}

#[tauri::command]
pub async fn create_credit_card_purchase(
    pool: State<'_, DbPool>,
    input: CreateCreditCardPurchaseInput,
) -> Result<CreditCardPurchase, String> {
    credit_card_repo::create_purchase_with_installments(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_credit_card_purchases(
    pool: State<'_, DbPool>,
    payment_method_id: Option<i64>,
) -> Result<Vec<CreditCardPurchaseWithProgress>, String> {
    credit_card_repo::list_purchases_with_progress(&pool, payment_method_id)
        .await
        .map_err(|e| e.to_string())
}
