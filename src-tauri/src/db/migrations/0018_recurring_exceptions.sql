-- Tabla de excepciones por período para reglas recurrentes.
-- El generador la consulta ANTES de crear un evento: si existe una excepción
-- para (rule_id, period_id), no genera el evento aunque la regla esté activa.
-- Esto protege contra el caso donde el evento fue eliminado manualmente.

CREATE TABLE IF NOT EXISTS recurring_exceptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id    INTEGER NOT NULL,
    period_id  INTEGER NOT NULL,
    reason     TEXT    NOT NULL DEFAULT 'cancelled',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (rule_id, period_id)
);
