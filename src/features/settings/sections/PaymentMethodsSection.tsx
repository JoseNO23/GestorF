import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Archive } from 'lucide-react';
import * as cmd from '../../../domain-client/commands';

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

const EMPTY_FORM = { name: '', kind: 'cash', asset_account_id: '', liability_account_id: '' };

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

  const assetAccounts = accounts.filter((a) => a.kind === 'asset');
  const liabilityAccounts = accounts.filter((a) => a.kind === 'liability');

  const createMutation = useMutation({
    mutationFn: () =>
      cmd.createPaymentMethod({
        name: form.name.trim(),
        kind: form.kind,
        asset_account_id: form.asset_account_id ? Number(form.asset_account_id) : undefined,
        liability_account_id: form.liability_account_id ? Number(form.liability_account_id) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-methods'] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: cmd.archivePaymentMethod,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
  });

  const isCredit = form.kind === 'credit';
  const needsAsset = ['cash', 'debit', 'transfer'].includes(form.kind);

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
              required
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
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Cuenta asociada (activo)
              </label>
              <select
                value={form.asset_account_id}
                onChange={(e) => setForm({ ...form, asset_account_id: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Ninguna —</option>
                {assetAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {isCredit && liabilityAccounts.length > 0 && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Cuenta de pasivo (TC / deuda)
              </label>
              <select
                value={form.liability_account_id}
                onChange={(e) => setForm({ ...form, liability_account_id: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Ninguna —</option>
                {liabilityAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="col-span-2 flex justify-end gap-2">
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
      ) : methods.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          No hay métodos de pago. Agrega uno para comenzar.
        </p>
      ) : (
        <div className="space-y-2">
          {methods.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${KIND_COLORS[m.kind]}`}>
                  {KIND_LABELS[m.kind]}
                </span>
                <span className="text-sm font-medium text-slate-800">{m.name}</span>
              </div>
              <button
                onClick={() => archiveMutation.mutate(m.id)}
                disabled={archiveMutation.isPending}
                className="text-slate-300 hover:text-red-500 transition-colors"
                title="Archivar"
              >
                <Archive size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
