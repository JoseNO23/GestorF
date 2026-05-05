CREATE TABLE IF NOT EXISTS payment_methods (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    name                 TEXT    NOT NULL,
    kind                 TEXT    NOT NULL CHECK (kind IN ('cash', 'debit', 'credit', 'transfer', 'other')),
    asset_account_id     INTEGER REFERENCES accounts(id),
    liability_account_id INTEGER REFERENCES accounts(id),
    archived_at          TEXT
);
