-- Estado persistido de notificaciones (leído / resuelto).
-- Las notificaciones en sí se generan dinámicamente desde los datos financieros;
-- esta tabla solo guarda la interacción del usuario con cada una.

CREATE TABLE IF NOT EXISTS notification_state (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    notif_type  TEXT    NOT NULL,   -- income_overdue, expense_due, credit_card_due, etc.
    source_type TEXT    NOT NULL,   -- event | payment_method
    source_id   INTEGER NOT NULL,
    read_at     TEXT,               -- NULL = no leída
    resolved_at TEXT,               -- NULL = no resuelta
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (notif_type, source_type, source_id)
);
