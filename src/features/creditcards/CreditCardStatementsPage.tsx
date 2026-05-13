import { useQuery } from '@tanstack/react-query';
import { CreditCard, Calendar } from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import { formatMoney } from '../../utils/money';

function nextOccurrence(day: number, fromDate: Date): Date {
  const d = new Date(fromDate);
  d.setDate(day);
  if (d <= fromDate) d.setMonth(d.getMonth() + 1);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CreditCardStatementsPage() {
  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: cmd.listPaymentMethods,
  });

  const { data: balances = [] } = useQuery({
    queryKey: ['credit-cards'],
    queryFn: async () => {
      const period = await cmd.getActivePeriod();
      return cmd.listCreditCardBalances(period.id);
    },
  });

  const creditCards = methods.filter((m) => m.kind === 'credit' && !m.archived_at);
  const today = new Date();

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-800">Estados de cuenta</h2>
        <p className="text-sm text-slate-400 mt-0.5">Próximas fechas de corte y pago por tarjeta</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : creditCards.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CreditCard size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay tarjetas de crédito configuradas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {creditCards.map((card) => {
            const balance = balances.find((b) => b.id === card.id);
            const nextCut = card.cut_day ? nextOccurrence(card.cut_day, today) : null;
            const nextPayment = card.payment_due_day
              ? nextOccurrence(card.payment_due_day, nextCut ?? today)
              : null;

            const daysUntilCut = nextCut
              ? Math.ceil((nextCut.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <div key={card.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Cabecera */}
                <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
                  <CreditCard size={17} className="text-orange-500" />
                  <h3 className="font-semibold text-slate-800">{card.name}</h3>
                  {daysUntilCut != null && daysUntilCut <= 7 && (
                    <span className="ml-auto text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                      Corte en {daysUntilCut}d
                    </span>
                  )}
                </div>

                {/* Fechas */}
                <div className="grid grid-cols-2 divide-x divide-slate-100 px-5 py-4">
                  <div className="pr-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                      <Calendar size={11} /> Próximo corte
                    </div>
                    <p className="text-sm font-medium text-slate-800">
                      {nextCut ? formatDate(nextCut) : '—'}
                    </p>
                    {card.cut_day && (
                      <p className="text-xs text-slate-400 mt-0.5">Día {card.cut_day} de cada mes</p>
                    )}
                  </div>
                  <div className="pl-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                      <Calendar size={11} /> Límite de pago
                    </div>
                    <p className="text-sm font-medium text-slate-800">
                      {nextPayment ? formatDate(nextPayment) : '—'}
                    </p>
                    {card.payment_due_day && (
                      <p className="text-xs text-slate-400 mt-0.5">Día {card.payment_due_day} del mes siguiente</p>
                    )}
                  </div>
                </div>

                {/* Deuda actual */}
                {balance && (
                  <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <span className="text-sm text-slate-500">Deuda acumulada</span>
                    <span className="text-sm font-bold text-slate-800">
                      {formatMoney(balance.current_debt_minor)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
