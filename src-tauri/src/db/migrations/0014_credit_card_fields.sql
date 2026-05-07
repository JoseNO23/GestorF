-- Campos adicionales para tarjetas de crédito en payment_methods.
-- Solo relevantes cuando kind = 'credit'.

ALTER TABLE payment_methods ADD COLUMN credit_limit_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payment_methods ADD COLUMN cut_day            INTEGER;   -- día del mes de corte (1-31)
ALTER TABLE payment_methods ADD COLUMN payment_due_day    INTEGER;   -- día del mes límite de pago (1-31)
