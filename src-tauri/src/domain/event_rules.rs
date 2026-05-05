use std::collections::HashMap;

/// Espejo de la tabla `status_rules`.
/// Los switches determinan cómo impacta un evento — no el nombre del estado.
#[derive(Debug, Clone)]
pub struct StatusRules {
    pub counts_as_paid: bool,
    pub affects_real: bool,
    pub affects_available: bool,
    pub affects_future: bool,
    pub creates_alert: bool,
    pub exclude_from_total_default: bool,
}

/// Espejo del campo `type` en `financial_events`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EventType {
    Income,
    Expense,
    Transfer,
    DebtPayment,
    DebtCharge,
    Receivable,
}

impl EventType {
    /// Parsea desde el string almacenado en SQLite.
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "income" => Ok(EventType::Income),
            "expense" => Ok(EventType::Expense),
            "transfer" => Ok(EventType::Transfer),
            "debt_payment" => Ok(EventType::DebtPayment),
            "debt_charge" => Ok(EventType::DebtCharge),
            "receivable" => Ok(EventType::Receivable),
            other => Err(format!("tipo de evento desconocido: {other}")),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            EventType::Income => "income",
            EventType::Expense => "expense",
            EventType::Transfer => "transfer",
            EventType::DebtPayment => "debt_payment",
            EventType::DebtCharge => "debt_charge",
            EventType::Receivable => "receivable",
        }
    }

    /// Dirección del impacto en los cálculos monetarios.
    /// +1 suma, -1 resta, 0 no mueve caja directamente.
    pub fn sign(self) -> i8 {
        match self {
            EventType::Income => 1,
            EventType::Receivable => 1,
            EventType::Expense => -1,
            EventType::DebtPayment => -1,
            EventType::Transfer => 0,
            EventType::DebtCharge => 0, // la compra TC no mueve caja
        }
    }

    /// Indica si este tipo puede mover dinero real (antes de aplicar reglas de estado).
    pub fn can_affect_real(self) -> bool {
        self.sign() != 0
    }
}

/// Mapa precargado de status_id → StatusRules para evitar N queries por evento.
pub type RulesMap = HashMap<i64, StatusRules>;

// ── Funciones de impacto ────────────────────────────────────────────────────
//
// Cada función responde: "¿este evento debe contar en este cálculo?"
// El `exclude_from_total` ya viene resuelto (considera padre/hijo y el flag del evento).

pub fn should_affect_real(
    event_type: EventType,
    rules: &StatusRules,
    exclude_from_total: bool,
) -> bool {
    if exclude_from_total {
        return false;
    }
    if !event_type.can_affect_real() {
        return false;
    }
    rules.affects_real
}

pub fn should_affect_available(
    event_type: EventType,
    rules: &StatusRules,
    exclude_from_total: bool,
) -> bool {
    if exclude_from_total {
        return false;
    }
    if event_type == EventType::Transfer {
        return false;
    }
    rules.affects_available
}

pub fn should_affect_future(
    event_type: EventType,
    rules: &StatusRules,
    exclude_from_total: bool,
) -> bool {
    if exclude_from_total {
        return false;
    }
    if event_type == EventType::Transfer {
        return false;
    }
    rules.affects_future
}

pub fn should_create_alert(rules: &StatusRules) -> bool {
    rules.creates_alert
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rules(affects_real: bool, affects_available: bool, affects_future: bool) -> StatusRules {
        StatusRules {
            counts_as_paid: false,
            affects_real,
            affects_available,
            affects_future,
            creates_alert: false,
            exclude_from_total_default: false,
        }
    }

    fn rules_alert() -> StatusRules {
        StatusRules {
            counts_as_paid: false,
            affects_real: false,
            affects_available: false,
            affects_future: false,
            creates_alert: true,
            exclude_from_total_default: false,
        }
    }

    // --- EventType::sign() ---

    #[test]
    fn income_signo_positivo() {
        assert_eq!(EventType::Income.sign(), 1);
    }

    #[test]
    fn expense_signo_negativo() {
        assert_eq!(EventType::Expense.sign(), -1);
    }

    #[test]
    fn transfer_no_mueve_caja() {
        assert_eq!(EventType::Transfer.sign(), 0);
        assert!(!EventType::Transfer.can_affect_real());
    }

    #[test]
    fn debt_charge_no_mueve_caja() {
        assert_eq!(EventType::DebtCharge.sign(), 0);
        assert!(!EventType::DebtCharge.can_affect_real());
    }

    // --- should_affect_real ---

    #[test]
    fn ingreso_afecta_real_si_estado_lo_permite() {
        let r = rules(true, false, false);
        assert!(should_affect_real(EventType::Income, &r, false));
    }

    #[test]
    fn gasto_afecta_real_si_estado_lo_permite() {
        let r = rules(true, false, false);
        assert!(should_affect_real(EventType::Expense, &r, false));
    }

    #[test]
    fn estado_sin_affects_real_no_impacta() {
        let r = rules(false, true, true);
        assert!(!should_affect_real(EventType::Income, &r, false));
        assert!(!should_affect_real(EventType::Expense, &r, false));
    }

    #[test]
    fn transfer_nunca_afecta_real() {
        let r = rules(true, true, true);
        assert!(!should_affect_real(EventType::Transfer, &r, false));
    }

    #[test]
    fn debt_charge_nunca_afecta_real() {
        let r = rules(true, true, true);
        assert!(!should_affect_real(EventType::DebtCharge, &r, false));
    }

    #[test]
    fn excluido_nunca_afecta_real() {
        let r = rules(true, true, true);
        assert!(!should_affect_real(EventType::Income, &r, true));
        assert!(!should_affect_real(EventType::Expense, &r, true));
    }

    // --- should_affect_available ---

    #[test]
    fn gasto_afecta_disponible_si_estado_lo_permite() {
        let r = rules(false, true, false);
        assert!(should_affect_available(EventType::Expense, &r, false));
    }

    #[test]
    fn transfer_nunca_afecta_disponible() {
        let r = rules(true, true, true);
        assert!(!should_affect_available(EventType::Transfer, &r, false));
    }

    #[test]
    fn excluido_no_afecta_disponible() {
        let r = rules(true, true, true);
        assert!(!should_affect_available(EventType::Expense, &r, true));
    }

    // --- should_affect_future ---

    #[test]
    fn ingreso_pendiente_afecta_futuro() {
        let r = rules(false, false, true);
        assert!(should_affect_future(EventType::Income, &r, false));
    }

    #[test]
    fn transfer_nunca_afecta_futuro() {
        let r = rules(true, true, true);
        assert!(!should_affect_future(EventType::Transfer, &r, false));
    }

    #[test]
    fn excluido_no_afecta_futuro() {
        let r = rules(true, true, true);
        assert!(!should_affect_future(EventType::Income, &r, true));
    }

    // --- should_create_alert ---

    #[test]
    fn estado_vencido_crea_alerta() {
        let r = rules_alert();
        assert!(should_create_alert(&r));
    }

    #[test]
    fn estado_normal_no_crea_alerta() {
        let r = rules(true, true, true);
        assert!(!should_create_alert(&r));
    }

    // --- parseo de EventType ---

    #[test]
    fn from_str_valido() {
        assert_eq!(EventType::from_str("income").unwrap(), EventType::Income);
        assert_eq!(EventType::from_str("expense").unwrap(), EventType::Expense);
        assert_eq!(EventType::from_str("debt_payment").unwrap(), EventType::DebtPayment);
    }

    #[test]
    fn from_str_invalido_retorna_error() {
        assert!(EventType::from_str("unknown").is_err());
    }
}
