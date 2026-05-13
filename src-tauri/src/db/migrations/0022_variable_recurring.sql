-- Soporte para recurrentes de monto variable.
-- amount_type: 'fixed' = el monto se repite igual cada período.
--              'variable' = el monto cambia; el sistema genera un estimado y
--                           solicita confirmación del monto real.
-- requires_amount_confirmation: flag temporal por instancia; se limpia cuando
--                               el usuario confirma el monto real del período.

ALTER TABLE recurring_rules
    ADD COLUMN amount_type TEXT NOT NULL DEFAULT 'fixed'
        CHECK (amount_type IN ('fixed', 'variable'));

ALTER TABLE financial_events
    ADD COLUMN requires_amount_confirmation INTEGER NOT NULL DEFAULT 0;
