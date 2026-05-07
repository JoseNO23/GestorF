-- Estados predeterminados con sus reglas.
-- INSERT OR IGNORE con IDs explícitos garantiza idempotencia.

INSERT OR IGNORE INTO statuses (id, name, color, sort_order) VALUES
    (1, 'Pagado',    '#10b981', 1),
    (2, 'Pendiente', '#f59e0b', 2),
    (3, 'Separado',  '#6366f1', 3),
    (4, 'Vencido',   '#ef4444', 4);

INSERT OR IGNORE INTO status_rules
    (status_id, applies_to, counts_as_paid, affects_real, affects_available,
     affects_future, creates_alert, exclude_from_total_default)
VALUES
    (1, 'all', 1, 1, 1, 0, 0, 0),
    (2, 'all', 0, 0, 0, 1, 0, 0),
    (3, 'all', 0, 0, 1, 1, 0, 0),
    (4, 'all', 0, 0, 1, 1, 1, 0);
