CREATE TABLE IF NOT EXISTS custom_field_values (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id      INTEGER NOT NULL REFERENCES financial_events(id) ON DELETE CASCADE,
    field_id      INTEGER NOT NULL REFERENCES custom_field_definitions(id),
    value_text    TEXT,
    value_number  REAL,
    value_date    TEXT,
    value_boolean INTEGER,
    UNIQUE (event_id, field_id)
);
