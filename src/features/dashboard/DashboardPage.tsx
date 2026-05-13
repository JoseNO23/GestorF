import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, TrendingUp, TrendingDown, Wallet, Clock,
  BarChart2, Info, RotateCcw,
} from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import { formatMoney } from '../../utils/money';
import type { FinancialEventRow } from '../../domain-client/types';

// ─── KpiCard ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-800 mt-0.5 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── SectionLabel ────────────────────────────────────────────────────────────
function SectionLabel({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{children}</h3>
      {note && <span className="text-xs text-slate-300">{note}</span>}
    </div>
  );
}

// ─── RecentRow ───────────────────────────────────────────────────────────────
function RecentRow({ event }: { event: FinancialEventRow }) {
  const isIncome = event.event_type === 'income' || event.event_type === 'receivable';
  const isPartial = isIncome
    && event.received_amount_minor != null
    && event.received_amount_minor !== event.amount_minor;

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {event.recurring_rule_id && (
          <RotateCcw size={11} className="text-indigo-300 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">{event.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{event.event_date}</p>
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <span className={`text-sm font-mono font-semibold ${isIncome ? 'text-emerald-600' : 'text-slate-700'}`}>
          {isIncome ? '+' : '-'}
          {isPartial ? formatMoney(event.received_amount_minor!) : formatMoney(event.amount_minor)}
        </span>
        {isPartial && (
          <p className="text-xs text-amber-500">de {formatMoney(event.amount_minor)}</p>
        )}
      </div>
    </div>
  );
}

// ─── TCBlock — tarjeta compacta ───────────────────────────────────────────────
function TCBlock({ deuda, disponible, limite }: { deuda: number; disponible: number; limite: number }) {
  const pct = limite > 0 ? Math.min((deuda / limite) * 100, 100) : 0;
  const barColor = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-orange-300';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      {/* Fila de métricas */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Deuda</p>
          <p className="text-lg font-bold text-orange-600 tabular-nums">{formatMoney(deuda)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Disponible</p>
          <p className="text-lg font-bold text-slate-700 tabular-nums">{formatMoney(disponible)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Límite</p>
          <p className="text-lg font-bold text-slate-400 tabular-nums">
            {limite > 0 ? formatMoney(limite) : '—'}
          </p>
        </div>
      </div>

      {/* Barra de uso */}
      {limite > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>{pct.toFixed(0)}% utilizado</span>
            <span className="font-medium">{formatMoney(deuda)} / {formatMoney(limite)}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Nota tooltip */}
      <div className="flex items-start gap-1.5 text-xs text-slate-400">
        <Info size={11} className="shrink-0 mt-0.5" />
        <span>El crédito disponible no forma parte de tu dinero real. Solo representa capacidad de compra financiada.</span>
      </div>
    </div>
  );
}

// ─── DashboardPage ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: period } = useQuery({ queryKey: ['active-period'], queryFn: cmd.getActivePeriod });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard', period?.id],
    queryFn: () => cmd.getDashboard(period!.id),
    enabled: !!period,
  });

  if (isLoading || !period) {
    return <div className="p-6 text-sm text-slate-400">Cargando dashboard...</div>;
  }

  if (isError || !data) {
    return (
      <div className="p-6 space-y-2">
        <p className="text-sm font-medium text-red-600">Error al cargar el dashboard.</p>
        {error && (
          <pre className="text-xs text-red-500 bg-red-50 rounded p-3 whitespace-pre-wrap break-all">
            {String(error)}
          </pre>
        )}
      </div>
    );
  }

  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const monthLabel = `${MONTHS[period.month - 1]} ${period.year}`;
  const balance = data.total_ingresos - data.total_gastos;
  const hasTc = data.tc_limite_total > 0 || data.tc_deuda_total > 0;

  return (
    <div className="p-6 space-y-7 max-w-3xl">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Dashboard</h2>
          <p className="text-sm text-slate-400 mt-0.5">{monthLabel}</p>
        </div>
        {data.alertas_vencidos > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium px-4 py-2 rounded-lg">
            <AlertTriangle size={15} />
            {data.alertas_vencidos} vencido{data.alertas_vencidos > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── Bloque 1: Tu dinero ─────────────────────────────────────────── */}
      <section>
        <SectionLabel note="excluye crédito TC">Tu dinero</SectionLabel>
        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            label="Dinero real"
            value={formatMoney(data.dinero_real)}
            sub="efectivo + cobrados"
            icon={Wallet}
            color="bg-indigo-500"
          />
          <KpiCard
            label="Disponible"
            value={formatMoney(data.dinero_disponible)}
            sub="real − compromisos"
            icon={Clock}
            color="bg-blue-500"
          />
          <KpiCard
            label="Proyección"
            value={formatMoney(data.dinero_futuro)}
            sub="al cierre del mes"
            icon={BarChart2}
            color="bg-purple-500"
          />
        </div>
      </section>

      {/* ── Bloque 2: Este mes ──────────────────────────────────────────── */}
      <section>
        <SectionLabel>{monthLabel} — resumen</SectionLabel>
        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            label="Cobrado"
            value={formatMoney(data.total_ingresos)}
            sub={data.total_ingresos_esperados > data.total_ingresos
              ? `de ${formatMoney(data.total_ingresos_esperados)} esperados`
              : 'total cobrado'}
            icon={TrendingUp}
            color="bg-emerald-500"
          />
          <KpiCard
            label="Gastos"
            value={formatMoney(data.total_gastos)}
            sub="gastos del período"
            icon={TrendingDown}
            color="bg-red-400"
          />
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-center">
            <p className="text-xs font-medium text-slate-500">Balance neto</p>
            <p className={`text-xl font-bold mt-0.5 tabular-nums ${balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {balance >= 0 ? '+' : ''}{formatMoney(balance)}
            </p>
            {data.total_ingresos > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">
                {((data.total_ingresos - data.total_gastos) / data.total_ingresos * 100).toFixed(0)}% de ahorro
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Bloque 3: Crédito (solo si existe) ────────────────────────── */}
      {hasTc && (
        <section>
          <SectionLabel>Crédito</SectionLabel>
          <TCBlock
            deuda={data.tc_deuda_total}
            disponible={data.tc_disponible_total}
            limite={data.tc_limite_total}
          />
        </section>
      )}

      {/* ── Movimientos recientes ───────────────────────────────────────── */}
      <section>
        <SectionLabel>Movimientos recientes</SectionLabel>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {data.movimientos_recientes.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              No hay movimientos en este mes.
            </p>
          ) : (
            data.movimientos_recientes.map((e) => <RecentRow key={e.id} event={e} />)
          )}
        </div>
      </section>

    </div>
  );
}
