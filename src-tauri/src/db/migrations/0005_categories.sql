CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#6B7280',
    scope       TEXT NOT NULL CHECK (scope IN ('income', 'expense', 'both')),
    archived_at TEXT
);
