import { useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import { formatMoney } from '../../utils/money';

export default function CreditCardCuotasPage() {
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['cc-purchases'],
    queryFn: () => cmd.listCreditCardPurchases(),
  });

  const { data: methods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: cmd.listPaymentMethods,
  });

  const creditCards = methods.filter((m) => m.kind === 'credit' && !m.archived_at);

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-800">Cuotas por tarjeta</h2>
        <p className="text-sm text-slate-400 mt-0.5">Compras en cuotas agrupadas por tarjeta</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : creditCards.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CreditCard size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay tarjetas de crédito configuradas.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {creditCards.map((card) => {
            const cardPurchases = purchases.filter((p) => p.payment_method_id === card.id);
            const active = cardPurchases.filter((p) => p.installments_paid < p.installments);
            const totalMonthly = active.reduce((s, p) => s + p.installment_amount_minor, 0);

            return (
              <div key={card.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Cabecera tarjeta */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <CreditCard size={17} className="text-orange-500" />
                    <h3 className="font-semibold text-slate-800">{card.name}</h3>
                  </div>
                  {active.length > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Cuota mensual total</p>
                      <p className="text-sm font-bold text-slate-800">{formatMoney(totalMonthly)}/mes</p>
                    </div>
                  )}
                </div>

                {/* Lista de compras */}
                {cardPurchases.length === 0 ? (
                  <p className="text-sm text-slate-400 px-5 py-4">Sin compras en cuotas.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {cardPurchases.map((p) => {
                      const pct = p.installments > 0
                        ? Math.min((p.installments_paid / p.installments) * 100, 100)
                        : 0;
                      const done = p.installments_paid >= p.installments;
                      return (
                        <div key={p.id} className={`px-5 py-3 ${done ? 'opacity-60' : ''}`}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{p.title}</p>
                              <p className="text-xs text-slate-400">{p.purchase_date.slice(0, 7)}</p>
                            </div>
                            {done ? (
                              <span className="text-xs text-emerald-600 shrink-0">Saldado</span>
                            ) : (
                              <span className="text-sm font-semibold text-slate-800 shrink-0">
                                {formatMoney(p.installment_amount_minor)}/mes
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 shrink-0">
                              {p.installments_paid}/{p.installments}
                            </span>
                          </div>
                        </div>
                      );
                    })}
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
