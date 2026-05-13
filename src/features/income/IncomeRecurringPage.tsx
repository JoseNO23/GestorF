import RecurringRulesSection from '../settings/sections/RecurringRulesSection';

export default function IncomeRecurringPage() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-800">Ingresos recurrentes</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Reglas que generan automáticamente ingresos esperados al inicio de cada período
        </p>
      </div>
      <RecurringRulesSection mode="income" />
    </div>
  );
}
