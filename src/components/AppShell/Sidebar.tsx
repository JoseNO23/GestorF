import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  CreditCard,
  BarChart2,
  Settings,
} from 'lucide-react';
import MonthSelector from './MonthSelector';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/ingresos', label: 'Ingresos', icon: TrendingUp },
  { path: '/gastos', label: 'Gastos', icon: TrendingDown },
  { path: '/deudas', label: 'Deudas', icon: CreditCard },
  { path: '/graficas', label: 'Gráficas', icon: BarChart2 },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-slate-800 text-slate-100 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700">
        <h1 className="text-lg font-bold tracking-tight text-white">
          GesterMoney
        </h1>
      </div>

      {/* Selector de mes */}
      <div className="px-4 py-3 border-b border-slate-700">
        <MonthSelector />
      </div>

      {/* Navegación principal */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Configuración al fondo */}
      <div className="px-2 py-3 border-t border-slate-700">
        <NavLink
          to="/configuracion"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }`
          }
        >
          <Settings size={18} />
          Configuración
        </NavLink>
      </div>
    </aside>
  );
}
