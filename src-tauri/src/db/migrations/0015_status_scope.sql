-- Agrega scope a estados para diferenciar ingresos de gastos.
-- scope: 'income' | 'expense' | 'both'

ALTER TABLE statuses ADD COLUMN scope TEXT NOT NULL DEFAULT 'both'
    CHECK (scope IN ('income', 'expense', 'both'));

-- Asignar scope correcto a los estados predeterminados
UPDATE statuses SET scope = 'expense' WHERE id = 1; -- Pagado
UPDATE statuses SET scope = 'both'    WHERE id = 2; -- Pendiente
UPDATE statuses SET scope = 'expense' WHERE id = 3; -- Separado
UPDATE statuses SET scope = 'both'    WHERE id = 4; -- Vencido

-- Nuevos estados específicos de ingreso
INSERT OR IGNORE INTO statuses (id, name, color, sort_order, scope) VALUES
    (5, 'Cobrado',         '#10b981', 5, 'income'),
    (6, 'Cobrado parcial', '#84cc16', 6, 'income'),
    (7, 'Cancelado',       '#64748b', 7, 'both');

-- Reglas para los nuevos estados
-- Cobrado: dinero recibido → afecta real y disponible
INSERT OR IGNORE INTO status_rules
    (status_id, applies_to, counts_as_paid, affects_real,
     affects_available, affects_future, creates_alert, exclude_from_total_default)
VALUES
    (5, 'all', 1, 1, 1, 0, 0, 0),
    -- Cobrado parcial: afecta real pero alerta + sigue en futuro
    (6, 'all', 0, 1, 1, 1, 1, 0),
    -- Cancelado: excluido de totales, no afecta nada
    (7, 'all', 0, 0, 0, 0, 0, 1);
