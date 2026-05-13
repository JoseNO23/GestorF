import { createHashRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/AppShell/AppShell';
import DashboardPage from '../features/dashboard/DashboardPage';
import IncomePage from '../features/income/IncomePage';
import IncomeRecurringPage from '../features/income/IncomeRecurringPage';
import IncomeExpectedPage from '../features/income/IncomeExpectedPage';
import ExpensesPage from '../features/expenses/ExpensesPage';
import ExpenseRecurringPage from '../features/expenses/ExpenseRecurringPage';
import ExpenseCuotasPage from '../features/expenses/ExpenseCuotasPage';
import DebtsPage from '../features/debts/DebtsPage';
import CreditCardsPage from '../features/creditcards/CreditCardsPage';
import CreditCardCuotasPage from '../features/creditcards/CreditCardCuotasPage';
import CreditCardPaymentsPage from '../features/creditcards/CreditCardPaymentsPage';
import CreditCardStatementsPage from '../features/creditcards/CreditCardStatementsPage';
import ChartsPage from '../features/charts/ChartsPage';
import SettingsPage from '../features/settings/SettingsPage';

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },

      // Ingresos
      {
        path: 'ingresos',
        children: [
          { index: true, element: <Navigate to="movimientos" replace /> },
          { path: 'movimientos', element: <IncomePage /> },
          { path: 'recurrentes', element: <IncomeRecurringPage /> },
          { path: 'esperados', element: <IncomeExpectedPage /> },
        ],
      },

      // Gastos
      {
        path: 'gastos',
        children: [
          { index: true, element: <Navigate to="movimientos" replace /> },
          { path: 'movimientos', element: <ExpensesPage /> },
          { path: 'recurrentes', element: <ExpenseRecurringPage /> },
          { path: 'cuotas', element: <ExpenseCuotasPage /> },
        ],
      },

      // Tarjetas
      {
        path: 'tarjetas',
        children: [
          { index: true, element: <Navigate to="balance" replace /> },
          { path: 'balance', element: <CreditCardsPage /> },
          { path: 'cuotas', element: <CreditCardCuotasPage /> },
          { path: 'pagos', element: <CreditCardPaymentsPage /> },
          { path: 'estados', element: <CreditCardStatementsPage /> },
        ],
      },

      { path: 'deudas', element: <DebtsPage /> },
      { path: 'graficas', element: <ChartsPage /> },
      { path: 'configuracion', element: <SettingsPage /> },
    ],
  },
]);
