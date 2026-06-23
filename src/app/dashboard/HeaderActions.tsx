'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Bell, Check, Loader2 } from 'lucide-react';
import ThemeToggle from '@/app/ThemeToggle';

interface NotificationItem {
  id: string;
  message: string;
  isRead: number;
  createdAt: string | null;
}

interface HeaderActionsProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  initialNotifications: NotificationItem[];
}

export default function HeaderActions({ user, initialNotifications }: HeaderActionsProps) {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const unreadCount = notifications.filter((n) => n.isRead === 0).length;

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLogoutLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true }),
      });
      if (res.ok) {
        setNotifications(notifications.map((n) => ({ ...n, isRead: 1 })));
        router.refresh();
      }
    } catch (err) {
      console.error('Mark read failed:', err);
    }
  };

  const markSingleAsRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setNotifications(notifications.map((n) => (n.id === id ? { ...n, isRead: 1 } : n)));
        router.refresh();
      }
    } catch (err) {
      console.error('Mark single read failed:', err);
    }
  };

  return (
    <div className="flex items-center gap-4 relative">
      {/* Theme Toggle */}
      <ThemeToggle />

      {/* Notifications Bell */}
      <div className="relative">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="w-10 h-10 rounded-xl bg-gray-900/60 hover:bg-gray-900/90 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition relative cursor-pointer"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-cyan-400 ring-4 ring-[#090d16]" />
          )}
        </button>

        {showNotifications && (
          <div className="absolute right-0 mt-3 w-80 glass-panel rounded-2xl border border-white/5 shadow-2xl p-4 z-30 animate-fade-in">
            <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
              <span className="font-bold text-sm text-white">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2">
              {notifications.length === 0 ? (
                <div className="text-center text-xs text-gray-500 py-6">No notifications yet.</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => n.isRead === 0 && markSingleAsRead(n.id)}
                    className={`p-2.5 rounded-xl text-xs transition border cursor-pointer ${
                      n.isRead === 0
                        ? 'bg-violet-950/20 border-violet-500/10 text-gray-200 hover:bg-violet-950/30'
                        : 'bg-transparent border-transparent text-gray-500'
                    }`}
                  >
                    <p className="leading-relaxed">{n.message}</p>
                    {n.createdAt && (
                      <span className="text-[10px] text-gray-600 mt-1 block">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* User Info & Logout */}
      <div className="flex items-center gap-3 pl-2 border-l border-gray-850">
        {user.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full bg-gray-805" />
        )}
        <div className="hidden md:block text-left">
          <p className="text-sm font-semibold text-white leading-tight">{user.name}</p>
          <p className="text-[10px] text-gray-500">{user.email}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={logoutLoading}
          className="w-10 h-10 rounded-xl bg-gray-900/60 hover:bg-rose-950/30 hover:border-rose-900/30 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-rose-400 transition cursor-pointer"
          title="Sign Out"
        >
          {logoutLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
