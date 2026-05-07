use crate::domain::{
    credit_card::{is_credit_purchase, is_excluded_child, PaymentMethodKind},
    event_rules::{
        should_affect_available, should_affect_future, should_affect_real, EventType, RulesMap,
        StatusRules,
    },
    money::Money,
};

/// Representación de un evento financiero para cálculos de dominio.
/// Solo contiene los campos necesarios para las fórmulas financieras.
/// El repositorio construye este struct al cargar eventos de SQLite.
#[derive(Debug, Clone)]
pub struct EventForCalc {
    pub id: i64,
    pub event_type: EventType,
    pub amount_minor: i64,
    pub status_id: i64,
    pub method_kind: Option<PaymentMethodKind>,
    pub parent_event_id: Option<i64>,
    pub exclude_from_total: bool,
    pub due_date: Option<String>, // "YYYY-MM-DD" — ISO ordena lexicográficamente
}

impl EventForCalc {
    fn is_excluded(&self) -> bool {
        is_excluded_child(self.parent_event_id, self.exclude_from_total)
    }

    fn is_credit_purchase(&self) -> bool {
        is_credit_purchase(self.event_type, self.method_kind)
    }

    fn amount(&self) -> Money {
        Money::from_minor(self.amount_minor)
    }

    fn apply_to(&self, total: &mut Money) {
        match self.event_type.sign() {
            1 => *total += self.amount(),
            -1 => *total -= self.amount(),
            _ => {}
        }
    }
}

fn get_rules<'a>(rules_map: &'a RulesMap, status_id: i64) -> Option<&'a StatusRules> {
    rules_map.get(&status_id)
}

// ── Funciones de cálculo ────────────────────────────────────────────────────

/// Dinero real: efectivo realizado en el período.
/// opening_balance = saldo inicial de cuentas asset del usuario.
pub fn calc_dinero_real(
    events: &[EventForCalc],
    rules_map: &RulesMap,
    opening_balance: Money,
) -> Money {
    let mut total = opening_balance;
    for event in events {
        if event.is_credit_purchase() {
            continue; // compra con TC no mueve caja
        }
        let Some(rules) = get_rules(rules_map, event.status_id) else {
            continue;
        };
        if should_affect_real(event.event_type, rules, event.is_excluded()) {
            event.apply_to(&mut total);
        }
    }
    total
}

/// Dinero disponible: dinero real menos compromisos pendientes.
/// No incluye ingresos pendientes — solo resta obligaciones no liquidadas.
pub fn calc_dinero_disponible(
    events: &[EventForCalc],
    rules_map: &RulesMap,
    opening_balance: Money,
) -> Money {
    let mut total = calc_dinero_real(events, rules_map, opening_balance);
    for event in events {
        let Some(rules) = get_rules(rules_map, event.status_id) else {
            continue;
        };
        // Saltar eventos ya contados en dinero real
        if rules.affects_real || rules.counts_as_paid {
            continue;
        }
        if should_affect_available(event.event_type, rules, event.is_excluded()) {
            event.apply_to(&mut total);
        }
    }
    total
}

/// Dinero futuro: proyección del período completo.
/// Incluye movimientos pendientes que afectan la proyección.
pub fn calc_dinero_futuro(
    events: &[EventForCalc],
    rules_map: &RulesMap,
    opening_balance: Money,
) -> Money {
    let mut total = calc_dinero_real(events, rules_map, opening_balance);
    for event in events {
        let Some(rules) = get_rules(rules_map, event.status_id) else {
            continue;
        };
        // Saltar eventos ya contados en dinero real
        if rules.affects_real || rules.counts_as_paid {
            continue;
        }
        if should_affect_future(event.event_type, rules, event.is_excluded()) {
            event.apply_to(&mut total);
        }
    }
    total
}

/// Total de ingresos del período (excluye hijos marcados como excluidos).
pub fn calc_total_ingresos(events: &[EventForCalc]) -> Money {
    let mut total = Money::ZERO;
    for event in events {
        if event.is_excluded() {
            continue;
        }
        if matches!(event.event_type, EventType::Income | EventType::Receivable) {
            total += event.amount();
        }
    }
    total
}

/// Total de gastos del período (excluye hijos excluidos y pagos de deuda).
pub fn calc_total_gastos(events: &[EventForCalc]) -> Money {
    let mut total = Money::ZERO;
    for event in events {
        if event.is_excluded() {
            continue;
        }
        if matches!(event.event_type, EventType::Expense | EventType::DebtCharge) {
            total += event.amount();
        }
    }
    total
}

