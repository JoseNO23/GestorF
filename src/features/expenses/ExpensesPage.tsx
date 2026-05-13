import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import type { FinancialEventRow } from '../../domain-client/types';
import Modal from '../../components/Modal/Modal';
import ExpenseForm from './ExpenseForm';
import ExpenseTable from './ExpenseTable';

const EXPENSE_TYPES = new Set(['expense', 'debt_charge']);

export default function ExpensesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FinancialEventRow | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const { data: period } = useQuery({
    queryKey: ['active-period'],
    queryFn: cmd.getActivePeriod,
  });

  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ['events', period?.id],
    queryFn: () => cmd.listEvents(period!.id),
    enabled: !!period,
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ['statuses'],
    queryFn: cmd.listStatusesWithRules,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: cmd.listCategories,
  });

  const { data: methods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: cmd.listPaymentMethods,
  });

  // Solo gastos y debt_charges
  const expenses = allEvents.filter((e) => EXPENSE_TYPES.has(e.event_type));

  // Filtros en cliente
  const filtered = expenses.filter((e) => {
    if (filterStatus && e.status_id.toString() !== filterStatus) return false;
    if (filterCategory && e.category_id?.toString() !== filterCategory) return false;
    return true;
  });

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit = (event: FinancialEventRow) => { setEditing(event); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const selectClass = 'text-sm border border-slate-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="p-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Gastos</h2>
          {period && (
            <p className="text-sm text-slate-400 mt-0.5">
              {period.year} · {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][period.month - 1]}
            </p>
          )}
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Nuevo gasto
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
          <option value="">Todos los estados</option>
          {statuses.filter((sw) => !sw.status.archived_at && sw.status.scope !== 'income').map((sw) => (
            <option key={sw.status.id} value={sw.status.id}>{sw.status.name}</option>
          ))}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={selectClass}>
          <option value="">Todas las categorías</option>
          {categories.filter((c) => !c.archived_at && c.scope !== 'income').map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {(filterStatus || filterCategory) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterCategory(''); }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <p className="text-sm text-slate-400 py-6">Cargando...</p>
      ) : (
        <ExpenseTable
          events={filtered}
          statuses={statuses}
          categories={categories}
          methods={methods}
          onEdit={openEdit}
        />
      )}

      {/* Modal formulario */}
      {showForm && period && (
        <Modal
          title={editing?.recurring_rule_id ? 'Gestionar gasto recurrente' : editing ? 'Editar gasto' : 'Nuevo gasto'}
          onClose={closeForm}
          size="lg"
        >
          <ExpenseForm
            periodId={period.id}
            event={editing ?? undefined}
            allExpenses={expenses}
            onClose={closeForm}
          />
        </Modal>
      )}
    </div>
  );
}
