import { createHashRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/AppShell/AppShell';
import DashboardPage from '../features/dashboard/DashboardPage';
import IncomePage from '../features/income/IncomePage';
import ExpensesPage from '../features/expenses/ExpensesPage';
import DebtsPage from '../features/debts/DebtsPage';
import ChartsPage from '../features/charts/ChartsPage';
import SettingsPage from '../features/settings/SettingsPage';
import CreditCardsPage from '../features/creditcards/CreditCardsPage';

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'ingresos', element: <IncomePage /> },
      { path: 'gastos', element: <ExpensesPage /> },
      { path: 'deudas', element: <DebtsPage /> },
      { path: 'tarjetas', element: <CreditCardsPage /> },
      { path: 'graficas', element: <ChartsPage /> },
      { path: 'configuracion', element: <SettingsPage /> },
    ],
  },
]);
