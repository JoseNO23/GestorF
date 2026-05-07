import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Archive } from 'lucide-react';
import * as cmd from '../../../domain-client/commands';

const SCOPE_LABELS: Record<string, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  both: 'Ambos',
};

const SCOPE_COLORS: Record<string, string> = {
  income: 'bg-emerald-100 text-emerald-700',
  expense: 'bg-red-100 text-red-700',
  both: 'bg-slate-100 text-slate-700',
};

const DEFAULT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16'];
const EMPTY_FORM = { name: '', color: '#6366f1', scope: 'both' };

export default function CategoriesSection() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: cmd.listCategories,
  });

  const createMutation = useMutation({
    mutationFn: () => cmd.createCategory({ name: form.name.trim(), color: form.color, scope: form.scope }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: cmd.archiveCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Clasifica movimientos por categoría. No afectan los cálculos financieros.
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          <Plus size={16} /> Agregar categoría
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
              placeholder="Alimentación"
              className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Aplica a</label>
            <select
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="both">Ingresos y gastos</option>
              <option value="income">Solo ingresos</option>
              <option value="expense">Solo gastos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
            <div className="flex items-center gap-2">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-6 h-6 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-indigo-500' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
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
      ) : categories.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          No hay categorías. Agrega una para comenzar.
        </p>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-sm font-medium text-slate-800">{cat.name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SCOPE_COLORS[cat.scope]}`}>
                  {SCOPE_LABELS[cat.scope]}
                </span>
              </div>
              <button
                onClick={() => archiveMutation.mutate(cat.id)}
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
