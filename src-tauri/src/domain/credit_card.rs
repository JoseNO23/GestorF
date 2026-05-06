use crate::domain::event_rules::EventType;

/// Espejo del campo `kind` en `payment_methods`.
/// El tipo interno es fijo; el nombre lo elige el usuario.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentMethodKind {
    Cash,
    Debit,
    Credit,
    Transfer,
    Other,
}

impl PaymentMethodKind {
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "cash" => Ok(PaymentMethodKind::Cash),
            "debit" => Ok(PaymentMethodKind::Debit),
            "credit" => Ok(PaymentMethodKind::Credit),
            "transfer" => Ok(PaymentMethodKind::Transfer),
            "other" => Ok(PaymentMethodKind::Other),
            other => Err(format!("tipo de método de pago desconocido: {other}")),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            PaymentMethodKind::Cash => "cash",
            PaymentMethodKind::Debit => "debit",
            PaymentMethodKind::Credit => "credit",
            PaymentMethodKind::Transfer => "transfer",
            PaymentMethodKind::Other => "other",
        }
    }

    pub fn is_credit(self) -> bool {
        self == PaymentMethodKind::Credit
    }
}

// ── Reglas TC ───────────────────────────────────────────────────────────────

/// Compra con TC: gasto económico que NO reduce dinero real.
/// Solo gastos (Expense) con método de tipo crédito califican.
/// El impacto en `affects_real` se anula en projections.rs al detectar esto.
pub fn is_credit_purchase(
    event_type: EventType,
    method_kind: Option<PaymentMethodKind>,
) -> bool {
    event_type == EventType::Expense
        && method_kind.map(|k| k.is_credit()).unwrap_or(false)
}

/// Pago de deuda/TC: reduce dinero real pero NO es un nuevo gasto económico.
/// Evita contar dos veces: una como gasto y otra como pago.
pub fn is_debt_payment(event_type: EventType) -> bool {
    event_type == EventType::DebtPayment
}

/// Hijo excluido del total: aparece en la tabla como detalle pero no suma al período.
/// Requiere padre explícito Y `exclude_from_total = true`.
pub fn is_excluded_child(parent_event_id: Option<i64>, exclude_from_total: bool) -> bool {
    parent_event_id.is_some() && exclude_from_total
}

/// Valida que un evento no sea su propio padre.
/// La validación de anidamiento profundo (nieto) ocurre en el repositorio,
/// donde se puede consultar el árbol completo.
pub fn validate_parent_child(event_id: i64, parent_id: i64) -> Result<(), String> {
    if event_id == parent_id {
        return Err(format!(
            "el evento {event_id} no puede ser su propio padre"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::event_rules::EventType;

    // ── PaymentMethodKind ──

    #[test]
    fn parsea_tipos_de_metodo() {
        assert_eq!(PaymentMethodKind::from_str("cash").unwrap(), PaymentMethodKind::Cash);
        assert_eq!(PaymentMethodKind::from_str("debit").unwrap(), PaymentMethodKind::Debit);
        assert_eq!(PaymentMethodKind::from_str("credit").unwrap(), PaymentMethodKind::Credit);
        assert_eq!(PaymentMethodKind::from_str("transfer").unwrap(), PaymentMethodKind::Transfer);
        assert_eq!(PaymentMethodKind::from_str("other").unwrap(), PaymentMethodKind::Other);
    }

    #[test]
    fn tipo_invalido_retorna_error() {
        assert!(PaymentMethodKind::from_str("bitcoin").is_err());
        assert!(PaymentMethodKind::from_str("").is_err());
    }

    #[test]
    fn roundtrip_as_str() {
        assert_eq!(PaymentMethodKind::Credit.as_str(), "credit");
        assert_eq!(PaymentMethodKind::Cash.as_str(), "cash");
    }

    // ── is_credit_purchase ──

    #[test]
    fn gasto_con_credito_es_compra_tc() {
        assert!(is_credit_purchase(
            EventType::Expense,
            Some(PaymentMethodKind::Credit)
        ));
    }

    #[test]
    fn gasto_con_efectivo_no_es_tc() {
        assert!(!is_credit_purchase(
            EventType::Expense,
            Some(PaymentMethodKind::Cash)
        ));
    }

    #[test]
    fn ingreso_con_credito_no_es_compra_tc() {
        // TC solo aplica a gastos
        assert!(!is_credit_purchase(
            EventType::Income,
            Some(PaymentMethodKind::Credit)
        ));
    }

    #[test]
    fn gasto_sin_metodo_no_es_tc() {
        assert!(!is_credit_purchase(EventType::Expense, None));
    }

    #[test]
    fn debt_payment_no_es_compra_tc() {
        assert!(!is_credit_purchase(
            EventType::DebtPayment,
            Some(PaymentMethodKind::Credit)
        ));
    }

    // ── is_debt_payment ──

    #[test]
    fn tipo_debt_payment_es_pago() {
        assert!(is_debt_payment(EventType::DebtPayment));
    }

    #[test]
    fn gasto_normal_no_es_pago_de_deuda() {
        assert!(!is_debt_payment(EventType::Expense));
        assert!(!is_debt_payment(EventType::Income));
    }

    // ── is_excluded_child ──

    #[test]
    fn hijo_con_padre_y_excluido_no_suma() {
        // Caso Netflix bajo Tarjeta BCP
        assert!(is_excluded_child(Some(42), true));
    }

    #[test]
    fn hijo_con_padre_pero_no_excluido_si_suma() {
        // Tiene padre pero no está marcado como excluido
        assert!(!is_excluded_child(Some(42), false));
    }

    #[test]
    fn evento_sin_padre_no_es_hijo() {
        assert!(!is_excluded_child(None, true));
        assert!(!is_excluded_child(None, false));
    }

    // ── validate_parent_child ──

    #[test]
    fn evento_no_puede_ser_su_propio_padre() {
        assert!(validate_parent_child(5, 5).is_err());
    }

    #[test]
    fn padre_distinto_es_valido() {
        assert!(validate_parent_child(10, 3).is_ok());
        assert!(validate_parent_child(1, 99).is_ok());
    }
}
