import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle2 } from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import type { FinancialEventRow, StatusWithRules } from '../../domain-client/types';
import { formatMoney, minorToInputStr } from '../../utils/money';

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function isPaidStatus(statusId: number, statuses: StatusWithRules[]) {
  const sw = statuses.find((s) => s.status.id === statusId);
  return sw?.rules.some((r) => r.counts_as_paid) ?? false;
}

function EventRow({ event, statuses }: { event: FinancialEventRow; statuses: StatusWithRules[] }) {
  const sw = statuses.find((s) => s.status.id === event.status_id);
  const status = sw?.status;
  const paid = isPaidStatus(event.status_id, statuses);
  const expected = event.expected_amount_minor ?? event.amount_minor;
  const received = event.received_amount_minor;

  return (
    <div className={`flex items-center gap-4 px-4 py-3 rounded-lg border bg-white ${paid ? 'border-slate-100 opacity-70' : 'border-slate-200'}`}>
      {paid
        ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
        : <Clock size={16} className="text-amber-400 shrink-0" />
      }

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{event.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{event.event_date}</p>
      </div>

      {received != null && received !== expected && (
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400">S/ {minorToInputStr(received)}</p>
          <p className="text-xs text-slate-400">de S/ {minorToInputStr(expected)}</p>
        </div>
      )}

      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-slate-700">{formatMoney(expected)}</p>
        {status && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: status.color + '22', color: status.color }}>
            {status.name}
          </span>
        )}
      </div>
    </div>
  );
}

export default function IncomeExpectedPage() {
  const { data: period } = useQuery({ queryKey: ['active-period'], queryFn: cmd.getActivePeriod });

  const { data: events = [] } = useQuery({
    queryKey: ['events', period?.id],
    queryFn: () => cmd.listEvents(period!.id),
    enabled: !!period,
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['statuses'],
    queryFn: cmd.listStatusesWithRules,
  });

  const incomeEvents = events.filter((e) => e.event_type === 'income');
  const pending = incomeEvents.filter((e) => !isPaidStatus(e.status_id, statuses));
  const received = incomeEvents.filter((e) => isPaidStatus(e.status_id, statuses));

  const monthLabel = period
    ? `${MONTH_NAMES[period.month - 1]} ${period.year}`
    : '';

  const totalExpected = incomeEvents.reduce((s, e) => s + (e.expected_amount_minor ?? e.amount_minor), 0);
  const totalReceived = incomeEvents.reduce((s, e) => s + (e.received_amount_minor ?? (isPaidStatus(e.status_id, statuses) ? e.amount_minor : 0)), 0);

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-800">Ingresos esperados</h2>
        {period && (
          <p className="text-sm text-slate-400 mt-0.5">
            Período: {monthLabel} · {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-400 mb-1">Total esperado</p>
          <p className="text-xl font-bold text-slate-800">{formatMoney(totalExpected)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-400 mb-1">Cobrado hasta ahora</p>
          <p className="text-xl font-bold text-emerald-600">{formatMoney(totalReceived)}</p>
        </div>
      </div>

      {/* Pendientes */}
      {pending.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 px-1">Pendientes</p>
          <div className="space-y-2">
            {pending.map((e) => (
              <EventRow key={e.id} event={e} statuses={statuses} />
            ))}
          </div>
        </div>
      )}

      {/* Cobrados */}
      {received.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 px-1">Cobrados</p>
          <div className="space-y-2">
            {received.map((e) => (
              <EventRow key={e.id} event={e} statuses={statuses} />
            ))}
          </div>
        </div>
      )}

      {incomeEvents.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Clock size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay ingresos registrados en este período.</p>
          <p className="text-xs mt-1">
            Crea ingresos en <strong>Movimientos</strong> o activa reglas en <strong>Recurrentes</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
