import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import * as cmd from '../../../domain-client/commands';
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

export default function AccountsSection() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: cmd.listAccounts,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      cmd.createAccount({
        name: form.name.trim(),
        kind: form.kind,
        opening_balance_minor: parseMoneyInput(form.opening_balance),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

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
              required
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
              type="number"
              min="0"
              step="0.01"
              value={form.opening_balance}
              onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="col-span-3 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="text-sm bg-indigo-600 text-white rounded px-4 py-1.5 hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          No hay cuentas. Agrega una para comenzar.
        </p>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${KIND_COLORS[account.kind]}`}>
                  {KIND_LABELS[account.kind]}
                </span>
                <span className="text-sm font-medium text-slate-800">{account.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600 font-mono">
                  {formatMoney(account.opening_balance_minor)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
