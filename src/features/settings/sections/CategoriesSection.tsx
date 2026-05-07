import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import * as cmd from '../../../domain-client/commands';
import type { Category } from '../../../domain-client/types';

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

const DEFAULT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];
const EMPTY_FORM = { name: '', color: '#6366f1', scope: 'both' };

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

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {DEFAULT_COLORS.map((c) => (
        <button
          key={c} type="button"
          onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full transition-transform ${value === c ? 'scale-125 ring-2 ring-offset-1 ring-indigo-500' : ''}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function CategoryRow({
  cat, onToggle, togglePending,
}: {
  cat: Category;
  onToggle: () => void;
  togglePending: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ name: string; color: string; scope: string }>({ name: cat.name, color: cat.color, scope: cat.scope });
  const [deleteError, setDeleteError] = useState('');
  const isDisabled = !!cat.archived_at;

  const updateMutation = useMutation({
    mutationFn: () => cmd.updateCategory(cat.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditing(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => cmd.deleteCategory(cat.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setDeleteError(''); },
    onError: (e: Error) => setDeleteError(e.message),
  });

  const handleDelete = () => {
    setDeleteError('');
    if (!window.confirm(`¿Eliminar "${cat.name}" permanentemente?\n\nSi está en uso, fallará. Deshabilitala en su lugar.`)) return;
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
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="both">Ingresos y gastos</option>
              <option value="income">Solo ingresos</option>
              <option value="expense">Solo gastos</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <ColorPicker value={form.color} onChange={(c) => setForm({ ...form, color: c })} />
            <div className="flex items-center gap-1 ml-2">
              <button type="submit" disabled={updateMutation.isPending}
                className="p-1 text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Guardar">
                <Check size={15} />
              </button>
              <button type="button" onClick={() => { setEditing(false); setForm({ name: cat.name, color: cat.color, scope: cat.scope }); }}
                className="p-1 text-slate-400 hover:text-slate-600" title="Cancelar">
                <X size={15} />
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
          <span className={`text-sm font-medium flex-1 truncate ${isDisabled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {cat.name}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${SCOPE_COLORS[cat.scope]}`}>
            {SCOPE_LABELS[cat.scope]}
          </span>
          <button onClick={() => { setEditing(true); setForm({ name: cat.name, color: cat.color, scope: cat.scope }); }}
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setShowForm(false); setForm(EMPTY_FORM); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => cmd.toggleCategory(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  const enabled = categories.filter((c) => !c.archived_at);
  const disabled = categories.filter((c) => !!c.archived_at);

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
              required autoFocus
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
            <ColorPicker value={form.color} onChange={(c) => setForm({ ...form, color: c })} />
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
              <p className="text-sm text-slate-400 text-center py-4">No hay categorías habilitadas.</p>
            )}
            {enabled.map((cat) => (
              <CategoryRow
                key={cat.id} cat={cat}
                onToggle={() => toggleMutation.mutate({ id: cat.id, enabled: false })}
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
                {disabled.map((cat) => (
                  <CategoryRow
                    key={cat.id} cat={cat}
                    onToggle={() => toggleMutation.mutate({ id: cat.id, enabled: true })}
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
