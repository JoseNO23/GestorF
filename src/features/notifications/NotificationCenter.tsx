import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CreditCard,
  EyeOff,
  Info,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as cmd from '../../domain-client/commands';
import type { NotificationItem, NotificationPriority } from '../../domain-client/types';

type Filter = 'all' | 'unread' | 'overdue' | 'upcoming' | 'important';

// ── Helpers de estilo ─────────────────────────────────────────────────────────

function priorityCard(p: NotificationPriority) {
  switch (p) {
    case 'critical': return 'border-red-200 bg-red-50';
    case 'warning':  return 'border-amber-200 bg-amber-50';
    case 'info':     return 'border-blue-200 bg-blue-50';
  }
}

function priorityBadge(p: NotificationPriority) {
  switch (p) {
    case 'critical': return 'bg-red-100 text-red-700';
    case 'warning':  return 'bg-amber-100 text-amber-700';
    case 'info':     return 'bg-blue-100 text-blue-700';
  }
}

function priorityLabel(p: NotificationPriority) {
  switch (p) {
    case 'critical': return 'Crítico';
    case 'warning':  return 'Importante';
    case 'info':     return 'Info';
  }
}

function NotifIcon({ type, priority }: { type: string; priority: NotificationPriority }) {
  const color =
    priority === 'critical' ? 'text-red-500' :
    priority === 'warning'  ? 'text-amber-500' :
                              'text-blue-500';
  switch (type) {
    case 'income_overdue':
    case 'income_due':
      return <TrendingUp size={17} className={color} />;
    case 'expense_overdue':
    case 'expense_due':
      return <TrendingDown size={17} className={color} />;
    case 'expense_upcoming':
      return <CalendarClock size={17} className={color} />;
    case 'credit_card_due':
      return <CreditCard size={17} className={color} />;
    default:
      return <Info size={17} className={color} />;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}

// ── Tarjeta individual ────────────────────────────────────────────────────────

function NotifCard({
  item,
  onDismiss,
  onNavigate,
}: {
  item: NotificationItem;
  onDismiss: (item: NotificationItem) => void;
  onNavigate: (item: NotificationItem) => void;
}) {
  const isUnread = !item.read_at;

  return (
    <div className={`rounded-lg border p-3 ${priorityCard(item.priority)} ${isUnread ? 'shadow-sm' : 'opacity-80'}`}>
      <div className="flex items-start gap-2.5">
        {/* Icono de tipo */}
        <div className="mt-0.5 shrink-0">
          <NotifIcon type={item.notif_type} priority={item.priority} />
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-semibold leading-tight ${isUnread ? 'text-slate-900' : 'text-slate-600'}`}>
              {item.title}
            </p>
            {isUnread && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" aria-label="No leída" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.message}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${priorityBadge(item.priority)}`}>
              {priorityLabel(item.priority)}
            </span>
            {item.due_date && (
              <span className="text-[11px] text-slate-400">{formatDate(item.due_date)}</span>
            )}
            <button
              onClick={() => onNavigate(item)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline-offset-2 hover:underline"
            >
              Ver detalle →
            </button>
          </div>
        </div>

        {/* Botón descartar */}
        <div className="relative group shrink-0">
          <button
            onClick={() => onDismiss(item)}
            className="mt-0.5 text-slate-300 hover:text-slate-500 transition-colors"
            aria-label="Descartar alerta"
          >
            <EyeOff size={15} />
          </button>
          {/* Tooltip */}
          <div className="absolute right-0 top-6 z-10 hidden group-hover:block w-52 bg-slate-800 text-white text-[11px] rounded px-2.5 py-1.5 leading-relaxed shadow-lg pointer-events-none">
            Descartar oculta esta alerta por 7 días. No modifica el movimiento financiero relacionado.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',       label: 'Todas' },
  { id: 'unread',    label: 'No leídas' },
  { id: 'overdue',   label: 'Vencidas' },
  { id: 'upcoming',  label: 'Próximas' },
  { id: 'important', label: 'Importantes' },
];

interface Props {
  onClose: () => void;
}

export default function NotificationCenter({ onClose }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: cmd.listNotifications,
    staleTime: 30_000,
  });

  const readMutation = useMutation({
    mutationFn: (item: NotificationItem) =>
      cmd.markNotificationRead(item.notif_type, item.source_type, item.source_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (item: NotificationItem) =>
      cmd.markNotificationDismissed(item.notif_type, item.source_type, item.source_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => {
      const unread = notifications.filter(n => !n.read_at);
      return Promise.all(
        unread.map(n => cmd.markNotificationRead(n.notif_type, n.source_type, n.source_id))
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleNavigate = (item: NotificationItem) => {
    if (!item.read_at) readMutation.mutate(item);
    navigate(item.route_to);
    onClose();
  };

  // El backend ya filtra las descartadas recientes. Aquí solo filtramos por tab.
  const visible = notifications.filter(n => {
    switch (filter) {
      case 'all':       return true;
      case 'unread':    return !n.read_at;
      case 'overdue':   return n.priority === 'critical';
      case 'upcoming':  return n.priority === 'info' || n.priority === 'warning';
      case 'important': return n.priority === 'critical' || n.priority === 'warning';
    }
  });

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <div className="flex flex-col h-full">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={17} className="text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-800">Notificaciones</h2>
          {unreadCount > 0 && (
            <span className="text-[11px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold leading-none">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              Marcar todas leídas
            </button>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Leyenda informativa */}
      <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 shrink-0">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Las alertas desaparecen automáticamente cuando el movimiento es registrado en su módulo.
          Descartar solo oculta la alerta, sin modificar el estado financiero.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 px-3 py-2 border-b border-slate-100 overflow-x-auto shrink-0">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${
              filter === f.id
                ? 'bg-indigo-600 text-white'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {isLoading ? (
          <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle size={28} className="text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-400">
              {filter === 'all' ? 'Sin alertas activas' : 'Sin items en este filtro'}
            </p>
            {filter === 'all' && (
              <p className="text-xs text-slate-300 mt-1">Todo está al día</p>
            )}
          </div>
        ) : (
          visible.map(item => (
            <NotifCard
              key={item.key}
              item={item}
              onDismiss={n => dismissMutation.mutate(n)}
              onNavigate={handleNavigate}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Hook público — contador para la campana ───────────────────────────────────

export function useNotificationCount() {
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: cmd.listNotifications,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return notifications.filter(n => !n.read_at).length;
}
