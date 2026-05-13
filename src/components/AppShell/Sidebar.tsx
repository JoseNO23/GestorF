import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  BarChart2,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import MonthSelector from './MonthSelector';

interface SubRoute {
  path: string;
  label: string;
}

interface GroupRoute {
  kind: 'group';
  basePath: string;
  label: string;
  icon: LucideIcon;
  children: SubRoute[];
}

interface LeafRoute {
  kind: 'leaf';
  path: string;
  label: string;
  icon: LucideIcon;
}

type NavRoute = GroupRoute | LeafRoute;

const NAV: NavRoute[] = [
  { kind: 'leaf', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    kind: 'group',
    basePath: '/ingresos',
    label: 'Ingresos',
    icon: TrendingUp,
    children: [
      { path: '/ingresos/movimientos', label: 'Movimientos' },
      { path: '/ingresos/recurrentes', label: 'Recurrentes' },
      { path: '/ingresos/esperados', label: 'Esperados' },
    ],
  },
  {
    kind: 'group',
    basePath: '/gastos',
    label: 'Gastos',
    icon: TrendingDown,
    children: [
      { path: '/gastos/movimientos', label: 'Movimientos' },
      { path: '/gastos/recurrentes', label: 'Recurrentes' },
      { path: '/gastos/cuotas', label: 'Cuotas' },
    ],
  },
  { kind: 'leaf', path: '/deudas', label: 'Deudas', icon: Wallet },
  {
    kind: 'group',
    basePath: '/tarjetas',
    label: 'Tarjetas',
    icon: CreditCard,
    children: [
      { path: '/tarjetas/balance', label: 'Balance' },
      { path: '/tarjetas/cuotas', label: 'Cuotas' },
      { path: '/tarjetas/pagos', label: 'Pagos' },
      { path: '/tarjetas/estados', label: 'Estados de cuenta' },
    ],
  },
  { kind: 'leaf', path: '/graficas', label: 'Gráficas', icon: BarChart2 },
];

const linkBase = 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors';
const activeLeaf = 'bg-indigo-600 text-white';
const inactiveLeaf = 'text-slate-300 hover:bg-slate-700 hover:text-white';

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-56 bg-slate-800 text-slate-100 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-slate-700">
        <h1 className="text-lg font-bold tracking-tight text-white">GesterMoney</h1>
      </div>

      {/* Selector de mes */}
      <div className="px-4 py-3 border-b border-slate-700">
        <MonthSelector />
      </div>

      {/* Navegación principal */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          if (item.kind === 'leaf') {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeLeaf : inactiveLeaf}`
                }
              >
                <item.icon size={17} />
                {item.label}
              </NavLink>
            );
          }

          // Group item
          const groupActive = location.pathname.startsWith(item.basePath);
          return (
            <div key={item.basePath}>
              {/* Parent — clicking navigates to first child */}
              <NavLink
                to={item.children[0].path}
                className={`${linkBase} ${
                  groupActive ? 'text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <item.icon
                  size={17}
                  className={groupActive ? 'text-indigo-300' : ''}
                />
                {item.label}
              </NavLink>

              {/* Children — always visible, indented */}
              <div className="ml-8 mt-0.5 mb-1 space-y-0.5">
                {item.children.map((child) => (
                  <NavLink
                    key={child.path}
                    to={child.path}
                    className={({ isActive }) =>
                      `block px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`
                    }
                  >
                    {child.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Configuración al fondo */}
      <div className="px-2 py-3 border-t border-slate-700">
        <NavLink
          to="/configuracion"
          className={({ isActive }) =>
            `${linkBase} ${isActive ? activeLeaf : inactiveLeaf}`
          }
        >
          <Settings size={17} />
          Configuración
        </NavLink>
      </div>
    </aside>
  );
}
