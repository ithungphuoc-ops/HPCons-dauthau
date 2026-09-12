'use client';

// AppLauncher — danh sách ứng dụng công ty (giống hệt pkd_crm-next/Task Manager),
// lấy từ account.hpcore.vn/api/apps. Bấm vào logo/tên app ở đầu Sidebar để mở.
//
// Từ 12/09/2026 App Tổng đổi chuẩn: /api/apps trả thêm group/groupLabel/groupColor/iconKeyNew.
// Popup gom 5 nhóm (hr/sales/supply/finance/system), ô icon nền đặc lấy màu từ `groupColor`
// (inline style, KHÔNG phụ thuộc safelist Tailwind) + icon Lucide trắng. API không trả `image` nữa.
// Vẫn giữ fallback: nếu API cũ thiếu `group` → 2 nhóm theo `category`; thiếu `groupColor` → class `color`
// (bg-blue-500...) hoặc `bg-brand-accent`; thiếu `iconKeyNew` → `iconKey` cũ.
import { useEffect, useState } from 'react';
import {
  Clock, MapPin, FileCheck, Send, CalendarClock, BarChart3, Settings,
  Warehouse, Briefcase, Receipt, Workflow, Heart, Laptop, PenTool, ClipboardCheck,
  Gavel, LayoutGrid, Search, X, AppWindow, type LucideIcon,
  // Icon Lucide thật theo iconKeyNew (App Tổng 12/09/2026)
  FileCheck2, ClipboardList, UserRound, Gift, BriefcaseBusiness, Handshake,
  Package, ShoppingCart, Boxes, ListChecks,
} from 'lucide-react';

const APPS_API = 'https://account.hpcore.vn/api/apps';
const HPCORE_PROFILE_URL = 'https://account.hpcore.vn/profile';

const ICONS: Record<string, LucideIcon> = {
  // Tên cũ (iconKey) — giữ để fallback
  Clock, MapPin, FileCheck, Send, CalendarClock, BarChart3, Settings,
  Warehouse, Briefcase, Receipt, Workflow, Heart, Laptop, PenTool, ClipboardCheck, Gavel,
  // Tên mới (iconKeyNew)
  FileCheck2, ClipboardList, UserRound, Gift, BriefcaseBusiness, Handshake,
  Package, ShoppingCart, Boxes, ListChecks,
};

// 5 nhóm chuẩn App Tổng — thứ tự hiển thị cố định. Nhãn/màu ở đây chỉ là fallback,
// ưu tiên groupLabel/groupColor do API trả về.
const GROUP_ORDER = ['hr', 'sales', 'supply', 'finance', 'system'] as const;
type GroupKey = (typeof GROUP_ORDER)[number];
const GROUP_META: Record<GroupKey, { label: string; subtitle: string; color: string }> = {
  hr: { label: 'Nhân sự & Hành chính', subtitle: 'Chấm công, đơn từ, đề xuất, đặt phòng, liên lạc, quà tặng', color: '#096AA7' },
  sales: { label: 'Kinh doanh & Dự án', subtitle: 'Khách hàng, đấu thầu, thiết kế, cuộc họp', color: '#0E8A5F' },
  supply: { label: 'Kho & Mua hàng', subtitle: 'Kho công trình, thu mua, kho ERP', color: '#B7791F' },
  finance: { label: 'Tài chính & Tài sản', subtitle: 'Công nợ, tài sản IT', color: '#0F7E8C' },
  system: { label: 'Quản trị hệ thống', subtitle: 'Báo cáo, cấu hình, phân quyền', color: '#4B5B6B' },
};

// Thang Level chị Trâm chốt 17/08/2026. Trước đây THIẾU HẲN VIEWER nên người Level 4 đăng nhập
// thấy chữ "VIEWER" thô trong khung tài khoản.
const ROLE_LABELS: Record<string, string> = {
  BOOD: 'Trưởng phòng / Phó phòng (Level 1)',
  MANAGER: 'Quản lý (Level 2)',
  STAFF: 'Nhân viên (Level 3)',
  VIEWER: 'Ban giám đốc — chỉ xem (Level 4)',
};

