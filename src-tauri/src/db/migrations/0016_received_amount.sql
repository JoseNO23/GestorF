-- Separa monto esperado de monto realmente cobrado/pagado.
-- Solo relevante para movimientos de reglas recurrentes.
--
-- expected_amount_minor: monto de la regla al momento de generar el evento
-- received_amount_minor: monto realmente cobrado/pagado (NULL = aún sin confirmar)

ALTER TABLE financial_events ADD COLUMN expected_amount_minor INTEGER;
ALTER TABLE financial_events ADD COLUMN received_amount_minor INTEGER;
