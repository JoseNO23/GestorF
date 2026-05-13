-- Compras con tarjeta de crédito en cuotas.
-- Cada cuota genera un financial_event en el período correspondiente.

CREATE TABLE IF NOT EXISTS credit_card_purchases (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_method_id           INTEGER NOT NULL REFERENCES payment_methods(id),
    title                       TEXT    NOT NULL,
    total_amount_minor          INTEGER NOT NULL CHECK (total_amount_minor > 0),
    installments                INTEGER NOT NULL DEFAULT 1 CHECK (installments >= 1),
    interest_type               TEXT    NOT NULL DEFAULT 'none'
                                        CHECK (interest_type IN ('none', 'fixed')),
    monthly_interest_rate       REAL    NOT NULL DEFAULT 0,   -- ej: 0.05 = 5% mensual
    installment_amount_minor    INTEGER NOT NULL,              -- monto por cuota (ya calculado)
    total_with_interest_minor   INTEGER NOT NULL,              -- total final incluyendo intereses
    category_id                 INTEGER REFERENCES categories(id),
    purchase_date               TEXT    NOT NULL,              -- "YYYY-MM-DD" primera cuota
    notes                       TEXT,
    created_at                  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cc_purchases_method ON credit_card_purchases(payment_method_id);

-- Enlace de cada cuota con su compra original
ALTER TABLE financial_events ADD COLUMN purchase_id         INTEGER REFERENCES credit_card_purchases(id);
ALTER TABLE financial_events ADD COLUMN installment_number  INTEGER; -- 1-based (1 = primera cuota)

CREATE INDEX IF NOT EXISTS idx_financial_events_purchase ON financial_events(purchase_id);
