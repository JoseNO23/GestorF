import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import * as cmd from '../../../domain-client/commands';
import type { PaymentMethod } from '../../../domain-client/types';

const KIND_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Crédito (TC)',
  transfer: 'Transferencia',
  other: 'Otro',
};

const KIND_COLORS: Record<string, string> = {
  cash: 'bg-emerald-100 text-emerald-700',
  debit: 'bg-blue-100 text-blue-700',
  credit: 'bg-orange-100 text-orange-700',
  transfer: 'bg-purple-100 text-purple-700',
  other: 'bg-slate-100 text-slate-700',
};

const EMPTY_FORM = {
  name: '', kind: 'cash', asset_account_id: '', liability_account_id: '',
  credit_limit: '0.00', cut_day: '', payment_due_day: '',
};

function ToggleSwitch({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${on ? 'bg-indigo-500' : 'bg-slate-300'}`}
      title={on ? 'Deshabilitar' : 'Habilitar'}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

function MethodRow({
  method, onToggle, togglePending, assetAccounts, liabilityAccounts,
}: {
  method: PaymentMethod;
  onToggle: () => void;
  togglePending: boolean;
  assetAccounts: { id: number; name: string }[];
  liabilityAccounts: { id: number; name: string }[];
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{
    name: string; kind: string; asset_account_id: string; liability_account_id: string;
    credit_limit: string; cut_day: string; payment_due_day: string;
  }>({
    name: method.name,
    kind: method.kind,
    asset_account_id: method.asset_account_id?.toString() ?? '',
    liability_account_id: method.liability_account_id?.toString() ?? '',
    credit_limit: (method.credit_limit_minor / 100).toFixed(2),
    cut_day: method.cut_day?.toString() ?? '',
    payment_due_day: method.payment_due_day?.toString() ?? '',
  });
  const [deleteError, setDeleteError] = useState('');
  const isDisabled = !!method.archived_at;

  const updateMutation = useMutation({
    mutationFn: () => cmd.updatePaymentMethod(method.id, {
      name: form.name.trim(),
      kind: form.kind,
      asset_account_id: form.asset_account_id ? Number(form.asset_account_id) : undefined,
      liability_account_id: form.liability_account_id ? Number(form.liability_account_id) : undefined,
      credit_limit_minor: form.kind === 'credit' ? Math.round(parseFloat(form.credit_limit || '0') * 100) : undefined,
      cut_day: form.kind === 'credit' && form.cut_day ? Number(form.cut_day) : undefined,
      payment_due_day: form.kind === 'credit' && form.payment_due_day ? Number(form.payment_due_day) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); setEditing(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => cmd.deletePaymentMethod(method.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); setDeleteError(''); },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const handleDelete = () => {
    setDeleteError('');
    if (!window.confirm(`¿Eliminar "${method.name}" permanentemente?\n\nSi está en uso, fallará. Deshabilitalo en su lugar.`)) return;
    deleteMutation.mutate();
  };

  const isCredit = form.kind === 'credit';
  const needsAsset = ['cash', 'debit', 'transfer'].includes(form.kind);

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {editing ? (
        <form
          onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
          className="p-3 grid grid-cols-2 gap-2"
        >
          <div>
            <input
              required autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="flex-1 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="cash">Efectivo</option>
              <option value="debit">Débito</option>
              <option value="credit">Crédito (TC)</option>
              <option value="transfer">Transferencia</option>
              <option value="other">Otro</option>
            </select>
            <button type="submit" disabled={updateMutation.isPending}
              className="p-1 text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Guardar">
              <Check size={15} />
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="p-1 text-slate-400 hover:text-slate-600" title="Cancelar">
              <X size={15} />
            </button>
          </div>
          {needsAsset && assetAccounts.length > 0 && (
            <div className="col-span-2">
              <select
                value={form.asset_account_id}
                onChange={(e) => setForm({ ...form, asset_account_id: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Cuenta activo —</option>
                {assetAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          {isCredit && liabilityAccounts.length > 0 && (
            <div className="col-span-2">
              <select
                value={form.liability_account_id}
                onChange={(e) => setForm({ ...form, liability_account_id: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Cuenta pasivo —</option>
                {liabilityAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          {isCredit && (
            <div className="col-span-2 grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">Límite (S/)</label>
                <input type="number" min="0" step="0.01" value={form.credit_limit}
                  onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">Día de corte</label>
                <input type="number" min="1" max="31" value={form.cut_day}
                  onChange={(e) => setForm({ ...form, cut_day: e.target.value })}
                  placeholder="—"
                  className="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">Día límite pago</label>
                <input type="number" min="1" max="31" value={form.payment_due_day}
                  onChange={(e) => setForm({ ...form, payment_due_day: e.target.value })}
                  placeholder="—"
                  className="w-full text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          )}
        </form>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${KIND_COLORS[method.kind]}`}>
            {KIND_LABELS[method.kind]}
          </span>
          <span className={`text-sm font-medium flex-1 truncate ${isDisabled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {method.name}
          </span>
          {method.kind === 'credit' && method.credit_limit_minor > 0 && (
            <span className="text-xs text-slate-400 shrink-0">
              Límite S/ {(method.credit_limit_minor / 100).toLocaleString('es-PE', { minimumFractionDigits: 0 })}
            </span>
          )}
          <button onClick={() => setEditing(true)}
            className="p-1 text-slate-300 hover:text-indigo-500 transition-colors shrink-0" title="Editar">
            <Pencil size={13} />
          </button>
          <ToggleSwitch on={!isDisabled} onChange={onToggle} disabled={togglePending} />
          <button onClick={handleDelete}
            className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0" title="Eliminar">
            <Trash2 size={13} />
          </button>
        </div>
      )}
      {deleteError && (
        <p className="text-xs text-amber-700 bg-amber-50 border-t border-amber-100 px-3 py-1.5">{deleteError}</p>
      )}
    </div>
  );
}

export default function PaymentMethodsSection() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: cmd.listPaymentMethods,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: cmd.listAccounts,
  });

  const assetAccounts = accounts.filter((a) => a.kind === 'asset' && !a.archived_at);
  const liabilityAccounts = accounts.filter((a) => a.kind === 'liability' && !a.archived_at);

  const createMutation = useMutation({
    mutationFn: () => cmd.createPaymentMethod({
      name: form.name.trim(),
      kind: form.kind,
      asset_account_id: form.asset_account_id ? Number(form.asset_account_id) : undefined,
      liability_account_id: form.liability_account_id ? Number(form.liability_account_id) : undefined,
      credit_limit_minor: form.kind === 'credit' ? Math.round(parseFloat(form.credit_limit || '0') * 100) : undefined,
      cut_day: form.kind === 'credit' && form.cut_day ? Number(form.cut_day) : undefined,
      payment_due_day: form.kind === 'credit' && form.payment_due_day ? Number(form.payment_due_day) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-methods'] }); setShowForm(false); setForm(EMPTY_FORM); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => cmd.togglePaymentMethod(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
  });

  const isCredit = form.kind === 'credit';
  const needsAsset = ['cash', 'debit', 'transfer'].includes(form.kind);

  const enabled = methods.filter((m) => !m.archived_at);
  const disabled = methods.filter((m) => !!m.archived_at);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Los métodos de tipo crédito (TC) no reducen dinero real al usarse.
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          <Plus size={16} /> Agregar método
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="mb-4 p-4 rounded-lg border border-slate-200 bg-slate-50 grid grid-cols-2 gap-3"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
            <input
              required autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="BCP Visa"
              className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="cash">Efectivo</option>
              <option value="debit">Débito</option>
              <option value="credit">Crédito (TC)</option>
              <option value="transfer">Transferencia</option>
              <option value="other">Otro</option>
            </select>
          </div>
          {needsAsset && assetAccounts.length > 0 && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Cuenta asociada (activo)</label>
              <select
                value={form.asset_account_id}
                onChange={(e) => setForm({ ...form, asset_account_id: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Ninguna —</option>
                {assetAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          {isCredit && liabilityAccounts.length > 0 && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Cuenta de pasivo (TC / deuda)</label>
              <select
                value={form.liability_account_id}
                onChange={(e) => setForm({ ...form, liability_account_id: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Ninguna —</option>
                {liabilityAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          {isCredit && (
            <div className="col-span-2 grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Límite de crédito (S/)</label>
                <input type="number" min="0" step="0.01" value={form.credit_limit}
                  onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Día de corte (1-31)</label>
                <input type="number" min="1" max="31" value={form.cut_day}
                  onChange={(e) => setForm({ ...form, cut_day: e.target.value })}
                  placeholder="Ej: 15"
                  className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Día límite de pago (1-31)</label>
                <input type="number" min="1" max="31" value={form.payment_due_day}
                  onChange={(e) => setForm({ ...form, payment_due_day: e.target.value })}
                  placeholder="Ej: 5"
                  className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          )}
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 px-3 py-1.5">Cancelar</button>
            <button type="submit" disabled={createMutation.isPending}
              className="text-sm bg-indigo-600 text-white rounded px-4 py-1.5 hover:bg-indigo-700 disabled:opacity-50">
              {createMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            {enabled.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No hay métodos habilitados.</p>
            )}
            {enabled.map((m) => (
              <MethodRow
                key={m.id} method={m}
                onToggle={() => toggleMutation.mutate({ id: m.id, enabled: false })}
                togglePending={toggleMutation.isPending}
                assetAccounts={assetAccounts}
                liabilityAccounts={liabilityAccounts}
              />
            ))}
          </div>

          {disabled.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1 px-1">
                Deshabilitados
              </p>
              <div className="space-y-1 opacity-60">
                {disabled.map((m) => (
                  <MethodRow
                    key={m.id} method={m}
                    onToggle={() => toggleMutation.mutate({ id: m.id, enabled: true })}
                    togglePending={toggleMutation.isPending}
                    assetAccounts={assetAccounts}
                    liabilityAccounts={liabilityAccounts}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
