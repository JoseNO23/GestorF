-- Agrega system_key a statuses para desacoplar lógica interna de nombres visuales.
-- system_key: identificador semántico interno, nunca editable por el usuario.
-- nullable: estados personalizados del usuario no tienen system_key.
-- Índice único parcial: garantiza unicidad solo en valores no nulos.

ALTER TABLE statuses ADD COLUMN system_key TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_statuses_system_key
    ON statuses(system_key) WHERE system_key IS NOT NULL;

-- Asignación defensiva: usa LOWER(name) con múltiples variantes de idioma
-- para ser compatible con diferentes seeds y entornos.
-- NO usa IDs hardcodeados.

UPDATE statuses SET system_key = 'pending'
    WHERE LOWER(name) IN ('pendiente', 'pending')
      AND system_key IS NULL;

UPDATE statuses SET system_key = 'paid'
    WHERE LOWER(name) IN ('pagado', 'paid')
      AND scope IN ('expense', 'both')
      AND system_key IS NULL;

UPDATE statuses SET system_key = 'received'
    WHERE LOWER(name) IN ('cobrado', 'received', 'collected')
      AND scope IN ('income', 'both')
      AND system_key IS NULL;

UPDATE statuses SET system_key = 'received_partial'
    WHERE LOWER(name) IN ('cobrado parcial', 'cobrado_parcial', 'partial', 'parcial')
      AND scope IN ('income', 'both')
      AND system_key IS NULL;

UPDATE statuses SET system_key = 'cancelled'
    WHERE LOWER(name) IN ('cancelado', 'cancelled', 'anulado')
      AND system_key IS NULL;

UPDATE statuses SET system_key = 'overdue'
    WHERE LOWER(name) IN ('vencido', 'overdue')
      AND system_key IS NULL;

UPDATE statuses SET system_key = 'separated'
    WHERE LOWER(name) IN ('separado', 'separated')
      AND system_key IS NULL;
