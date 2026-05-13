import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import type { FinancialEventRow, RecurringRule, Status } from '../../domain-client/types';

type Option = 'period' | 'stop-date' | 'delete-all';

interface Props {
  event: FinancialEventRow;
  rule: RecurringRule;
  canceladoStatus: Status | undefined;
  onBack: () => void;
  onDone: () => void;
}

// Primer día del mes de una fecha "YYYY-MM-DD"
function firstOfMonth(date: string): string {
  return date.slice(0, 7) + '-01';
}

const today = () => new Date().toISOString().slice(0, 10);

export default function RecurringDeletePanel({ event, rule, canceladoStatus, onBack, onDone }: Props) {
  const qc = useQueryClient();
  const isIncome = event.event_type === 'income';
  const [option, setOption] = useState<Option>('period');
  const [stopDate, setStopDate] = useState(today);
  const [error, setError] = useState('');

  const actionMutation = useMutation({
    mutationFn: async () => {
      switch (option) {
        case 'period': {
          if (!canceladoStatus) throw new Error('Estado "Cancelado" no encontrado en la base de datos');
          const expectedAmount = event.expected_amount_minor ?? event.amount_minor;
          // Marca el evento actual como Cancelado
          await cmd.updateEvent(event.id, {
            title: event.title,
            amount_minor: expectedAmount,
            event_date: event.event_date,
            status_id: canceladoStatus.id,
            category_id: event.category_id ?? undefined,
            payment_method_id: event.payment_method_id ?? undefined,
            exclude_from_total: event.exclude_from_total,
            notes: event.notes ?? undefined,
          });
          // Crea excepción persistente: el generador no recreará este evento
          // aunque sea borrado manualmente en el futuro.
          await cmd.createRecurringException(rule.id, event.period_id);
          return;
        }

        case 'stop-date': {
          if (!stopDate) throw new Error('Selecciona una fecha de detención');
          // 1. Actualiza ends_on de la regla → el generador no creará más eventos
          await cmd.updateRecurringRule(rule.id, {
            event_type: rule.event_type,
            title: rule.title,
            amount_minor: rule.amount_minor,
            frequency: rule.frequency,
            day_of_month: rule.day_of_month ?? undefined,
            interval_days: rule.interval_days ?? undefined,
            category_id: rule.category_id ?? undefined,
            payment_method_id: rule.payment_method_id ?? undefined,
            default_status_id: rule.default_status_id ?? undefined,
            starts_on: rule.starts_on,
            ends_on: stopDate,
            remind_days_before: rule.remind_days_before ?? undefined,
            notes: rule.notes ?? undefined,
          });
          // 2. Cancela eventos ya generados desde esa fecha
          await cmd.cancelFutureRecurringEvents(rule.id, stopDate);
          return;
        }

        case 'delete-all': {
          // Fecha de corte = inicio del período actual del evento
          const cutDate = firstOfMonth(event.event_date);
          // 1. Cancela todos los eventos futuros no pagados (desde el período actual)
          await cmd.cancelFutureRecurringEvents(rule.id, cutDate);
          // 2. Desactiva la regla (soft-delete vía archived_at)
          await cmd.toggleRecurringRule(rule.id, false);
          return;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['recurring-rules'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onDone();
    },
    onError: (err: Error) => setError(err.message),
  });

  const OPTIONS: { id: Option; label: string; desc: string; danger?: boolean }[] = [
    {
      id: 'period',
      label: isIncome ? 'Cancelar solo este cobro' : 'Cancelar solo este pago',
      desc: 'Cancela únicamente este registro del período actual. La regla sigue activa y generará los próximos períodos normalmente.',
    },
    {
      id: 'stop-date',
      label: 'Detener desde una fecha',
      desc: 'Conserva los movimientos anteriores a la fecha indicada. Los movimientos ya generados desde esa fecha se cancelarán y no se crearán nuevos.',
    },
    {
      id: 'delete-all',
      label: 'Desactivar recurrencia',
      desc: 'Desactiva esta regla permanentemente. Se conservarán los movimientos anteriores al período actual. Los movimientos futuros ya generados se cancelarán.',
      danger: true,
    },
  ];

  const confirmLabel: Record<Option, string> = {
    period: isIncome ? 'Cancelar este mes' : 'Cancelar este pago',
    'stop-date': 'Detener recurrencia',
    'delete-all': 'Desactivar recurrencia',
  };

  const confirmClass: Record<Option, string> = {
    period: 'bg-amber-600 hover:bg-amber-700',
    'stop-date': 'bg-orange-600 hover:bg-orange-700',
    'delete-all': 'bg-red-600 hover:bg-red-700',
  };

  return (
    <div className="space-y-4">
      {/* Contexto */}
      <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
        <span>
          <strong>"{rule.title}"</strong> es una regla recurrente.
          Los cambios afectan a futuros períodos.
        </span>
      </div>

      {/* Opciones */}
      <div className="space-y-2">
        {OPTIONS.map((opt) => {
          const selected = option === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setOption(opt.id)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                selected
                  ? opt.danger
                    ? 'border-red-300 bg-red-50'
                    : 'border-indigo-300 bg-indigo-50'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  selected
                    ? opt.danger ? 'border-red-500' : 'border-indigo-600'
                    : 'border-slate-300'
                }`}>
                  {selected && (
                    <div className={`w-2 h-2 rounded-full ${opt.danger ? 'bg-red-500' : 'bg-indigo-600'}`} />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${opt.danger ? 'text-red-700' : 'text-slate-800'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{opt.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Date picker — solo para stop-date */}
      {option === 'stop-date' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Detener a partir de
          </label>
          <input
            type="date"
            value={stopDate}
            onChange={(e) => setStopDate(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <p className="text-xs text-slate-400 mt-1">
            Los movimientos anteriores a esta fecha no se tocan.
            Los ya generados desde esta fecha se cancelarán.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Pie */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft size={15} /> Volver
        </button>
        <button
          type="button"
          onClick={() => { setError(''); actionMutation.mutate(); }}
          disabled={actionMutation.isPending}
          className={`text-sm text-white rounded px-5 py-1.5 font-medium disabled:opacity-50 transition-colors ${confirmClass[option]}`}
        >
          {actionMutation.isPending ? 'Procesando...' : confirmLabel[option]}
        </button>
      </div>
    </div>
  );
}
