import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, TrendingUp, TrendingDown, Wallet, Clock, BarChart2 } from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import { formatMoney } from '../../utils/money';
import type { FinancialEventRow } from '../../domain-client/types';

function KpiCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-800 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function RecentRow({ event }: { event: FinancialEventRow }) {
  const isIncome = event.event_type === 'income' || event.event_type === 'receivable';
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-700">{event.title}</p>
        <p className="text-xs text-slate-400">{event.event_date}</p>
      </div>
      <span className={`text-sm font-mono font-semibold ${isIncome ? 'text-emerald-600' : 'text-slate-700'}`}>
        {isIncome ? '+' : '-'}{formatMoney(event.amount_minor)}
      </span>
    </div>
  );
}

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

  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Dashboard</h2>
          <p className="text-sm text-slate-400 mt-0.5">{months[period.month - 1]} {period.year}</p>
        </div>
        {data.alertas_vencidos > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium px-4 py-2 rounded-lg">
            <AlertTriangle size={16} />
            {data.alertas_vencidos} vencido{data.alertas_vencidos > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Dinero real" value={formatMoney(data.dinero_real)} sub="efectivo actual" icon={Wallet} color="bg-indigo-500" />
        <KpiCard label="Dinero disponible" value={formatMoney(data.dinero_disponible)} sub="real − compromisos" icon={Clock} color="bg-blue-500" />
        <KpiCard label="Proyección" value={formatMoney(data.dinero_futuro)} sub="al cierre del mes" icon={BarChart2} color="bg-purple-500" />
      </div>

      {/* Ingresos vs Gastos */}
      <div className="grid grid-cols-2 gap-4">
        <KpiCard label="Ingresos del mes" value={formatMoney(data.total_ingresos)} icon={TrendingUp} color="bg-emerald-500" />
        <KpiCard label="Gastos del mes" value={formatMoney(data.total_gastos)} icon={TrendingDown} color="bg-red-400" />
      </div>

      {/* Movimientos recientes */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Movimientos recientes</h3>
        {data.movimientos_recientes.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">
            No hay movimientos en este mes. Registra un ingreso o gasto para comenzar.
          </p>
        ) : (
          data.movimientos_recientes.map((e) => <RecentRow key={e.id} event={e} />)
        )}
      </div>
    </div>
  );
}
