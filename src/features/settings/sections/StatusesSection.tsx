import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronDown, ChevronRight, Trash2, Pencil, Check, X } from 'lucide-react';
import * as cmd from '../../../domain-client/commands';
import type { StatusRuleRow, StatusWithRules } from '../../../domain-client/types';

const DEFAULT_COLORS = ['#10b981', '#f59e0b', '#6366f1', '#ef4444', '#8b5cf6', '#64748b'];

const EMPTY_RULES: Omit<StatusRuleRow, 'status_id' | 'applies_to'> = {
  counts_as_paid: false,
  affects_real: false,
  affects_available: false,
  affects_future: true,
  creates_alert: false,
  exclude_from_total_default: false,
};

const RULE_LABELS: Record<string, { label: string; hint: string }> = {
  affects_real:              { label: 'Afecta dinero real',          hint: 'El monto mueve efectivo de la cuenta' },
  counts_as_paid:            { label: 'Cuenta como pagado',          hint: 'Liquidado — no aparece como pendiente' },
  affects_available:         { label: 'Afecta disponible',           hint: 'Descuenta del dinero comprometido' },
  affects_future:            { label: 'Afecta proyección',           hint: 'Aparece en dinero futuro' },
  creates_alert:             { label: 'Genera alerta',               hint: 'Muestra advertencia en el dashboard' },
  exclude_from_total_default:{ label: 'Excluir del total por defecto',hint: 'No suma al total del período' },
};

