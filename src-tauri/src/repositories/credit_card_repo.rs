use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{db::connection::DbPool, repositories::periods_repo};

// ── Structs ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CreditCardPurchase {
    pub id: i64,
    pub payment_method_id: i64,
    pub title: String,
    pub total_amount_minor: i64,
    pub installments: i64,
    pub interest_type: String,
    pub monthly_interest_rate: f64,
    pub installment_amount_minor: i64,
    pub total_with_interest_minor: i64,
    pub category_id: Option<i64>,
    pub purchase_date: String,
    pub notes: Option<String>,
    pub created_at: String,
}

/// Vista de una compra con cuántas cuotas ya se generaron/pagaron.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CreditCardPurchaseWithProgress {
    pub id: i64,
    pub payment_method_id: i64,
    pub title: String,
    pub total_amount_minor: i64,
    pub installments: i64,
    pub installment_amount_minor: i64,
    pub total_with_interest_minor: i64,
    pub interest_type: String,
    pub monthly_interest_rate: f64,
    pub category_id: Option<i64>,
    pub purchase_date: String,
    pub notes: Option<String>,
    pub installments_generated: i64, // cuántos eventos existen
    pub installments_paid: i64,      // cuántos están en estado pagado/cobrado
}

#[derive(Debug, Deserialize)]
pub struct CreateCreditCardPurchaseInput {
    pub payment_method_id: i64,
    pub title: String,
    pub total_amount_minor: i64,
    pub installments: i64,
    pub interest_type: String,      // "none" | "fixed"
    pub monthly_interest_rate: f64, // 0.05 = 5%
    pub category_id: Option<i64>,
    pub purchase_date: String, // "YYYY-MM-DD" — mes de la primera cuota
    pub notes: Option<String>,
}

// ── Helpers de cálculo ────────────────────────────────────────────────────────

/// Calcula el monto de cada cuota (en centavos).
/// Con interés fijo: anualidad estándar  P·r·(1+r)^n / ((1+r)^n − 1)
/// Sin interés: división entera con redondeo hacia arriba.
pub fn calc_installment_amount(total: i64, n: i64, monthly_rate: f64) -> i64 {
    if n <= 0 {
        return total;
    }
    if monthly_rate <= 0.0 {
        // Sin interés: techo de la división para que el total >= original
        (total + n - 1) / n
    } else {
        let r = monthly_rate;
        let rn = (1.0 + r).powi(n as i32);
        let factor = r * rn / (rn - 1.0);
        (total as f64 * factor).ceil() as i64
    }
}

/// Suma de todas las cuotas = total real a pagar.
pub fn calc_total_with_interest(installment: i64, n: i64) -> i64 {
    installment * n
}

/// Avanza N meses desde (year, month). Devuelve (new_year, new_month).
fn add_months(year: i64, month: i64, n: i64) -> (i64, i64) {
    let total = (year * 12 + month - 1) + n;
    let y = total / 12;
    let m = (total % 12) + 1;
    (y, m)
}

