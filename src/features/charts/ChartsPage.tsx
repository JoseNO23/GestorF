import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import * as cmd from '../../domain-client/commands';
import { formatMoney, MONTHS_ES } from '../../utils/money';

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316'];

const fmtAmount = (v: unknown) => typeof v === 'number' ? formatMoney(v) : '';
const fmtMonth = (year: number, month: number) => `${MONTHS_ES[month - 1].slice(0, 3)} ${String(year).slice(2)}`;

export default function ChartsPage() {
  const { data: period } = useQuery({ queryKey: ['active-period'], queryFn: cmd.getActivePeriod });

  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ['events', period?.id],
    queryFn: () => cmd.listEvents(period!.id),
    enabled: !!period,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: cmd.listCategories,
  });

  const { data: evolution = [] } = useQuery({
    queryKey: ['evolution'],
    queryFn: () => cmd.getEvolution(6),
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Gastos por categoría
  const byCategory = new Map<string, { name: string; color: string; value: number }>();
  for (const e of allEvents) {
    if (e.event_type !== 'expense' && e.event_type !== 'debt_charge') continue;
    if (e.exclude_from_total) continue;
    const cat = e.category_id ? categoryMap.get(e.category_id) : null;
    const key = cat ? String(cat.id) : 'sin-cat';
    const entry = byCategory.get(key) ?? { name: cat?.name ?? 'Sin categoría', color: cat?.color ?? '#94a3b8', value: 0 };
    entry.value += e.amount_minor;
    byCategory.set(key, entry);
  }
  const pieData = [...byCategory.values()].sort((a, b) => b.value - a.value);

  // Ingresos vs gastos mes actual
  const totalIngresos = allEvents.filter((e) => e.event_type === 'income' || e.event_type === 'receivable').reduce((s, e) => s + e.amount_minor, 0);
  const totalGastos = allEvents.filter((e) => (e.event_type === 'expense' || e.event_type === 'debt_charge') && !e.exclude_from_total).reduce((s, e) => s + e.amount_minor, 0);
  const barData = [
    { name: 'Ingresos', value: totalIngresos },
    { name: 'Gastos', value: totalGastos },
  ];

  // Evolución mensual
  const lineData = evolution.map((p) => ({
    name: fmtMonth(p.year, p.month),
    ingresos: p.total_ingresos,
    gastos: p.total_gastos,
  }));

  if (isLoading) return <div className="p-6 text-sm text-slate-400">Cargando...</div>;

  const noData = totalIngresos === 0 && totalGastos === 0;

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <h2 className="text-2xl font-semibold text-slate-800">Gráficas</h2>

      {/* Ingresos vs Gastos — BarChart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Ingresos vs Gastos — mes actual</h3>
        {noData ? (
          <p className="text-sm text-slate-400 text-center py-8">Sin datos en este mes.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `S/${(v / 100).toFixed(0)}`} tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v) => fmtAmount(v)} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                <Cell fill="#10b981" />
                <Cell fill="#ef4444" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Gastos por categoría — PieChart donut */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Gastos por categoría</h3>
        {pieData.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Sin gastos en este mes.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.color || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmtAmount(v)} />
              <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Evolución mensual — LineChart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Evolución últimos 6 meses</h3>
        {lineData.length < 2 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            Necesitas al menos 2 meses con datos para ver la evolución.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lineData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `S/${(v / 100).toFixed(0)}`} tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v) => fmtAmount(v)} />
              <Legend formatter={(v) => <span className="text-xs capitalize">{v}</span>} />
              <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
