import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, RotateCcw, ToggleLeft, ToggleRight } from 'lucide-react';
import * as cmd from '../../../domain-client/commands';
import type { RecurringRule } from '../../../domain-client/types';
import { formatMoney, parseMoneyInput } from '../../../utils/money';
import Modal from '../../../components/Modal/Modal';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const FREQ_LABELS: Record<string, string> = {
  monthly: 'Mensual', biweekly: 'Quincenal', weekly: 'Semanal', custom: 'Personalizada',
};

const TYPE_COLORS: Record<string, string> = {
  income: 'bg-emerald-100 text-emerald-700',
  expense: 'bg-red-100 text-red-700',
};

const today = () => new Date().toISOString().slice(0, 10);

function freqSummary(rule: RecurringRule) {
  if (rule.frequency === 'monthly') return `${FREQ_LABELS.monthly} · día ${rule.day_of_month ?? '?'}`;
  if (rule.interval_days) return `Cada ${rule.interval_days} días`;
  return FREQ_LABELS[rule.frequency];
}

// ─────────────────────────────────────────────────────────────────────────────
// Formulario completo — usado en modal de crear y editar
// ─────────────────────────────────────────────────────────────────────────────
interface RuleFormData {
  event_type: string;
  title: string;
  amount: string;
  frequency: string;
  day_of_month: string;
  interval_days: string;
  category_id: string;
  payment_method_id: string;
  default_status_id: string;
  starts_on: string;
  ends_on: string;
  remind_days_before: string;
  notes: string;
}

function emptyForm(rule?: RecurringRule, defaultType?: string): RuleFormData {
  if (!rule) {
    return {
      event_type: defaultType ?? 'expense', title: '', amount: '', frequency: 'monthly',
      day_of_month: '1', interval_days: '14', category_id: '', payment_method_id: '',
      default_status_id: '', starts_on: today(), ends_on: '', remind_days_before: '', notes: '',
    };
  }
  return {
    event_type: rule.event_type,
    title: rule.title,
    amount: (rule.amount_minor / 100).toFixed(2),
    frequency: rule.frequency,
    day_of_month: rule.day_of_month?.toString() ?? '1',
    interval_days: rule.interval_days?.toString() ?? '14',
    category_id: rule.category_id?.toString() ?? '',
    payment_method_id: rule.payment_method_id?.toString() ?? '',
    default_status_id: rule.default_status_id?.toString() ?? '',
    starts_on: rule.starts_on,
    ends_on: rule.ends_on ?? '',
    remind_days_before: rule.remind_days_before?.toString() ?? '',
    notes: rule.notes ?? '',
  };
}

