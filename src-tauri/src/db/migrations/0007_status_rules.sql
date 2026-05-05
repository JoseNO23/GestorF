CREATE TABLE IF NOT EXISTS status_rules (
    status_id                 INTEGER NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
    applies_to                TEXT    NOT NULL CHECK (applies_to IN ('income', 'expense', 'debt', 'all')),
    counts_as_paid            INTEGER NOT NULL DEFAULT 0,
    affects_real              INTEGER NOT NULL DEFAULT 0,
    affects_available         INTEGER NOT NULL DEFAULT 0,
    affects_future            INTEGER NOT NULL DEFAULT 1,
    creates_alert             INTEGER NOT NULL DEFAULT 0,
    exclude_from_total_default INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (status_id, applies_to)
);
