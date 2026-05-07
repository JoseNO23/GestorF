-- Reglas de movimientos recurrentes (ingresos/gastos fijos).
-- financial_events.recurring_rule_id apunta a la regla que generó el evento.

CREATE TABLE IF NOT EXISTS recurring_rules (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type          TEXT    NOT NULL CHECK (event_type IN ('income', 'expense')),
    title               TEXT    NOT NULL,
    amount_minor        INTEGER NOT NULL CHECK (amount_minor >= 0),
    frequency           TEXT    NOT NULL DEFAULT 'monthly'
                                CHECK (frequency IN ('monthly', 'biweekly', 'weekly', 'custom')),
    day_of_month        INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
    interval_days       INTEGER,
    category_id         INTEGER REFERENCES categories(id),
    payment_method_id   INTEGER REFERENCES payment_methods(id),
    default_status_id   INTEGER REFERENCES statuses(id),
    starts_on           TEXT    NOT NULL,
    ends_on             TEXT,
    remind_days_before  INTEGER,
    notes               TEXT,
    archived_at         TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recurring_rules_type ON recurring_rules(event_type);

ALTER TABLE financial_events
    ADD COLUMN recurring_rule_id INTEGER REFERENCES recurring_rules(id);

CREATE INDEX IF NOT EXISTS idx_financial_events_recurring ON financial_events(recurring_rule_id);
