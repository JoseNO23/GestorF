import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import * as cmd from '../../../domain-client/commands';
import type { StatusRuleRow, StatusWithRules } from '../../../domain-client/types';

const DEFAULT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#64748b'];

const EMPTY_RULES: Omit<StatusRuleRow, 'status_id' | 'applies_to'> = {
  counts_as_paid: false,
  affects_real: false,
  affects_available: false,
  affects_future: true,
  creates_alert: false,
  exclude_from_total_default: false,
};

const RULE_LABELS: Record<string, { label: string; hint: string }> = {
  affects_real: { label: 'Afecta dinero real', hint: 'El monto mueve efectivo de la cuenta' },
  counts_as_paid: { label: 'Cuenta como pagado', hint: 'Liquidado — no aparece como pendiente' },
  affects_available: { label: 'Afecta disponible', hint: 'Descuenta del dinero comprometido' },
  affects_future: { label: 'Afecta proyección', hint: 'Aparece en dinero futuro' },
  creates_alert: { label: 'Genera alerta', hint: 'Muestra advertencia en el dashboard' },
  exclude_from_total_default: { label: 'Excluir del total por defecto', hint: 'No suma al total del período' },
};

function RulesForm({ sw: item }: { sw: StatusWithRules }) {
  const qc = useQueryClient();
  const existingRules = item.rules.find((r) => r.applies_to === 'all');
  const [rules, setRules] = useState<Omit<StatusRuleRow, 'status_id' | 'applies_to'>>({
    ...EMPTY_RULES,
    ...existingRules,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      cmd.upsertStatusRules(item.status.id, { applies_to: 'all', ...rules }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
  });

  return (
    <div className="mt-3 ml-4 p-4 rounded-lg border border-slate-200 bg-slate-50">
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4">
        {(Object.keys(RULE_LABELS) as (keyof typeof RULE_LABELS)[]).map((key) => (
          <label key={key} className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rules[key as keyof typeof rules] as boolean}
              onChange={(e) => setRules({ ...rules, [key]: e.target.checked })}
              className="mt-0.5 accent-indigo-600"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">{RULE_LABELS[key].label}</span>
              <p className="text-xs text-slate-400">{RULE_LABELS[key].hint}</p>
            </div>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="text-sm bg-indigo-600 text-white rounded px-4 py-1.5 hover:bg-indigo-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Guardando...' : 'Guardar reglas'}
        </button>
      </div>
    </div>
  );
}

export default function StatusesSection() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', color: '#6366f1', sort_order: 0 });

  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ['statuses'],
    queryFn: cmd.listStatusesWithRules,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      cmd.createStatus({ name: form.name.trim(), color: form.color, sort_order: form.sort_order }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['statuses'] });
      setShowForm(false);
      setForm({ name: '', color: '#6366f1', sort_order: 0 });
    },
  });

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
              placeholder="Pagado"
              className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
            <div className="flex items-center gap-2 mt-1">
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
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Orden</label>
            <input
              type="number"
              min="0"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="col-span-3 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 px-3 py-1.5">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="text-sm bg-indigo-600 text-white rounded px-4 py-1.5 hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Guardando...' : 'Crear estado'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : statuses.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          No hay estados. Agrega uno para comenzar.
        </p>
      ) : (
        <div className="space-y-2">
          {statuses.map((sw) => (
            <div key={sw.status.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === sw.status.id ? null : sw.status.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: sw.status.color }} />
                  <span className="text-sm font-medium text-slate-800">{sw.status.name}</span>
                  {sw.rules.length === 0 && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      Sin reglas
                    </span>
                  )}
                </div>
                {expandedId === sw.status.id ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
              </button>
              {expandedId === sw.status.id && <RulesForm sw={sw} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
