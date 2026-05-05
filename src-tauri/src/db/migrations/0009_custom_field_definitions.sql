CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    field_type  TEXT    NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'list')),
    applies_to  TEXT    NOT NULL CHECK (applies_to IN ('income', 'expense', 'both', 'debt')),
    required    INTEGER NOT NULL DEFAULT 0,
    options_json TEXT,
    archived_at TEXT
);
