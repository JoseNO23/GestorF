import { useQuery } from '@tanstack/react-query';
import { CreditCard, AlertCircle } from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import { formatMoney } from '../../utils/money';

function cutDateThisMonth(cutDay: number | null): string | null {
  if (!cutDay) return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), cutDay);
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
}

function dueDateThisMonth(paymentDueDay: number | null): string | null {
  if (!paymentDueDay) return null;
  const now = new Date();
  // payment due is typically the following month
  const d = new Date(now.getFullYear(), now.getMonth() + 1, paymentDueDay);
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
}

function ProgressBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function CreditCardsPage() {
  const { data: activePeriod } = useQuery({
    queryKey: ['active-period'],
    queryFn: cmd.getActivePeriod,
  });

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['credit-cards', activePeriod?.id],
    queryFn: () => cmd.listCreditCardBalances(activePeriod!.id),
    enabled: !!activePeriod,
  });

  const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-800">Tarjetas de crédito</h2>
        {activePeriod && (
          <p className="text-sm text-slate-400 mt-0.5">
            {activePeriod.year} · {MONTH_NAMES[activePeriod.month - 1]}
          </p>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : cards.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay tarjetas de crédito configuradas.</p>
          <p className="text-xs mt-1">
            Agrega un método de pago de tipo <strong>Crédito (TC)</strong> en Configuración → Métodos de pago.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {cards.map((card) => {
            const usedPct = card.credit_limit_minor > 0
              ? Math.round((card.balance_used_minor / card.credit_limit_minor) * 100)
              : 0;
            const isNearLimit = usedPct >= 90;
            const cutDate = cutDateThisMonth(card.cut_day);
            const dueDate = dueDateThisMonth(card.payment_due_day);

            return (
              <div key={card.id} className={`rounded-xl border bg-white p-5 ${isNearLimit ? 'border-red-200' : 'border-slate-200'}`}>
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-orange-500" />
                    <h3 className="font-semibold text-slate-800">{card.name}</h3>
                  </div>
                  {isNearLimit && (
                    <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-100 rounded-full px-2.5 py-1">
                      <AlertCircle size={11} />
                      Límite al {usedPct}%
                    </div>
                  )}
                </div>

                {/* Montos */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Utilizado este mes</p>
                    <p className="text-lg font-bold text-slate-800">{formatMoney(card.balance_used_minor)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Disponible</p>
                    <p className={`text-lg font-bold ${card.available_minor <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatMoney(card.available_minor)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Límite</p>
                    <p className="text-lg font-bold text-slate-500">
                      {card.credit_limit_minor > 0 ? formatMoney(card.credit_limit_minor) : '—'}
                    </p>
                  </div>
                </div>

                {/* Barra de uso */}
                {card.credit_limit_minor > 0 && (
                  <ProgressBar used={card.balance_used_minor} limit={card.credit_limit_minor} />
                )}

                {/* Fechas */}
                {(cutDate || dueDate) && (
                  <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
                    {cutDate && (
                      <div>
                        <p className="text-xs text-slate-400">Corte</p>
                        <p className="text-sm font-medium text-slate-700">{cutDate}</p>
                      </div>
                    )}
                    {dueDate && (
                      <div>
                        <p className="text-xs text-slate-400">Límite de pago</p>
                        <p className="text-sm font-medium text-slate-700">{dueDate}</p>
                      </div>
                    )}
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
