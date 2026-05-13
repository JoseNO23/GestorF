import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, ExternalLink, Check, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RecurringDeletePanel from '../shared/RecurringDeletePanel';
import * as cmd from '../../domain-client/commands';
import type { FinancialEventRow } from '../../domain-client/types';
import { parseMoneyInput, minorToInputStr, formatMoney } from '../../utils/money';

function calcInstallmentPreview(totalMinor: number, n: number, monthlyRatePct: number) {
  if (n < 1 || totalMinor <= 0) return null;
  const rate = monthlyRatePct / 100;
  let installment: number;
  if (rate <= 0) {
    installment = Math.ceil(totalMinor / n);
  } else {
    const rn = Math.pow(1 + rate, n);
    const factor = (rate * rn) / (rn - 1);
    installment = Math.ceil(totalMinor * factor);
  }
  const total = installment * n;
  return { installment, total, interest: total - totalMinor };
}

interface Props {
  periodId: number;
  event?: FinancialEventRow;
  allExpenses: FinancialEventRow[];
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────────────────────────────────────
// Modo 1 — Gasto manual (create & edit)
// ─────────────────────────────────────────────────────────────────────────────
function ManualExpenseForm({ periodId, event, allExpenses, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
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
  });
  const [useInstallments, setUseInstallments] = useState(false);
  const [instForm, setInstForm] = useState({
    n: '3',
    interestType: 'none' as 'none' | 'fixed',
    monthlyRate: '0',
  });
  const [error, setError] = useState('');

  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: cmd.listStatusesWithRules });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: cmd.listCategories });
  const { data: methods = [] } = useQuery({ queryKey: ['payment-methods'], queryFn: cmd.listPaymentMethods });

  const activeStatuses = statuses
    .filter((sw) => !sw.status.archived_at && sw.status.scope !== 'income')
    .map((sw) => sw.status);

  const selectedMethod = methods.find((m) => m.id.toString() === form.payment_method_id);
  const isCreditCard = selectedMethod?.kind === 'credit';

  const parentCandidates = allExpenses.filter(
    (e) => !e.parent_event_id && e.id !== event?.id
  );

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => {
    const next = { ...prev, [k]: e.target.value };
    // Al seleccionar un padre, excluir del total automáticamente para evitar doble conteo.
    // Al quitar el padre, revertir la exclusión automática.
    if (k === 'parent_event_id') {
      next.exclude_from_total = !!e.target.value;
    }
    return next;
  });

  const isTCInstallmentMode = isCreditCard && !event && useInstallments;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amountMinor = parseMoneyInput(form.amount);
      if (!form.title.trim()) throw new Error('El título es obligatorio');
      if (amountMinor <= 0) throw new Error('El monto debe ser mayor a 0');

      if (isTCInstallmentMode) {
        const n = Number(instForm.n);
        if (!n || n < 2) throw new Error('El número de cuotas debe ser al menos 2');
        if (!form.payment_method_id) throw new Error('Selecciona la tarjeta de crédito');
        const monthlyRatePct = instForm.interestType === 'fixed' ? Number(instForm.monthlyRate) : 0;
        if (instForm.interestType === 'fixed' && monthlyRatePct <= 0)
          throw new Error('Ingresa una tasa mensual válida');
        return cmd.createCreditCardPurchase({
          payment_method_id: Number(form.payment_method_id),
          title: form.title.trim(),
          total_amount_minor: amountMinor,
          installments: n,
          interest_type: instForm.interestType,
          monthly_interest_rate: monthlyRatePct / 100,
          category_id: form.category_id ? Number(form.category_id) : undefined,
          purchase_date: form.event_date,
          notes: form.notes.trim() || undefined,
        });
      }

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
      qc.invalidateQueries({ queryKey: ['cc-purchases'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const f = 'w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const l = 'block text-xs font-medium text-slate-600 mb-1';

  const totalMinor = parseMoneyInput(form.amount);
  const preview = isTCInstallmentMode
    ? calcInstallmentPreview(
        totalMinor,
        Number(instForm.n) || 0,
        instForm.interestType === 'fixed' ? Number(instForm.monthlyRate) : 0,
      )
    : null;

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(''); saveMutation.mutate(); }} className="space-y-4">
      <div>
        <label className={l}>Título *</label>
        <input required autoFocus value={form.title} onChange={set('title')} placeholder="Supermercado Wong" className={f} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>{isTCInstallmentMode ? 'Precio total (S/) *' : 'Monto (S/) *'}</label>
          <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" className={f} />
        </div>
        <div>
          <label className={l}>{isTCInstallmentMode ? 'Mes de primera cuota *' : 'Fecha *'}</label>
          <input required type="date" value={form.event_date} onChange={set('event_date')} className={f} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {!isTCInstallmentMode && (
          <div>
            <label className={l}>Estado *</label>
            <select required value={form.status_id} onChange={set('status_id')} className={f}>
              <option value="">— Seleccionar —</option>
              {activeStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div className={isTCInstallmentMode ? 'col-span-2' : ''}>
          <label className={l}>Categoría</label>
          <select value={form.category_id} onChange={set('category_id')} className={f}>
            <option value="">— Ninguna —</option>
            {categories.filter((c) => !c.archived_at && c.scope !== 'income').map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={`grid gap-3 ${isTCInstallmentMode ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <div>
          <label className={l}>Método de pago{isTCInstallmentMode ? ' (tarjeta) *' : ''}</label>
          <select value={form.payment_method_id} onChange={set('payment_method_id')} className={f}>
            <option value="">— Ninguno —</option>
            {methods.filter((m) => !m.archived_at).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        {!isTCInstallmentMode && (
          <div>
            <label className={l}>Vencimiento</label>
            <input type="date" value={form.due_date} onChange={set('due_date')} className={f} />
          </div>
        )}
      </div>

      {/* Aviso TC */}
      {isCreditCard && (
        <div className="text-xs bg-orange-50 border border-orange-100 text-orange-700 rounded px-3 py-2 flex items-start gap-2">
          <span className="font-bold mt-0.5">TC</span>
          <span>
            Este gasto se imputa a la tarjeta <strong>{selectedMethod?.name}</strong>.
            {selectedMethod?.cut_day && <> Corte: día {selectedMethod.cut_day}.</>}
            {selectedMethod?.payment_due_day && <> Pago: día {selectedMethod.payment_due_day}.</>}
          </span>
        </div>
      )}

      {/* Panel de cuotas — solo para nuevos gastos TC */}
      {isCreditCard && !event && (
        <div className="rounded-lg border border-slate-200 p-3 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={useInstallments}
              onChange={(e) => setUseInstallments(e.target.checked)}
              className="accent-indigo-600 w-4 h-4"
            />
            <span className="text-sm font-medium text-slate-700">¿Pago en cuotas?</span>
          </label>

          {useInstallments && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={l}>Número de cuotas *</label>
                  <input
                    type="number" min="2" max="60" value={instForm.n}
                    onChange={(e) => setInstForm((p) => ({ ...p, n: e.target.value }))}
                    className={f}
                  />
                </div>
                <div>
                  <label className={l}>Tipo de interés</label>
                  <select
                    value={instForm.interestType}
                    onChange={(e) => setInstForm((p) => ({ ...p, interestType: e.target.value as 'none' | 'fixed' }))}
                    className={f}
                  >
                    <option value="none">Sin interés</option>
                    <option value="fixed">Con interés fijo</option>
                  </select>
                </div>
              </div>

              {instForm.interestType === 'fixed' && (
                <div>
                  <label className={l}>Tasa mensual (%)</label>
                  <input
                    type="number" min="0.01" max="100" step="0.01"
                    value={instForm.monthlyRate}
                    onChange={(e) => setInstForm((p) => ({ ...p, monthlyRate: e.target.value }))}
                    placeholder="Ej: 2.5"
                    className={f}
                  />
                </div>
              )}

              {preview && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 space-y-1">
                  <p className="text-xs font-medium text-indigo-600 mb-2 uppercase tracking-wide">Vista previa</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Cuota mensual</span>
                    <span className="font-semibold text-slate-800">{formatMoney(preview.installment)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total a pagar</span>
                    <span className="font-semibold text-slate-800">{formatMoney(preview.total)}</span>
                  </div>
                  {preview.interest > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Intereses totales</span>
                      <span className="font-semibold text-amber-600">{formatMoney(preview.interest)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!isTCInstallmentMode && parentCandidates.length > 0 && (
        <div>
          <label className={l}>Gasto padre (ej: estado de cuenta TC)</label>
          <select value={form.parent_event_id} onChange={set('parent_event_id')} className={f}>
            <option value="">— Ninguno —</option>
            {parentCandidates.map((e) => (
              <option key={e.id} value={e.id}>{e.title} — S/ {minorToInputStr(e.amount_minor)}</option>
            ))}
          </select>
        </div>
      )}

      {!isTCInstallmentMode && !form.parent_event_id && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.exclude_from_total}
            onChange={(e) => setForm((prev) => ({ ...prev, exclude_from_total: e.target.checked }))}
            className="accent-indigo-600" />
          <span className="text-sm text-slate-700">Excluir del total del mes</span>
        </label>
      )}
      {form.parent_event_id && (
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <span className="text-indigo-400">ℹ</span>
          Este gasto se excluye automáticamente del total para evitar doble conteo con el padre.
        </p>
      )}

      <div>
        <label className={l}>Notas</label>
        <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Opcional..." className={`${f} resize-none`} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancelar</button>
        <button type="submit" disabled={saveMutation.isPending}
          className="text-sm bg-indigo-600 text-white rounded px-5 py-1.5 hover:bg-indigo-700 disabled:opacity-50">
          {saveMutation.isPending
            ? 'Guardando...'
            : isTCInstallmentMode
            ? `Crear compra en ${instForm.n || '?'} cuotas`
            : event ? 'Actualizar' : 'Crear gasto'}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modo 2 — Crear regla recurrente de gasto
// ─────────────────────────────────────────────────────────────────────────────
function RecurringExpenseCreateForm({ periodId, onClose }: { periodId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category_id: '',
    payment_method_id: '',
    frequency: 'monthly',
    day_of_month: '1',
    interval_days: '14',
    remind_days_before: '',
    starts_on: today(),
    ends_on: '',
    notes: '',
  });
  const [error, setError] = useState('');

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: cmd.listCategories });
  const { data: methods = [] } = useQuery({ queryKey: ['payment-methods'], queryFn: cmd.listPaymentMethods });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: cmd.listStatusesWithRules });
  const pendienteStatus = statuses.find(
    (sw) => sw.status.system_key === 'pending' && !sw.status.archived_at
  )?.status;

  const isMonthly = form.frequency === 'monthly';

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('El título es obligatorio');
      const amountMinor = parseMoneyInput(form.amount);
      if (amountMinor <= 0) throw new Error('El monto debe ser mayor a 0');
      if (!form.starts_on) throw new Error('La fecha de inicio es obligatoria');
      if (isMonthly && (!form.day_of_month || Number(form.day_of_month) < 1))
        throw new Error('El día límite de pago es obligatorio (1–31)');

      await cmd.createRecurringRule({
        event_type: 'expense',
        title: form.title.trim(),
        amount_minor: amountMinor,
        frequency: form.frequency,
        day_of_month: isMonthly ? Number(form.day_of_month) : undefined,
        interval_days: !isMonthly ? Number(form.interval_days || '7') : undefined,
        category_id: form.category_id ? Number(form.category_id) : undefined,
        payment_method_id: form.payment_method_id ? Number(form.payment_method_id) : undefined,
        default_status_id: pendienteStatus?.id,
        remind_days_before: form.remind_days_before ? Number(form.remind_days_before) : undefined,
        starts_on: form.starts_on,
        ends_on: form.ends_on || undefined,
        notes: form.notes.trim() || undefined,
      });

      await cmd.generateRecurringEvents(periodId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['recurring-rules'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const f = 'w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const l = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(''); saveMutation.mutate(); }} className="space-y-4">
      <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700">
        <RotateCcw size={15} className="shrink-0 mt-0.5 text-indigo-500" />
        <span>
          Estás creando una <strong>regla de gasto recurrente</strong>. Se generará automáticamente como <strong>Pendiente</strong> al inicio de cada período.
        </span>
      </div>

      <div>
        <label className={l}>Nombre del gasto recurrente *</label>
        <input required autoFocus value={form.title} onChange={set('title')} placeholder="Ej: Alquiler" className={f} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Monto (S/) *</label>
          <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" className={f} />
        </div>
        <div>
          <label className={l}>Categoría</label>
          <select value={form.category_id} onChange={set('category_id')} className={f}>
            <option value="">— Ninguna —</option>
            {categories.filter((c) => !c.archived_at && c.scope !== 'income').map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Método de pago</label>
          <select value={form.payment_method_id} onChange={set('payment_method_id')} className={f}>
            <option value="">— Ninguno —</option>
            {methods.filter((m) => !m.archived_at).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={l}>Recordar antes (días)</label>
          <input type="number" min="0" value={form.remind_days_before}
            onChange={set('remind_days_before')} placeholder="Sin recordatorio" className={f} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Frecuencia</label>
          <select value={form.frequency} onChange={set('frequency')} className={f}>
            <option value="monthly">Mensual</option>
            <option value="biweekly">Quincenal</option>
            <option value="weekly">Semanal</option>
          </select>
        </div>
        <div>
          <label className={l}>Día límite de pago</label>
          <input type="number" min="1" max="31" value={form.day_of_month} onChange={set('day_of_month')} className={f} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Inicio</label>
          <input type="date" value={form.starts_on} onChange={set('starts_on')} className={f} />
        </div>
        <div>
          <label className={l}>Fin (opcional)</label>
          <input type="date" value={form.ends_on} onChange={set('ends_on')} className={f} />
        </div>
      </div>

      <div>
        <label className={l}>Notas</label>
        <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Opcional..." className={`${f} resize-none`} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancelar</button>
        <button type="submit" disabled={saveMutation.isPending}
          className="text-sm bg-indigo-600 text-white rounded px-5 py-1.5 hover:bg-indigo-700 disabled:opacity-50">
          {saveMutation.isPending ? 'Creando regla...' : 'Crear gasto recurrente'}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modo 3 — Gestionar instancia de gasto recurrente
// ─────────────────────────────────────────────────────────────────────────────
function RecurringExpenseInstanceManager({ event, onClose }: { event: FinancialEventRow; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [actualDate, setActualDate] = useState(event.event_date);
  const [notes, setNotes] = useState(event.notes ?? '');
  const [error, setError] = useState('');

  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: cmd.listStatusesWithRules });
  const { data: rules = [] } = useQuery({ queryKey: ['recurring-rules'], queryFn: cmd.listRecurringRules });

  const rule = rules.find((r) => r.id === event.recurring_rule_id);
  const pagadoStatus = statuses.find((sw) => sw.status.system_key === 'paid')?.status;
  const canceladoStatus = statuses.find((sw) => sw.status.system_key === 'cancelled')?.status;
  const currentStatus = statuses.find((sw) => sw.status.id === event.status_id)?.status;
  const isAlreadyPagado = pagadoStatus && event.status_id === pagadoStatus.id;

  // Monto esperado = expected_amount_minor (del evento generado) o el de la regla
  const expectedAmount = event.expected_amount_minor ?? rule?.amount_minor ?? event.amount_minor;

  const actionMutation = useMutation({
    mutationFn: (payload: { status_id: number; amount_minor?: number; event_date?: string; notes?: string }) =>
      cmd.updateEvent(event.id, {
        title: event.title,
        amount_minor: payload.amount_minor ?? expectedAmount,
        event_date: payload.event_date ?? event.event_date,
        status_id: payload.status_id,
        category_id: event.category_id ?? undefined,
        payment_method_id: event.payment_method_id ?? undefined,
        exclude_from_total: event.exclude_from_total,
        notes: payload.notes ?? event.notes ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const FREQ_ES: Record<string, string> = {
    monthly: 'Mensual', biweekly: 'Quincenal', weekly: 'Semanal', custom: 'Personalizada',
  };

  const f = 'w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const l = 'block text-xs font-medium text-slate-600 mb-1';

  // Panel de eliminación — sustituye el contenido cuando está activo
  if (showDeletePanel && rule) {
    return (
      <RecurringDeletePanel
        event={event}
        rule={rule}
        canceladoStatus={canceladoStatus}
        onBack={() => setShowDeletePanel(false)}
        onDone={onClose}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabecera de la regla (readonly) */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">
          <RotateCcw size={11} />
          Regla recurrente #{event.recurring_rule_id}
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">Frecuencia</p>
            <p className="font-medium text-slate-700">{rule ? FREQ_ES[rule.frequency] : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Día límite</p>
            <p className="font-medium text-slate-700">{rule?.day_of_month ? `Día ${rule.day_of_month}` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Monto</p>
            <p className="font-medium text-slate-700">S/ {minorToInputStr(rule?.amount_minor ?? event.amount_minor)}</p>
          </div>
        </div>
        <button type="button" onClick={() => { onClose(); navigate('/gastos/recurrentes'); }}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-1">
          <ExternalLink size={11} /> Editar regla en Gastos → Recurrentes
        </button>
      </div>

      {/* Estado actual */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-white">
        <p className="text-sm text-slate-500 flex-1">Estado actual:</p>
        {currentStatus && (
          <span className="text-sm font-medium px-2.5 py-1 rounded-full"
            style={{ backgroundColor: currentStatus.color + '22', color: currentStatus.color }}>
            {currentStatus.name}
          </span>
        )}
      </div>

      {/* Acción principal */}
      {!isAlreadyPagado && (
        <button type="button"
          onClick={() => pagadoStatus && actionMutation.mutate({ status_id: pagadoStatus.id, amount_minor: expectedAmount, event_date: actualDate, notes: notes || undefined })}
          disabled={actionMutation.isPending || !pagadoStatus}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-indigo-700 disabled:opacity-50">
          <Check size={15} /> Pagado — S/ {minorToInputStr(expectedAmount)}
        </button>
      )}

      {/* Fecha de pago real */}
      <div>
        <label className={l}>Fecha real de pago</label>
        <input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} className={f} />
      </div>

      {/* Notas */}
      <div>
        <label className={l}>Notas</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          placeholder="Opcional..." className={`${f} resize-none`} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between pt-2">
        {rule && (
          <button
            type="button"
            onClick={() => setShowDeletePanel(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={13} /> Detener / Eliminar...
          </button>
        )}
        <div className="flex gap-2 ml-auto">
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">Cerrar</button>
          {isAlreadyPagado && (
            <button type="button"
              onClick={() => actionMutation.mutate({ status_id: event.status_id, amount_minor: expectedAmount, event_date: actualDate, notes: notes || undefined })}
              disabled={actionMutation.isPending}
              className="text-sm bg-indigo-600 text-white rounded px-4 py-1.5 hover:bg-indigo-700 disabled:opacity-50">
              Guardar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrador
// ─────────────────────────────────────────────────────────────────────────────
export default function ExpenseForm({ periodId, event, allExpenses, onClose }: Props) {
  const [isRecurring, setIsRecurring] = useState(false);

  // Modo 3: gestionar instancia recurrente
  if (event?.recurring_rule_id) {
    return <RecurringExpenseInstanceManager event={event} onClose={onClose} />;
  }

  // Modo 2: crear regla recurrente
  if (!event && isRecurring) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-indigo-700 flex items-center gap-1.5">
            <RotateCcw size={14} /> Modo: gasto recurrente
          </span>
          <button type="button" onClick={() => setIsRecurring(false)}
            className="text-xs text-slate-400 hover:text-slate-600 underline">
            Cambiar a gasto único
          </button>
        </div>
        <RecurringExpenseCreateForm periodId={periodId} onClose={onClose} />
      </div>
    );
  }

  // Modo 1: gasto manual (create o edit)
  return (
    <div>
      {!event && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <span className="text-sm text-slate-500">¿Es un gasto fijo que se repite?</span>
          <button type="button" onClick={() => setIsRecurring(true)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5">
            <RotateCcw size={14} /> Crear gasto recurrente
          </button>
        </div>
      )}
      <ManualExpenseForm periodId={periodId} event={event} allExpenses={allExpenses} onClose={onClose} />
    </div>
  );
}
