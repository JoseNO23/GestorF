import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as commands from '../../domain-client/commands';
import { formatPeriod } from '../../utils/money';

export default function MonthSelector() {
  const qc = useQueryClient();

  const { data: period, isLoading } = useQuery({
    queryKey: ['active-period'],
    queryFn: commands.getActivePeriod,
  });

  const changePeriod = useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      commands.setActivePeriod(year, month),
    onSuccess: (newPeriod) => {
      qc.setQueryData(['active-period'], newPeriod);
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });

  const navigate = (direction: -1 | 1) => {
    if (!period) return;
    let { year, month } = period;
    month += direction;
    if (month === 0) { month = 12; year -= 1; }
    if (month === 13) { month = 1; year += 1; }
    changePeriod.mutate({ year, month });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-1">
        <Loader2 size={16} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => navigate(-1)}
        disabled={changePeriod.isPending}
        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-40"
        aria-label="Mes anterior"
      >
        <ChevronLeft size={16} />
      </button>

      <span className="text-sm font-medium text-slate-200 select-none">
        {period ? formatPeriod(period.year, period.month) : '—'}
      </span>

      <button
        onClick={() => navigate(1)}
        disabled={changePeriod.isPending}
        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-40"
        aria-label="Mes siguiente"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