/// Cuenta eventos con due_date vencido y no pagados.
/// `today` debe ser "YYYY-MM-DD" — la comparación lexicográfica es correcta con ISO.
pub fn count_vencidos(events: &[EventForCalc], rules_map: &RulesMap, today: &str) -> usize {
    events
        .iter()
        .filter(|event| {
            let Some(rules) = get_rules(rules_map, event.status_id) else {
                return false;
            };
            if rules.counts_as_paid {
                return false;
            }
            event
                .due_date
                .as_deref()
                .map(|due| due < today)
                .unwrap_or(false)
        })
        .count()
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    // IDs de estados fijos para los tests
    const PAGADO: i64 = 1;
    const PENDIENTE: i64 = 2;
    const SEPARADO: i64 = 3;
    const VENCIDO: i64 = 4;

    fn build_rules_map() -> RulesMap {
        let mut map = HashMap::new();
        map.insert(
            PAGADO,
            StatusRules {
                counts_as_paid: true,
                affects_real: true,
                affects_available: true,
                affects_future: false,
                creates_alert: false,
                exclude_from_total_default: false,
            },
        );
        map.insert(
            PENDIENTE,
            StatusRules {
                counts_as_paid: false,
                affects_real: false,
                affects_available: false,
                affects_future: true,
                creates_alert: false,
                exclude_from_total_default: false,
            },
        );
        map.insert(
            SEPARADO,
            StatusRules {
                counts_as_paid: false,
                affects_real: false,
                affects_available: true,
                affects_future: true,
                creates_alert: false,
                exclude_from_total_default: false,
            },
        );
        map.insert(
            VENCIDO,
            StatusRules {
                counts_as_paid: false,
                affects_real: false,
                affects_available: true,
                affects_future: true,
                creates_alert: true,
                exclude_from_total_default: false,
            },
        );
        map
    }

    fn evento(
        id: i64,
        event_type: EventType,
        amount: i64,
        status_id: i64,
    ) -> EventForCalc {
        EventForCalc {
            id,
            event_type,
            amount_minor: amount,
            status_id,
            method_kind: None,
            parent_event_id: None,
            exclude_from_total: false,
            due_date: None,
        }
    }

    fn evento_tc(id: i64, amount: i64, status_id: i64) -> EventForCalc {
        EventForCalc {
            method_kind: Some(PaymentMethodKind::Credit),
            ..evento(id, EventType::Expense, amount, status_id)
        }
    }

    fn evento_hijo(id: i64, amount: i64, status_id: i64, parent: i64) -> EventForCalc {
        EventForCalc {
            parent_event_id: Some(parent),
            exclude_from_total: true,
            ..evento(id, EventType::Expense, amount, status_id)
        }
    }

    fn evento_vencido(id: i64, amount: i64, due: &str) -> EventForCalc {
        EventForCalc {
            due_date: Some(due.to_string()),
            ..evento(id, EventType::Expense, amount, VENCIDO)
        }
    }

    // ── dinero real ──────────────────────────────────────────────────────────

    #[test]
    fn ingreso_pagado_aumenta_dinero_real() {
        let rules = build_rules_map();
        let events = vec![evento(1, EventType::Income, 50000, PAGADO)]; // S/ 500
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        assert_eq!(real.to_minor(), 50000);
    }

    #[test]
    fn gasto_pagado_reduce_dinero_real() {
        let rules = build_rules_map();
        let events = vec![evento(1, EventType::Expense, 20000, PAGADO)]; // S/ 200
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        assert_eq!(real.to_minor(), -20000);
    }

    #[test]
    fn gasto_pendiente_no_afecta_real() {
        let rules = build_rules_map();
        let events = vec![evento(1, EventType::Expense, 20000, PENDIENTE)];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        assert_eq!(real.to_minor(), 0);
    }

    #[test]
    fn compra_tc_no_reduce_dinero_real() {
        let rules = build_rules_map();
        let events = vec![evento_tc(1, 65000, PAGADO)]; // S/ 650 con TC
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        assert_eq!(real.to_minor(), 0); // TC no mueve caja
    }

    #[test]
    fn pago_tc_reduce_dinero_real() {
        let rules = build_rules_map();
        let events = vec![evento(1, EventType::DebtPayment, 65000, PAGADO)];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        assert_eq!(real.to_minor(), -65000);
    }

    #[test]
    fn opening_balance_se_incluye_en_real() {
        let rules = build_rules_map();
        let events = vec![evento(1, EventType::Income, 10000, PAGADO)];
        let real = calc_dinero_real(&events, &rules, Money::from_minor(100000));
        assert_eq!(real.to_minor(), 110000);
    }

    // ── dinero disponible ────────────────────────────────────────────────────

    #[test]
    fn gasto_separado_reduce_disponible() {
        let rules = build_rules_map();
        let events = vec![evento(1, EventType::Expense, 5000, SEPARADO)]; // S/ 50
        let disp = calc_dinero_disponible(&events, &rules, Money::ZERO);
        assert_eq!(disp.to_minor(), -5000);
    }

    #[test]
    fn disponible_no_incluye_ingresos_pendientes() {
        let rules = build_rules_map();
        let events = vec![
            evento(1, EventType::Income, 100000, PENDIENTE), // S/ 1000 pendiente
        ];
        let disp = calc_dinero_disponible(&events, &rules, Money::ZERO);
        // Ingresos pendientes NO suman al disponible (solo real + compromisos)
        assert_eq!(disp.to_minor(), 0);
    }

    #[test]
    fn gasto_pagado_ya_en_real_no_se_descuenta_de_nuevo() {
        let rules = build_rules_map();
        let events = vec![evento(1, EventType::Expense, 10000, PAGADO)];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        let disp = calc_dinero_disponible(&events, &rules, Money::ZERO);
        // Mismo valor: el gasto pagado ya está en real, no se descuenta dos veces
        assert_eq!(real, disp);
    }

    // ── dinero futuro ────────────────────────────────────────────────────────

    #[test]
    fn gasto_pendiente_afecta_futuro_no_real() {
        let rules = build_rules_map();
        let events = vec![evento(1, EventType::Expense, 30000, PENDIENTE)];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        let futuro = calc_dinero_futuro(&events, &rules, Money::ZERO);
        assert_eq!(real.to_minor(), 0);
        assert_eq!(futuro.to_minor(), -30000);
    }

    #[test]
    fn ingreso_pendiente_afecta_futuro() {
        let rules = build_rules_map();
        let events = vec![evento(1, EventType::Income, 80000, PENDIENTE)];
        let futuro = calc_dinero_futuro(&events, &rules, Money::ZERO);
        assert_eq!(futuro.to_minor(), 80000);
    }

    // ── hijo TC excluido ─────────────────────────────────────────────────────

    #[test]
    fn hijo_tc_excluido_no_duplica_total_gastos() {
        let rules = build_rules_map();
        // BCP S/ 650 (padre) + Netflix S/ 35 (hijo excluido)
        let padre_id = 10;
        let events = vec![
            evento(padre_id, EventType::Expense, 65000, PAGADO),
            evento_hijo(11, 3500, PAGADO, padre_id),
        ];
        let total = calc_total_gastos(&events);
        // Solo cuenta el padre: Netflix está excluido
        assert_eq!(total.to_minor(), 65000);
    }

    #[test]
    fn hijo_tc_excluido_no_afecta_dinero_real() {
        let rules = build_rules_map();
        let padre_id = 10;
        let events = vec![
            evento_tc(padre_id, 65000, PAGADO),      // BCP TC S/ 650 (no mueve real)
            evento_hijo(11, 3500, PAGADO, padre_id), // Netflix excluido
        ];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        // Ni el padre TC ni el hijo excluido mueven dinero real
        assert_eq!(real.to_minor(), 0);
    }

    #[test]
    fn pago_tc_reduce_real_sin_duplicar_gasto() {
        let rules = build_rules_map();
        let events = vec![
            evento_tc(1, 65000, PAGADO),                   // compra TC: no mueve real
            evento(2, EventType::DebtPayment, 65000, PAGADO), // pago TC: sí mueve real
        ];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        let total_gastos = calc_total_gastos(&events);
        assert_eq!(real.to_minor(), -65000); // solo el pago reduce real
        assert_eq!(total_gastos.to_minor(), 65000); // la compra TC cuenta como gasto económico
    }

    // ── vencidos ─────────────────────────────────────────────────────────────

    #[test]
    fn gasto_vencido_es_contado() {
        let rules = build_rules_map();
        let events = vec![evento_vencido(1, 10000, "2026-04-01")];
        assert_eq!(count_vencidos(&events, &rules, "2026-05-04"), 1);
    }

    #[test]
    fn gasto_futuro_no_es_vencido() {
        let rules = build_rules_map();
        let events = vec![evento_vencido(1, 10000, "2026-12-01")];
        assert_eq!(count_vencidos(&events, &rules, "2026-05-04"), 0);
    }

    #[test]
    fn gasto_pagado_no_es_vencido() {
        let rules = build_rules_map();
        let mut e = evento_vencido(1, 10000, "2026-04-01");
        e.status_id = PAGADO; // pagado → counts_as_paid=true → no vence
        assert_eq!(count_vencidos(&[e], &rules, "2026-05-04"), 0);
    }
}