/// Parsea "YYYY-MM-DD" → (year, month, day).
fn parse_date(date: &str) -> (i64, i64, i64) {
    let parts: Vec<&str> = date.split('-').collect();
    let y = parts.first().and_then(|s| s.parse().ok()).unwrap_or(2026);
    let m = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(1);
    let d = parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(1);
    (y, m, d)
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

pub async fn list_purchases_with_progress(
    pool: &DbPool,
    payment_method_id: Option<i64>,
) -> Result<Vec<CreditCardPurchaseWithProgress>, sqlx::Error> {
    // Construye el WHERE dinámicamente
    let where_clause = if payment_method_id.is_some() {
        "WHERE ccp.payment_method_id = ?"
    } else {
        ""
    };

    let sql = format!(
        "SELECT
             ccp.id, ccp.payment_method_id, ccp.title,
             ccp.total_amount_minor, ccp.installments,
             ccp.installment_amount_minor, ccp.total_with_interest_minor,
             ccp.interest_type, ccp.monthly_interest_rate,
             ccp.category_id, ccp.purchase_date, ccp.notes,
             COUNT(fe.id) AS installments_generated,
             SUM(CASE WHEN sr.counts_as_paid = 1 THEN 1 ELSE 0 END) AS installments_paid
         FROM credit_card_purchases ccp
         LEFT JOIN financial_events fe ON fe.purchase_id = ccp.id
         LEFT JOIN status_rules sr ON sr.status_id = fe.status_id AND sr.applies_to = 'all'
         {where_clause}
         GROUP BY ccp.id
         ORDER BY ccp.purchase_date DESC"
    );

    let query = sqlx::query_as::<_, CreditCardPurchaseWithProgress>(&sql);
    let query = if let Some(mid) = payment_method_id {
        query.bind(mid)
    } else {
        query
    };

    query.fetch_all(pool).await
}

/// Crea la compra y genera los N eventos de cuota en los períodos correspondientes.
/// Crea los períodos futuros si no existen.
pub async fn create_purchase_with_installments(
    pool: &DbPool,
    input: CreateCreditCardPurchaseInput,
) -> Result<CreditCardPurchase, sqlx::Error> {
    let n = input.installments.max(1);
    let installment =
        calc_installment_amount(input.total_amount_minor, n, input.monthly_interest_rate);
    let total_with_interest = calc_total_with_interest(installment, n);

    // 1. Insertar la compra
    let result = sqlx::query(
        "INSERT INTO credit_card_purchases
             (payment_method_id, title, total_amount_minor, installments,
              interest_type, monthly_interest_rate,
              installment_amount_minor, total_with_interest_minor,
              category_id, purchase_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(input.payment_method_id)
    .bind(&input.title)
    .bind(input.total_amount_minor)
    .bind(n)
    .bind(&input.interest_type)
    .bind(input.monthly_interest_rate)
    .bind(installment)
    .bind(total_with_interest)
    .bind(input.category_id)
    .bind(&input.purchase_date)
    .bind(&input.notes)
    .execute(pool)
    .await?;

    let purchase_id = result.last_insert_rowid();

    // 2. Estado por defecto: buscar por system_key 'pending' (resistente a renombres).
    let status_id: i64 = sqlx::query_as::<_, (i64,)>(
        "SELECT id FROM statuses
         WHERE system_key = 'pending' AND archived_at IS NULL
         LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    .map(|(id,)| id)
    .ok_or_else(|| sqlx::Error::RowNotFound)?;

    // 3. Generar N cuotas en los períodos correspondientes
    let (base_year, base_month, _) = parse_date(&input.purchase_date);
    for i in 0..n {
        let (year, month) = add_months(base_year, base_month, i);
        let period = periods_repo::get_or_create_period(pool, year as i32, month as u32).await?;

        let event_date = format!("{year:04}-{month:02}-01");
        let installment_number = i + 1;

        sqlx::query(
            "INSERT INTO financial_events
                 (period_id, type, title, amount_minor, event_date,
                  status_id, category_id, payment_method_id, exclude_from_total,
                  purchase_id, installment_number)
             VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, 0, ?, ?)",
        )
        .bind(period.id)
        .bind(format!("{} ({}/{})", &input.title, installment_number, n))
        .bind(installment)
        .bind(&event_date)
        .bind(status_id)
        .bind(input.category_id)
        .bind(input.payment_method_id)
        .bind(purchase_id)
        .bind(installment_number)
        .execute(pool)
        .await?;
    }

    // 4. Devolver la compra creada
    sqlx::query_as::<_, CreditCardPurchase>(
        "SELECT id, payment_method_id, title, total_amount_minor, installments,
                interest_type, monthly_interest_rate,
                installment_amount_minor, total_with_interest_minor,
                category_id, purchase_date, notes, created_at
         FROM credit_card_purchases WHERE id = ?",
    )
    .bind(purchase_id)
    .fetch_one(pool)
    .await
}
