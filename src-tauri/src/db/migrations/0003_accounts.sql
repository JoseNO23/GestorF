CREATE TABLE IF NOT EXISTS accounts (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    name                   TEXT    NOT NULL,
    kind                   TEXT    NOT NULL CHECK (kind IN ('asset', 'liability', 'receivable')),
    opening_balance_minor  INTEGER NOT NULL DEFAULT 0,
    archived_at            TEXT
);
