import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import * as cmd from '../../../domain-client/commands';
import type { Account } from '../../../domain-client/types';
import { formatMoney, parseMoneyInput } from '../../../utils/money';

const KIND_LABELS: Record<string, string> = {
  asset: 'Activo',
  liability: 'Pasivo',
  receivable: 'Por cobrar',
};

const KIND_COLORS: Record<string, string> = {
  asset: 'bg-emerald-100 text-emerald-800',
  liability: 'bg-red-100 text-red-800',
  receivable: 'bg-blue-100 text-blue-800',
};

const EMPTY_FORM = { name: '', kind: 'asset', opening_balance: '0.00' };

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

function AccountRow({
  account, onToggle, togglePending,
}: {
  account: Account;
  onToggle: () => void;
  togglePending: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ name: string; kind: string; opening_balance: string }>({
    name: account.name,
    kind: account.kind,
    opening_balance: (account.opening_balance_minor / 100).toFixed(2),
  });
  const [deleteError, setDeleteError] = useState('');
  const isDisabled = !!account.archived_at;

  const updateMutation = useMutation({
    mutationFn: () => cmd.updateAccount(account.id, {
      name: form.name.trim(),
      kind: form.kind,
      opening_balance_minor: parseMoneyInput(form.opening_balance),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); setEditing(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => cmd.deleteAccount(account.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); setDeleteError(''); },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const handleDelete = () => {
    setDeleteError('');
    if (!window.confirm(`¿Eliminar "${account.name}" permanentemente?\n\nSi está en uso, fallará. Deshabilitala en su lugar.`)) return;
    deleteMutation.mutate();
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {editing ? (
        <form
          onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
          className="p-3 grid grid-cols-3 gap-2"
        >
          <div>
            <input
              required autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="asset">Activo</option>
              <option value="liability">Pasivo</option>
              <option value="receivable">Por cobrar</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min="0" step="0.01"
              value={form.opening_balance}
              onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
              className="flex-1 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button type="submit" disabled={updateMutation.isPending}
              className="p-1 text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Guardar">
              <Check size={15} />
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="p-1 text-slate-400 hover:text-slate-600" title="Cancelar">
              <X size={15} />
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${KIND_COLORS[account.kind]}`}>
            {KIND_LABELS[account.kind]}
          </span>
          <span className={`text-sm font-medium flex-1 truncate ${isDisabled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {account.name}
          </span>
          <span className="text-sm text-slate-500 font-mono shrink-0">
            {formatMoney(account.opening_balance_minor)}
          </span>
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

export default function AccountsSection() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: cmd.listAccounts,
  });

  const createMutation = useMutation({
    mutationFn: () => cmd.createAccount({
      name: form.name.trim(),
      kind: form.kind,
      opening_balance_minor: parseMoneyInput(form.opening_balance),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); setShowForm(false); setForm(EMPTY_FORM); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => cmd.toggleAccount(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });

  const enabled = accounts.filter((a) => !a.archived_at);
  const disabled = accounts.filter((a) => !!a.archived_at);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Las cuentas definen tus activos (bancos, efectivo) y pasivos (tarjetas, deudas).
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          <Plus size={16} /> Agregar cuenta
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="mb-4 p-4 rounded-lg border border-slate-200 bg-slate-50 grid grid-cols-3 gap-3"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
            <input
              required autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="BCP Ahorros"
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
              <option value="asset">Activo (banco / efectivo)</option>
              <option value="liability">Pasivo (TC / préstamo)</option>
              <option value="receivable">Por cobrar</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Saldo inicial (S/)</label>
            <input
              type="number" min="0" step="0.01"
              value={form.opening_balance}
              onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="col-span-3 flex justify-end gap-2">
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
              <p className="text-sm text-slate-400 text-center py-4">No hay cuentas habilitadas.</p>
            )}
            {enabled.map((account) => (
              <AccountRow
                key={account.id} account={account}
                onToggle={() => toggleMutation.mutate({ id: account.id, enabled: false })}
                togglePending={toggleMutation.isPending}
              />
            ))}
          </div>

          {disabled.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1 px-1">
                Deshabilitadas
              </p>
              <div className="space-y-1 opacity-60">
                {disabled.map((account) => (
                  <AccountRow
                    key={account.id} account={account}
                    onToggle={() => toggleMutation.mutate({ id: account.id, enabled: true })}
                    togglePending={toggleMutation.isPending}
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
