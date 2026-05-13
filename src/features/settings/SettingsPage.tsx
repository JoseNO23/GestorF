import { useState } from 'react';
import AccountsSection from './sections/AccountsSection';
import PaymentMethodsSection from './sections/PaymentMethodsSection';
import CategoriesSection from './sections/CategoriesSection';
import StatusesSection from './sections/StatusesSection';

type Tab = 'cuentas' | 'metodos' | 'categorias' | 'estados';

const TABS: { id: Tab; label: string }[] = [
  { id: 'cuentas', label: 'Cuentas' },
  { id: 'metodos', label: 'Métodos de pago' },
  { id: 'categorias', label: 'Categorías' },
  { id: 'estados', label: 'Estados' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('cuentas');

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">Configuración</h2>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cuentas' && <AccountsSection />}
      {tab === 'metodos' && <PaymentMethodsSection />}
      {tab === 'categorias' && <CategoriesSection />}
      {tab === 'estados' && <StatusesSection />}
    </div>
  );
}
