import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X, RotateCcw } from 'lucide-react';
import * as cmd from '../../../domain-client/commands';
import type { RecurringRule } from '../../../domain-client/types';
import { formatMoney, parseMoneyInput } from '../../../utils/money';

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Mensual',
  biweekly: 'Quincenal',
  weekly: 'Semanal',
  custom: 'Personalizada',
};

const TYPE_COLORS: Record<string, string> = {
  income: 'bg-emerald-100 text-emerald-700',
  expense: 'bg-red-100 text-red-700',
};

const EMPTY_FORM = {
  event_type: 'expense',
  title: '',
  amount: '0.00',
  frequency: 'monthly',
  day_of_month: '1',
  interval_days: '7',
  starts_on: new Date().toISOString().slice(0, 10),
  ends_on: '',
  default_status_id: '',
  remind_days_before: '',
};

function ToggleSwitch({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button" onClick={onChange} disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${on ? 'bg-indigo-500' : 'bg-slate-300'}`}
      title={on ? 'Deshabilitar' : 'Habilitar'}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

function RuleRow({ rule, statuses, onToggle, togglePending }: {
  rule: RecurringRule;
  statuses: { id: number; name: string }[];
  onToggle: () => void;
  togglePending: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<typeof EMPTY_FORM>({
    event_type: rule.event_type,
    title: rule.title,
    amount: (rule.amount_minor / 100).toFixed(2),
    frequency: rule.frequency,
    day_of_month: rule.day_of_month?.toString() ?? '1',
    interval_days: rule.interval_days?.toString() ?? '7',
    starts_on: rule.starts_on,
    ends_on: rule.ends_on ?? '',
    default_status_id: rule.default_status_id?.toString() ?? '',
    remind_days_before: rule.remind_days_before?.toString() ?? '',
  });
  const [deleteError, setDeleteError] = useState('');
  const isDisabled = !!rule.archived_at;

  const field = 'w-full text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500';

  const updateMutation = useMutation({
    mutationFn: () => cmd.updateRecurringRule(rule.id, {
      event_type: form.event_type,
      title: form.title.trim(),
      amount_minor: parseMoneyInput(form.amount),
      frequency: form.frequency,
      day_of_month: form.frequency === 'monthly' ? Number(form.day_of_month) : undefined,
      interval_days: form.frequency !== 'monthly' ? Number(form.interval_days) : undefined,
      starts_on: form.starts_on,
      ends_on: form.ends_on || undefined,
      default_status_id: form.default_status_id ? Number(form.default_status_id) : undefined,
      remind_days_before: form.remind_days_before ? Number(form.remind_days_before) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring-rules'] }); setEditing(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => cmd.deleteRecurringRule(rule.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring-rules'] }); setDeleteError(''); },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const handleDelete = () => {
    setDeleteError('');
    if (!window.confirm(`¿Eliminar la regla "${rule.title}"?\n\nLos movimientos ya generados no se eliminan.`)) return;
    deleteMutation.mutate();
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="p-3 space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-2">
              <input required value={form.title} onChange={set('title')} placeholder="Título"
                className={field} autoFocus />
            </div>
            <div>
              <select value={form.event_type} onChange={set('event_type')} className={field}>
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
            </div>
            <div>
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')}
                className={field} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <select value={form.frequency} onChange={set('frequency')} className={field}>
                <option value="monthly">Mensual</option>
                <option value="biweekly">Quincenal</option>
                <option value="weekly">Semanal</option>
                <option value="custom">Personalizada</option>
              </select>
            </div>
            {form.frequency === 'monthly' ? (
              <div>
                <input type="number" min="1" max="31" value={form.day_of_month} onChange={set('day_of_month')}
                  className={field} placeholder="Día (1-31)" />
              </div>
            ) : (
              <div>
                <input type="number" min="1" value={form.interval_days} onChange={set('interval_days')}
                  className={field} placeholder="Cada N días" />
              </div>
            )}
            <div>
              <select value={form.default_status_id} onChange={set('default_status_id')} className={field}>
                <option value="">— Estado al generar —</option>
                {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <input type="number" min="0" value={form.remind_days_before} onChange={set('remind_days_before')}
                className={field} placeholder="Recordar X días antes" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 items-center">
            <div>
              <input type="date" value={form.starts_on} onChange={set('starts_on')} className={field} />
            </div>
            <div>
              <input type="date" value={form.ends_on} onChange={set('ends_on')} className={field} />
            </div>
            <div className="flex justify-end gap-1">
              <button type="submit" disabled={updateMutation.isPending}
                className="p-1 text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Guardar">
                <Check size={15} />
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="p-1 text-slate-400 hover:text-slate-600" title="Cancelar">
                <X size={15} />
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <RotateCcw size={13} className={isDisabled ? 'text-slate-300' : 'text-indigo-400'} />
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLORS[rule.event_type]}`}>
            {rule.event_type === 'income' ? 'Ingreso' : 'Gasto'}
          </span>
          <span className={`text-sm font-medium flex-1 truncate ${isDisabled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {rule.title}
          </span>
          <span className="text-xs text-slate-500 shrink-0">{FREQ_LABELS[rule.frequency]}</span>
          {rule.day_of_month && (
            <span className="text-xs text-slate-400 shrink-0">día {rule.day_of_month}</span>
          )}
          <span className="text-sm font-mono text-slate-700 shrink-0">{formatMoney(rule.amount_minor)}</span>
          <button onClick={() => setEditing(true)}
            className="p-1 text-slate-300 hover:text-indigo-500 transition-colors shrink-0" title="Editar">
            <Pencil size={13} />
          </button>
          <ToggleSwitch on={!isDisabled} onChange={onToggle} disabled={togglePending} />
          <button onClick={handleDelete}
            className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0" title="Eliminar">
            <Trash2 size={13} />
          </button>
        </div>
      )}
      {deleteError && (
        <p className="text-xs text-amber-700 bg-amber-50 border-t border-amber-100 px-3 py-1.5">{deleteError}</p>
      )}
    </div>
  );
}

export default function RecurringRulesSection() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['recurring-rules'],
    queryFn: cmd.listRecurringRules,
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['statuses'],
    queryFn: cmd.listStatusesWithRules,
  });

  const activeStatuses = statuses.filter((sw) => !sw.status.archived_at).map((sw) => sw.status);

  const createMutation = useMutation({
    mutationFn: () => cmd.createRecurringRule({
      event_type: form.event_type,
      title: form.title.trim(),
      amount_minor: parseMoneyInput(form.amount),
      frequency: form.frequency,
      day_of_month: form.frequency === 'monthly' ? Number(form.day_of_month) : undefined,
      interval_days: form.frequency !== 'monthly' ? Number(form.interval_days) : undefined,
      starts_on: form.starts_on,
      ends_on: form.ends_on || undefined,
      default_status_id: form.default_status_id ? Number(form.default_status_id) : undefined,
      remind_days_before: form.remind_days_before ? Number(form.remind_days_before) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-rules'] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      cmd.toggleRecurringRule(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-rules'] }),
  });

  const field = 'w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const label = 'block text-xs font-medium text-slate-600 mb-1';
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const enabled = rules.filter((r) => !r.archived_at);
  const disabled = rules.filter((r) => !!r.archived_at);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Las reglas recurrentes generan movimientos automáticamente al abrir cada período.
        </p>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800">
          <Plus size={16} /> Agregar regla
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="mb-4 p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className={label}>Título *</label>
              <input required autoFocus value={form.title} onChange={set('title')}
                placeholder="Alquiler" className={field} />
            </div>
            <div>
              <label className={label}>Tipo</label>
              <select value={form.event_type} onChange={set('event_type')} className={field}>
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
            </div>
            <div>
              <label className={label}>Monto (S/) *</label>
              <input required type="number" min="0.01" step="0.01" value={form.amount}
                onChange={set('amount')} className={field} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={label}>Frecuencia</label>
              <select value={form.frequency} onChange={set('frequency')} className={field}>
                <option value="monthly">Mensual</option>
                <option value="biweekly">Quincenal</option>
                <option value="weekly">Semanal</option>
                <option value="custom">Personalizada</option>
              </select>
            </div>
            {form.frequency === 'monthly' ? (
              <div>
                <label className={label}>Día del mes</label>
                <input type="number" min="1" max="31" value={form.day_of_month}
                  onChange={set('day_of_month')} className={field} />
              </div>
            ) : (
              <div>
                <label className={label}>Cada N días</label>
                <input type="number" min="1" value={form.interval_days}
                  onChange={set('interval_days')} className={field} />
              </div>
            )}
            <div>
              <label className={label}>Estado al generar</label>
              <select value={form.default_status_id} onChange={set('default_status_id')} className={field}>
                <option value="">— Primero disponible —</option>
                {activeStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Recordar (días antes)</label>
              <input type="number" min="0" value={form.remind_days_before}
                onChange={set('remind_days_before')} placeholder="Sin recordatorio" className={field} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label}>Inicio</label>
              <input type="date" value={form.starts_on} onChange={set('starts_on')} className={field} />
            </div>
            <div>
              <label className={label}>Fin (opcional)</label>
              <input type="date" value={form.ends_on} onChange={set('ends_on')} className={field} />
            </div>
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 px-3 py-1.5">Cancelar</button>
              <button type="submit" disabled={createMutation.isPending}
                className="flex-1 text-sm bg-indigo-600 text-white rounded px-4 py-1.5 hover:bg-indigo-700 disabled:opacity-50">
                {createMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            {enabled.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No hay reglas recurrentes activas.</p>
            )}
            {enabled.map((r) => (
              <RuleRow
                key={r.id} rule={r} statuses={activeStatuses}
                onToggle={() => toggleMutation.mutate({ id: r.id, enabled: false })}
                togglePending={toggleMutation.isPending}
              />
            ))}
          </div>

          {disabled.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1 px-1">
                Deshabilitadas
              </p>
              <div className="space-y-1 opacity-60">
                {disabled.map((r) => (
                  <RuleRow
                    key={r.id} rule={r} statuses={activeStatuses}
                    onToggle={() => toggleMutation.mutate({ id: r.id, enabled: true })}
                    togglePending={toggleMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
