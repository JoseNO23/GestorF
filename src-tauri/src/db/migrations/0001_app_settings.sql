CREATE TABLE IF NOT EXISTS app_settings (
    id               INTEGER PRIMARY KEY CHECK (id = 1),
    currency_code    TEXT    NOT NULL DEFAULT 'PEN',
    active_period_id INTEGER
);

INSERT OR IGNORE INTO app_settings (id, currency_code) VALUES (1, 'PEN');
