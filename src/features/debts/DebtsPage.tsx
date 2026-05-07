import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import * as cmd from '../../domain-client/commands';
import type { FinancialEventRow } from '../../domain-client/types';
import Modal from '../../components/Modal/Modal';
import { formatMoney, parseMoneyInput, minorToInputStr } from '../../utils/money';

const DEBT_TYPES = new Set(['debt_charge', 'receivable']);

const today = () => new Date().toISOString().split('T')[0];

function DebtForm({ periodId, event, onClose }: { periodId: number; event?: FinancialEventRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: event?.title ?? '',
    amount: event ? minorToInputStr(event.amount_minor) : '',
    event_date: event?.event_date ?? today(),
    due_date: event?.due_date ?? '',
    event_type: event?.event_type ?? 'debt_charge',
    status_id: event?.status_id.toString() ?? '',
    notes: event?.notes ?? '',
  });
  const [error, setError] = useState('');

  const { data: statuses = [] } = useQuery({ queryKey: ['statuses'], queryFn: cmd.listStatusesWithRules });

  const set = (f: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [f]: e.target.value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const amountMinor = parseMoneyInput(form.amount);
      if (!form.title.trim()) throw new Error('El título es obligatorio');
      if (amountMinor <= 0) throw new Error('El monto debe ser mayor a 0');
      if (!form.status_id) throw new Error('Selecciona un estado');
      const base = {
        title: form.title.trim(), amount_minor: amountMinor,
        event_date: form.event_date, due_date: form.due_date || undefined,
        status_id: Number(form.status_id), exclude_from_total: false,
        notes: form.notes.trim() || undefined,
      };
      return event
        ? cmd.updateEvent(event.id, { event_type: form.event_type, ...base })
        : cmd.createEvent({ period_id: periodId, event_type: form.event_type, ...base });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); onClose(); },
    onError: (err: Error) => setError(err.message),
  });

  const f = 'w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const l = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(''); saveMutation.mutate(); }} className="space-y-4">
      <div>
        <label className={l}>Tipo</label>
        <select value={form.event_type} onChange={set('event_type')} className={f}>
          <option value="debt_charge">Deuda a pagar (debo dinero)</option>
          <option value="receivable">Por cobrar (me deben)</option>
        </select>
      </div>
      <div>
        <label className={l}>Descripción *</label>
        <input required value={form.title} onChange={set('title')} placeholder="Préstamo a Juan" className={f} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={l}>Monto (S/) *</label>
          <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} className={f} />
        </div>
        <div>
          <label className={l}>Estado *</label>
          <select required value={form.status_id} onChange={set('status_id')} className={f}>
            <option value="">— Seleccionar —</option>
            {statuses.filter((sw) => !sw.status.archived_at).map((sw) => <option key={sw.status.id} value={sw.status.id}>{sw.status.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={l}>Fecha</label><input type="date" value={form.event_date} onChange={set('event_date')} className={f} /></div>
        <div><label className={l}>Vencimiento</label><input type="date" value={form.due_date} onChange={set('due_date')} className={f} /></div>
      </div>
      <div>
        <label className={l}>Notas</label>
        <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${f} resize-none`} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="text-sm text-slate-500 px-3 py-1.5">Cancelar</button>
        <button type="submit" disabled={saveMutation.isPending}
          className="text-sm bg-indigo-600 text-white rounded px-5 py-1.5 hover:bg-indigo-700 disabled:opacity-50">
          {saveMutation.isPending ? 'Guardando...' : event ? 'Actualizar' : 'Registrar'}
        </button>
      </div>
    </form>
  );
}

export default function DebtsPage() {
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

  const debts = allEvents.filter((e) => DEBT_TYPES.has(e.event_type));
  const statusMap = new Map(statuses.map((sw) => [sw.status.id, sw.status]));

  const deleteMutation = useMutation({
    mutationFn: cmd.deleteEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });

  const openEdit = (e: FinancialEventRow) => { setEditing(e); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const toPagar = debts.filter((e) => e.event_type === 'debt_charge');
  const porCobrar = debts.filter((e) => e.event_type === 'receivable');

  const renderRow = (d: FinancialEventRow) => {
    const status = statusMap.get(d.status_id);
    const isReceivable = d.event_type === 'receivable';
    return (
      <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50 group">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{d.title}</p>
          <p className="text-xs text-slate-400">{d.event_date}{d.due_date ? ` · vence ${d.due_date}` : ''}</p>
        </div>
        {status && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: status.color + '22', color: status.color }}>{status.name}</span>
        )}
        <span className={`text-sm font-mono font-semibold shrink-0 ${isReceivable ? 'text-emerald-600' : 'text-slate-800'}`}>
          {formatMoney(d.amount_minor)}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
          <button onClick={() => openEdit(d)} className="p-1 text-slate-400 hover:text-indigo-600"><Pencil size={14} /></button>
          <button onClick={() => { if (window.confirm(`¿Eliminar "${d.title}"?`)) deleteMutation.mutate(d.id); }}
            className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      </div>
    );
  };

  const DebtGroup = ({ title, items, color }: { title: string; items: FinancialEventRow[]; color: string }) => (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className={`px-4 py-3 border-b border-slate-200 flex items-center justify-between ${color}`}>
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-sm font-mono font-bold">{formatMoney(items.reduce((s, e) => s + e.amount_minor, 0))}</span>
      </div>
      {items.length === 0
        ? <p className="text-sm text-slate-400 py-6 text-center">Sin registros</p>
        : items.map(renderRow)}
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-800">Deudas</h2>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={16} /> Registrar deuda
        </button>
      </div>

      {isLoading ? <p className="text-sm text-slate-400">Cargando...</p> : (
        <>
          <DebtGroup title="Por pagar" items={toPagar} color="bg-red-50 text-red-700" />
          <DebtGroup title="Por cobrar" items={porCobrar} color="bg-emerald-50 text-emerald-700" />
        </>
      )}

      {showForm && period && (
        <Modal title={editing ? 'Editar deuda' : 'Registrar deuda'} onClose={closeForm}>
          <DebtForm periodId={period.id} event={editing ?? undefined} onClose={closeForm} />
        </Modal>
      )}
    </div>
  );
}
