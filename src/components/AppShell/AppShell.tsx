import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationCenter, { useNotificationCount } from '../../features/notifications/NotificationCenter';

function TopBar({ onBellClick }: { onBellClick: () => void }) {
  const unread = useNotificationCount();

  return (
    <div className="h-11 bg-white border-b border-slate-200 flex items-center justify-end px-4 shrink-0">
      <button
        onClick={onBellClick}
        className="relative p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        title="Centro de notificaciones"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}

export default function AppShell() {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onBellClick={() => setPanelOpen(p => !p)} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Backdrop */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10"
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* Panel lateral */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-96 bg-white shadow-2xl border-l border-slate-200 transition-transform duration-200 ${
          panelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <NotificationCenter onClose={() => setPanelOpen(false)} />
      </div>
    </div>
  );
}
