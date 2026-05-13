import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, ExternalLink, Check, AlertCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as cmd from '../../domain-client/commands';
import type { FinancialEventRow } from '../../domain-client/types';
import { parseMoneyInput, minorToInputStr } from '../../utils/money';
import RecurringDeletePanel from '../shared/RecurringDeletePanel';

interface Props {
  periodId: number;
  event?: FinancialEventRow;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────────────────────────────────────
// Modo 1 — Ingreso manual (create & edit)
// ─────────────────────────────────────────────────────────────────────────────
function ManualIncomeForm({ periodId, event, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: event?.title ?? '',
    amount: event ? minorToInputStr(event.amount_minor) : '',
    event_date: event?.event_date ?? today(),
    due_date: event?.due_date ?? '',
    status_id: event?.status_id.toString() ?? '',
    category_id: event?.category_id?.toString() ?? '',
    payment_method_id: event?.payment_method_id?.toString() ?? '',
    notes: event?.notes ?? '',
  });
  const [error, setError] = useState('');

  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: cmd.listStatusesWithRules });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: cmd.listCategories });
  const { data: methods = [] } = useQuery({ queryKey: ['payment-methods'], queryFn: cmd.listPaymentMethods });

  const activeStatuses = statuses
    .filter((sw) => !sw.status.archived_at && sw.status.scope !== 'expense')
    .map((sw) => sw.status);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

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
        exclude_from_total: false,
        notes: form.notes.trim() || undefined,
      };

      return event
        ? cmd.updateEvent(event.id, base)
        : cmd.createEvent({ period_id: periodId, event_type: 'income', ...base });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const f = 'w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const l = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(''); saveMutation.mutate(); }} className="space-y-4">
      <div>
        <label className={l}>Título *</label>
        <input required autoFocus value={form.title} onChange={set('title')} placeholder="Sueldo enero" className={f} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Monto (S/) *</label>
          <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" className={f} />
        </div>
        <div>
          <label className={l}>Fecha *</label>
          <input required type="date" value={form.event_date} onChange={set('event_date')} className={f} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Estado *</label>
          <select required value={form.status_id} onChange={set('status_id')} className={f}>
            <option value="">— Seleccionar —</option>
            {activeStatuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={l}>Categoría</label>
          <select value={form.category_id} onChange={set('category_id')} className={f}>
            <option value="">— Ninguna —</option>
            {categories.filter((c) => !c.archived_at && c.scope !== 'expense').map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Método de cobro</label>
          <select value={form.payment_method_id} onChange={set('payment_method_id')} className={f}>
            <option value="">— Ninguno —</option>
            {methods.filter((m) => !m.archived_at).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={l}>Fecha esperada de cobro</label>
          <input type="date" value={form.due_date} onChange={set('due_date')} className={f} />
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
          className="text-sm bg-emerald-600 text-white rounded px-5 py-1.5 hover:bg-emerald-700 disabled:opacity-50">
          {saveMutation.isPending ? 'Guardando...' : event ? 'Actualizar' : 'Registrar ingreso'}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modo 2 — Crear regla recurrente (completa, validada, sin "Estado al generar")
// ─────────────────────────────────────────────────────────────────────────────
function RecurringRuleCreateForm({ periodId, onClose }: { periodId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    amount: '',
    amount_type: 'fixed' as 'fixed' | 'variable',
    category_id: '',
    payment_method_id: '',
    frequency: 'monthly',
    day_of_month: '1',
    interval_days: '14',
    starts_on: today(),
    ends_on: '',
    notes: '',
  });
  const [error, setError] = useState('');

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: cmd.listCategories });
  const { data: methods = [] } = useQuery({ queryKey: ['payment-methods'], queryFn: cmd.listPaymentMethods });
  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: cmd.listStatusesWithRules });

  const pendienteStatus = statuses.find(
    (sw) => sw.status.system_key === 'pending' && !sw.status.archived_at
  )?.status;

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const isMonthly = form.frequency === 'monthly';

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('El título es obligatorio');
      const amountMinor = parseMoneyInput(form.amount);
      if (amountMinor <= 0) throw new Error('El monto esperado debe ser mayor a 0');
      if (!form.starts_on) throw new Error('La fecha de inicio es obligatoria');
      if (isMonthly && (!form.day_of_month || Number(form.day_of_month) < 1))
        throw new Error('El día esperado de cobro es obligatorio (1–31)');
      if (!isMonthly && (!form.interval_days || Number(form.interval_days) < 1))
        throw new Error('El intervalo de días es obligatorio');

      await cmd.createRecurringRule({
        event_type: 'income',
        title: form.title.trim(),
        amount_minor: amountMinor,
        amount_type: form.amount_type,
        frequency: form.frequency,
        day_of_month: isMonthly ? Number(form.day_of_month) : undefined,
        interval_days: !isMonthly ? Number(form.interval_days) : undefined,
        category_id: form.category_id ? Number(form.category_id) : undefined,
        payment_method_id: form.payment_method_id ? Number(form.payment_method_id) : undefined,
        // Estado inicial siempre "Pendiente" para ingresos — nunca seleccionable
        default_status_id: pendienteStatus?.id,
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
      {/* Aviso: estado automático */}
      <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 text-sm text-indigo-800">
        <RotateCcw size={15} className="shrink-0 mt-0.5" />
        <span>
          Se generará automáticamente como <strong>Pendiente</strong> al inicio de cada período.
          Cámbialo a <strong>Cobrado</strong> cuando lo recibas.
          Un ingreso pendiente no suma al dinero disponible.
        </span>
      </div>

      {/* Título */}
      <div>
        <label className={l}>Nombre del ingreso recurrente *</label>
        <input required autoFocus value={form.title} onChange={set('title')} placeholder="Ej: Sueldo mensual" className={f} />
      </div>

      {/* Monto + Tipo */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>{form.amount_type === 'variable' ? 'Monto estimado (S/) *' : 'Monto esperado (S/) *'}</label>
          <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" className={f} />
        </div>
        <div>
          <label className={l}>Tipo de monto</label>
          <div className="flex gap-4 mt-1.5">
            {(['fixed', 'variable'] as const).map((t) => (
              <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
                <input type="radio" name="income_amount_type" value={t}
                  checked={form.amount_type === t}
                  onChange={() => setForm((p) => ({ ...p, amount_type: t }))}
                  className="accent-indigo-600" />
                {t === 'fixed' ? 'Fijo' : 'Variable'}
              </label>
            ))}
          </div>
          {form.amount_type === 'variable' && (
            <p className="text-xs text-indigo-600 mt-1">Se pedirá confirmar el monto real cada período.</p>
          )}
        </div>
      </div>

      {/* Categoría */}
      <div>
        <label className={l}>Categoría</label>
        <select value={form.category_id} onChange={set('category_id')} className={f}>
          <option value="">— Ninguna —</option>
          {categories.filter((c) => !c.archived_at && c.scope !== 'expense').map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Método de cobro */}
      <div>
        <label className={l}>Método de cobro (opcional)</label>
        <select value={form.payment_method_id} onChange={set('payment_method_id')} className={f}>
          <option value="">— Ninguno —</option>
          {methods.filter((m) => !m.archived_at).map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* Frecuencia + Día */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Frecuencia *</label>
          <select value={form.frequency} onChange={set('frequency')} className={f}>
            <option value="monthly">Mensual</option>
            <option value="biweekly">Quincenal (cada 14 días)</option>
            <option value="weekly">Semanal (cada 7 días)</option>
            <option value="custom">Personalizada</option>
          </select>
        </div>
        {isMonthly ? (
          <div>
            <label className={l}>Día esperado de cobro *</label>
            <input required type="number" min="1" max="31" value={form.day_of_month} onChange={set('day_of_month')} className={f} />
          </div>
        ) : (
          <div>
            <label className={l}>Cada cuántos días *</label>
            <input required type="number" min="1" value={form.interval_days} onChange={set('interval_days')}
              placeholder={form.frequency === 'biweekly' ? '14' : form.frequency === 'weekly' ? '7' : ''}
              className={f} />
          </div>
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
        <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Opcional..." className={`${f} resize-none`} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">Cancelar</button>
        <button type="submit" disabled={saveMutation.isPending}
          className="text-sm bg-emerald-600 text-white rounded px-5 py-1.5 hover:bg-emerald-700 disabled:opacity-50">
          {saveMutation.isPending ? 'Creando regla...' : 'Crear ingreso recurrente'}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modo 3 — Gestionar instancia de ingreso recurrente
// ─────────────────────────────────────────────────────────────────────────────
function RecurringInstanceManager({ event, onClose }: { event: FinancialEventRow; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showPartial, setShowPartial] = useState(false);
  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [partialAmount, setPartialAmount] = useState(
    minorToInputStr(event.received_amount_minor ?? event.expected_amount_minor ?? event.amount_minor)
  );
  const [actualDate, setActualDate] = useState(event.event_date);
  const [notes, setNotes] = useState(event.notes ?? '');
  const [error, setError] = useState('');

  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: cmd.listStatusesWithRules });
  const { data: rules = [] } = useQuery({ queryKey: ['recurring-rules'], queryFn: cmd.listRecurringRules });

  const rule = rules.find((r) => r.id === event.recurring_rule_id);

  const cobradoStatus = statuses.find((sw) => sw.status.system_key === 'received')?.status;
  const cobradoParcialStatus = statuses.find((sw) => sw.status.system_key === 'received_partial')?.status;
  const canceladoStatus = statuses.find((sw) => sw.status.system_key === 'cancelled')?.status;

  const [confirmedAmount, setConfirmedAmount] = useState(
    minorToInputStr(event.expected_amount_minor ?? event.amount_minor)
  );

  const currentStatus = statuses.find((sw) => sw.status.id === event.status_id)?.status;
  const isAlreadyCobrado = cobradoStatus && event.status_id === cobradoStatus.id;
  const isAlreadyCancelado = canceladoStatus && event.status_id === canceladoStatus.id;

  // El monto esperado proviene de expected_amount_minor (campo del evento generado)
  // o de la regla si el campo no está disponible.
  const expectedAmount = event.expected_amount_minor ?? rule?.amount_minor ?? event.amount_minor;

  const actionMutation = useMutation({
    mutationFn: async (payload: {
      status_id: number;
      amount_minor: number;
      received_amount_minor?: number;
      event_date?: string;
      notes?: string;
      requires_amount_confirmation?: boolean;
    }) => {
      return cmd.updateEvent(event.id, {
        title: event.title,
        amount_minor: payload.amount_minor,
        received_amount_minor: payload.received_amount_minor,
        event_date: payload.event_date ?? event.event_date,
        status_id: payload.status_id,
        category_id: event.category_id ?? undefined,
        payment_method_id: event.payment_method_id ?? undefined,
        exclude_from_total: event.exclude_from_total,
        notes: payload.notes ?? event.notes ?? undefined,
        requires_amount_confirmation: payload.requires_amount_confirmation,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const markCobrado = () => {
    if (!cobradoStatus) return;
    actionMutation.mutate({
      status_id: cobradoStatus.id,
      amount_minor: expectedAmount,
      received_amount_minor: expectedAmount,
      event_date: actualDate,
      notes: notes || undefined,
      requires_amount_confirmation: false,
    });
  };

  const markParcial = () => {
    if (!cobradoParcialStatus) return;
    const received = parseMoneyInput(partialAmount);
    actionMutation.mutate({
      status_id: cobradoParcialStatus.id,
      amount_minor: expectedAmount,   // no sobreescribir el monto esperado
      received_amount_minor: received,
      event_date: actualDate,
      notes: notes || undefined,
      requires_amount_confirmation: false, // registrar monto parcial cierra la confirmación pendiente
    });
  };

  const saveNotes = () => {
    actionMutation.mutate({
      status_id: event.status_id,
      amount_minor: expectedAmount,
      received_amount_minor: event.received_amount_minor ?? undefined,
      event_date: actualDate,
      notes: notes || undefined,
    });
  };

  const f = 'w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const l = 'block text-xs font-medium text-slate-600 mb-1';

  const FREQ_ES: Record<string, string> = {
    monthly: 'Mensual', biweekly: 'Quincenal', weekly: 'Semanal', custom: 'Personalizada',
  };

  // Panel de eliminación — sustituye el contenido principal cuando está activo
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
      {/* Cabecera informativa — datos de la regla (readonly) */}
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
            <p className="text-xs text-slate-400">Día esperado</p>
            <p className="font-medium text-slate-700">{rule?.day_of_month ? `Día ${rule.day_of_month}` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Monto esperado</p>
            <p className="font-medium text-slate-700">S/ {minorToInputStr(rule?.amount_minor ?? event.amount_minor)}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { onClose(); navigate('/ingresos/recurrentes'); }}
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-1"
        >
          <ExternalLink size={11} /> Editar regla en Ingresos → Recurrentes
        </button>
      </div>

      {/* Estado actual + montos */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-white">
        <p className="text-sm text-slate-500 flex-1">Estado actual:</p>
        {/* Monto parcial vs esperado */}
        {event.received_amount_minor != null && event.received_amount_minor !== expectedAmount ? (
          <span className="text-sm font-mono text-amber-700">
            S/ {minorToInputStr(event.received_amount_minor)} de S/ {minorToInputStr(expectedAmount)}
          </span>
        ) : (
          <span className="text-sm font-mono text-slate-700">
            S/ {minorToInputStr(expectedAmount)}
          </span>
        )}
        {currentStatus && (
          <span className="text-sm font-medium px-2.5 py-1 rounded-full"
            style={{ backgroundColor: currentStatus.color + '22', color: currentStatus.color }}>
            {currentStatus.name}
          </span>
        )}
      </div>

      {/* Panel de confirmación de monto variable */}
      {event.requires_amount_confirmation && !isAlreadyCobrado && !isAlreadyCancelado && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
            Confirmar monto recibido
          </p>
          <p className="text-xs text-indigo-600">
            Este ingreso es variable. El estimado era <strong>S/ {minorToInputStr(event.expected_amount_minor ?? event.amount_minor)}</strong>.
            Ingresa el monto real recibido.
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className={l}>Monto real (S/)</label>
              <input type="number" min="0.01" step="0.01" value={confirmedAmount}
                onChange={(e) => setConfirmedAmount(e.target.value)} className={f} />
            </div>
            <button
              type="button"
              disabled={actionMutation.isPending || !cobradoStatus}
              onClick={() => {
                if (!cobradoStatus) return;
                const real = parseMoneyInput(confirmedAmount);
                actionMutation.mutate({
                  status_id: cobradoStatus.id,
                  amount_minor: real,
                  received_amount_minor: real,
                  event_date: actualDate,
                  notes: notes || undefined,
                  requires_amount_confirmation: false,
                });
              }}
              className="text-sm bg-indigo-600 text-white rounded px-4 py-1.5 hover:bg-indigo-700 disabled:opacity-50 shrink-0"
            >
              Confirmar y cobrar
            </button>
          </div>
        </div>
      )}

      {/* Acciones operativas */}
      {!isAlreadyCobrado && !isAlreadyCancelado && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Acciones</p>

          {/* Cobrado */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={markCobrado}
              disabled={actionMutation.isPending || !cobradoStatus}
              className="flex items-center justify-center gap-2 bg-emerald-600 text-white text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check size={15} />
              Cobrado — S/ {minorToInputStr(expectedAmount)}
            </button>

            <button
              type="button"
              onClick={() => setShowPartial((v) => !v)}
              className="flex items-center justify-center gap-2 border border-amber-300 text-amber-700 bg-amber-50 text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-amber-100"
            >
              <AlertCircle size={15} /> Cobrado parcial
            </button>
          </div>

          {/* Panel cobro parcial */}
          {showPartial && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={l}>Monto recibido (S/)</label>
                  <input type="number" min="0.01" step="0.01" value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)} className={f} />
                </div>
                <div>
                  <label className={l}>Fecha real de cobro</label>
                  <input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} className={f} />
                </div>
              </div>
              <button type="button" onClick={markParcial} disabled={actionMutation.isPending}
                className="w-full text-sm bg-amber-600 text-white rounded-lg px-4 py-2 hover:bg-amber-700 disabled:opacity-50">
                Confirmar cobro parcial
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fecha real (editable) — solo si ya está cobrado para corregirla */}
      {isAlreadyCobrado && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={l}>Fecha real de cobro</label>
            <input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} className={f} />
          </div>
        </div>
      )}

      {/* Notas */}
      <div>
        <label className={l}>Notas</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          placeholder="Opcional..." className={`${f} resize-none`} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Pie */}
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
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">
            Cerrar
          </button>
          {(isAlreadyCobrado || isAlreadyCancelado) && (
            <button type="button" onClick={saveNotes} disabled={actionMutation.isPending}
              className="text-sm bg-indigo-600 text-white rounded px-4 py-1.5 hover:bg-indigo-700 disabled:opacity-50">
              Guardar notas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrador — detecta el modo correcto
// ─────────────────────────────────────────────────────────────────────────────
export default function IncomeForm({ periodId, event, onClose }: Props) {
  const [isRecurring, setIsRecurring] = useState(false);

  // Modo 3: editar instancia generada por regla
  if (event?.recurring_rule_id) {
    return <RecurringInstanceManager event={event} onClose={onClose} />;
  }

  // Modo 2: crear regla recurrente
  if (!event && isRecurring) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-indigo-700 flex items-center gap-1.5">
            <RotateCcw size={14} /> Modo: ingreso recurrente
          </span>
          <button type="button" onClick={() => setIsRecurring(false)}
            className="text-xs text-slate-400 hover:text-slate-600 underline">
            Cambiar a ingreso único
          </button>
        </div>
        <RecurringRuleCreateForm periodId={periodId} onClose={onClose} />
      </div>
    );
  }

  // Modo 1: ingreso manual (create o edit)
  return (
    <div>
      {!event && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <span className="text-sm text-slate-500">¿Es un ingreso que se repite cada mes?</span>
          <button type="button" onClick={() => setIsRecurring(true)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5">
            <RotateCcw size={14} /> Crear ingreso recurrente
          </button>
        </div>
      )}
      <ManualIncomeForm periodId={periodId} event={event} onClose={onClose} />
    </div>
  );
}
