-- Datos predeterminados para toda la configuración.
-- INSERT OR IGNORE con IDs explícitos garantiza idempotencia.

-- ── Estados con sus reglas ──────────────────────────────────────────────────
INSERT OR IGNORE INTO statuses (id, name, color, sort_order) VALUES
    (1, 'Pagado',    '#10b981', 1),
    (2, 'Pendiente', '#f59e0b', 2),
    (3, 'Separado',  '#6366f1', 3),
    (4, 'Vencido',   '#ef4444', 4);

INSERT OR IGNORE INTO status_rules
    (status_id, applies_to, counts_as_paid, affects_real, affects_available,
     affects_future, creates_alert, exclude_from_total_default)
VALUES
    (1, 'all', 1, 1, 1, 0, 0, 0),  -- Pagado:    mueve caja real, cuenta como pagado
    (2, 'all', 0, 0, 0, 1, 0, 0),  -- Pendiente: solo afecta proyección futura
    (3, 'all', 0, 0, 1, 1, 0, 0),  -- Separado:  compromete disponible y proyección
    (4, 'all', 0, 0, 1, 1, 1, 0);  -- Vencido:   igual que separado + genera alerta

-- ── Categorías predeterminadas ──────────────────────────────────────────────
INSERT OR IGNORE INTO categories (id, name, color, scope) VALUES
    (1,  'Alimentación',    '#10b981', 'expense'),
    (2,  'Transporte',      '#6366f1', 'expense'),
    (3,  'Servicios',       '#f59e0b', 'expense'),
    (4,  'Salud',           '#ef4444', 'expense'),
    (5,  'Entretenimiento', '#8b5cf6', 'expense'),
    (6,  'Educación',       '#06b6d4', 'expense'),
    (7,  'Ropa y hogar',    '#f97316', 'expense'),
    (8,  'Sueldo',          '#10b981', 'income'),
    (9,  'Freelance',       '#84cc16', 'income'),
    (10, 'Otros ingresos',  '#0ea5e9', 'income');

-- ── Métodos de pago predeterminados ────────────────────────────────────────
INSERT OR IGNORE INTO payment_methods (id, name, kind) VALUES
    (1, 'Efectivo',        'cash'),
    (2, 'Tarjeta débito',  'debit'),
    (3, 'Tarjeta crédito', 'credit'),
    (4, 'Transferencia',   'transfer');
