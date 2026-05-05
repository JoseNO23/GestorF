CREATE TABLE IF NOT EXISTS statuses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    color       TEXT    NOT NULL DEFAULT '#6B7280',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT
);
