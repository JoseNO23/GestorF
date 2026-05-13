import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import type { FinancialEventRow } from '../../domain-client/types';
import Modal from '../../components/Modal/Modal';
import IncomeForm from './IncomeForm';
import { formatMoney } from '../../utils/money';

export default function IncomePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FinancialEventRow | null>(null);

  const { data: period } = useQuery({ queryKey: ['active-period'], queryFn: cmd.getActivePeriod });

  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ['events', period?.id],
    queryFn: () => cmd.listEvents(period!.id),
    enabled: !!period,
  });

  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: cmd.listStatusesWithRules });

  const excludedStatusIds = new Set(
    statuses
      .filter((sw) => sw.rules.some((r) => r.exclude_from_total_default))
      .map((sw) => sw.status.id)
  );

  const incomes = allEvents.filter(
    (e) => (e.event_type === 'income' || e.event_type === 'receivable') && !excludedStatusIds.has(e.status_id)
  );

  const deleteMutation = useMutation({
    mutationFn: cmd.deleteEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const statusMap = new Map(statuses.map((sw) => [sw.status.id, sw.status]));
  const total = incomes.reduce((sum, e) => sum + e.amount_minor, 0);

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit = (e: FinancialEventRow) => { setEditing(e); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Ingresos</h2>
          {period && (
            <p className="text-sm text-slate-400 mt-0.5">
              {period.year} · {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][period.month - 1]}
            </p>
          )}
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
          <Plus size={16} /> Registrar ingreso
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400 py-6">Cargando...</p>
      ) : incomes.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No hay ingresos en este mes.</p>
          <p className="text-xs mt-1">Usa "Registrar ingreso" para agregar el primero.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
            <span>Descripción</span>
            <span className="mr-16">Estado</span>
            <span className="mr-8 text-right">Monto</span>
            <span />
          </div>

          {incomes.map((income) => {
            const status = statusMap.get(income.status_id);
            return (
              <div key={income.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {income.recurring_rule_id && (
                      <span title="Generado por regla recurrente"><RotateCcw size={11} className="text-indigo-400 shrink-0" /></span>
                    )}
                    <p className="text-sm font-medium text-slate-800 truncate">{income.title}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{income.event_date}</p>
                </div>

                {status && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: status.color + '22', color: status.color }}>
                    {status.name}
                  </span>
                )}

                <span className="text-sm font-mono font-medium shrink-0">
                  {income.received_amount_minor != null && income.received_amount_minor !== income.amount_minor ? (
                    <span className="text-amber-600">
                      {formatMoney(income.received_amount_minor)}
                      <span className="text-xs text-slate-400 ml-1">/ {formatMoney(income.amount_minor)}</span>
                    </span>
                  ) : (
                    <span className="text-emerald-700">{formatMoney(income.amount_minor)}</span>
                  )}
                </span>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => openEdit(income)} className="p-1 text-slate-400 hover:text-indigo-600" title="Editar">
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { if (window.confirm(`¿Eliminar "${income.title}"?`)) deleteMutation.mutate(income.id); }}
                    disabled={deleteMutation.isPending}
                    className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-40" title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
            <span className="text-xs text-slate-500">{incomes.length} movimientos</span>
            <span className="text-sm font-semibold text-emerald-700">Total: {formatMoney(total)}</span>
          </div>
        </div>
      )}

      {showForm && period && (
        <Modal
          title={
            editing?.recurring_rule_id
              ? 'Gestionar cobro recurrente'
              : editing
              ? 'Editar ingreso'
              : 'Registrar ingreso'
          }
          onClose={closeForm}
        >
          <IncomeForm periodId={period.id} event={editing ?? undefined} onClose={closeForm} />
        </Modal>
      )}
    </div>
  );
}
