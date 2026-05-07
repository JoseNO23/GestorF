-- Categorías y métodos de pago predeterminados.
-- Separados en migración propia para no invalidar el checksum de 0011.

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

INSERT OR IGNORE INTO payment_methods (id, name, kind) VALUES
    (1, 'Efectivo',        'cash'),
    (2, 'Tarjeta débito',  'debit'),
    (3, 'Tarjeta crédito', 'credit'),
    (4, 'Transferencia',   'transfer');
