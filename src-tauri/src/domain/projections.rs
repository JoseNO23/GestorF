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
    pub amount_minor: i64, // monto esperado (de la regla o el original)
    pub received_amount_minor: Option<i64>, // monto realmente cobrado (solo ingresos parciales)
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

    /// Monto esperado / nominal. Siempre el valor de la regla o del registro original.
    fn amount(&self) -> Money {
        Money::from_minor(self.amount_minor)
    }

    /// Monto efectivo para cálculos reales:
    /// - Income/Receivable con received_amount_minor: usa lo realmente cobrado.
    /// - Todo lo demás: usa amount_minor.
    fn effective_amount(&self) -> Money {
        if matches!(self.event_type, EventType::Income | EventType::Receivable) {
            if let Some(recv) = self.received_amount_minor {
                return Money::from_minor(recv);
            }
        }
        Money::from_minor(self.amount_minor)
    }

    fn apply_to(&self, total: &mut Money) {
        match self.event_type.sign() {
            1 => *total += self.effective_amount(),
            -1 => *total -= self.effective_amount(),
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
/// Contrato: disponible = real - obligaciones. Los ingresos (Income, Receivable)
/// NUNCA se suman aquí aunque su estado tenga affects_available=true.
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
        // Solo obligaciones (gastos, deudas): los ingresos no reducen disponible
        if matches!(event.event_type, EventType::Income | EventType::Receivable) {
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

/// Total de ingresos realmente cobrados en el período.
/// Usa received_amount_minor cuando está disponible (cobro parcial o completo).
pub fn calc_total_ingresos(events: &[EventForCalc], rules_map: &RulesMap) -> Money {
    let mut total = Money::ZERO;
    for event in events {
        if event.is_excluded() {
            continue;
        }
        if !matches!(event.event_type, EventType::Income | EventType::Receivable) {
            continue;
        }
        let Some(rules) = get_rules(rules_map, event.status_id) else {
            continue;
        };
        // Solo cuenta lo que ya afectó dinero real (cobrado o cobrado parcial)
        if should_affect_real(event.event_type, rules, event.is_excluded()) {
            total += event.effective_amount();
        }
    }
    total
}

/// Total de ingresos esperados del período (excluye cancelados).
/// Representa la proyección: cuánto se espera cobrar en total.
pub fn calc_total_ingresos_esperados(events: &[EventForCalc], rules_map: &RulesMap) -> Money {
    let mut total = Money::ZERO;
    for event in events {
        if event.is_excluded() {
            continue;
        }
        if !matches!(event.event_type, EventType::Income | EventType::Receivable) {
            continue;
        }
        let Some(rules) = get_rules(rules_map, event.status_id) else {
            continue;
        };
        if rules.exclude_from_total_default {
            continue;
        } // excluir cancelados
        total += event.amount(); // siempre el monto esperado
    }
    total
}

/// Total de gastos del período (excluye hijos excluidos, pagos de deuda y cancelados).
/// Usa `rules_map` para excluir estados con `exclude_from_total_default` (ej. "Cancelado").
/// Consistente con el SQL de evolución que aplica el mismo filtro.
pub fn calc_total_gastos(events: &[EventForCalc], rules_map: &RulesMap) -> Money {
    let mut total = Money::ZERO;
    for event in events {
        if event.is_excluded() {
            continue;
        }
        if !matches!(event.event_type, EventType::Expense | EventType::DebtCharge) {
            continue;
        }
        if let Some(rules) = get_rules(rules_map, event.status_id) {
            if rules.exclude_from_total_default {
                continue;
            }
        }
        total += event.amount();
    }
    total
}

/// Cuenta eventos con due_date vencido, no pagados y no cancelados.
/// `today` debe ser "YYYY-MM-DD" — la comparación lexicográfica es correcta con ISO.
/// Excluye estados con `exclude_from_total_default` (cancelados/anulados) que ya
/// no representan obligaciones reales y no deben inflar el badge de alertas.
pub fn count_vencidos(events: &[EventForCalc], rules_map: &RulesMap, today: &str) -> usize {
    events
        .iter()
        .filter(|event| {
            let Some(rules) = get_rules(rules_map, event.status_id) else {
                return false;
            };
            if rules.counts_as_paid || rules.exclude_from_total_default {
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

    fn evento(id: i64, event_type: EventType, amount: i64, status_id: i64) -> EventForCalc {
        EventForCalc {
            id,
            event_type,
            amount_minor: amount,
            received_amount_minor: None,
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
        let total = calc_total_gastos(&events, &rules);
        // Solo cuenta el padre: Netflix está excluido
        assert_eq!(total.to_minor(), 65000);
    }

    #[test]
    fn hijo_tc_excluido_no_afecta_dinero_real() {
        let rules = build_rules_map();
        let padre_id = 10;
        let events = vec![
            evento_tc(padre_id, 65000, PAGADO), // BCP TC S/ 650 (no mueve real)
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
            evento_tc(1, 65000, PAGADO), // compra TC: no mueve real
            evento(2, EventType::DebtPayment, 65000, PAGADO), // pago TC: sí mueve real
        ];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        let total_gastos = calc_total_gastos(&events, &rules);
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

    // ── received_amount_minor — cobro parcial ────────────────────────────────

    // IDs de nuevos estados (alineados con migration 0015)
    const COBRADO: i64 = 5;
    const COBRADO_PARCIAL: i64 = 6;

    fn build_rules_map_ext() -> RulesMap {
        let mut map = build_rules_map();
        map.insert(
            COBRADO,
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
            COBRADO_PARCIAL,
            StatusRules {
                counts_as_paid: false,
                affects_real: true,
                affects_available: true,
                affects_future: true,
                creates_alert: true,
                exclude_from_total_default: false,
            },
        );
        map
    }

    fn evento_parcial(id: i64, expected: i64, received: i64, status_id: i64) -> EventForCalc {
        EventForCalc {
            received_amount_minor: Some(received),
            ..evento(id, EventType::Income, expected, status_id)
        }
    }

    #[test]
    fn cobro_parcial_usa_received_en_dinero_real() {
        let rules = build_rules_map_ext();
        // Sueldo esperado 3000, cobrado 1500
        let events = vec![evento_parcial(1, 300000, 150000, COBRADO_PARCIAL)];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        assert_eq!(real.to_minor(), 150000); // solo lo cobrado
    }

    #[test]
    fn cobro_completo_usa_expected_cuando_no_hay_received() {
        let rules = build_rules_map_ext();
        // Cobrado sin received_amount_minor → usa amount_minor
        let events = vec![evento(1, EventType::Income, 300000, COBRADO)];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        assert_eq!(real.to_minor(), 300000);
    }

    #[test]
    fn total_ingresos_usa_received_no_expected() {
        let rules = build_rules_map_ext();
        let events = vec![
            evento_parcial(1, 300000, 150000, COBRADO_PARCIAL), // cobrado parcial
            evento_parcial(2, 500000, 500000, COBRADO),         // cobrado completo
        ];
        let total = calc_total_ingresos(&events, &rules);
        assert_eq!(total.to_minor(), 650000); // 150k + 500k
    }

    #[test]
    fn total_ingresos_esperados_usa_amount_minor() {
        let rules = build_rules_map_ext();
        let events = vec![
            evento_parcial(1, 300000, 150000, COBRADO_PARCIAL),
            evento_parcial(2, 500000, 500000, COBRADO),
            evento(3, EventType::Income, 200000, PENDIENTE),
        ];
        let esperados = calc_total_ingresos_esperados(&events, &rules);
        assert_eq!(esperados.to_minor(), 1_000_000); // 300k + 500k + 200k
    }

    // ── regresión: disponible no incluye ingresos aunque estado tenga affects_available ──

    #[test]
    fn ingreso_con_affects_available_no_incrementa_disponible() {
        let rules = build_rules_map();
        // SEPARADO tiene affects_available=true; un ingreso NO debe sumarse al disponible
        let events = vec![evento(1, EventType::Income, 100000, SEPARADO)];
        let disp = calc_dinero_disponible(&events, &rules, Money::ZERO);
        assert_eq!(disp.to_minor(), 0);
    }

    #[test]
    fn receivable_con_affects_available_no_incrementa_disponible() {
        let rules = build_rules_map();
        let events = vec![evento(1, EventType::Receivable, 50000, SEPARADO)];
        let disp = calc_dinero_disponible(&events, &rules, Money::ZERO);
        assert_eq!(disp.to_minor(), 0);
    }

    // ── TC — escenarios de pago y deuda ─────────────────────────────────────

    /// Pago TC parcial: solo el monto pagado reduce el dinero real.
    #[test]
    fn pago_tc_parcial_reduce_real_proporcional() {
        let rules = build_rules_map();
        let events = vec![
            evento_tc(1, 100000, PAGADO), // compra S/1000: no mueve real
            evento(2, EventType::DebtPayment, 30000, PAGADO), // pago parcial S/300
        ];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        assert_eq!(real.to_minor(), -30000); // solo el pago reduce real
    }

    /// Pago TC total: dinero real baja exactamente lo que se pagó.
    #[test]
    fn pago_tc_total_reduce_real_en_monto_completo() {
        let rules = build_rules_map();
        let events = vec![
            evento_tc(1, 100000, PAGADO),                      // compra S/1000
            evento(2, EventType::DebtPayment, 100000, PAGADO), // pago total S/1000
        ];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        assert_eq!(real.to_minor(), -100000); // pago completo
    }

    /// Pago mayor a compra TC: dinero real cae más de lo comprado.
    /// El modelo no bloquea esto — es responsabilidad del usuario no sobrepasar.
    #[test]
    fn pago_mayor_a_compra_tc_genera_real_extra_negativo() {
        let rules = build_rules_map();
        let events = vec![
            evento_tc(1, 50000, PAGADO),                      // compra S/500
            evento(2, EventType::DebtPayment, 80000, PAGADO), // pago S/800 (excede)
        ];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        // La compra TC no reduce real, el pago sí: real = -80000
        assert_eq!(real.to_minor(), -80000);
        // El total de gastos solo incluye la compra TC (no el pago)
        let total_gastos = calc_total_gastos(&events, &rules);
        assert_eq!(total_gastos.to_minor(), 50000);
    }

    /// DebtCharge nunca afecta dinero real (sign=0, can_affect_real=false).
    #[test]
    fn debt_charge_no_mueve_real_ni_caja() {
        let rules = build_rules_map();
        let events = vec![evento(1, EventType::DebtCharge, 200000, PAGADO)];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        assert_eq!(real.to_minor(), 0); // DebtCharge no mueve caja
    }

    /// DebtCharge sí cuenta en total_gastos (es un gasto económico).
    #[test]
    fn debt_charge_cuenta_en_total_gastos() {
        let rules = build_rules_map();
        let events = vec![evento(1, EventType::DebtCharge, 200000, PAGADO)];
        let total = calc_total_gastos(&events, &rules);
        assert_eq!(total.to_minor(), 200000);
    }

    /// exclude_from_total=true sin parent_event_id NO excluye el evento.
    /// is_excluded_child() requiere ambas condiciones (AND).
    #[test]
    fn exclude_from_total_sin_padre_no_excluye_el_evento() {
        let rules = build_rules_map();
        let events = vec![EventForCalc {
            id: 1,
            event_type: EventType::Expense,
            amount_minor: 10000,
            received_amount_minor: None,
            status_id: PAGADO,
            method_kind: None,
            parent_event_id: None,    // sin padre
            exclude_from_total: true, // flag marcado (inconsistente)
            due_date: None,
        }];
        // is_excluded_child(None, true) = false → el evento SÍ cuenta
        let total = calc_total_gastos(&events, &rules);
        assert_eq!(total.to_minor(), 10000); // cuenta porque no tiene padre real
    }

    // ── cancelado — regresión de los 3 bugs ─────────────────────────────────

    const CANCELADO: i64 = 7;

    fn build_rules_map_with_cancelado() -> RulesMap {
        let mut map = build_rules_map_ext();
        map.insert(
            CANCELADO,
            StatusRules {
                counts_as_paid: false,
                affects_real: false,
                affects_available: false,
                affects_future: false,
                creates_alert: false,
                exclude_from_total_default: true, // el flag clave
            },
        );
        map
    }

    /// Bug 1 — calc_total_gastos no debe contar gastos cancelados.
    /// Antes: Cancelado contaba porque no se verificaba exclude_from_total_default.
    /// Ahora: se pasa rules_map y se filtra.
    #[test]
    fn gasto_cancelado_no_cuenta_en_total_gastos() {
        let rules = build_rules_map_with_cancelado();
        let events = vec![
            evento(1, EventType::Expense, 30000, PENDIENTE), // activo: S/300
            evento(2, EventType::Expense, 10000, CANCELADO), // cancelado: no debe sumar
        ];
        let total = calc_total_gastos(&events, &rules);
        assert_eq!(total.to_minor(), 30000); // solo el pendiente
    }

    /// Bug 1 — consistencia con evolution SQL: ambos deben excluir cancelados.
    #[test]
    fn gasto_cancelado_no_afecta_total_aunque_tenga_estado_no_pagado() {
        let rules = build_rules_map_with_cancelado();
        let events = vec![evento(1, EventType::Expense, 50000, CANCELADO)];
        let total = calc_total_gastos(&events, &rules);
        assert_eq!(total.to_minor(), 0);
    }

    /// Bug 2 — count_vencidos no debe contar eventos cancelados vencidos.
    /// Antes: Cancelado (counts_as_paid=false) se contaba como vencido.
    #[test]
    fn evento_cancelado_vencido_no_genera_alerta() {
        let rules = build_rules_map_with_cancelado();
        let events = vec![EventForCalc {
            due_date: Some("2026-04-01".to_string()),
            status_id: CANCELADO,
            ..evento(1, EventType::Expense, 10000, CANCELADO)
        }];
        assert_eq!(count_vencidos(&events, &rules, "2026-05-12"), 0);
    }

    /// Bug 2 — ingreso cancelado vencido tampoco debe contar.
    #[test]
    fn ingreso_cancelado_vencido_no_genera_alerta() {
        let rules = build_rules_map_with_cancelado();
        let events = vec![EventForCalc {
            due_date: Some("2026-03-01".to_string()),
            status_id: CANCELADO,
            ..evento(1, EventType::Income, 80000, CANCELADO)
        }];
        assert_eq!(count_vencidos(&events, &rules, "2026-05-12"), 0);
    }

    /// Regresión: gasto vencido no cancelado sí debe seguir contando.
    #[test]
    fn gasto_vencido_activo_sigue_generando_alerta() {
        let rules = build_rules_map_with_cancelado();
        let events = vec![EventForCalc {
            due_date: Some("2026-04-01".to_string()),
            ..evento(1, EventType::Expense, 10000, VENCIDO)
        }];
        assert_eq!(count_vencidos(&events, &rules, "2026-05-12"), 1);
    }

    /// Pago TC pendiente reduce proyección pero no dinero real.
    #[test]
    fn pago_tc_pendiente_reduce_futuro_no_real() {
        let rules = build_rules_map();
        let events = vec![
            evento_tc(1, 100000, PAGADO), // compra TC ya registrada
            evento(2, EventType::DebtPayment, 100000, PENDIENTE), // pago planificado
        ];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        let futuro = calc_dinero_futuro(&events, &rules, Money::ZERO);
        assert_eq!(real.to_minor(), 0); // pago pendiente no afecta real
        assert_eq!(futuro.to_minor(), -100000); // pero sí afecta proyección
    }

    /// Múltiples cuotas TC: cada una no mueve real, el pago de la deuda sí.
    #[test]
    fn cuotas_tc_multiples_no_mueven_real() {
        let rules = build_rules_map();
        // Simula 3 cuotas de S/100 c/u + un pago de S/200 (parcial)
        let events = vec![
            evento_tc(1, 10000, PAGADO),
            evento_tc(2, 10000, PENDIENTE),
            evento_tc(3, 10000, PENDIENTE),
            evento(4, EventType::DebtPayment, 20000, PAGADO), // pago parcial
        ];
        let real = calc_dinero_real(&events, &rules, Money::ZERO);
        let total_gastos = calc_total_gastos(&events, &rules);
        assert_eq!(real.to_minor(), -20000); // solo el pago reduce real
        assert_eq!(total_gastos.to_minor(), 30000); // 3 cuotas de S/100 = gasto económico
    }
}
