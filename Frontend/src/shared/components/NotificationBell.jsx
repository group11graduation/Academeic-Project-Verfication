import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import notificationService from '../../services/notificationService';

function formatRelativeTime(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(value).toLocaleDateString();
}

/**
 * Shared notification center for admin / teacher / student shells.
 * @param {{ variant?: 'admin' | 'teacher' | 'student' }} props
 */
export default function NotificationBell({ variant = 'admin' }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const rootRef = useRef(null);

  const buttonClass =
    variant === 'student'
      ? 'relative hidden sm:flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
      : 'relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#cfdbfb] bg-white text-[#53638f] transition-colors hover:bg-[#f5f8ff] dark:border-white/10 dark:bg-[#111827] dark:text-slate-300 dark:hover:bg-[#1f2937]';

  const refreshUnread = useCallback(async () => {
    try {
      const res = await notificationService.unreadCount();
      if (res?.success) setUnread(Number(res.data?.count) || 0);
    } catch {
      /* ignore poll errors */
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationService.list({ limit: 40 });
      if (res?.success) {
        setItems(Array.isArray(res.data) ? res.data : []);
      }
      await refreshUnread();
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, [refreshUnread]);

  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, 30000);
    return () => clearInterval(id);
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) return undefined;
    loadList();
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, loadList]);

  const onToggle = () => setOpen((v) => !v);

  const onItemClick = async (item) => {
    if (item?.unread || !item?.readAt) {
      try {
        await notificationService.markRead(item.id || item._id);
        setItems((prev) =>
          prev.map((row) =>
            String(row.id || row._id) === String(item.id || item._id)
              ? { ...row, unread: false, readAt: new Date().toISOString() }
              : row
          )
        );
        setUnread((n) => Math.max(0, n - 1));
      } catch {
        /* still navigate */
      }
    }
    setOpen(false);
    if (item?.link) navigate(item.link);
  };

  const onMarkAll = async () => {
    setMarkingAll(true);
    try {
      await notificationService.markAllRead();
      setItems((prev) => prev.map((row) => ({ ...row, unread: false, readAt: row.readAt || new Date().toISOString() })));
      setUnread(0);
    } catch {
      /* ignore */
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" className={buttonClass} title="Notifications" onClick={onToggle} aria-expanded={open}>
        {variant === 'student' ? <Bell className="h-[18px] w-[18px]" /> : <Bell className="h-4 w-4" strokeWidth={2} />}
        {unread > 0 && (
          <span
            className={`absolute flex items-center justify-center rounded-full bg-rose-500 font-bold text-white ring-2 ring-white dark:ring-[#0f172a] ${
              variant === 'student'
                ? 'top-1 right-1 min-h-[14px] min-w-[14px] px-0.5 text-[8px]'
                : '-right-1 -top-1 min-h-[15px] min-w-[15px] px-0.5 text-[8px]'
            }`}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#111827]">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-white/10">
            <div>
              <p className="text-[12px] font-black text-slate-900 dark:text-slate-100">Notifications</p>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                {unread > 0 ? `${unread} unread` : 'You are up to date'}
              </p>
            </div>
            <button
              type="button"
              onClick={onMarkAll}
              disabled={markingAll || unread === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              {markingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
              Mark all read
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-3 py-8 text-[12px] font-semibold text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : items.length === 0 ? (
              <div className="px-3 py-8 text-center text-[12px] font-semibold text-slate-500 dark:text-slate-400">
                No notifications yet.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {items.map((item) => {
                  const isUnread = item.unread || !item.readAt;
                  return (
                    <li key={String(item.id || item._id)}>
                      <button
                        type="button"
                        onClick={() => onItemClick(item)}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/5 ${
                          isUnread ? 'bg-blue-50/60 dark:bg-blue-500/10' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[12px] font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
                          {isUnread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#1D68E3]" />}
                        </div>
                        {item.body ? (
                          <p className="line-clamp-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            {item.body}
                          </p>
                        ) : null}
                        <p className="text-[10px] font-semibold text-slate-400">{formatRelativeTime(item.createdAt)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