// ── Toggle switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${
        on ? 'bg-indigo-500' : 'bg-slate-300'
      }`}
      title={on ? 'Deshabilitar' : 'Habilitar'}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${
          on ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ── Formulario de reglas ──────────────────────────────────────────────────────
function RulesForm({ sw }: { sw: StatusWithRules }) {
  const qc = useQueryClient();
  const existing = sw.rules.find((r) => r.applies_to === 'all');
  const [rules, setRules] = useState<Omit<StatusRuleRow, 'status_id' | 'applies_to'>>({
    ...EMPTY_RULES,
    ...existing,
  });

  const saveMutation = useMutation({
    mutationFn: () => cmd.upsertStatusRules(sw.status.id, { applies_to: 'all', ...rules }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
  });

  return (
    <div className="mt-0 mx-0 p-4 bg-slate-50 border-t border-slate-200">
      <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 mb-4">
        {(Object.keys(RULE_LABELS) as (keyof typeof RULE_LABELS)[]).map((key) => (
          <label key={key} className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rules[key as keyof typeof rules] as boolean}
              onChange={(e) => setRules({ ...rules, [key]: e.target.checked })}
              className="mt-0.5 accent-indigo-600"
            />
            <div>
              <p className="text-sm font-medium text-slate-700">{RULE_LABELS[key].label}</p>
              <p className="text-xs text-slate-400">{RULE_LABELS[key].hint}</p>
            </div>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between">
        {saveMutation.isError && (
          <p className="text-xs text-red-600">{String(saveMutation.error)}</p>
        )}
        <div className="ml-auto">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="text-sm bg-indigo-600 text-white rounded px-4 py-1.5 hover:bg-indigo-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Guardando...' : 'Guardar reglas'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sección principal ─────────────────────────────────────────────────────────
export default function StatusesSection() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string>('');
  const [form, setForm] = useState({ name: '', color: '#10b981', sort_order: 0 });

  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ['statuses'],
    queryFn: cmd.listStatusesWithRules,
  });

  const createMutation = useMutation({
    mutationFn: () => cmd.createStatus({ name: form.name.trim(), color: form.color, sort_order: form.sort_order }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['statuses'] });
      setShowForm(false);
      setForm({ name: '', color: '#10b981', sort_order: 0 });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      cmd.toggleStatus(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: cmd.deleteStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['statuses'] });
      setDeleteError('');
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  const handleDelete = (sw: StatusWithRules) => {
    setDeleteError('');
    if (!window.confirm(`¿Eliminar el estado "${sw.status.name}" permanentemente?\n\nSi hay movimientos que lo usan, la eliminación fallará. Usa "deshabilitar" en su lugar.`)) return;
    deleteMutation.mutate(sw.status.id);
  };

  const enabled = statuses.filter((sw) => !sw.status.archived_at);
  const disabled = statuses.filter((sw) => !!sw.status.archived_at);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Los estados controlan cómo cada movimiento afecta el dinero real, disponible y futuro.
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          <Plus size={16} /> Agregar estado
        </button>
      </div>

      {/* Formulario nuevo estado */}
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
              placeholder="Mi estado"
              className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
            <div className="flex items-center gap-2 mt-1">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-6 h-6 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-indigo-500' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Orden</label>
            <input
              type="number" min="0"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="col-span-3 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 px-3 py-1.5">Cancelar</button>
            <button type="submit" disabled={createMutation.isPending}
              className="text-sm bg-indigo-600 text-white rounded px-4 py-1.5 hover:bg-indigo-700 disabled:opacity-50">
              {createMutation.isPending ? 'Creando...' : 'Crear estado'}
            </button>
          </div>
        </form>
      )}

      {deleteError && (
        <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          {deleteError}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : (
        <div className="space-y-4">
          {/* Estados habilitados */}
          <div className="space-y-1">
            {enabled.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No hay estados habilitados.</p>
            )}
            {enabled.map((sw) => (
              <StatusRow
                key={sw.status.id} sw={sw}
                expanded={expandedId === sw.status.id}
                onToggleExpand={() => setExpandedId(expandedId === sw.status.id ? null : sw.status.id)}
                onToggle={() => toggleMutation.mutate({ id: sw.status.id, enabled: false })}
                onDelete={() => handleDelete(sw)}
                togglePending={toggleMutation.isPending}
              />
            ))}
          </div>

          {/* Estados deshabilitados */}
          {disabled.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1 px-1">
                Deshabilitados
              </p>
              <div className="space-y-1 opacity-60">
                {disabled.map((sw) => (
                  <StatusRow
                    key={sw.status.id} sw={sw}
                    expanded={expandedId === sw.status.id}
                    onToggleExpand={() => setExpandedId(expandedId === sw.status.id ? null : sw.status.id)}
                    onToggle={() => toggleMutation.mutate({ id: sw.status.id, enabled: true })}
                    onDelete={() => handleDelete(sw)}
                    togglePending={toggleMutation.isPending}
                    isDisabled
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

// ── Fila de estado ────────────────────────────────────────────────────────────
function StatusRow({
  sw, expanded, onToggleExpand, onToggle, onDelete, togglePending, isDisabled,
}: {
  sw: StatusWithRules;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggle: () => void;
  onDelete: () => void;
  togglePending: boolean;
  isDisabled?: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: sw.status.name, color: sw.status.color, sort_order: sw.status.sort_order });

  const updateMutation = useMutation({
    mutationFn: () => cmd.updateStatus(sw.status.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['statuses'] }); setEditing(false); },
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {editing ? (
        <form
          onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
          className="flex items-center gap-2 px-3 py-2"
        >
          <input
            required autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="flex-1 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex items-center gap-1">
            {DEFAULT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                className={`w-4 h-4 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-indigo-500' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <input
            type="number" min="0"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
            className="w-14 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            title="Orden"
          />
          <button type="submit" disabled={updateMutation.isPending}
            className="p-1 text-indigo-600 hover:text-indigo-800 disabled:opacity-50" title="Guardar">
            <Check size={14} />
          </button>
          <button type="button" onClick={() => { setEditing(false); setForm({ name: sw.status.name, color: sw.status.color, sort_order: sw.status.sort_order }); }}
            className="p-1 text-slate-400 hover:text-slate-600" title="Cancelar">
            <X size={14} />
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* Expand rules */}
          <button onClick={onToggleExpand} className="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-slate-50 -mx-1 px-1 rounded transition-colors">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sw.status.color }} />
            <span className={`text-sm font-medium truncate ${isDisabled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
              {sw.status.name}
            </span>
            {sw.rules.length === 0 && !isDisabled && (
              <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">Sin reglas</span>
            )}
            {expanded
              ? <ChevronDown size={14} className="text-slate-400 shrink-0 ml-auto" />
              : <ChevronRight size={14} className="text-slate-400 shrink-0 ml-auto" />
            }
          </button>

          <button onClick={() => setEditing(true)}
            className="p-1 text-slate-300 hover:text-indigo-500 transition-colors shrink-0" title="Editar">
            <Pencil size={13} />
          </button>
          <ToggleSwitch on={!isDisabled} onChange={onToggle} disabled={togglePending} />
          <button onClick={onDelete}
            className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0" title="Eliminar permanentemente">
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Reglas expandidas */}
      {!editing && expanded && <RulesForm sw={sw} />}
    </div>
  );
}
