import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as cmd from '../../domain-client/commands';
import type { FinancialEventRow } from '../../domain-client/types';
import { parseMoneyInput, minorToInputStr } from '../../utils/money';

interface Props {
  periodId: number;
  event?: FinancialEventRow;
  allExpenses: FinancialEventRow[]; // candidatos a padre
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

function initForm(event?: FinancialEventRow) {
  return {
    title: event?.title ?? '',
    amount: event ? minorToInputStr(event.amount_minor) : '',
    event_date: event?.event_date ?? today(),
    due_date: event?.due_date ?? '',
    status_id: event?.status_id.toString() ?? '',
    category_id: event?.category_id?.toString() ?? '',
    payment_method_id: event?.payment_method_id?.toString() ?? '',
    parent_event_id: event?.parent_event_id?.toString() ?? '',
    exclude_from_total: event?.exclude_from_total ?? false,
    notes: event?.notes ?? '',
  };
}

export default function ExpenseForm({ periodId, event, allExpenses, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => initForm(event));
  const [error, setError] = useState('');

  const { data: statuses = [] } = useQuery({
    queryKey: ['statuses'],
    queryFn: cmd.listStatusesWithRules,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: cmd.listCategories,
  });
  const { data: methods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: cmd.listPaymentMethods,
  });

  // Solo raíces de otros gastos como candidatos a padre (no hijos ni el mismo)
  const parentCandidates = allExpenses.filter(
    (e) => !e.parent_event_id && e.id !== event?.id
  );

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amountMinor = parseMoneyInput(form.amount);
      if (!form.title.trim()) throw new Error('El título es obligatorio');
      if (amountMinor <= 0) throw new Error('El monto debe ser mayor a 0');
      if (!form.status_id) throw new Error('Selecciona un estado');

      const base = {
        title: form.title.trim(),
        amount_minor: amountMinor,
        event_date: form.event_date,
        due_date: form.due_date || undefined,
        status_id: Number(form.status_id),
        category_id: form.category_id ? Number(form.category_id) : undefined,
        payment_method_id: form.payment_method_id ? Number(form.payment_method_id) : undefined,
        parent_event_id: form.parent_event_id ? Number(form.parent_event_id) : undefined,
        exclude_from_total: form.exclude_from_total,
        notes: form.notes.trim() || undefined,
      };

      return event
        ? cmd.updateEvent(event.id, base)
        : cmd.createEvent({ period_id: periodId, event_type: 'expense', ...base });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const field = 'w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const label = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setError(''); saveMutation.mutate(); }}
      className="space-y-4"
    >
      {/* Título */}
      <div>
        <label className={label}>Título *</label>
        <input required value={form.title} onChange={set('title')} placeholder="Supermercado Wong" className={field} />
      </div>

      {/* Monto y fecha */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Monto (S/) *</label>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={set('amount')}
            placeholder="0.00"
            className={field}
          />
        </div>
        <div>
          <label className={label}>Fecha *</label>
          <input required type="date" value={form.event_date} onChange={set('event_date')} className={field} />
        </div>
      </div>

      {/* Estado y categoría */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Estado *</label>
          <select required value={form.status_id} onChange={set('status_id')} className={field}>
            <option value="">— Seleccionar —</option>
            {statuses.map((sw) => (
              <option key={sw.status.id} value={sw.status.id}>{sw.status.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Categoría</label>
          <select value={form.category_id} onChange={set('category_id')} className={field}>
            <option value="">— Ninguna —</option>
            {categories.filter((c) => c.scope !== 'income').map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Método de pago y vencimiento */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Método de pago</label>
          <select value={form.payment_method_id} onChange={set('payment_method_id')} className={field}>
            <option value="">— Ninguno —</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Vencimiento</label>
          <input type="date" value={form.due_date} onChange={set('due_date')} className={field} />
        </div>
      </div>

      {/* Gasto padre (TC consolidado) */}
      {parentCandidates.length > 0 && (
        <div>
          <label className={label}>Gasto padre (ej: estado de cuenta TC)</label>
          <select value={form.parent_event_id} onChange={set('parent_event_id')} className={field}>
            <option value="">— Ninguno —</option>
            {parentCandidates.map((e) => (
              <option key={e.id} value={e.id}>{e.title} — S/ {minorToInputStr(e.amount_minor)}</option>
            ))}
          </select>
        </div>
      )}

      {/* Excluir de total */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.exclude_from_total}
          onChange={(e) => setForm((prev) => ({ ...prev, exclude_from_total: e.target.checked }))}
          className="accent-indigo-600"
        />
        <span className="text-sm text-slate-700">Excluir del total del mes</span>
        <span className="text-xs text-slate-400">(para hijos de TC)</span>
      </label>

      {/* Notas */}
      <div>
        <label className={label}>Notas</label>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          rows={2}
          placeholder="Opcional..."
          className={`${field} resize-none`}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="text-sm bg-indigo-600 text-white rounded px-5 py-1.5 hover:bg-indigo-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Guardando...' : event ? 'Actualizar' : 'Crear gasto'}
        </button>
      </div>
    </form>
  );
}
