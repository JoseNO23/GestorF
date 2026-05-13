import { useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import type { CreditCardPurchaseWithProgress } from '../../domain-client/types';
import { formatMoney } from '../../utils/money';

function PurchaseCard({ p, cardName }: { p: CreditCardPurchaseWithProgress; cardName?: string }) {
  const pct = p.installments > 0 ? Math.min((p.installments_paid / p.installments) * 100, 100) : 0;
  const remaining = p.installments - p.installments_paid;
  const done = remaining <= 0;
  const barColor = done ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-400' : 'bg-indigo-500';

  return (
    <div className={`rounded-xl border bg-white p-4 ${done ? 'border-slate-100 opacity-75' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{p.title}</p>
          {cardName && (
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <CreditCard size={11} /> {cardName}
            </p>
          )}
        </div>
        {done ? (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 shrink-0">Saldado</span>
        ) : (
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-slate-800">{formatMoney(p.installment_amount_minor)}</p>
            <p className="text-xs text-slate-400">/ mes</p>
          </div>
        )}
      </div>

      {/* Progreso */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{p.installments_paid} de {p.installments} cuotas pagadas</span>
          {!done && <span>{remaining} pendiente{remaining !== 1 ? 's' : ''}</span>}
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Totales */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
        <span>Total original: <strong className="text-slate-700">{formatMoney(p.total_amount_minor)}</strong></span>
        {p.total_with_interest_minor > p.total_amount_minor && (
          <span>Con interés: <strong className="text-amber-600">{formatMoney(p.total_with_interest_minor)}</strong></span>
        )}
        <span>Desde {p.purchase_date.slice(0, 7)}</span>
      </div>
    </div>
  );
}

export default function ExpenseCuotasPage() {
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['cc-purchases'],
    queryFn: () => cmd.listCreditCardPurchases(),
  });

  const { data: methods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: cmd.listPaymentMethods,
  });

  const getCardName = (methodId: number) =>
    methods.find((m) => m.id === methodId)?.name;

  const active = purchases.filter((p) => p.installments_paid < p.installments);
  const completed = purchases.filter((p) => p.installments_paid >= p.installments);

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-800">Compras en cuotas</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          {active.length} activa{active.length !== 1 ? 's' : ''} · {completed.length} saldada{completed.length !== 1 ? 's' : ''}
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : purchases.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CreditCard size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No hay compras en cuotas registradas.</p>
          <p className="text-xs mt-1">
            Crea un gasto con una tarjeta de crédito y activa "¿Pago en cuotas?".
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map((p) => (
                <PurchaseCard key={p.id} p={p} cardName={getCardName(p.payment_method_id)} />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 px-1 mt-2">Saldadas</p>
              <div className="space-y-3">
                {completed.map((p) => (
                  <PurchaseCard key={p.id} p={p} cardName={getCardName(p.payment_method_id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
