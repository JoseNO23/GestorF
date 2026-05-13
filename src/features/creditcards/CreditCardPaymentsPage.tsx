import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownCircle, Plus, X } from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import type { CreditCardBalance } from '../../domain-client/types';
import { formatMoney, minorToInputStr, parseMoneyInput } from '../../utils/money';

const today = () => new Date().toISOString().split('T')[0];

// ── Formulario de pago TC ─────────────────────────────────────────────────────

function PaymentForm({
  card,
  periodId,
  onClose,
}: {
  card: CreditCardBalance;
  periodId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    amount: '',
    event_date: today(),
    notes: '',
    status_id: '',
  });
  const [error, setError] = useState('');

  const { data: statuses = [] } = useQuery({
    queryKey: ['statuses'],
    queryFn: cmd.listStatusesWithRules,
  });

  // Estados válidos para un pago (gastos/both, no sólo income)
  const validStatuses = statuses
    .filter((sw) => !sw.status.archived_at && sw.status.scope !== 'income')
    .map((sw) => sw.status);

  const pagadoId = statuses.find((sw) =>
    sw.status.system_key === 'paid' && !sw.status.archived_at
  )?.status.id;

  const effectiveStatusId = form.status_id || (pagadoId ? String(pagadoId) : '');

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amountMinor = parseMoneyInput(form.amount);
      if (amountMinor <= 0) throw new Error('El monto debe ser mayor a 0');
      if (!effectiveStatusId) throw new Error('Selecciona un estado');

      // debt_payment: reduce la deuda TC y sale de dinero real
      return cmd.createEvent({
        period_id: periodId,
        event_type: 'debt_payment',
        title: `Pago ${card.name}`,
        amount_minor: amountMinor,
        event_date: form.event_date,
        status_id: Number(effectiveStatusId),
        payment_method_id: card.id,
        exclude_from_total: false,
        notes: form.notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['credit-cards'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const f = 'w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const l = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-slate-700">Registrar pago — {card.name}</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>

      {/* Deuda actual como referencia */}
      <div className="text-xs text-slate-500 bg-white border border-slate-100 rounded px-3 py-2">
        Deuda acumulada: <span className="font-semibold text-orange-600">{formatMoney(card.current_debt_minor)}</span>
        {card.credit_limit_minor > 0 && (
          <> · Disponible: <span className="font-medium">{formatMoney(card.available_minor)}</span></>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Monto pagado (S/) *</label>
          <input
            type="number" min="0.01" step="0.01" autoFocus
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            placeholder={minorToInputStr(card.current_debt_minor) || '0.00'}
            className={f}
          />
        </div>
        <div>
          <label className={l}>Fecha *</label>
          <input
            type="date"
            value={form.event_date}
            onChange={(e) => setForm((p) => ({ ...p, event_date: e.target.value }))}
            className={f}
          />
        </div>
      </div>

      <div>
        <label className={l}>Estado</label>
        <select
          value={effectiveStatusId}
          onChange={(e) => setForm((p) => ({ ...p, status_id: e.target.value }))}
          className={f}
        >
          <option value="">— Seleccionar —</option>
          {validStatuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={l}>Notas (opcional)</label>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="Pago mínimo, pago total..."
          className={f}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button" onClick={onClose}
          className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => { setError(''); saveMutation.mutate(); }}
          disabled={saveMutation.isPending}
          className="text-sm bg-indigo-600 text-white rounded px-5 py-1.5 hover:bg-indigo-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Registrando...' : 'Confirmar pago'}
        </button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CreditCardPaymentsPage() {
  const [openFormCardId, setOpenFormCardId] = useState<number | null>(null);

  const { data: period } = useQuery({ queryKey: ['active-period'], queryFn: cmd.getActivePeriod });

  const { data: creditCards = [] } = useQuery({
    queryKey: ['credit-cards', period?.id],
    queryFn: () => cmd.listCreditCardBalances(period!.id),
    enabled: !!period,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', period?.id],
    queryFn: () => cmd.listEvents(period!.id),
    enabled: !!period,
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['statuses'],
    queryFn: cmd.listStatusesWithRules,
  });

  const creditCardIds = new Set(creditCards.map((c) => c.id));

  // Pagos TC: eventos debt_payment del período cuyo método de pago es una TC
  const debtPayments = events.filter(
    (e) =>
      e.event_type === 'debt_payment' &&
      e.payment_method_id != null &&
      creditCardIds.has(e.payment_method_id),
  );

  const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const monthLabel = period ? `${MONTH_NAMES[period.month - 1]} ${period.year}` : '';

  if (creditCards.length === 0) {
    return (
      <div className="p-6 max-w-2xl">
        <h2 className="text-2xl font-semibold text-slate-800 mb-2">Pagos de tarjetas</h2>
        <p className="text-sm text-slate-400">No tienes tarjetas de crédito configuradas.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-800">Pagos de tarjetas</h2>
        {period && <p className="text-sm text-slate-400 mt-0.5">{monthLabel}</p>}
      </div>

      {/* Tarjetas — deuda y botón de pago */}
      <section className="space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Deuda acumulada por tarjeta
        </p>
        {creditCards.map((card) => {
          const pct = card.credit_limit_minor > 0
            ? Math.min((card.current_debt_minor / card.credit_limit_minor) * 100, 100)
            : 0;
          const isOpen = openFormCardId === card.id;

          return (
            <div key={card.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{card.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Deuda: <span className="text-orange-600 font-medium">{formatMoney(card.current_debt_minor)}</span>
                    {card.credit_limit_minor > 0 && (
                      <> · Disponible: <span className="font-medium">{formatMoney(card.available_minor)}</span></>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setOpenFormCardId(isOpen ? null : card.id)}
                  disabled={card.current_debt_minor <= 0}
                  className="flex items-center gap-1.5 text-xs font-medium bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-3"
                >
                  <Plus size={13} /> Registrar pago
                </button>
              </div>

              {card.credit_limit_minor > 0 && (
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-orange-300'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {/* Formulario inline */}
              {isOpen && period && (
                <PaymentForm
                  card={card}
                  periodId={period.id}
                  onClose={() => setOpenFormCardId(null)}
                />
              )}
            </div>
          );
        })}
      </section>

      {/* Pagos registrados en el período actual */}
      <section>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Pagos registrados — {monthLabel}
        </p>
        {debtPayments.length === 0 ? (
          <p className="text-sm text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-4 py-4">
            No hay pagos a tarjetas en este período.
          </p>
        ) : (
          <div className="space-y-2">
            {debtPayments.map((e) => {
              const card = creditCards.find((c) => c.id === e.payment_method_id);
              const sw = statuses.find((s) => s.status.id === e.status_id);
              const status = sw?.status;
              return (
                <div key={e.id} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-slate-200 bg-white">
                  <ArrowDownCircle size={15} className="text-indigo-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{e.title}</p>
                    <p className="text-xs text-slate-400">{e.event_date} · {card?.name}</p>
                  </div>
                  {status && (
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: status.color + '22', color: status.color }}>
                      {status.name}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-indigo-700 shrink-0">
                    −{formatMoney(e.amount_minor)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Nota semántica */}
      <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-4 py-3">
        <ArrowDownCircle size={13} className="shrink-0 mt-0.5" />
        <span>
          Un pago de tarjeta reduce la deuda acumulada y descuenta del dinero real.
          Es distinto de registrar un gasto con la tarjeta — ese aumenta la deuda.
        </span>
      </div>
    </div>
  );
}