interface RemoteApp {
  name: string;
  iconKey?: string;
  iconKeyNew?: string;
  color?: string;
  category?: 'ops' | 'business';
  group?: string;
  groupLabel?: string;
  groupColor?: string;
  groupSoftColor?: string;
  image?: string | null;
  href?: string;
  comingSoon?: boolean;
}

interface AppGroup {
  key: string;
  title: string;
  subtitle: string;
  color?: string;
  apps: RemoteApp[];
}

/** Tô sáng phần chữ khớp với từ khoá tìm kiếm — plain-match, khớp đúng luật lọc app.name.toLowerCase().includes(ql) ở trên. */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-green-100 px-0.5 font-semibold text-green-800">{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
}

function Tile({ app, onNavigate, query }: { app: RemoteApp; onNavigate: () => void; query: string }) {
  const Icon = (app.iconKeyNew && ICONS[app.iconKeyNew]) || (app.iconKey && ICONS[app.iconKey]) || AppWindow;
  const current = !!app.href && app.href.includes('dauthau.hpcore.vn');
  // Nền đặc theo màu nhóm (inline) — chỉ rơi về class Tailwind cũ khi API không trả groupColor.
  const tileBgClass = app.groupColor ? '' : (app.color ?? 'bg-brand-accent');
  const inner = (
    <>
      <div
        className={`flex size-14 items-center justify-center overflow-hidden rounded-xl transition-transform group-hover:scale-105
        ${tileBgClass} ${app.comingSoon ? 'opacity-50' : ''}`}
        style={app.groupColor ? { backgroundColor: app.groupColor } : undefined}
      >
        <Icon size={26} strokeWidth={1.75} className="text-white" aria-hidden />
      </div>
      <span className={`text-center text-xs font-medium leading-tight ${app.comingSoon ? 'text-text-disabled' : 'text-foreground'}`}>
        <HighlightMatch text={app.name} query={query} />
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

/** Gom nhóm: ưu tiên 5 nhóm mới theo `group`; nếu API cũ không app nào có `group` → 2 nhóm theo `category`. */
function buildGroups(list: RemoteApp[]): AppGroup[] {
  const hasNewGroups = list.some((a) => !!a.group);
  if (hasNewGroups) {
    return GROUP_ORDER
      .map((key): AppGroup => {
        const apps = list.filter((a) => a.group === key);
        const meta = GROUP_META[key];
        return {
          key,
          title: apps[0]?.groupLabel || meta.label,
          subtitle: meta.subtitle,
          color: apps[0]?.groupColor || meta.color,
          apps,
        };
      })
      .filter((g) => g.apps.length > 0);
  }
  return [
    { key: 'ops', title: 'Nhân sự & Vận hành', subtitle: 'Chấm công, đơn từ, đặt phòng, báo cáo...', apps: list.filter((a) => a.category !== 'business') },
    { key: 'business', title: 'Ứng dụng nghiệp vụ', subtitle: 'Kinh doanh, kho, tài sản, quy trình...', apps: list.filter((a) => a.category === 'business') },
  ].filter((g) => g.apps.length > 0);
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
  const groups = buildGroups(list);

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
              <div key={g.key}>
                {/* Đầu nhóm: chấm vuông màu nhóm + tiêu đề + số app căn phải (giống App Tổng) */}
                <div className="flex items-center gap-2">
                  {g.color && <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: g.color }} />}
                  <p className="font-semibold">{g.title}</p>
                  <span className="ml-auto text-xs tabular-nums text-text-desc">{g.apps.length}</span>
                </div>
                <p className={`mb-3 text-xs text-text-desc ${g.color ? 'pl-[18px]' : ''}`}>{g.subtitle}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {g.apps.map((app) => <Tile key={app.name} app={app} onNavigate={onClose} query={ql} />)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
