import { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import * as cmd from '../../domain-client/commands';
import { formatMoney } from '../../utils/money';

// ─── Colores semánticos ───────────────────────────────────────────────────────
const C = {
  cobrado:    '#10b981', // verde  — ingreso confirmado
  esperado:   '#f59e0b', // ámbar  — ingreso pendiente/esperado
  gasto:      '#ef4444', // rojo   — gasto real
  disponible: '#6366f1', // índigo — dinero disponible / crédito libre
  deuda:      '#f97316', // naranja — deuda TC
  balance:    '#8b5cf6', // violeta — balance neto
  grid:       '#f1f5f9',
};

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const fmtMonthLabel = (y: number, m: number) => `${MONTHS_ES[m - 1]} ${String(y).slice(2)}`;
const fmtTick = (v: number) => `S/${(v / 100).toFixed(0)}`;
// ─── Helpers de escala dinámica ───────────────────────────────────────────────
function dynamicMax(values: number[], margin = 1.15): number {
  const max = Math.max(...values.filter(v => v > 0), 1);
  const raw = max * margin;
  // redondear al siguiente múltiplo de 100 para ticks limpios (en centavos)
  const step = Math.pow(10, Math.floor(Math.log10(raw / 100)));
  return Math.ceil(raw / (step * 100)) * step * 100;
}

// ─── Tooltip personalizado ────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      {label && <p className="font-semibold text-slate-600 mb-1.5">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-medium text-slate-800">{formatMoney(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Tarjeta KPI mini ────────────────────────────────────────────────────────
function MiniKpi({ label, value, sub, color = 'text-slate-800' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Selector de rango ────────────────────────────────────────────────────────
const RANGES: { label: string; months: number }[] = [
  { label: '3 meses', months: 3 },
  { label: '6 meses', months: 6 },
  { label: '12 meses', months: 12 },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ChartsPage() {
  const [rangeMonths, setRangeMonths] = useState(6);

  const { data: period } = useQuery({ queryKey: ['active-period'], queryFn: cmd.getActivePeriod });
  const { data: dashData } = useQuery({
    queryKey: ['dashboard', period?.id],
    queryFn: () => cmd.getDashboard(period!.id),
    enabled: !!period,
  });
  const { data: allEvents = [] } = useQuery({
    queryKey: ['events', period?.id],
    queryFn: () => cmd.listEvents(period!.id),
    enabled: !!period,
  });
  const { data: evolution = [] } = useQuery({
    queryKey: ['evolution', rangeMonths],
    queryFn: () => cmd.getEvolution(rangeMonths),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: cmd.listCategories,
  });
  const { data: creditCards = [] } = useQuery({
    queryKey: ['credit-cards', period?.id],
    queryFn: () => cmd.listCreditCardBalances(period!.id),
    enabled: !!period,
  });
  // ── Datos del mes actual ────────────────────────────────────────────────────
  const cobrado = dashData?.total_ingresos ?? 0;
  const esperado = dashData?.total_ingresos_esperados ?? 0;
  const gastos = dashData?.total_gastos ?? 0;
  const balance = cobrado - gastos;
  const pctAhorro = cobrado > 0 ? ((cobrado - gastos) / cobrado) * 100 : 0;

  const barMesData = [
    { name: 'Cobrado', value: cobrado, fill: C.cobrado },
    { name: 'Esperado', value: esperado, fill: C.esperado },
    { name: 'Gastos', value: gastos, fill: C.gasto },
  ];
  const barMesMax = dynamicMax([cobrado, esperado, gastos]);

  // ── Gastos por categoría ────────────────────────────────────────────────────
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const byCat = useMemo(() => {
    const map = new Map<string, { name: string; color: string; value: number }>();
    for (const e of allEvents) {
      if (e.event_type !== 'expense' && e.event_type !== 'debt_charge') continue;
      if (e.exclude_from_total) continue;
      const cat = e.category_id ? categoryMap.get(e.category_id) : null;
      const key = String(e.category_id ?? 'none');
      const entry = map.get(key) ?? { name: cat?.name ?? 'Sin categoría', color: cat?.color ?? '#94a3b8', value: 0 };
      entry.value += e.amount_minor;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 8);
  }, [allEvents, categories]);

  // ── Evolución mensual ────────────────────────────────────────────────────────
  const lineData = evolution.map((p) => ({
    name: fmtMonthLabel(p.year, p.month),
    cobrado: p.total_ingresos,
    esperado: p.total_ingresos_esperados,
    gastos: p.total_gastos,
    balance: p.total_ingresos - p.total_gastos,
  }));

  const allLineVals = lineData.flatMap((d) => [d.cobrado, d.esperado, d.gastos]);
  const lineMax = dynamicMax(allLineVals);
  const lineMin = Math.min(...lineData.map((d) => d.balance).filter((v) => v < 0), 0);

  // ── TC ────────────────────────────────────────────────────────────────────
  const tcBarData = creditCards.map((c) => ({
    name: c.name,
    deuda: c.current_debt_minor,
    disponible: c.available_minor,
    limite: c.credit_limit_minor,
  }));
  const tcMax = dynamicMax(creditCards.map((c) => c.credit_limit_minor));

  const noMesData = cobrado === 0 && gastos === 0;
  const monthLabel = period ? `${MONTHS_ES[period.month - 1]} ${period.year}` : '';

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      {/* Cabecera + selector de rango */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Gráficas</h2>
          {period && <p className="text-sm text-slate-400 mt-0.5">{monthLabel}</p>}
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {RANGES.map(({ label, months }) => (
            <button
              key={months}
              onClick={() => setRangeMonths(months)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                rangeMonths === months
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 1. Mes actual — análisis ─────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
          Mes actual — {monthLabel}
        </h3>

        {noMesData ? (
          <p className="text-sm text-slate-400 bg-white rounded-xl border border-slate-200 py-10 text-center">
            Sin datos en este mes.
          </p>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <MiniKpi
                label="Cobrado"
                value={formatMoney(cobrado)}
                sub={esperado > cobrado ? `de ${formatMoney(esperado)} esperados` : undefined}
                color="text-emerald-600"
              />
              <MiniKpi label="Gastos" value={formatMoney(gastos)} color="text-red-500" />
              <MiniKpi
                label="Balance neto"
                value={formatMoney(balance)}
                color={balance >= 0 ? 'text-emerald-700' : 'text-red-600'}
              />
              <MiniKpi
                label="% Ahorro"
                value={`${pctAhorro >= 0 ? pctAhorro.toFixed(1) : '0.0'}%`}
                color={pctAhorro >= 20 ? 'text-emerald-600' : pctAhorro >= 0 ? 'text-amber-600' : 'text-red-600'}
              />
            </div>

            {/* Barra cobrado vs esperado vs gastos */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-medium text-slate-500 mb-3">Cobrado · Esperado · Gastos</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barMesData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={fmtTick}
                    tick={{ fontSize: 10 }}
                    width={54}
                    domain={[0, barMesMax]}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {barMesData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>

      {/* ── 2. Gastos por categoría ───────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
          Gastos por categoría — {monthLabel}
        </h3>
        {byCat.length === 0 ? (
          <p className="text-sm text-slate-400 bg-white rounded-xl border border-slate-200 py-10 text-center">
            Sin gastos categorizados en este mes.
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-5 grid grid-cols-2 gap-6">
            {/* Donut */}
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={byCat}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {byCat.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <div className="bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs shadow">
                        <p className="font-medium text-slate-700">{payload[0].name}</p>
                        <p className="text-slate-600">{formatMoney(payload[0].value as number)}</p>
                        <p className="text-slate-400">
                          {((payload[0].payload.percent ?? 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Lista ordenada */}
            <div className="flex flex-col justify-center space-y-2">
              {byCat.map((cat) => {
                const pct = gastos > 0 ? (cat.value / gastos) * 100 : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-slate-600 truncate max-w-28">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-400">{pct.toFixed(0)}%</span>
                        <span className="font-medium text-slate-700">{formatMoney(cat.value)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1">
                      <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── 3. Evolución mensual ──────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
          Evolución — últimos {rangeMonths} meses
        </h3>
        {lineData.length < 2 ? (
          <p className="text-sm text-slate-400 bg-white rounded-xl border border-slate-200 py-10 text-center">
            Necesitas al menos 2 meses con datos.
          </p>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
            {/* Área: ingresos cobrados vs gastos */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-3">Ingresos cobrados · Gastos · Balance neto</p>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={lineData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gradCobrado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.cobrado} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={C.cobrado} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradGasto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.gasto} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={C.gasto} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={fmtTick}
                    tick={{ fontSize: 10 }}
                    width={56}
                    domain={[Math.min(lineMin, 0), lineMax]}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend formatter={(v) => (
                    <span className="text-xs capitalize text-slate-600">{v}</span>
                  )} />
                  {lineMin < 0 && <ReferenceLine y={0} stroke={C.grid} strokeWidth={1.5} />}
                  <Area type="monotone" dataKey="cobrado" name="Cobrado" stroke={C.cobrado} strokeWidth={2}
                    fill="url(#gradCobrado)" dot={{ r: 3, fill: C.cobrado }} />
                  <Area type="monotone" dataKey="gastos" name="Gastos" stroke={C.gasto} strokeWidth={2}
                    fill="url(#gradGasto)" dot={{ r: 3, fill: C.gasto }} />
                  <Area type="monotone" dataKey="balance" name="Balance neto" stroke={C.balance} strokeWidth={1.5}
                    fill="none" strokeDasharray="4 3" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Línea: cobrado vs esperado */}
            {lineData.some((d) => d.esperado > d.cobrado) && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-3">Cobrado vs esperado (gap de ingresos)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={lineData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="gradEsperado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.esperado} stopOpacity={0.12} />
                        <stop offset="95%" stopColor={C.esperado} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtTick} tick={{ fontSize: 10 }} width={56} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
                    <Area type="monotone" dataKey="esperado" name="Esperado" stroke={C.esperado} strokeWidth={1.5}
                      fill="url(#gradEsperado)" dot={false} />
                    <Area type="monotone" dataKey="cobrado" name="Cobrado" stroke={C.cobrado} strokeWidth={2}
                      fill="none" dot={{ r: 3, fill: C.cobrado }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 4. Tarjetas de crédito ────────────────────────────────────────── */}
      {creditCards.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
            Tarjetas de crédito — deuda acumulada
          </h3>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-400 mb-3">
              La deuda es global (acumulada entre meses). Deuda / Disponible / Límite.
            </p>
            <ResponsiveContainer width="100%" height={Math.max(120, creditCards.length * 60)}>
              <BarChart
                layout="vertical"
                data={tcBarData}
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={fmtTick}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, tcMax]}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={80}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={(v) => <span className="text-xs text-slate-600 capitalize">{v}</span>} />
                <Bar dataKey="deuda" name="Deuda" fill={C.deuda} radius={[0, 4, 4, 0]} maxBarSize={18} />
                <Bar dataKey="disponible" name="Disponible" fill={C.disponible} radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>

            {/* Tabla resumen de TC */}
            <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
              {creditCards.map((card) => {
                const pct = card.credit_limit_minor > 0
                  ? (card.current_debt_minor / card.credit_limit_minor) * 100
                  : 0;
                return (
                  <div key={card.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{card.name}</span>
                      <span className={pct >= 90 ? 'text-red-600 font-medium' : 'text-slate-500'}>
                        {formatMoney(card.current_debt_minor)} / {formatMoney(card.credit_limit_minor)}
                        <span className="ml-1 text-slate-400">({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-orange-400'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
