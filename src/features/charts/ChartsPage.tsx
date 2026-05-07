import { useQuery } from '@tanstack/react-query';
import * as cmd from '../../domain-client/commands';
import { formatMoney } from '../../utils/money';

export default function ChartsPage() {
  const { data: period } = useQuery({ queryKey: ['active-period'], queryFn: cmd.getActivePeriod });
  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ['events', period?.id],
    queryFn: () => cmd.listEvents(period!.id),
    enabled: !!period,
  });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: cmd.listCategories });

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Gastos por categoría (no excluidos)
  const expensesByCategory = new Map<number | null, number>();
  for (const e of allEvents) {
    if (e.event_type !== 'expense' && e.event_type !== 'debt_charge') continue;
    if (e.exclude_from_total) continue;
    const key = e.category_id ?? null;
    expensesByCategory.set(key, (expensesByCategory.get(key) ?? 0) + e.amount_minor);
  }

  const totalGastos = [...expensesByCategory.values()].reduce((s, v) => s + v, 0);
  const totalIngresos = allEvents
    .filter((e) => e.event_type === 'income' || e.event_type === 'receivable')
    .reduce((s, e) => s + e.amount_minor, 0);

  const sorted = [...expensesByCategory.entries()]
    .sort((a, b) => b[1] - a[1]);

  if (isLoading) return <div className="p-6 text-sm text-slate-400">Cargando...</div>;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h2 className="text-2xl font-semibold text-slate-800">Gráficas</h2>

      {/* Ingresos vs Gastos */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Ingresos vs Gastos</h3>
        {totalIngresos === 0 && totalGastos === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Sin datos en este mes.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Ingresos</span><span className="font-mono text-emerald-700">{formatMoney(totalIngresos)}</span>
              </div>
              <div className="h-4 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: totalIngresos === 0 ? '0%' : '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Gastos</span><span className="font-mono text-red-600">{formatMoney(totalGastos)}</span>
              </div>
              <div className="h-4 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-red-400 rounded-full transition-all"
                  style={{ width: totalIngresos === 0 ? '100%' : `${Math.min(100, (totalGastos / totalIngresos) * 100).toFixed(1)}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gastos por categoría */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Gastos por categoría</h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Sin gastos en este mes.</p>
        ) : (
          <div className="space-y-3">
            {sorted.map(([catId, amount]) => {
              const cat = catId !== null ? categoryMap.get(catId) : null;
              const pct = totalGastos > 0 ? (amount / totalGastos) * 100 : 0;
              return (
                <div key={catId ?? 'sin-categoria'}>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span className="flex items-center gap-1.5">
                      {cat && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />}
                      {cat?.name ?? 'Sin categoría'}
                    </span>
                    <span className="font-mono">{formatMoney(amount)} <span className="text-slate-400">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct.toFixed(1)}%`, backgroundColor: cat?.color ?? '#94a3b8' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
