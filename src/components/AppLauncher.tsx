'use client';

// AppLauncher — danh sách ứng dụng công ty (giống hệt pkd_crm-next/Task Manager),
// lấy từ account.hpcore.vn/api/apps. Bấm vào logo/tên app ở đầu Sidebar để mở.
import { useEffect, useState } from 'react';
import {
  Clock, MapPin, FileCheck, Send, CalendarClock, BarChart3, Settings,
  Warehouse, Briefcase, Receipt, Workflow, Heart, Laptop, PenTool, ClipboardCheck,
  Gavel, LayoutGrid, Search, X, AppWindow, type LucideIcon,
} from 'lucide-react';

const APPS_API = 'https://account.hpcore.vn/api/apps';
const HPCORE_PROFILE_URL = 'https://account.hpcore.vn/profile';

const ICONS: Record<string, LucideIcon> = {
  Clock, MapPin, FileCheck, Send, CalendarClock, BarChart3, Settings,
  Warehouse, Briefcase, Receipt, Workflow, Heart, Laptop, PenTool, ClipboardCheck, Gavel,
};

const ROLE_LABELS: Record<string, string> = {
  BOOD: 'Ban Giám đốc / Trưởng phòng (Level 1)',
  MANAGER: 'Quản lý (Level 2)',
  STAFF: 'Chuyên viên (Level 3)',
};

interface RemoteApp {
  name: string;
  iconKey?: string;
  color?: string;
  image?: string;
  href?: string;
  comingSoon?: boolean;
}

const isBiz = (n: string) => n.startsWith('HPC ');

function Tile({ app, onNavigate }: { app: RemoteApp; onNavigate: () => void }) {
  const Icon = (app.iconKey && ICONS[app.iconKey]) || AppWindow;
  const current = !!app.href && app.href.includes('dauthau.hpcore.vn');
  const inner = (
    <>
      <div className={`flex size-14 items-center justify-center overflow-hidden rounded-xl transition-transform group-hover:scale-105
        ${app.image ? 'bg-white' : (app.color ?? 'bg-brand-accent')} ${app.comingSoon ? 'opacity-50' : ''}`}>
        {app.image
          ? <img src={app.image} alt={app.name} className="size-full scale-[1.15] object-cover" />
          : <Icon className="size-6 text-white" aria-hidden />
        }
      </div>
      <span className={`text-center text-xs font-medium leading-tight ${app.comingSoon ? 'text-text-disabled' : 'text-foreground'}`}>
        {app.name}
      </span>
      {current && <span className="rounded-full bg-brand-accent/15 px-1.5 py-0.5 text-[9px] text-brand-accent dark:text-brand-accent-300">Đang dùng</span>}
      {app.comingSoon && <span className="rounded-full bg-brand-warning/15 px-1.5 py-0.5 text-[9px] text-brand-warning">Sắp ra mắt</span>}
    </>
  );
  const cls = 'group flex flex-col items-center gap-2 rounded-lg p-3 transition-colors hover:bg-elevated';
  if (app.comingSoon || !app.href) return <div className={`${cls} cursor-default`} title="Sắp ra mắt">{inner}</div>;
  if (current) return <div className={cls}>{inner}</div>;
  return <a href={app.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={cls}>{inner}</a>;
}

export function AppLauncher({
  displayName,
  email,
  role,
  onClose,
}: {
  displayName?: string | null;
  email?: string | null;
  role?: string;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [apps, setApps] = useState<RemoteApp[] | null>(null);

  useEffect(() => {
    let ok = true;
    fetch(APPS_API)
      .then((r) => r.json())
      .then((d) => { if (ok) setApps(Array.isArray(d.apps) ? d.apps : []); })
      .catch(() => { if (ok) setApps([]); });
    return () => { ok = false; };
  }, []);

  const ql = q.trim().toLowerCase();
  const list = (apps ?? []).filter((a) => !ql || a.name.toLowerCase().includes(ql));
  const groups = [
    { title: 'Nhân sự & Vận hành', subtitle: 'Chấm công, đơn từ, đặt phòng, báo cáo...', apps: list.filter((a) => !isBiz(a.name)) },
    { title: 'Ứng dụng nghiệp vụ', subtitle: 'Kinh doanh, kho, tài sản, quy trình...', apps: list.filter((a) => isBiz(a.name)) },
  ].filter((g) => g.apps.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-start overflow-y-auto bg-black/50 p-3 sm:py-4 md:pl-[272px] md:pr-4"
      onClick={onClose}
    >
      <div className="w-full max-w-4xl rounded-xl border border-hp-border bg-card text-foreground shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-hp-border p-5 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="truncate font-bold">{displayName || email || 'Người dùng'}</p>
            <p className="text-xs text-text-desc">
              {(role && ROLE_LABELS[role]) || role} ·{' '}
              <a href={HPCORE_PROFILE_URL} target="_blank" rel="noopener noreferrer" className="text-brand-accent dark:text-brand-accent-300 hover:underline">Tài khoản</a>
            </p>
          </div>
          <div className="relative sm:ml-auto sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-desc" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} autoFocus
              placeholder="Tìm kiếm ứng dụng"
              className="h-9 w-full rounded-md border border-hp-border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>
          <button onClick={onClose} aria-label="Đóng" className="hidden size-8 items-center justify-center rounded-md text-text-desc hover:bg-elevated sm:flex">
            <X className="size-5" />
          </button>
        </div>

        {/* Nội dung */}
        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-5">
          <a href="https://account.hpcore.vn/dashboard" className="inline-flex items-center gap-2 text-sm text-brand-accent dark:text-brand-accent-300 hover:underline">
            <LayoutGrid className="size-4" /> Tổng quan HPCons App Tổng
          </a>

          {apps === null ? (
            <p className="py-8 text-center text-sm text-text-desc">Đang tải danh sách ứng dụng…</p>
          ) : groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-desc">Không có ứng dụng phù hợp</p>
          ) : (
            groups.map((g) => (
              <div key={g.title}>
                <p className="font-semibold">{g.title}</p>
                <p className="mb-3 text-xs text-text-desc">{g.subtitle}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {g.apps.map((app) => <Tile key={app.name} app={app} onNavigate={onClose} />)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