function RecurringRuleModal({
  rule, onClose, lockedType,
}: {
  rule?: RecurringRule;
  onClose: () => void;
  lockedType?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<RuleFormData>(() => emptyForm(rule, lockedType));
  const [error, setError] = useState('');

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: cmd.listCategories });
  const { data: methods = [] } = useQuery({ queryKey: ['payment-methods'], queryFn: cmd.listPaymentMethods });
  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: cmd.listStatusesWithRules });

  const isIncome = form.event_type === 'income';
  const isMonthly = form.frequency === 'monthly';

  const pendienteStatus = statuses.find(
    (sw) => sw.status.system_key === 'pending' && !sw.status.archived_at
  )?.status;

  // Statuses disponibles para el tipo de evento
  const availableStatuses = statuses
    .filter((sw) => !sw.status.archived_at && sw.status.scope !== (isIncome ? 'expense' : 'income'))
    .map((sw) => sw.status);

  const set = (k: keyof RuleFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('El título es obligatorio');
      const amountMinor = parseMoneyInput(form.amount);
      if (amountMinor <= 0) throw new Error('El monto debe ser mayor a 0');
      if (!form.starts_on) throw new Error('La fecha de inicio es obligatoria');
      if (isMonthly && (!form.day_of_month || Number(form.day_of_month) < 1))
        throw new Error('El día del mes es obligatorio (1–31)');
      if (!isMonthly && (!form.interval_days || Number(form.interval_days) < 1))
        throw new Error('El intervalo de días es obligatorio');

      const input = {
        event_type: form.event_type,
        title: form.title.trim(),
        amount_minor: amountMinor,
        frequency: form.frequency,
        day_of_month: isMonthly ? Number(form.day_of_month) : undefined,
        interval_days: !isMonthly ? Number(form.interval_days) : undefined,
        category_id: form.category_id ? Number(form.category_id) : undefined,
        payment_method_id: form.payment_method_id ? Number(form.payment_method_id) : undefined,
        // Ingresos: siempre Pendiente; Gastos: según selección del usuario
        default_status_id: isIncome
          ? pendienteStatus?.id
          : form.default_status_id ? Number(form.default_status_id) : undefined,
        starts_on: form.starts_on,
        ends_on: form.ends_on || undefined,
        remind_days_before: !isIncome && form.remind_days_before
          ? Number(form.remind_days_before) : undefined,
        notes: form.notes.trim() || undefined,
      };

      if (rule) {
        await cmd.updateRecurringRule(rule.id, input);
      } else {
        await cmd.createRecurringRule(input);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-rules'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const f = 'w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const l = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(''); saveMutation.mutate(); }} className="space-y-4">
      {/* Tipo */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Tipo *</label>
          {lockedType ? (
            <div className={`${f} bg-slate-50 text-slate-500 cursor-default flex items-center gap-2`}>
              {lockedType === 'income' ? '↑ Ingreso recurrente' : '↓ Gasto recurrente'}
            </div>
          ) : (
            <select value={form.event_type} onChange={set('event_type')} className={f}>
              <option value="expense">Gasto recurrente</option>
              <option value="income">Ingreso recurrente</option>
            </select>
          )}
        </div>
        <div>
          <label className={l}>Título *</label>
          <input required autoFocus value={form.title} onChange={set('title')}
            placeholder={isIncome ? 'Ej: Sueldo mensual' : 'Ej: Alquiler'} className={f} />
        </div>
      </div>

      {/* Monto + Categoría */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Monto (S/) *</label>
          <input required type="number" min="0.01" step="0.01" value={form.amount}
            onChange={set('amount')} placeholder="0.00" className={f} />
        </div>
        <div>
          <label className={l}>Categoría</label>
          <select value={form.category_id} onChange={set('category_id')} className={f}>
            <option value="">— Ninguna —</option>
            {categories
              .filter((c) => !c.archived_at && c.scope !== (isIncome ? 'expense' : 'income'))
              .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Método + Recordatorio (solo gastos) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>{isIncome ? 'Método de cobro' : 'Método de pago'}</label>
          <select value={form.payment_method_id} onChange={set('payment_method_id')} className={f}>
            <option value="">— Ninguno —</option>
            {methods.filter((m) => !m.archived_at).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        {!isIncome && (
          <div>
            <label className={l}>Recordar antes (días)</label>
            <input type="number" min="0" value={form.remind_days_before}
              onChange={set('remind_days_before')} placeholder="Sin recordatorio" className={f} />
          </div>
        )}
      </div>

      {/* Frecuencia + Día */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Frecuencia *</label>
          <select value={form.frequency} onChange={set('frequency')} className={f}>
            <option value="monthly">Mensual</option>
            <option value="biweekly">Quincenal (14 días)</option>
            <option value="weekly">Semanal (7 días)</option>
            <option value="custom">Personalizada</option>
          </select>
        </div>
        {isMonthly ? (
          <div>
            <label className={l}>{isIncome ? 'Día esperado de cobro *' : 'Día límite de pago *'}</label>
            <input required type="number" min="1" max="31" value={form.day_of_month}
              onChange={set('day_of_month')} className={f} />
          </div>
        ) : (
          <div>
            <label className={l}>Cada cuántos días *</label>
            <input required type="number" min="1" value={form.interval_days}
              onChange={set('interval_days')} className={f} />
          </div>
        )}
      </div>

      {/* Estado inicial */}
      <div>
        <label className={l}>Estado inicial al generar</label>
        {isIncome ? (
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span><strong>Pendiente</strong> — automático para ingresos. Cámbialo a Cobrado cuando lo recibas.</span>
          </div>
        ) : (
          <select value={form.default_status_id} onChange={set('default_status_id')} className={f}>
            <option value="">— Pendiente (automático) —</option>
            {availableStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Inicio *</label>
          <input required type="date" value={form.starts_on} onChange={set('starts_on')} className={f} />
        </div>
        <div>
          <label className={l}>Fin (opcional)</label>
          <input type="date" value={form.ends_on} onChange={set('ends_on')} className={f} />
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className={l}>Notas</label>
        <textarea value={form.notes} onChange={set('notes')} rows={2}
          placeholder="Opcional..." className={`${f} resize-none`} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose}
          className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancelar</button>
        <button type="submit" disabled={saveMutation.isPending}
          className="text-sm bg-indigo-600 text-white rounded px-5 py-1.5 hover:bg-indigo-700 disabled:opacity-50">
          {saveMutation.isPending ? 'Guardando...' : rule ? 'Guardar cambios' : 'Crear regla'}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fila de regla — solo lectura + acciones
// ─────────────────────────────────────────────────────────────────────────────
function RuleRow({
  rule, onEdit, onToggle, togglePending, onDelete,
}: {
  rule: RecurringRule;
  onEdit: () => void;
  onToggle: () => void;
  togglePending: boolean;
  onDelete: () => void;
}) {
  const isDisabled = !!rule.archived_at;

  return (
    <div className={`rounded-lg border bg-white overflow-hidden ${isDisabled ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Ícono + tipo */}
        <RotateCcw size={14} className={isDisabled ? 'text-slate-300' : 'text-indigo-400'} />
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLORS[rule.event_type]}`}>
          {rule.event_type === 'income' ? 'Ingreso' : 'Gasto'}
        </span>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isDisabled ? 'line-through text-slate-400' : 'text-slate-800'}`}>
            {rule.title}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {freqSummary(rule)}
            {rule.starts_on && <> · desde {rule.starts_on}</>}
            {rule.ends_on && <> hasta {rule.ends_on}</>}
          </p>
        </div>

        {/* Monto */}
        <span className="text-sm font-mono font-medium text-slate-700 shrink-0">
          {formatMoney(rule.amount_minor)}
        </span>

        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit}
            className="p-1.5 text-slate-300 hover:text-indigo-500 transition-colors rounded"
            title="Editar regla">
            <Pencil size={14} />
          </button>
          <button
            onClick={onToggle}
            disabled={togglePending}
            className="p-1.5 text-slate-300 hover:text-indigo-500 transition-colors rounded disabled:opacity-40"
            title={isDisabled ? 'Habilitar' : 'Deshabilitar'}
          >
            {isDisabled ? <ToggleLeft size={16} /> : <ToggleRight size={16} className="text-indigo-500" />}
          </button>
          <button onClick={onDelete}
            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded"
            title="Eliminar regla">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sección principal
// ─────────────────────────────────────────────────────────────────────────────
export default function RecurringRulesSection({ mode }: { mode?: 'income' | 'expense' } = {}) {
  const qc = useQueryClient();
  const [modalRule, setModalRule] = useState<RecurringRule | null | 'new'>(null);
  const [deleteError, setDeleteError] = useState('');

  const { data: allRules = [], isLoading } = useQuery({
    queryKey: ['recurring-rules'],
    queryFn: cmd.listRecurringRules,
  });

  const rules = mode ? allRules.filter((r) => r.event_type === mode) : allRules;

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      cmd.toggleRecurringRule(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: cmd.deleteRecurringRule,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring-rules'] }); setDeleteError(''); },
    onError: (e: unknown) => setDeleteError(typeof e === 'string' ? e : (e as Error).message ?? String(e)),
  });

  const handleDelete = (rule: RecurringRule) => {
    setDeleteError('');
    if (!window.confirm(
      `¿Eliminar la regla "${rule.title}"?\n\nLos movimientos ya generados no se eliminan.`
    )) return;
    deleteMutation.mutate(rule.id);
  };

  const enabled = rules.filter((r) => !r.archived_at);
  const disabled = rules.filter((r) => !!r.archived_at);

  return (
    <div>
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Se generan automáticamente al inicio de cada período. Gestiona los movimientos desde Ingresos o Gastos.
        </p>
        <button
          onClick={() => setModalRule('new')}
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 shrink-0 ml-4"
        >
          <Plus size={16} />
          {mode === 'income' ? 'Nuevo ingreso' : mode === 'expense' ? 'Nuevo gasto' : 'Agregar regla'}
        </button>
      </div>

      {deleteError && (
        <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          {deleteError}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <RotateCcw size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay reglas recurrentes configuradas.</p>
          <p className="text-xs mt-1">Crea una para generar movimientos automáticamente cada mes.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Activas */}
          <div className="space-y-2">
            {enabled.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No hay reglas activas.</p>
            )}
            {enabled.map((r) => (
              <RuleRow
                key={r.id}
                rule={r}
                onEdit={() => setModalRule(r)}
                onToggle={() => toggleMutation.mutate({ id: r.id, enabled: false })}
                togglePending={toggleMutation.isPending}
                onDelete={() => handleDelete(r)}
              />
            ))}
          </div>

          {/* Deshabilitadas */}
          {disabled.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 px-1">
                Deshabilitadas
              </p>
              <div className="space-y-2">
                {disabled.map((r) => (
                  <RuleRow
                    key={r.id}
                    rule={r}
                    onEdit={() => setModalRule(r)}
                    onToggle={() => toggleMutation.mutate({ id: r.id, enabled: true })}
                    togglePending={toggleMutation.isPending}
                    onDelete={() => handleDelete(r)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal crear / editar */}
      {modalRule !== null && (
        <Modal
          title={modalRule === 'new' ? 'Nueva regla recurrente' : `Editar: ${(modalRule as RecurringRule).title}`}
          onClose={() => setModalRule(null)}
        >
          <RecurringRuleModal
            rule={modalRule === 'new' ? undefined : (modalRule as RecurringRule)}
            lockedType={mode}
            onClose={() => setModalRule(null)}
          />
        </Modal>
      )}
    </div>
  );
}
