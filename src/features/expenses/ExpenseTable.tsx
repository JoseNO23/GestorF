import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import type { FinancialEventRow, StatusWithRules, Category, PaymentMethod } from '../../domain-client/types';
import { formatMoney } from '../../utils/money';

interface Props {
  events: FinancialEventRow[];
  statuses: StatusWithRules[];
  categories: Category[];
  methods?: PaymentMethod[]; // reservado para uso futuro
  onEdit: (event: FinancialEventRow) => void;
}

function buildTree(events: FinancialEventRow[]) {
  const roots: FinancialEventRow[] = [];
  const childrenOf = new Map<number, FinancialEventRow[]>();

  for (const e of events) {
    if (e.parent_event_id) {
      const list = childrenOf.get(e.parent_event_id) ?? [];
      list.push(e);
      childrenOf.set(e.parent_event_id, list);
    } else {
      roots.push(e);
    }
  }

  return { roots, childrenOf };
}

export default function ExpenseTable({ events, statuses, categories, onEdit }: Props) {
  const qc = useQueryClient();

  const statusMap = new Map(statuses.map((sw) => [sw.status.id, sw.status]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const deleteMutation = useMutation({
    mutationFn: cmd.deleteEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const handleDelete = (event: FinancialEventRow) => {
    if (!window.confirm(`¿Eliminar "${event.title}"?`)) return;
    deleteMutation.mutate(event.id);
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-sm">No hay gastos en este mes.</p>
        <p className="text-xs mt-1">Usa "Nuevo gasto" para agregar el primero.</p>
      </div>
    );
  }

  const { roots, childrenOf } = buildTree(events);

  // Total del mes (excluye hijos marcados como excluidos)
  const total = events
    .filter((e) => !e.exclude_from_total)
    .reduce((sum, e) => sum + e.amount_minor, 0);

  const renderRow = (event: FinancialEventRow, isChild = false) => {
    const status = statusMap.get(event.status_id);
    const category = event.category_id ? categoryMap.get(event.category_id) : null;

    return (
      <div
        key={event.id}
        className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50 group ${isChild ? 'pl-10 bg-slate-50/50' : ''}`}
      >
        {/* Indentación hija */}
        {isChild && <span className="text-slate-300 text-xs shrink-0">└─</span>}

        {/* Título */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800 truncate">{event.title}</span>
            {event.exclude_from_total && (
              <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">excluido</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-400">{event.event_date}</span>
            {category && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                {category.name}
              </span>
            )}
          </div>
        </div>

        {/* Estado */}
        {status && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: status.color + '22', color: status.color }}
          >
            {status.name}
          </span>
        )}

        {/* Monto */}
        <span className={`text-sm font-mono font-medium shrink-0 ${event.exclude_from_total ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
          {formatMoney(event.amount_minor)}
        </span>

        {/* Acciones */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => onEdit(event)}
            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => handleDelete(event)}
            disabled={deleteMutation.isPending}
            className="p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
        <span>Descripción</span>
        <span className="text-right mr-16">Estado</span>
        <span className="text-right mr-8">Monto</span>
        <span />
      </div>

      {/* Filas */}
      {roots.map((root) => (
        <div key={root.id}>
          {renderRow(root)}
          {(childrenOf.get(root.id) ?? []).map((child) => renderRow(child, true))}
        </div>
      ))}

      {/* Totales */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
        <span className="text-xs text-slate-500">
          {events.filter((e) => !e.exclude_from_total).length} movimientos
        </span>
        <span className="text-sm font-semibold text-slate-800">
          Total: {formatMoney(total)}
        </span>
      </div>
    </div>
  );
}
