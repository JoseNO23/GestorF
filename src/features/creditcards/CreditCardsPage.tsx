import { useQuery } from '@tanstack/react-query';
import { CreditCard, AlertCircle, TrendingDown, ArrowDownCircle } from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import { formatMoney } from '../../utils/money';
import type { CreditCardBalance, CreditCardPurchaseWithProgress } from '../../domain-client/types';

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function usagePercent(debt: number, limit: number) {
  return limit > 0 ? Math.min((debt / limit) * 100, 100) : 0;
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function DataRow({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${valueClass || 'text-slate-800'}`}>{value}</span>
    </div>
  );
}

function cutDateLabel(cutDay: number | null, month: number, year: number): string | null {
  if (!cutDay) return null;
  const d = new Date(year, month - 1, cutDay);
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
}

function dueDateLabel(paymentDueDay: number | null, month: number, year: number): string | null {
  if (!paymentDueDay) return null;
  // El pago es el mes siguiente al corte
  const d = new Date(year, month, paymentDueDay); // month sin -1 = mes siguiente
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
}

function PurchaseProgress({ p }: { p: CreditCardPurchaseWithProgress }) {
  const pct = p.installments > 0 ? Math.min((p.installments_paid / p.installments) * 100, 100) : 0;
  const remaining = p.installments - p.installments_paid;
  const done = remaining <= 0;
  return (
    <div className="py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm text-slate-700 font-medium leading-tight">{p.title}</p>
        {done ? (
          <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0">Saldado</span>
        ) : (
          <span className="text-xs text-slate-500 shrink-0">{formatMoney(p.installment_amount_minor)}/mes</span>
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
          {p.installments_paid}/{p.installments} cuotas
        </span>
      </div>
    </div>
  );
}

function CardPanel({ card, month, year, purchases }: {
  card: CreditCardBalance;
  month: number;
  year: number;
  purchases: CreditCardPurchaseWithProgress[];
}) {
  const pct = usagePercent(card.current_debt_minor, card.credit_limit_minor);
  const isNearLimit = pct >= 90;
  const isOverLimit = card.current_debt_minor > card.credit_limit_minor;
  const cutLabel = cutDateLabel(card.cut_day, month, year);
  const dueLabel = dueDateLabel(card.payment_due_day, month, year);
  const hasMonthlyActivity = card.month_purchases_minor > 0 || card.month_payments_minor > 0;

  return (
    <div className={`rounded-xl border bg-white overflow-hidden ${isNearLimit ? 'border-red-200' : 'border-slate-200'}`}>
      {/* Cabecera */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <CreditCard size={18} className="text-orange-500" />
          <h3 className="font-semibold text-slate-800">{card.name}</h3>
        </div>
        {isOverLimit ? (
          <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1 font-medium">
            <AlertCircle size={11} /> Límite superado
          </div>
        ) : isNearLimit ? (
          <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 font-medium">
            <AlertCircle size={11} /> {Math.round(pct)}% utilizado
          </div>
        ) : null}
      </div>

      {/* Métricas globales */}
      <div className="px-5 pb-4">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Balance global (acumulado)</p>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Deuda actual</p>
            <p className={`text-lg font-bold ${isOverLimit ? 'text-red-600' : 'text-slate-800'}`}>
              {formatMoney(card.current_debt_minor)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Disponible</p>
            <p className={`text-lg font-bold ${card.available_minor <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {formatMoney(card.available_minor)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Límite</p>
            <p className="text-lg font-bold text-slate-400">
              {card.credit_limit_minor > 0 ? formatMoney(card.credit_limit_minor) : '—'}
            </p>
          </div>
        </div>

        {card.credit_limit_minor > 0 && (
          <ProgressBar pct={pct} />
        )}
      </div>

      {/* Métricas mensuales */}
      <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
          {MONTH_NAMES[month - 1]} {year} (informativo)
        </p>
        <div className="space-y-0.5">
          {hasMonthlyActivity ? (
            <>
              <DataRow
                label="Compras este mes"
                value={formatMoney(card.month_purchases_minor)}
                valueClass="text-slate-700"
              />
              <DataRow
                label="Pagos este mes"
                value={formatMoney(card.month_payments_minor)}
                valueClass={card.month_payments_minor > 0 ? 'text-emerald-600' : 'text-slate-400'}
              />
            </>
          ) : (
            <p className="text-xs text-slate-400 py-1">Sin actividad este mes.</p>
          )}
          {cutLabel && (
            <DataRow label="Fecha de corte" value={cutLabel} />
          )}
          {dueLabel && (
            <DataRow label="Límite de pago" value={dueLabel} />
          )}
        </div>
      </div>

      {/* Compras en cuotas */}
      {purchases.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Compras en cuotas</p>
          {purchases.map((p) => <PurchaseProgress key={p.id} p={p} />)}
        </div>
      )}

      {/* Aviso: la deuda no se reinicia por mes */}
      {card.current_debt_minor > 0 && (
        <div className="px-5 py-2.5 border-t border-slate-100 bg-amber-50 flex items-start gap-2">
          <TrendingDown size={13} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            La deuda acumula entre meses. Para reducirla, registra un{' '}
            <strong>pago de deuda</strong> en Gastos cuando pagues el estado de cuenta.
          </p>
        </div>
      )}
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

  const { data: allPurchases = [] } = useQuery({
    queryKey: ['cc-purchases'],
    queryFn: () => cmd.listCreditCardPurchases(),
  });

  const totalDebt = cards.reduce((s, c) => s + c.current_debt_minor, 0);
  const totalAvailable = cards.reduce((s, c) => s + c.available_minor, 0);

  return (
    <div className="p-6 max-w-3xl">
      {/* Encabezado */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-800">Tarjetas de crédito</h2>
        {activePeriod && (
          <p className="text-sm text-slate-400 mt-0.5">
            Mes visible: {MONTH_NAMES[activePeriod.month - 1]} {activePeriod.year} · La deuda es global
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
        <div className="space-y-4">
          {/* Resumen global si hay más de una TC */}
          {cards.length > 1 && (
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Resumen consolidado</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">Deuda total</p>
                  <p className="text-xl font-bold text-slate-800">{formatMoney(totalDebt)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Disponible total</p>
                  <p className="text-xl font-bold text-emerald-600">{formatMoney(totalAvailable)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tarjeta individual */}
          {cards.map((card) => (
            <CardPanel
              key={card.id}
              card={card}
              month={activePeriod?.month ?? new Date().getMonth() + 1}
              year={activePeriod?.year ?? new Date().getFullYear()}
              purchases={allPurchases.filter((p) => p.payment_method_id === card.id)}
            />
          ))}

          {/* Instrucción sobre pagos */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <ArrowDownCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-700">
              Para registrar el pago mensual de la TC, usa <strong>Gastos → Nuevo gasto</strong> con tipo{' '}
              <strong>Deuda → Pago de deuda</strong>. Eso reduce la deuda acumulada.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
