CREATE TABLE IF NOT EXISTS financial_events (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id            INTEGER NOT NULL REFERENCES periods(id),
    type                 TEXT    NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'debt_payment', 'debt_charge', 'receivable')),
    title                TEXT    NOT NULL,
    amount_minor         INTEGER NOT NULL CHECK (amount_minor >= 0),
    event_date           TEXT    NOT NULL,
    due_date             TEXT,
    status_id            INTEGER NOT NULL REFERENCES statuses(id),
    category_id          INTEGER REFERENCES categories(id),
    payment_method_id    INTEGER REFERENCES payment_methods(id),
    source_account_id    INTEGER REFERENCES accounts(id),
    target_account_id    INTEGER REFERENCES accounts(id),
    liability_account_id INTEGER REFERENCES accounts(id),
    parent_event_id      INTEGER REFERENCES financial_events(id),
    exclude_from_total   INTEGER NOT NULL DEFAULT 0,
    notes                TEXT,
    created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_financial_events_period ON financial_events(period_id);
CREATE INDEX IF NOT EXISTS idx_financial_events_status ON financial_events(status_id);
CREATE INDEX IF NOT EXISTS idx_financial_events_parent ON financial_events(parent_event_id);
