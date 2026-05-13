import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { useState } from 'react';

export interface RecurringFormState {
  is_recurring: boolean;
  frequency: string;
  day_of_month: string;
  interval_days: string;
  starts_on: string;
  ends_on: string;
  remind_days_before: string; // solo usado en modo 'expense'
  default_status_id: string;
}

export const EMPTY_RECURRING: RecurringFormState = {
  is_recurring: false,
  frequency: 'monthly',
  day_of_month: '1',
  interval_days: '7',
  starts_on: new Date().toISOString().slice(0, 10),
  ends_on: '',
  remind_days_before: '',
  default_status_id: '',
};

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Mensual',
  biweekly: 'Quincenal',
  weekly: 'Semanal',
  custom: 'Personalizada',
};

interface Props {
  value: RecurringFormState;
  onChange: (v: RecurringFormState) => void;
  statuses: { id: number; name: string }[];
  fieldClass: string;
  labelClass: string;
  mode?: 'income' | 'expense';
}

export default function RecurringSection({
  value, onChange, statuses, fieldClass, labelClass, mode = 'expense',
}: Props) {
  const [open, setOpen] = useState(value.is_recurring);
  const isIncome = mode === 'income';

  const set = (k: keyof RecurringFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => onChange({ ...value, [k]: e.target.value });

  const toggleEnabled = () => {
    const next = !value.is_recurring;
    onChange({ ...value, is_recurring: next });
    setOpen(next);
  };

  const isMonthly = value.frequency === 'monthly';
  const title = isIncome ? 'Cobro recurrente' : 'Repetición / Planificación';
  const dayLabel = isIncome ? 'Día esperado de cobro' : 'Día del mes (1-31)';
  const statusLabel = 'Estado al generar';

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => { if (value.is_recurring) setOpen((v) => !v); else toggleEnabled(); }}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        {open
          ? <ChevronDown size={14} className="text-slate-400" />
          : <ChevronRight size={14} className="text-slate-400" />
        }
        <RotateCcw size={14} className={value.is_recurring ? 'text-indigo-600' : 'text-slate-400'} />
        <span className={`text-sm font-medium ${value.is_recurring ? 'text-indigo-700' : 'text-slate-500'}`}>
          {title}
        </span>

        {value.is_recurring && (
          <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium">
            {FREQ_LABELS[value.frequency]} · día {isMonthly ? value.day_of_month : value.interval_days}
          </span>
        )}

        <span
          role="switch"
          aria-checked={value.is_recurring}
          onClick={(e) => { e.stopPropagation(); toggleEnabled(); }}
          className={`ml-2 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
            value.is_recurring ? 'bg-indigo-500' : 'bg-slate-300'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5 ${
            value.is_recurring ? 'translate-x-4' : 'translate-x-0.5'
          }`} />
        </span>
      </button>

      {/* Body */}
      {open && value.is_recurring && (
        <div className="px-4 py-3 grid grid-cols-2 gap-3 bg-white">

          {/* Frecuencia */}
          <div>
            <label className={labelClass}>Frecuencia</label>
            <select value={value.frequency} onChange={set('frequency')} className={fieldClass}>
              <option value="monthly">Mensual</option>
              <option value="biweekly">Quincenal</option>
              <option value="weekly">Semanal</option>
              <option value="custom">Personalizada (días)</option>
            </select>
          </div>

          {/* Día */}
          {isMonthly ? (
            <div>
              <label className={labelClass}>{dayLabel}</label>
              <input type="number" min="1" max="31" value={value.day_of_month} onChange={set('day_of_month')} className={fieldClass} />
            </div>
          ) : (
            <div>
              <label className={labelClass}>Cada cuántos días</label>
              <input
                type="number" min="1"
                value={value.interval_days}
                onChange={set('interval_days')}
                placeholder={value.frequency === 'biweekly' ? '14' : value.frequency === 'weekly' ? '7' : ''}
                className={fieldClass}
              />
            </div>
          )}

          {/* Estado — solo gastos; ingresos siempre Pendiente */}
          {!isIncome && (
            <div>
              <label className={labelClass}>{statusLabel}</label>
              <select value={value.default_status_id} onChange={set('default_status_id')} className={fieldClass}>
                <option value="">— Primero disponible —</option>
                {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {/* Recordatorio — solo en gastos */}
          {!isIncome && (
            <div>
              <label className={labelClass}>Recordar antes (días)</label>
              <input
                type="number" min="0"
                value={value.remind_days_before}
                onChange={set('remind_days_before')}
                placeholder="Sin recordatorio"
                className={fieldClass}
              />
            </div>
          )}

          {/* Inicio */}
          <div>
            <label className={labelClass}>Inicio</label>
            <input type="date" value={value.starts_on} onChange={set('starts_on')} className={fieldClass} />
          </div>

          {/* Fin opcional */}
          <div>
            <label className={labelClass}>Fin (opcional)</label>
            <input type="date" value={value.ends_on} onChange={set('ends_on')} className={fieldClass} />
          </div>

          {/* Nota para ingresos */}
          {isIncome && (
            <div className="col-span-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-3 py-2">
              Se generará como <strong>Pendiente</strong> al inicio de cada período. Cámbialo a <strong>Cobrado</strong> cuando lo recibas. Un ingreso pendiente no suma al dinero disponible.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
