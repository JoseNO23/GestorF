CREATE TABLE IF NOT EXISTS periods (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    year       INTEGER NOT NULL,
    month      INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    starts_on  TEXT    NOT NULL,
    ends_on    TEXT    NOT NULL,
    closed_at  TEXT,
    UNIQUE (year, month)
);
