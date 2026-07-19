import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, Staff, ProjectTask, ActivityLog, AppNotification, PersonalTask, DelayLog } from './types';
import { mockProjects, mockStaff, ADMIN_SEED } from './data/mockData';
import StatsDashboard from './components/StatsDashboard';
import GanttChart from './components/GanttChart';
import SchemaExplorer from './components/SchemaExplorer';
import WorkflowViewer from './components/WorkflowViewer';
import ProjectForm from './components/ProjectForm';
import HpConsLogo from './components/HpConsLogo';
import StaffEditModal from './components/StaffEditModal';
import TenderMindmap from './components/TenderMindmap';
import KanbanBoard, { KANBAN_STEPS } from './components/KanbanBoard';
import MyTasksPanel, { DEFAULT_PROJECT_TASKS, taskDeadlineISO, todayISO } from './components/MyTasksPanel';
import StaffTaskResultPanel from './components/StaffTaskResultPanel';
import SubtaskGantt, { DEFAULT_TASK_DAYS } from './components/SubtaskGantt';
import { Badge, TimelineProgress, EmptyState } from './components/ui';
import { updateTaskInTree, calculateProjectProgress, getTaskProgress } from './utils/taskTree';
import { fmtDateVN, fmtDateTimeVN } from './utils/dateVN';
import { useModalA11y } from './utils/useModalA11y';
import * as xlsx from 'xlsx';
import { 
  Building2, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  User, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  Calendar, 
  Users, 
  ListTodo, 
  Database, 
  Briefcase,
  FileCheck,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  LogOut,
  Sun,
  Moon,
  CheckSquare,
  Square,
  Zap,
  Upload,
  AlertTriangle,
  RefreshCw,
  Camera,
  Cloud,
  ExternalLink,
  History,
  LayoutGrid,
  Clock,
  Key,
  Bell,
  CalendarDays,
  X,
  MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ChangePasswordModal from './components/ChangePasswordModal';
import CdtRevisionModal from './components/CdtRevisionModal';
import PullBackDelayModal from './components/PullBackDelayModal';
import DateInput from './components/DateInput';
import { subscribeCollection, pushCollection, watchAuth, signInStaff, changeOwnPassword, signOutFb, authEmailFor } from './lib/firebase';

// One-time clean-slate: xóa dữ liệu demo cũ trong trình duyệt (nếu có) và seed tài khoản
// admin gốc. Dữ liệu cũ được sao lưu vào các khóa "*__predemo_backup" để khôi phục nếu cần.
(function runCleanSlateOnce() {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem('erp_clean_slate_v1')) return;
    ['erp_projects', 'erp_staff', 'erp_activity_logs', 'erp_current_user'].forEach((k) => {
      const v = localStorage.getItem(k);
      if (v != null) localStorage.setItem(`${k}__predemo_backup`, v);
    });
    localStorage.setItem('erp_staff', JSON.stringify([ADMIN_SEED]));
    localStorage.removeItem('erp_projects');
    localStorage.removeItem('erp_activity_logs');
    localStorage.removeItem('erp_current_user');
    localStorage.setItem('erp_clean_slate_v1', '1');
  } catch (e) {
    console.error('Clean-slate migration error', e);
  }
})();

// Seed danh sách nhân sự Phòng Đấu Thầu (admin + 8 người) một lần. Tách riêng để có thể
// cập nhật danh sách mà không xoá dữ liệu dự án đang có.
(function seedStaffOnce() {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem('erp_staff_seed_v3')) return;
    localStorage.setItem('erp_staff', JSON.stringify(mockStaff));
    localStorage.setItem('erp_staff_seed_v3', '1');
  } catch (e) {
    console.error('Staff seed error', e);
  }
})();

// Nâng cấp Firebase Auth (v4): mật khẩu KHÔNG còn lưu trong dữ liệu nhân sự — Firebase quản lý.
// Dọn mật khẩu cũ khỏi bộ nhớ máy; admin chuyển sang luồng kích hoạt 123456 + bắt đổi lần đầu.
(function authUpgradeV4() {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem('erp_auth_v4')) return;
    const raw = localStorage.getItem('erp_staff');
    if (raw) {
      const list = JSON.parse(raw) as any[];
      const cleaned = list.map(({ password, ...s }) =>
        s.id === 'ADMIN' ? { ...s, mustChangePassword: true } : s
      );
      localStorage.setItem('erp_staff', JSON.stringify(cleaned));
    }
    localStorage.removeItem('erp_current_user'); // buộc đăng nhập lại theo cơ chế mới
    localStorage.setItem('erp_auth_v4', '1');
  } catch (e) {
    console.error('Auth v4 migration error', e);
  }
})();

export const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.trim().split(' ');
  const last = parts[parts.length - 1] || '';
  const first = parts[0] || '';
  const letters = (first[0] || '') + (last[0] || '');
  return letters.toUpperCase();
};

export const getInitialsColor = (name: string) => {
  if (!name) return 'bg-slate-200 text-slate-700 dark:bg-dark-elevated dark:text-slate-300';
  const code = name.charCodeAt(0) % 5;
  const colors = [
    'bg-brand-accent/15 text-brand-accent-700 dark:bg-brand-accent/15 dark:text-brand-accent-300 border-brand-accent/50 dark:border-brand-accent/40',
    'bg-brand-success/15 text-brand-success-700 dark:bg-brand-success/15 dark:text-brand-success-300 border-brand-success/50 dark:border-brand-success/40',
    'bg-brand-accent/15 text-brand-accent-700 dark:bg-brand-accent/15 dark:text-brand-accent-300 border-brand-accent/50 dark:border-brand-accent/40',
    'bg-brand-warning/15 text-brand-warning dark:bg-brand-warning/10 dark:text-brand-warning border-brand-warning/50 dark:border-brand-warning/40',
    'bg-brand-accent/15 text-brand-accent-700 dark:bg-brand-accent/15 dark:text-brand-accent-300 border-brand-accent/50 dark:border-brand-accent/40',
  ];
  return colors[code];
};

// ===== Lịch cá nhân: nhãn & tính lần xảy ra của việc lặp lại =====
export const REPEAT_LABEL: Record<string, string> = {
  none: 'Không lặp lại', daily: 'Hàng ngày', weekly: 'Hàng tuần', monthly: 'Hàng tháng', yearly: 'Hàng năm',
};
const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Việc `t` có xảy ra vào ngày `cd` không (theo kiểu lặp lại; bắt đầu từ dueDate)?
export function ptOccursOn(t: PersonalTask, cd: Date): boolean {
  const [by, bm, bd] = t.dueDate.split('-').map(Number);
  const base = new Date(by, bm - 1, bd);
  const cell = new Date(cd.getFullYear(), cd.getMonth(), cd.getDate());
  if (cell.getTime() < base.getTime()) return false;
  // Lịch lặp lại: bỏ buổi đã xóa lẻ, và cắt chuỗi khi vượt repeatUntil.
  const cellYMD = ymdOf(cell);
  if (t.excludeDates?.includes(cellYMD)) return false;
  if (t.repeatUntil && cellYMD > t.repeatUntil) return false;
  switch (t.repeat || 'none') {
    case 'daily': return true;
    case 'weekly': return Math.round((cell.getTime() - base.getTime()) / 86400000) % 7 === 0;
    case 'monthly': return cell.getDate() === bd;
    case 'yearly': return cell.getDate() === bd && cell.getMonth() === bm - 1;
    default: return ymdOf(cell) === t.dueDate; // none
  }
}
// Ngày xảy ra kế tiếp (YYYY-MM-DD) tính từ fromYMD; quét tối đa 400 ngày; null nếu hết.
export function ptNextOccurrence(t: PersonalTask, fromYMD: string): string | null {
  if ((t.repeat || 'none') === 'none') return t.dueDate;
  const [fy, fm, fd] = fromYMD.split('-').map(Number);
  for (let i = 0; i < 400; i++) {
    const d = new Date(fy, fm - 1, fd + i);
    if (ptOccursOn(t, d)) return ymdOf(d);
  }
  return null;
}

// Ánh xạ chức danh → quyền hệ thống (RBAC) khi tài khoản chưa gán quyền tường minh.
// Ban giám đốc / Trưởng phòng / Phó phòng / Quản trị hệ thống = Level 1 (BOOD); Quản lý = Level 2; còn lại = Level 3.
// (2026-07-15, chị chốt: Phó phòng lên Level 1; chức danh "Quản lý" thay Phó phòng ở Level 2)
export const chucVuToRole = (chucVu?: string): 'BOOD' | 'MANAGER' | 'STAFF' =>
  (chucVu === 'Ban giám đốc' || chucVu === 'Trưởng phòng' || chucVu === 'Phó phòng' || chucVu === 'Quản trị hệ thống') ? 'BOOD' :
  chucVu === 'Quản lý' ? 'MANAGER' : 'STAFF';

// Đa quản lý (chị chốt 17/07): 1 quản lý CHÍNH + nhiều quản lý PHỤ/kế thừa đều có quyền thao tác.
// Dùng cho mọi kiểm tra "người này có phải quản lý của dự án không".
export const isProjectManager = (p: { quanLyId?: string; quanLyIdsPhu?: string[] }, staffId?: string): boolean =>
  !!staffId && (p.quanLyId === staffId || !!p.quanLyIdsPhu?.includes(staffId));
// Danh sách toàn bộ quản lý (chính + phụ), lọc rỗng — để gửi thông báo cho tất cả.
export const allManagerIds = (p: { quanLyId?: string; quanLyIdsPhu?: string[] }): string[] =>
  Array.from(new Set([p.quanLyId, ...(p.quanLyIdsPhu || [])].filter(Boolean))) as string[];

// ===== MỌI "hạn" bám 1 NGUỒN duy nhất = mốc kết thúc VIỆC CON (sơ đồ Gantt) =====
type DeadlineFields = { ngayBatDau: string; tasks?: ProjectTask[]; soNgayThucHien?: number; soNgayDuyetTP?: number; soNgayDuyetBLD?: number; soNgayDuKien?: number };
// Mốc KẾT THÚC thực hiện = ngày kết thúc muộn nhất của các việc con (cùng cách xếp lịch với SubtaskGantt:
// việc chưa đặt ngày thì xếp nối tiếp từ ngày bắt đầu dự án). Không có việc con → dùng số ngày thực hiện dự kiến.
export const getExecEnd = (p: DeadlineFields): Date => {
  const DAY = 24 * 60 * 60 * 1000;
  const start = new Date(p.ngayBatDau);
  const list = p.tasks || [];
  if (list.length === 0) {
    const execDays = p.soNgayThucHien ?? Math.max(1, (p.soNgayDuKien ?? 3) - 2);
    return new Date(start.getTime() + execDays * DAY);
  }
  let cursor = start.getTime();
  let maxEnd = cursor;
  for (const t of list) {
    const ts = t.ngayBatDau ? new Date(t.ngayBatDau).getTime() : cursor;
    const days = t.soNgay && t.soNgay > 0 ? t.soNgay : DEFAULT_TASK_DAYS;
    const end = ts + days * DAY;
    cursor = end;
    if (end > maxEnd) maxEnd = end;
  }
  return new Date(maxEnd);
};
// Hạn PHÒNG (chốt khi TP duyệt xong) = mốc kết thúc việc con + số ngày TP kiểm tra. KHÔNG tính BLĐ.
export const getDeptDeadline = (p: DeadlineFields): Date => {
  const d = getExecEnd(p);
  d.setDate(d.getDate() + (p.soNgayDuyetTP ?? 1));
  return d;
};
// Hạn THẦU (nộp CĐT) = Hạn Phòng + số ngày Ban lãnh đạo duyệt.
export const getTenderDeadline = (p: DeadlineFields): Date => {
  const d = getDeptDeadline(p);
  d.setDate(d.getDate() + (p.soNgayDuyetBLD ?? 1));
  return d;
};

// Cụm nút lọc trạng thái Đang làm / Đã xong / Tất cả — DÙNG CHUNG cho Dashboard,
// danh sách Dự án cha và bảng Công việc (gom 3 bản copy y hệt — luật 8: không lặp component)
function StatusFilterPills({ value, onChange, counts }: {
  value: 'ACTIVE' | 'DONE' | 'ALL';
  onChange: (v: 'ACTIVE' | 'DONE' | 'ALL') => void;
  counts: { active: number; done: number; all: number };
}) {
  return (
    <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-dark-elevated/60 p-0.5 rounded-lg">
      {([['ACTIVE', 'Đang làm', counts.active], ['DONE', 'Đã xong', counts.done], ['ALL', 'Tất cả', counts.all]] as const).map(([k, label, n]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={`px-2.5 py-1 rounded-md text-[10px] font-black transition-colors whitespace-nowrap ${value === k ? 'bg-white dark:bg-dark-card text-brand-accent dark:text-brand-accent-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
          {label} ({n})
        </button>
      ))}
    </div>
  );
}

// Thẻ Trưởng phòng kiểm tra & cập nhật KẾT QUẢ + TIẾN ĐỘ cấp Phòng cho một hồ sơ thầu
function PhongResultCard({ project, canEdit, onSave, hideNotes = false }: {
  project: Project;
  canEdit: boolean;
  onSave: (tienDoPhong: number, ketQuaPhong: string) => void;
  hideNotes?: boolean;   // Ẩn khối "Kết quả kiểm tra của Trưởng phòng" (dùng cho chế độ xem nhanh cho gọn)
}) {
  const [tienDo, setTienDo] = useState<number>(project.tienDoPhong || 0);
  const [ketQua, setKetQua] = useState<string>(project.ketQuaPhong || '');

  useEffect(() => {
    setTienDo(project.tienDoPhong || 0);
    setKetQua(project.ketQuaPhong || '');
  }, [project.id, project.tienDoPhong, project.ketQuaPhong]);

  const isDirty = tienDo !== (project.tienDoPhong || 0) || ketQua.trim() !== (project.ketQuaPhong || '');

  return (
    <div className="bg-white dark:bg-dark-card border border-brand-primary/60 dark:border-brand-primary/40 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
        <span className="text-[10px] uppercase font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <FileCheck className="w-4 h-4 text-brand-primary shrink-0" />
          Kết quả kiểm tra &amp; Tiến độ cấp Phòng
        </span>
        <span className="text-[9px] bg-brand-primary/10 dark:bg-brand-primary/15 text-brand-primary dark:text-brand-primary-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
          Trưởng phòng cập nhật
        </span>
      </div>

      {(() => {
        const dl = getDeptDeadline(project);
        const overdue = dl.getTime() < Date.now() && (project.tienDoPhong || 0) < 100;
        return (
          <div className={`flex items-center justify-between text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${overdue ? 'bg-brand-danger/10 dark:bg-brand-danger/10 border-brand-danger/25 dark:border-brand-danger/20 text-brand-danger dark:text-brand-danger' : 'bg-slate-50 dark:bg-dark-bg border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-300'}`}>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3 shrink-0" /> Hạn Phòng (chốt khi TP duyệt xong)</span>
            <span>{fmtDateVN(dl)}{overdue ? ' • Trễ hạn' : ''}</span>
          </div>
        );
      })()}

      <div className="space-y-1">
        <div className="flex justify-between text-[11px] font-bold">
          <span className="text-slate-700 dark:text-slate-300">Tiến độ Phòng duyệt</span>
          <span className="text-brand-success dark:text-brand-success-300">{tienDo}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={tienDo}
          onChange={(e) => setTienDo(parseInt(e.target.value))}
          disabled={!canEdit}
          className="w-full h-1.5 bg-slate-100 dark:bg-dark-elevated rounded-lg appearance-none cursor-pointer accent-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {!hideNotes && (
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
          Kết quả kiểm tra của Trưởng phòng (nhận xét, kết luận nghiệm thu cấp Phòng):
        </span>
        {canEdit ? (
          <textarea
            value={ketQua}
            onChange={(e) => setKetQua(e.target.value)}
            placeholder="VD: Đã rà soát toàn bộ đơn giá và khối lượng BOQ, hồ sơ đạt yêu cầu trình ký..."
            className="w-full h-16 p-2 text-xs bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        ) : (
          <div className="p-2.5 bg-slate-50 dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 min-h-10 font-medium whitespace-pre-wrap">
            {project.ketQuaPhong?.trim() || 'Trưởng phòng chưa cập nhật kết quả kiểm tra cấp Phòng.'}
          </div>
        )}
      </div>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onSave(tienDo, ketQua)}
            disabled={!isDirty}
            className="px-4 py-1.5 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg text-[11px] font-black transition-colors cursor-pointer"
          >
            💾 Lưu kết quả Phòng
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  // Load initial data from localStorage if exists, else fallback to mock data
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('erp_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((p: any, idx: number) => {
            // Robust migration for legacy data structure
            if (!p.projectId) {
              const num = p.stt || (idx + 1);
              const formattedNum = num < 10 ? `0${num}` : `${num}`;
              p.projectId = `2026.${formattedNum}`;
            }
            // Dữ liệu cũ (chưa có loaiBanGhi) → coi là công việc/gói thầu (vẫn lên Kanban)
            if (!p.loaiBanGhi) p.loaiBanGhi = 'CONG_VIEC';
            // Tách số ngày cũ thành 3 chặng (giữ nguyên tổng = hạn cũ): thực hiện + TP duyệt + Giám đốc duyệt
            if (p.soNgayThucHien === undefined && typeof p.soNgayDuKien === 'number') {
              if (p.soNgayDuKien >= 3) { p.soNgayThucHien = p.soNgayDuKien - 2; p.soNgayDuyetTP = 1; p.soNgayDuyetBLD = 1; }
              else { p.soNgayThucHien = Math.max(1, p.soNgayDuKien); p.soNgayDuyetTP = 0; p.soNgayDuyetBLD = 0; }
            }
            // Strip confidential money fields & legacy quality score left over from older versions
            const { giaTriDuAn, giaTriUocTinh, giaTriHopDong, doanhThuDaThu, qualityScore, ...rest } = p;
            return rest as Project;
          });
        }
      } catch (e) {
        console.error("Error parsing projects from localStorage", e);
      }
    }
    return mockProjects;
  });

  const [staff, setStaff] = useState<Staff[]>(() => {
    const saved = localStorage.getItem('erp_staff');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Staff[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Error parsing staff from localStorage", e);
      }
    }
    return mockStaff;
  });

  // Current logged in user (RBAC state)
  const [currentUser, setCurrentUser] = useState<{ email: string; role: 'BOOD' | 'MANAGER' | 'STAFF'; staffId: string; name: string } | null>(() => {
    const saved = localStorage.getItem('erp_current_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) {
          if (parsed.staffId === 'S001') parsed.email = 'bood@hpcons.vn';
          if (parsed.staffId === 'S002') parsed.email = 'manager@hpcons.vn';
          if (parsed.staffId === 'S003') parsed.email = 'nam@hpcons.vn';
          localStorage.setItem('erp_current_user', JSON.stringify(parsed));
        }
        return parsed;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Form input credential states for Webform login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Dark/Light mode theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // Default to dark mode as requested (do not default to light)
  });

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PROJECTS' | 'KANBAN' | 'GANTT' | 'STAFF' | 'SYSTEM' | 'HISTORY' | 'CALENDAR' | 'DEPTLINKS'>('DASHBOARD');

  // ===== Lịch cá nhân (việc riêng + nhắc trên chuông) — lưu localStorage theo máy/người dùng =====
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>(() => {
    try { const s = JSON.parse(localStorage.getItem('erp_personal_tasks') || '[]'); return Array.isArray(s) ? s : []; }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem('erp_personal_tasks', JSON.stringify(personalTasks));
  }, [personalTasks]);
  // Ô nhập nhanh của tab Lịch
  const [newPtTitle, setNewPtTitle] = useState('');
  const [newPtDue, setNewPtDue] = useState('');
  const [newPtNote, setNewPtNote] = useState('');
  const [newPtTime, setNewPtTime] = useState('');   // Giờ hẹn HH:MM (rỗng = cả ngày)
  const [newPtRepeat, setNewPtRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('none');
  const [notifPerm, setNotifPerm] = useState<string>(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  // ===== Lịch cá nhân dạng Google Calendar (chỉ đổi GIAO DIỆN — logic nhắc giữ nguyên) =====
  // Con trỏ tháng đang xem (ngày 1 của tháng); modal 1 ngày mở khi bấm ô ngày (YYYY-MM-DD) hoặc null.
  const [calCursor, setCalCursor] = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [calDayModal, setCalDayModal] = useState<string | null>(null);
  const calDayModalRef = useModalA11y(() => setCalDayModal(null), calDayModal !== null);
  // Tab "Hệ thống" gộp CSDL + Luồng Nghiệp Vụ; nút gạt chọn nội dung con
  const [systemSubtab, setSystemSubtab] = useState<'SCHEMA' | 'WORKFLOW'>('SCHEMA');

  // Bottom Navigation mobile (06-mobile/layout.md): sheet "Thêm" chứa các tab ngoài 4 mục chính
  const [showMoreNav, setShowMoreNav] = useState(false);
  const moreNavRef = useModalA11y(() => setShowMoreNav(false), showMoreNav);

  // Sidebar thu gọn 72px (HPCons 08-navigation): tablet 768-1279 mặc định thu gọn, desktop mở 260px.
  // Người dùng bấm nút thu/mở — lựa chọn được nhớ trong localStorage.
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('ui_sidebar_collapsed');
    if (saved !== null) return saved === '1';
    return typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1280;
  });
  const toggleSidebar = () => setSidebarCollapsed(v => {
    localStorage.setItem('ui_sidebar_collapsed', v ? '0' : '1');
    return !v;
  });
  
  // Activity logging state & helper
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('erp_activity_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing activity logs", e);
      }
    }
    // Seed default professional logs for HP-CONS
    const seedLogs: ActivityLog[] = [
      {
        id: 'L-seed-1',
        userId: 'S001',
        userName: 'Ngô Trấn Lâm',
        userRole: 'BOOD',
        action: 'Khởi tạo hệ thống',
        details: 'Hệ thống HP-CONS ERP BPM hoàn tất khởi tạo cơ sở dữ liệu và đồng bộ các mốc tiến độ phòng Đấu Thầu.',
        timestamp: '2026-06-29 08:30:00'
      },
      {
        id: 'L-seed-2',
        userId: 'S002',
        userName: 'Nguyễn Văn Mạnh',
        userRole: 'MANAGER',
        action: 'Đồng bộ tiến độ',
        details: 'Đã cập nhật đồng bộ các mốc tiến độ mới nhất cho 8 dự án thầu từ nguồn báo cáo phòng Đấu thầu.',
        timestamp: '2026-06-29 09:15:22'
      },
      {
        id: 'L-seed-3',
        userId: 'S003',
        userName: 'Trần Hoài Nam',
        userRole: 'STAFF',
        action: 'Cập nhật tác vụ',
        details: 'Đã hoàn thành mốc "Nghiên cứu hồ sơ thầu & Thiết kế sơ bộ" tại gói thầu mẫu ĐX.2026.01.',
        timestamp: '2026-06-29 10:42:05'
      }
    ];
    localStorage.setItem('erp_activity_logs', JSON.stringify(seedLogs));
    return seedLogs;
  });

  const logAction = (action: string, details: string, userOverride?: any, relatedStaffIds?: string[]) => {
    const user = userOverride || currentUser;
    if (!user) return;
    const newLog: ActivityLog = {
      id: `L-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: user.staffId,
      userName: user.name,
      userRole: user.role,
      action,
      details,
      timestamp: new Date().toLocaleString('sv-SE').replace('T', ' '),
      relatedStaffIds: relatedStaffIds && relatedStaffIds.length > 0 ? relatedStaffIds : undefined
    };
    setActivityLogs(prev => {
      const updated = [newLog, ...prev];
      localStorage.setItem('erp_activity_logs', JSON.stringify(updated));
      return updated;
    });
  };

  // All personnel taking part in a project (manager + implementers) — used to scope activity-log visibility
  const getProjectParticipants = (p?: Project): string[] => {
    if (!p) return [];
    return Array.from(new Set([p.quanLyId, ...(p.quanLyIdsPhu || []), p.thucHienId, ...(p.thucHienIds || [])].filter(Boolean)));
  };
  
  // Form modal states
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);
  const [formMode, setFormMode] = useState<'CREATE_TENDER' | 'ADD_WORK' | 'EDIT_ALL'>('EDIT_ALL');
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [isAddingStaff, setIsAddingStaff] = useState<boolean>(false);
  // Modal đổi mật khẩu: 'forced' = bắt buộc lần đầu; 'self' = người dùng tự đổi
  const [pwModal, setPwModal] = useState<'forced' | 'self' | null>(null);
  // Chuông thông báo cho Trưởng phòng (báo TP vào nhập tiến độ Phòng)
  const [showNotif, setShowNotif] = useState(false);
  // Công việc đang mở modal "CĐT điều chỉnh"
  const [cdtRevisionProject, setCdtRevisionProject] = useState<Project | null>(null);
  // Kéo hồ sơ về Bước 1: hộp hỏi "có ảnh hưởng hạn nộp không?" (Stage 1). Nếu có → mở popup dời hạn (Stage 2).
  const [pullBackProject, setPullBackProject] = useState<Project | null>(null);
  const [pullBackDelayProject, setPullBackDelayProject] = useState<Project | null>(null);
  // Hộp xác nhận xóa chung (dự án, công việc, việc lịch không lặp) — bấm "Xóa" lần nữa mới xóa.
  const [confirmState, setConfirmState] = useState<null | { title: string; message: string; confirmLabel: string; onConfirm: () => void }>(null);
  // Hộp xóa việc lịch LẶP LẠI: chọn chỉ xóa buổi này / xóa buổi này & các buổi sau.
  const [recurDelete, setRecurDelete] = useState<null | { task: PersonalTask; occ: string }>(null);
  const [deletingStaffId, setDeletingStaffId] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStaff, setFilterStaff] = useState<string>('ALL');

  // Date Range and Excel Import states
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [apiFilteredProjects, setApiFilteredProjects] = useState<Project[] | null>(null);
  const [showImportPanel, setShowImportPanel] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  // Expanded project accordion state
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Staff personal workspace: which task has its result editor open (key: `${projectId}-${taskId}`)
  const [expandedStaffTaskId, setExpandedStaffTaskId] = useState<string | null>(null);

  // Dashboard year filter (default: current year)
  const [dashboardYear, setDashboardYear] = useState<string>(String(new Date().getFullYear()));
  // Lọc dự án/hồ sơ theo trạng thái hoàn thành (dùng cho "Danh sách dự án" & "Tổng hợp tình trạng").
  // Mặc định ẩn bớt hồ sơ đã xong cho gọn.
  const [projStatusFilter, setProjStatusFilter] = useState<'ACTIVE' | 'DONE' | 'ALL'>('ACTIVE');

  // Activity log search box
  const [logSearch, setLogSearch] = useState<string>('');

  // Ô tìm kiếm dự án ở danh sách tác vụ cá nhân (nhân viên L3)
  const [personalTaskSearch, setPersonalTaskSearch] = useState<string>('');
  // Lọc danh sách tác vụ nhân viên theo khoảng thời gian thực hiện (từ ngày → đến ngày)
  const [staffTaskFrom, setStaffTaskFrom] = useState<string>('');
  const [staffTaskTo, setStaffTaskTo] = useState<string>('');

  // App-wide font scale for readability (persisted)
  const [fontScale, setFontScale] = useState<number>(() => {
    const saved = parseFloat(localStorage.getItem('erp_font_scale') || '1');
    return isNaN(saved) ? 1 : Math.min(1.4, Math.max(0.85, saved));
  });

  useEffect(() => {
    // Dùng CSS `zoom` (phóng CẢ chữ px lẫn layout như trình duyệt) thay cho font-size % trên <html>
    // — vì app dùng nhiều cỡ chữ px cố định (text-[10px]...) mà font-size % không scale được.
    document.documentElement.style.fontSize = '';
    document.body.style.setProperty('zoom', String(fontScale));
    localStorage.setItem('erp_font_scale', String(fontScale));
  }, [fontScale]);

  // Ctrl + mouse wheel zooms the app font size (like a browser); prevents native page zoom
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const step = e.deltaY < 0 ? 0.05 : -0.05;
      setFontScale(prev => Math.min(1.4, Math.max(0.85, Math.round((prev + step) * 100) / 100)));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  // Notification banner state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Đồng hồ UTC hiển thị ở góc trang đăng nhập + giờ địa phương hiển thị trên header sau đăng nhập
  const [utcTime, setUtcTime] = useState('');
  const [localNow, setLocalNow] = useState(() => new Date());

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${h}:${m}:${s} UTC`);
      setLocalNow(now);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync dark class to HTML document element
  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Live Recalculation Engine for Staff KPIs based on Project statuses
  const updateStaffStats = (projList: Project[], currentStaffList: Staff[] = staff) => {
    const updatedStaff = currentStaffList.map(member => {
      // Find all projects assigned to this staff member (as coordinator or primary)
      const memberProjects = projList.filter(p => p.thucHienId === member.id || p.thucHienIds?.includes(member.id));
      
      const activeCount = memberProjects.filter(p => p.trangThai === 'DANG_THUC_HIEN' || p.trangThai === 'TRE_TIEN_DO').length;
      
      const completedList = memberProjects.filter(p => p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN');
      const onTimeCompleted = memberProjects.filter(p => p.trangThai === 'HOAN_THANH_DUNG_HAN');
      const overdueList = memberProjects.filter(p => p.trangThai === 'TRE_TIEN_DO');
      const lateCompletedList = memberProjects.filter(p => p.trangThai === 'HOAN_THANH_TRE_HAN');

      // On-time rate calculation
      const onTimeRate = completedList.length > 0 
        ? Math.round((onTimeCompleted.length / completedList.length) * 100) 
        : 100;

      // Helper for date difference
      const getDaysDiff = (d1Str: string, d2Str: string): number => {
        if (!d1Str || !d2Str) return 0;
        const d1 = new Date(d1Str);
        const d2 = new Date(d2Str);
        const diffTime = d2.getTime() - d1.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      };

      // Automated KPI engine: KPI chỉ tính theo tiến độ
      // (100 điểm, trừ 5 điểm cho mỗi ngày trễ hạn — không còn điểm chất lượng)
      const memberKpis = memberProjects.map(p => {
        let daysDelayed = 0;
        const isCompleted = p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN' || !!p.ngayHoanThanhThucTe;
        // Hồ sơ đã gửi CĐT (bước 5 trở đi): mốc chấm trễ là THỜI HẠN HẸN CĐT (nếu có) thay cho hạn hiện tại
        const benchmark = ((p.kanbanStep || 0) >= 5 && p.hanHenCDT) ? p.hanHenCDT : ymdOf(getTenderDeadline(p));
        if (isCompleted) {
          const completionDate = p.ngayHoanThanhThucTe || new Date().toISOString().split('T')[0];
          daysDelayed = Math.max(0, getDaysDiff(benchmark, completionDate));
        } else {
          const todayStr = new Date().toISOString().split('T')[0];
          daysDelayed = Math.max(0, getDaysDiff(benchmark, todayStr));
        }

        return Math.max(0, 100 - (daysDelayed * 5));
      });

      const kpiPoints = memberKpis.length > 0
        ? Math.round(memberKpis.reduce((acc, val) => acc + val, 0) / memberKpis.length)
        : 85; // Default score of 85 if no tasks assigned yet

      return {
        ...member,
        soDuAnDangLam: activeCount,
        tiLeDungHan: onTimeRate,
        kpiDiem: kpiPoints
      };
    });

    setStaff(updatedStaff);
    localStorage.setItem('erp_staff', JSON.stringify(updatedStaff));
  };

  // ===== Firestore (đám mây): nguồn dữ liệu CHUNG của cả phòng, realtime =====
  // lastRemote lưu "ảnh chụp" JSON lần nhận gần nhất từ cloud để tránh vòng lặp echo
  // (nhận từ cloud → state đổi → effect đẩy lại cloud → nhận lại...).
  const lastRemoteProjects = useRef<string | null>(null);
  const lastRemoteStaff = useRef<string | null>(null);

  // Thông báo chuông 🔔 (lưu cloud — mọi vai trò đều nhận theo targetId)
  const [notifs, setNotifs] = useState<AppNotification[]>(() => {
    try { return JSON.parse(localStorage.getItem('erp_notifs') || '[]'); } catch { return []; }
  });
  const lastRemoteNotifs = useRef<string | null>(null);

  // Trạng thái đăng nhập Firebase Auth (chìa khóa để đọc/ghi Firestore sau khi siết Rules)
  const [fbAuthed, setFbAuthed] = useState<boolean>(false);
  // Đã nhận bản nhân sự MỚI NHẤT từ cloud sau khi đăng nhập (để chốt vai trò/cờ đổi mật khẩu chính xác)
  const [staffSynced, setStaffSynced] = useState<boolean>(false);
  // Tên đăng nhập đang chờ hoàn tất (đã qua Firebase Auth, chờ dữ liệu nhân sự về để vào app)
  const [pendingLoginUser, setPendingLoginUser] = useState<string | null>(null);

  useEffect(() => watchAuth(u => {
    setFbAuthed(!!u);
    if (!u) {
      // Phiên Firebase kết thúc → khóa dữ liệu, quay về màn đăng nhập
      setStaffSynced(false);
      lastRemoteProjects.current = null;
      lastRemoteStaff.current = null;
      lastRemoteNotifs.current = null;
    }
  }), []);

  useEffect(() => {
    if (!fbAuthed) return; // Rules yêu cầu đăng nhập — chỉ lắng nghe dữ liệu sau khi có phiên Firebase
    const unsubProjects = subscribeCollection<Project>('projects', (items, isEmpty) => {
      if (isEmpty) {
        // Cloud chưa có dữ liệu → thiết bị đầu tiên đẩy dữ liệu cục bộ lên làm gốc.
        // Luôn ghi nhận đã nhận snapshot (kể cả rỗng) để mở khóa cho effect đồng bộ bên dưới.
        setProjects(prev => {
          lastRemoteProjects.current = JSON.stringify(prev.length > 0 ? prev : []);
          if (prev.length > 0) {
            pushCollection('projects', prev).catch(err => console.error('[Firebase] Lỗi đẩy dự án lần đầu:', err));
          } else {
            lastRemoteProjects.current = '[]';
          }
          return prev;
        });
        return;
      }
      const sorted = [...items].sort((a, b) => (a.projectId || '').localeCompare(b.projectId || ''));
      lastRemoteProjects.current = JSON.stringify(sorted);
      setProjects(sorted);
    });
    const unsubStaff = subscribeCollection<Staff>('staff', (items, isEmpty) => {
      if (isEmpty) {
        setStaff(prev => {
          lastRemoteStaff.current = JSON.stringify(prev.length > 0 ? prev : []);
          if (prev.length > 0) {
            pushCollection('staff', prev).catch(err => console.error('[Firebase] Lỗi đẩy nhân sự lần đầu:', err));
          }
          return prev;
        });
        setStaffSynced(true);
        return;
      }
      const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
      lastRemoteStaff.current = JSON.stringify(sorted);
      setStaff(sorted);
      setStaffSynced(true);
    });
    const unsubNotifs = subscribeCollection<AppNotification>('notifications', (items, isEmpty) => {
      if (isEmpty) { lastRemoteNotifs.current = '[]'; setNotifs([]); return; }
      const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
      lastRemoteNotifs.current = JSON.stringify(sorted);
      setNotifs(sorted);
    });
    return () => { unsubProjects(); unsubStaff(); unsubNotifs(); };
  }, [fbAuthed]);

  // Đồng bộ thông báo lên cloud (chỉ sau snapshot đầu, tránh ghi đè)
  useEffect(() => {
    localStorage.setItem('erp_notifs', JSON.stringify(notifs));
    const sorted = [...notifs].sort((a, b) => a.id.localeCompare(b.id));
    const serialized = JSON.stringify(sorted);
    if (lastRemoteNotifs.current !== null && serialized !== lastRemoteNotifs.current) {
      lastRemoteNotifs.current = serialized;
      pushCollection('notifications', sorted).catch(err => console.error('[Firebase] Lỗi đồng bộ thông báo:', err));
    }
  }, [notifs]);

  // Gửi thông báo tới danh sách nhân sự (bỏ qua chính mình); giữ tối đa 30 thông báo/người.
  // CHỐNG TRÙNG: cùng người nhận + cùng nội dung + cùng hồ sơ → chỉ giữ 1 thông báo
  // (tránh việc chỉnh kế hoạch nhiều lần bắn lặp "bạn được giao việc" cho nhân sự).
  const pushNotify = (targetIds: (string | undefined)[], text: string, projId?: string) => {
    const ids = Array.from(new Set(targetIds.filter(Boolean) as string[])).filter(id => id !== currentUser?.staffId);
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setNotifs(prev => {
      const items: AppNotification[] = ids
        .filter(tid => !prev.some(n => n.targetId === tid && n.text === text && n.projId === projId))
        .map((tid, i) => ({ id: `N${Date.now()}-${i}-${tid}`, targetId: tid, text, projId, ngay: now }));
      if (items.length === 0) return prev;
      const merged = [...prev, ...items];
      const byTarget: Record<string, AppNotification[]> = {};
      merged.forEach(n => { (byTarget[n.targetId] = byTarget[n.targetId] || []).push(n); });
      return Object.values(byTarget).flatMap(list => [...list].sort((a, b) => a.ngay.localeCompare(b.ngay)).slice(-30));
    });
  };

  // Tự nhắc CHÍNH MÌNH (khác pushNotify — pushNotify loại trừ bản thân). Dùng cho Lịch cá nhân:
  // đẩy tin lên chuông + popup thông báo trình duyệt (nếu đã được cấp quyền).
  const notifySelf = (text: string) => {
    const id = currentUser?.staffId;
    if (!id) return;
    const now = new Date().toISOString();
    setNotifs(prev => {
      if (prev.some(n => n.targetId === id && n.text === text)) return prev;
      const merged = [...prev, { id: `N${Date.now()}-self`, targetId: id, text, ngay: now } as AppNotification];
      const byTarget: Record<string, AppNotification[]> = {};
      merged.forEach(n => { (byTarget[n.targetId] = byTarget[n.targetId] || []).push(n); });
      return Object.values(byTarget).flatMap(list => [...list].sort((a, b) => a.ngay.localeCompare(b.ngay)).slice(-30));
    });
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification('Nhắc việc — HP-CONS ERP', { body: text }); } catch { /* trình duyệt chặn */ }
    }
  };

  // Bộ máy nhắc Lịch cá nhân: kiểm khi mở app + mỗi 60s khi app đang mở.
  // - Cả 2 loại đều nhắc 3 lần: trước hạn ~3 ngày · trước hạn ~1 ngày · tới hạn.
  //   Mốc "tới hạn" = đúng giờ:phút nếu có giờ hẹn; = 8h00 sáng ngày hẹn nếu chỉ có ngày.
  // - Việc LẶP LẠI: mỗi lần xảy ra áp cùng quy tắc (bỏ mốc "trước 3 ngày" để tránh spam lịch hàng ngày).
  // Khóa theo firedKeys (mỗi lần xảy ra 1 bộ khóa) → lịch lặp nhắc lại mỗi chu kỳ; tự chuyển dữ liệu cũ (fired).
  useEffect(() => {
    if (!currentUser?.staffId) return;
    // Chuyển cờ cũ {created,d3,d1} → firedKeys tương ứng dueDate gốc
    const migratedKeys = (t: PersonalTask): string[] => {
      if (t.firedKeys) return t.firedKeys;
      const f = t.fired || {}; const k: string[] = [];
      if (f.created) k.push('created');
      if (f.d3) k.push(`${t.dueDate}:d3`);
      if (f.d1) k.push(`${t.dueDate}:d1`);
      return k;
    };
    const check = () => {
      const now = Date.now();
      const todayYMD = ymdOf(new Date());
      const batch: { id: string; key: string; text: string }[] = [];
      personalTasks.forEach(t => {
        if (t.done || t.ownerId !== currentUser.staffId || !t.dueDate) return;
        const done = new Set(migratedKeys(t));
        const repeating = (t.repeat || 'none') !== 'none';
        // Lần xảy ra đang xét: không lặp = dueDate; lặp = lần kế tiếp >= hôm nay
        const occ = repeating ? ptNextOccurrence(t, todayYMD) : t.dueDate;
        if (!occ) return;
        const dm = occ.split('-').reverse().join('-');
        const push = (key: string, text: string) => { if (!done.has(key)) batch.push({ id: t.id, key, text }); };
        // Mốc "tới hạn": CÓ giờ hẹn = đúng giờ:phút; CHỈ có ngày = 8h00 sáng ngày hẹn.
        const dueMs = new Date(`${occ}T${t.dueTime || '08:00:00'}`).getTime();
        const at = t.dueTime ? ` lúc ${t.dueTime}` : '';
        // Cả 2 loại đều nhắc 3 lần: trước ~3 ngày · trước ~1 ngày · tới hạn.
        // Trước ~3 ngày — bỏ với lịch lặp để tránh spam.
        if (!repeating && now >= dueMs - 3 * 86400000 && now < dueMs - 86400000)
          push(`${occ}:d3`, `📅 Còn khoảng 3 ngày tới hạn: "${t.title}" (hạn ${dm}${at})`);
        // Trước ~1 ngày
        if (now >= dueMs - 86400000 && now < dueMs)
          push(`${occ}:d1`, `🔔 Sắp tới hạn (còn ~1 ngày): "${t.title}" (hạn ${dm}${at})`);
        // Tới hạn: đúng giờ hẹn (nếu có giờ) hoặc 8h00 sáng ngày hẹn (nếu chỉ có ngày)
        if (now >= dueMs) {
          if (t.dueTime) push(`${occ}:t0`, `⏳ Đến giờ hẹn: "${t.title}" (${dm} lúc ${t.dueTime})`);
          else push(`${occ}:d0`, `☀️ Hôm nay tới hạn: "${t.title}" (hạn ${dm} — nhắc 8h00 sáng)`);
        }
      });
      if (!batch.length) return;
      batch.forEach(b => notifySelf(b.text));
      setPersonalTasks(prev => prev.map(t => {
        const mine = batch.filter(b => b.id === t.id);
        if (!mine.length) return t;
        // Gộp khóa mới + prune khóa cũ quá 30 ngày (chặn firedKeys phình vô hạn với lịch lặp)
        const merged = [...new Set([...migratedKeys(t), ...mine.map(b => b.key)])];
        const cutoff = ymdOf(new Date(Date.now() - 30 * 86400000));
        const pruned = merged.filter(k => k === 'created' || (k.split(':')[0] >= cutoff));
        return { ...t, firedKeys: pruned };
      }));
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.staffId, personalTasks]);

  // ==== Thao tác Lịch cá nhân ====
  const addPersonalTask = () => {
    const title = newPtTitle.trim();
    if (!title || !newPtDue || !currentUser?.staffId) return;
    const t: PersonalTask = { id: `PT${Date.now()}`, ownerId: currentUser.staffId, title, dueDate: newPtDue, createdAt: Date.now(), note: newPtNote.trim() || undefined, fired: {} };
    setPersonalTasks(prev => [t, ...prev]);
    setNewPtTitle(''); setNewPtDue(''); setNewPtNote('');
    triggerToast('Đã thêm việc cá nhân — hệ thống sẽ nhắc trên chuông khi tới hạn.');
  };
  // Thêm việc cho MỘT ngày cụ thể (lịch Google Calendar: bấm ô ngày rồi nhập) — kèm giờ hẹn & lặp lại.
  const addPersonalTaskOn = (dateStr: string) => {
    const title = newPtTitle.trim();
    if (!title || !dateStr || !currentUser?.staffId) return;
    const t: PersonalTask = {
      id: `PT${Date.now()}`, ownerId: currentUser.staffId, title, dueDate: dateStr,
      dueTime: newPtTime || undefined,
      repeat: newPtRepeat !== 'none' ? newPtRepeat : undefined,
      createdAt: Date.now(), note: newPtNote.trim() || undefined, firedKeys: [],
    };
    setPersonalTasks(prev => [t, ...prev]);
    setNewPtTitle(''); setNewPtNote(''); setNewPtTime(''); setNewPtRepeat('none');
    triggerToast('Đã thêm lịch hẹn — hệ thống sẽ nhắc trên chuông khi tới hạn.');
  };
  const togglePersonalDone = (id: string) => setPersonalTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deletePersonalTask = (id: string) => setPersonalTasks(prev => prev.filter(t => t.id !== id));
  // Yêu cầu xóa 1 việc lịch tại NGÀY occ (YYYY-MM-DD). Lặp lại → hỏi phạm vi; không lặp → xác nhận thường.
  const requestDeletePersonalTask = (t: PersonalTask, occ: string) => {
    if ((t.repeat || 'none') === 'none') {
      setConfirmState({
        title: 'Xóa việc trong lịch',
        message: `Bạn có chắc chắn muốn xóa việc "${t.title}"?`,
        confirmLabel: 'Xóa',
        onConfirm: () => deletePersonalTask(t.id),
      });
    } else {
      setRecurDelete({ task: t, occ });
    }
  };
  // Áp dụng xóa việc lịch LẶP LẠI: 'one' = chỉ buổi occ (thêm excludeDates);
  // 'following' = buổi occ & các buổi sau (cắt repeatUntil = ngày trước occ; nếu occ là buổi đầu thì xóa cả chuỗi).
  const applyRecurDelete = (mode: 'one' | 'following') => {
    if (!recurDelete) return;
    const { task, occ } = recurDelete;
    if (mode === 'one') {
      setPersonalTasks(prev => prev.map(t => t.id === task.id
        ? { ...t, excludeDates: [...(t.excludeDates || []), occ] }
        : t));
      triggerToast(`Đã xóa buổi ${fmtDateVN(occ)} của "${task.title}".`);
    } else {
      if (occ <= task.dueDate) {
        deletePersonalTask(task.id);
      } else {
        const [oy, om, od] = occ.split('-').map(Number);
        const prevDay = new Date(oy, om - 1, od - 1);
        const until = `${prevDay.getFullYear()}-${String(prevDay.getMonth() + 1).padStart(2, '0')}-${String(prevDay.getDate()).padStart(2, '0')}`;
        setPersonalTasks(prev => prev.map(t => t.id === task.id ? { ...t, repeatUntil: until } : t));
      }
      triggerToast(`Đã xóa buổi ${fmtDateVN(occ)} & các buổi lặp sau của "${task.title}".`);
    }
    setRecurDelete(null);
  };
  const requestNotifPerm = () => {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then(p => setNotifPerm(p)).catch(() => {});
  };

  // Thông báo của người đang đăng nhập (mới nhất trước). Badge chỉ đếm tin CHƯA ĐỌC;
  // mở chuông = đánh dấu đã đọc toàn bộ (số tắt) nhưng tin vẫn giữ nguyên trong danh sách.
  const myNotifs = useMemo(() =>
    notifs.filter(n => n.targetId === currentUser?.staffId).sort((a, b) => b.ngay.localeCompare(a.ngay)),
  [notifs, currentUser]);
  const myUnreadCount = useMemo(() => myNotifs.filter(n => !n.daDoc).length, [myNotifs]);
  const markMyNotifsRead = () => setNotifs(prev =>
    prev.some(n => n.targetId === currentUser?.staffId && !n.daDoc)
      ? prev.map(n => (n.targetId === currentUser?.staffId && !n.daDoc) ? { ...n, daDoc: true } : n)
      : prev
  );
  const clearMyNotifs = () => setNotifs(prev => prev.filter(n => n.targetId !== currentUser?.staffId));

  // Sync projects to localStorage, Firestore (cloud), server backup, and trigger staff stats recalculation
  useEffect(() => {
    localStorage.setItem('erp_projects', JSON.stringify(projects));
    updateStaffStats(projects);

    // Đẩy lên Firestore khi dữ liệu thực sự đổi so với bản cloud gần nhất.
    // QUAN TRỌNG: chỉ đẩy SAU khi đã nhận snapshot đầu tiên (lastRemote != null) —
    // tránh máy vừa mở app ghi đè dữ liệu cloud bằng bản cục bộ cũ.
    const serialized = JSON.stringify(projects);
    if (lastRemoteProjects.current !== null && serialized !== lastRemoteProjects.current) {
      lastRemoteProjects.current = serialized;
      pushCollection('projects', projects).catch(err => console.error('[Firebase] Lỗi đồng bộ dự án lên cloud:', err));
    }

    // Sync to backend database (bản dự phòng trên máy chủ nội bộ)
    const syncToServer = async () => {
      try {
        await fetch('/api/projects/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projects })
        });
      } catch (err) {
        console.error("Lỗi đồng bộ dữ liệu lên máy chủ:", err);
      }
    };
    syncToServer();
  }, [projects]);

  // Sync staff to localStorage, Firestore (cloud) and backend server
  useEffect(() => {
    localStorage.setItem('erp_staff', JSON.stringify(staff));

    // Chỉ đẩy lên cloud sau khi đã nhận snapshot đầu tiên (tránh ghi đè dữ liệu chung)
    const serialized = JSON.stringify(staff);
    if (lastRemoteStaff.current !== null && serialized !== lastRemoteStaff.current) {
      lastRemoteStaff.current = serialized;
      // BẢO MẬT: không bao giờ ghi trường mật khẩu lên cloud — Firebase Auth quản lý mật khẩu
      const stripped = staff.map(({ password: _pw, ...rest }) => rest);
      pushCollection('staff', stripped).catch(err => console.error('[Firebase] Lỗi đồng bộ nhân sự lên cloud:', err));
      // Danh sách email được PHÉP truy cập dữ liệu (Rules đối chiếu) — bám theo danh sách nhân sự còn hiệu lực
      const allowDocs = staff
        .filter(s => s.username && !s.daNghi)
        .map(s => ({ id: authEmailFor(s.username!) }));
      pushCollection('authAllow', allowDocs).catch(err => console.error('[Firebase] Lỗi đồng bộ danh sách truy cập:', err));
    }

    const syncStaffToServer = async () => {
      try {
        await fetch('/api/staff/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staff })
        });
      } catch (err) {
        console.error("Lỗi đồng bộ nhân sự lên máy chủ:", err);
      }
    };
    syncStaffToServer();
  }, [staff]);

  // Enforce role-based restrictions on tab selection.
  // STAFF may use DASHBOARD (their KPI workspace) and HISTORY (their activity log).
  // MANAGER may use the STAFF tab (to create Level-3 accounts) but not the DB/Workflow admin tabs.
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'STAFF' && !['DASHBOARD', 'HISTORY', 'CALENDAR'].includes(activeTab)) {
      setActiveTab('DASHBOARD');
    } else if (currentUser.role === 'MANAGER' && activeTab === 'SYSTEM') {
      setActiveTab('DASHBOARD');
    }
  }, [currentUser, activeTab]);

  // Handle Login submission — xác thực qua FIREBASE AUTH (mật khẩu do Google quản lý, đã mã hóa)
  const [loginBusy, setLoginBusy] = useState(false);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const raw = loginEmail.trim().toLowerCase();
    if (!raw || loginBusy) return;

    // Nhập email thật? → tra ngược ra tên đăng nhập từ danh sách nhân sự đã lưu trên máy
    let username = raw;
    if (raw.includes('@')) {
      const byEmail = staff.find(s => !s.daNghi && s.email && s.email.toLowerCase() === raw);
      if (byEmail?.username) username = byEmail.username.toLowerCase();
      else { setLoginError('Không tìm thấy email này — vui lòng đăng nhập bằng tên đăng nhập.'); return; }
    }

    setLoginBusy(true);
    const err = await signInStaff(username, loginPassword);
    setLoginBusy(false);
    if (err) { setLoginError(err); return; }
    // Firebase đã xác thực OK — chờ dữ liệu nhân sự từ cloud về để chốt vai trò (effect bên dưới)
    setPendingLoginUser(username);
  };

  // Hoàn tất đăng nhập: khi đã có phiên Firebase + bản nhân sự mới nhất từ cloud
  useEffect(() => {
    if (!pendingLoginUser || !staffSynced) return;
    const matched = staff.find(s => !s.daNghi && s.username && s.username.toLowerCase() === pendingLoginUser);
    if (!matched) {
      // Đã qua được Firebase nhưng không có trong danh sách nhân sự → chặn (không cấp dữ liệu)
      setPendingLoginUser(null);
      signOutFb();
      setLoginError('Tài khoản không tồn tại trong danh sách nhân sự — liên hệ quản trị viên.');
      return;
    }
    const mappedRole = matched.role || chucVuToRole(matched.chucVu);
    const u = {
      email: matched.email || matched.username || pendingLoginUser,
      role: mappedRole as 'BOOD' | 'MANAGER' | 'STAFF',
      staffId: matched.id,
      name: `${matched.hoTen} (${matched.chucVu})`
    };
    setCurrentUser(u);
    localStorage.setItem('erp_current_user', JSON.stringify(u));
    setPendingLoginUser(null);

    // Lần đầu đăng nhập (mật khẩu mặc định) → bắt buộc thêm ảnh + đổi mật khẩu trước khi vào hệ thống
    if (matched.mustChangePassword) {
      setPwModal('forced');
    } else {
      const roleText = u.role === 'BOOD' ? 'Ban Giám đốc / Trưởng phòng / Phó phòng (Level 1)' : u.role === 'MANAGER' ? 'Quản lý (Level 2)' : 'Chuyên viên thực hiện (Level 3)';
      triggerToast(`Đăng nhập thành công với vai trò ${roleText}!`);
    }
  }, [pendingLoginUser, staffSynced, staff]);

  // Đổi mật khẩu (+ ảnh đại diện lần đầu): đổi trên FIREBASE AUTH rồi cập nhật bản ghi nhân sự.
  // Trả về chuỗi lỗi (hiện trong modal) hoặc null nếu thành công.
  const handleChangePassword = async (newPassword: string, oldPassword?: string, avatar?: string): Promise<string | null> => {
    if (!currentUser) return 'Phiên làm việc không hợp lệ.';
    const err = await changeOwnPassword(newPassword, pwModal === 'self' ? (oldPassword ?? '') : undefined);
    if (err) return err;
    const updatedStaffList = staff.map(s =>
      s.id === currentUser.staffId
        ? { ...s, password: undefined, mustChangePassword: false, ...(avatar ? { avatar } : {}) }
        : s
    );
    setStaff(updatedStaffList);
    localStorage.setItem('erp_staff', JSON.stringify(updatedStaffList));
    setPwModal(null);
    triggerToast(avatar ? 'Đã cập nhật ảnh đại diện & đổi mật khẩu thành công!' : 'Đã đổi mật khẩu thành công!');
    logAction('Đổi mật khẩu', `${currentUser.name} đã đổi mật khẩu đăng nhập.`);
    return null;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setPwModal(null);
    setLoginEmail('');
    setLoginPassword('');
    setPendingLoginUser(null);
    localStorage.removeItem('erp_current_user');
    signOutFb().catch(() => {});
    triggerToast('Đã đăng xuất khỏi hệ thống thầu.');
  };

  // Handle saving staff member updates
  const handleSaveStaff = (updatedMember: Staff) => {
    const updatedStaffList = staff.map(s => s.id === updatedMember.id ? updatedMember : s);
    setStaff(updatedStaffList);
    localStorage.setItem('erp_staff', JSON.stringify(updatedStaffList));
    
    // Also re-trigger statistics on the updated staff list
    updateStaffStats(projects, updatedStaffList);
    
    setEditingStaff(null);
    triggerToast(`Đã cập nhật thông tin nhân sự: ${updatedMember.hoTen}`);
    logAction('Cập nhật nhân sự', `Cập nhật hồ sơ thông tin của nhân sự: ${updatedMember.hoTen} (${updatedMember.chucVu})`);
  };

  // Handle saving project (both Add and Edit)
  const handleSaveProject = (savedProject: Project) => {
    let updated: Project[];
    const old = projects.find(p => p.id === savedProject.id);
    const exists = !!old;

    // Quy trình duyệt công việc: Quản lý tạo mới → chờ TP duyệt (báo qua chuông);
    // Trưởng phòng lưu (tạo hoặc kiểm tra xong) → coi như đã duyệt → lên Kanban/Gantt.
    if (savedProject.loaiBanGhi !== 'DU_AN') {
      if (currentUser?.role === 'BOOD') {
        savedProject.tpDaDuyet = true;
        savedProject.choDuyetLai = undefined; // TP đã kiểm tra & lưu → xóa cờ chờ duyệt lại
      } else if (!exists) {
        savedProject.tpDaDuyet = false;
      } else if (currentUser?.role === 'MANAGER' && old &&
                 savedProject.ngayHoanThanhDuKienGoc > old.ngayHoanThanhDuKienGoc) {
        // Quản lý sửa qua form làm hạn tổng bị lùi xa hơn đã báo → chờ TP duyệt lại
        savedProject.choDuyetLai = true;
      }
    }

    // TP vừa duyệt kế hoạch → thẻ tự nhảy sang bước 2 (Triển khai hồ sơ thầu)
    const approvedNow = savedProject.loaiBanGhi !== 'DU_AN' && old?.tpDaDuyet === false && savedProject.tpDaDuyet === true;
    if (approvedNow) {
      savedProject.kanbanStep = Math.max(savedProject.kanbanStep || 1, 2);
    }

    // ===== Thông báo chuông 🔔 =====
    const label = savedProject.loaiBanGhi === 'DU_AN'
      ? `dự án "${savedProject.tenDuAn}"`
      : `công việc "${savedProject.hangMuc} — ${savedProject.tenDuAn}"`;
    if (!exists) {
      // Quản lý (chính + phụ) được chọn phụ trách khi khởi tạo
      pushNotify(allManagerIds(savedProject), `Bạn được chọn làm Quản lý cho ${label}.`, savedProject.id);
    } else if (approvedNow) {
      // Kế hoạch được TP duyệt → báo Quản lý (chính + phụ) + các nhân sự được giao việc
      pushNotify([...allManagerIds(old!), ...allManagerIds(savedProject)], `Kế hoạch ${label} đã được Trưởng phòng duyệt — bắt đầu triển khai (bước 2).`, savedProject.id);
      pushNotify([savedProject.thucHienId, ...(savedProject.thucHienIds || [])], `Bạn được giao ${label} — Trưởng phòng đã duyệt, bắt đầu thực hiện.`, savedProject.id);
    } else if (old) {
      const hoanThanh = old.trangThai === 'DANG_THUC_HIEN' && (savedProject.trangThai === 'HOAN_THANH_DUNG_HAN' || savedProject.trangThai === 'HOAN_THANH_TRE_HAN');
      const keHoachDoi = JSON.stringify(old.tasks || []) !== JSON.stringify(savedProject.tasks || []);
      const moTaDoi = (old.moTa || '') !== (savedProject.moTa || '');
      const noiDung = hoanThanh ? `${label} đã HOÀN THÀNH.`
        : keHoachDoi ? `${label} vừa chỉnh sửa kế hoạch.`
        : moTaDoi ? `${label} vừa chỉnh sửa mô tả.`
        : `${label} vừa được chỉnh sửa thông tin.`;
      pushNotify([...allManagerIds(old), ...allManagerIds(savedProject)], noiDung, savedProject.id);
      // Có quản lý mới (chính hoặc phụ) so với bản cũ → báo người mới được thêm
      {
        const oldSet = new Set(allManagerIds(old));
        const added = allManagerIds(savedProject).filter(id => !oldSet.has(id));
        if (added.length) pushNotify(added, `Bạn được chọn làm Quản lý cho ${label}.`, savedProject.id);
      }
    }

    if (exists) {
      updated = projects.map(p => p.id === savedProject.id ? savedProject : p);
      triggerToast(currentUser?.role === 'BOOD' && savedProject.loaiBanGhi !== 'DU_AN'
        ? `Đã duyệt & cập nhật công việc: "${savedProject.tenDuAn}"`
        : `Đã cập nhật gói thầu: "${savedProject.tenDuAn}"`);
      logAction('Cập nhật gói thầu', `Cập nhật thông tin chi tiết gói thầu ${savedProject.projectId} - ${savedProject.tenDuAn}`, undefined, getProjectParticipants(savedProject));
    } else {
      updated = [...projects, savedProject];
      triggerToast(savedProject.tpDaDuyet === false
        ? `Đã tạo công việc "${savedProject.tenDuAn}" — hệ thống đã báo Trưởng phòng vào duyệt (qua chuông 🔔).`
        : `Đã thêm mới gói thầu: "${savedProject.tenDuAn}"`);
      logAction('Đăng ký thầu mới', `Đăng ký hồ sơ thầu mới mã ${savedProject.projectId} - ${savedProject.tenDuAn} (Hạn nộp: ${savedProject.ngayHoanThanhDuKienHienTai})${savedProject.tpDaDuyet === false ? ' — chờ Trưởng phòng duyệt' : ''}`, undefined, getProjectParticipants(savedProject));
    }
    
    // Sort projects chronologically by Project_ID
    updated.sort((a, b) => a.projectId.localeCompare(b.projectId));
    setProjects(updated);
    setShowForm(false);
    setEditingProject(undefined);
  };

  const handleDeleteProject = (id: string, name: string) => {
    if (currentUser?.role !== 'BOOD') {
      triggerToast('Chỉ có Trưởng phòng (Level 1) mới được quyền xóa hồ sơ!');
      return;
    }
    setConfirmState({
      title: 'Xóa hồ sơ thầu',
      message: `Bạn có chắc chắn muốn xóa hồ sơ "${name}" khỏi hệ thống thầu? Hành động này không thể hoàn tác.`,
      confirmLabel: 'Xóa hồ sơ',
      onConfirm: () => {
        const target = projects.find(p => p.id === id);
        const updated = projects.filter(p => p.id !== id);
        setProjects(updated);
        triggerToast(`Đã xóa hồ sơ: "${name}"`);
        logAction('Xóa hồ sơ thầu', `Xóa vĩnh viễn hồ sơ dự án thầu: "${name}" (ID: ${id})`, undefined, getProjectParticipants(target));
      },
    });
  };

  // Xóa DỰ ÁN CHA (chỉ Trưởng phòng): nếu còn công việc con thì hỏi xác nhận xóa kèm toàn bộ
  const handleDeleteParent = (parent: Project) => {
    if (currentUser?.role !== 'BOOD') {
      triggerToast('Chỉ Trưởng phòng (Level 1) mới được quyền xóa dự án!');
      return;
    }
    const children = projects.filter(p => p.duAnChaId === parent.id);
    const msg = children.length > 0
      ? `Dự án "${parent.tenDuAn}" đang có ${children.length} công việc con. Xóa dự án sẽ XÓA KÈM toàn bộ công việc con này. Bạn chắc chắn?`
      : `Bạn có chắc chắn muốn xóa dự án "${parent.tenDuAn}"?`;
    setConfirmState({
      title: 'Xóa dự án',
      message: msg,
      confirmLabel: 'Xóa dự án',
      onConfirm: () => {
        const removeIds = new Set([parent.id, ...children.map(c => c.id)]);
        setProjects(projects.filter(p => !removeIds.has(p.id)));
        triggerToast(`Đã xóa dự án "${parent.tenDuAn}"${children.length > 0 ? ` cùng ${children.length} công việc con` : ''}.`);
        logAction('Xóa dự án', `Xóa dự án "${parent.tenDuAn}" (${parent.projectId})${children.length > 0 ? ` kèm ${children.length} công việc con` : ''}.`);
      },
    });
  };

  // CĐT điều chỉnh: kéo tiến độ về bước đã chọn, GIỮ công việc đã hoàn thành, thêm công việc mới, tính lại %.
  const handleCdtRevision = (projId: string, noiDung: string, buocVe: number, newTaskDefs: { name: string; weight: number }[]) => {
    let target: Project | undefined;
    const updated = projects.map(p => {
      if (p.id !== projId) return p;
      target = p;
      const newTasks: ProjectTask[] = newTaskDefs.map((t, i) => ({
        id: `T${Date.now()}-${i}`, name: t.name, weight: t.weight, isCompleted: false, staffProgress: 0, managerProgress: 0,
      }));
      const allTasks = [...(p.tasks || []), ...newTasks];
      const newProg = calculateProjectProgress(allTasks);
      const rev = { ngay: new Date().toISOString().split('T')[0], noiDung, buocVe };
      return {
        ...p,
        tasks: allTasks,
        tienDoBoPhan: newProg,
        tienDoPhong: 0,
        ketQuaPhong: undefined,
        kanbanStep: buocVe,
        tinhTrangDuAn: 'Đang triển khai' as const,
        trangThai: 'DANG_THUC_HIEN' as const,
        cdtDieuChinh: [...(p.cdtDieuChinh || []), rev],
      };
    });
    setProjects(updated);
    setCdtRevisionProject(null);
    triggerToast(`Đã áp dụng CĐT điều chỉnh & kéo hồ sơ về bước ${buocVe}.`);
    if (target) {
      const added = newTaskDefs.length ? ` Thêm ${newTaskDefs.length} công việc con mới.` : '';
      logAction('CĐT điều chỉnh', `CĐT điều chỉnh hồ sơ ${target.projectId} - ${target.tenDuAn}: ${noiDung}. Kéo về bước ${buocVe}, giữ công việc đã hoàn thành.${added}`, undefined, getProjectParticipants(target));
    }
  };

  const handleEditClick = (p: Project) => {
    if (currentUser?.role === 'STAFF') {
      triggerToast('Nhân viên không được quyền sửa hồ sơ thầu! Hãy sử dụng bảng tác vụ ở danh sách dự án.');
      return;
    }
    setFormMode('EDIT_ALL');
    setEditingProject(p);
    setShowForm(true);
  };

  const handleCreateClick = () => {
    if (currentUser?.role !== 'BOOD') {
      triggerToast('Chỉ có Trưởng phòng (Level 1) mới được quyền khai báo gói thầu mới!');
      return;
    }
    setFormMode('CREATE_TENDER');
    setEditingProject(undefined);
    setShowForm(true);
  };

  // Years available for the dashboard filter (from start dates and project codes)
  const dashboardYears = useMemo(() => {
    const years = new Set<string>();
    projects.forEach(p => {
      const y = (p.ngayBatDau || '').slice(0, 4);
      if (/^\d{4}$/.test(y)) years.add(y);
      const m = (p.projectId || '').match(/(20\d{2})/);
      if (m) years.add(m[1]);
    });
    years.add(String(new Date().getFullYear()));
    return Array.from(years).sort().reverse();
  }, [projects]);

  const handleAddWorkClick = () => {
    if (currentUser?.role !== 'BOOD' && currentUser?.role !== 'MANAGER') {
      triggerToast('Chỉ có Trưởng phòng (Level 1) hoặc Quản lý (Level 2) mới được quyền thiết lập công việc mới!');
      return;
    }
    setFormMode('ADD_WORK');
    setEditingProject(undefined);
    setShowForm(true);
  };

  // Nhân sự còn làm việc. Nhân sự đã nghỉ (daNghi) vẫn nằm trong `staff` để tra cứu tên
  // trên các công việc đã/đang thực hiện, nhưng bị loại khỏi đăng nhập, giao việc và KPI.
  const activeStaff = useMemo(() => staff.filter(s => !s.daNghi), [staff]);

  // KPI & đội ngũ theo phân quyền:
  // - Trưởng phòng (L1): xem tất cả.
  // - Quản lý (L2): xem BẢN THÂN + ĐỘI NGŨ CỦA MÌNH (nhân viên được L1 gán quanLyPhuTrachId = mình).
  //   KHÔNG còn theo "ai mình giao việc" — việc giao việc vẫn tự do, chỉ đổi quyền XEM.
  //   Nhân viên chưa được gán quản lý → chỉ Trưởng phòng thấy.
  // - Nhân viên (L3): chỉ xem chính mình.
  const kpiStaff = useMemo(() => {
    if (!currentUser) return activeStaff;
    if (currentUser.role === 'BOOD') return activeStaff;
    return activeStaff.filter(s => {
      if (s.id === currentUser.staffId) return true;              // luôn thấy chính mình
      if (currentUser.role !== 'MANAGER') return false;            // L3 chỉ thấy mình
      if ((s.role || chucVuToRole(s.chucVu)) === 'BOOD') return false; // QL không xem KPI Trưởng phòng
      return s.quanLyPhuTrachId === currentUser.staffId;           // chỉ đội ngũ của mình
    });
  }, [activeStaff, currentUser]);

  // Kiểm tra nhân sự có đang tham gia dự án / được giao tác vụ nào không
  const staffHasWork = (staffId: string): boolean => {
    const taskHasAssignee = (list?: ProjectTask[]): boolean => {
      if (!list) return false;
      return list.some(t =>
        t.assignedTo === staffId ||
        (t.assignedStaffIds || []).includes(staffId) ||
        taskHasAssignee(t.subtasks)
      );
    };
    return projects.some(p =>
      isProjectManager(p, staffId) ||
      p.thucHienId === staffId ||
      (p.thucHienIds || []).includes(staffId) ||
      taskHasAssignee(p.tasks)
    );
  };

  // Xóa tài khoản nhân sự: nếu còn công việc đã/đang làm thì chỉ khóa tài khoản (nghỉ việc),
  // toàn bộ công việc và lịch sử được giữ nguyên; nếu chưa có gì thì xóa hẳn.
  const handleDeleteStaff = (member: Staff) => {
    if (staffHasWork(member.id)) {
      const updatedStaffList = staff.map(s =>
        s.id === member.id
          ? { ...s, daNghi: true, email: undefined, password: undefined }
          : s
      );
      setStaff(updatedStaffList);
      updateStaffStats(projects, updatedStaffList);
      triggerToast(`Đã xóa tài khoản của ${member.hoTen}. Công việc đã/đang thực hiện vẫn được giữ nguyên.`);
      logAction('Xóa tài khoản nhân sự', `Xóa tài khoản đăng nhập của nhân sự nghỉ việc: ${member.hoTen} (${member.chucVu}). Công việc đã/đang thực hiện được bảo toàn.`);
    } else {
      const updatedStaffList = staff.filter(s => s.id !== member.id);
      setStaff(updatedStaffList);
      updateStaffStats(projects, updatedStaffList);
      triggerToast(`Đã xóa tài khoản nhân sự: ${member.hoTen}`);
      logAction('Xóa tài khoản nhân sự', `Xóa hoàn toàn tài khoản: ${member.hoTen} (${member.chucVu}) — chưa có công việc nào được giao.`);
    }
    setDeletingStaffId(null);
  };

  // RBAC Project Data Access Control
  const rbacProjects = useMemo(() => {
    if (!currentUser) return [];
    const sourceProjects = apiFilteredProjects !== null ? apiFilteredProjects : projects;
    if (currentUser.role === 'BOOD') return sourceProjects;
    if (currentUser.role === 'MANAGER') {
      // Level 2 views projects they manage or work on (các dự án họ làm)
      return sourceProjects.filter(p =>
        isProjectManager(p, currentUser.staffId) ||
        p.thucHienId === currentUser.staffId ||
        p.thucHienIds?.includes(currentUser.staffId)
      );
    }
    // Level 3 views projects they are assigned to
    return sourceProjects.filter(p => p.thucHienId === currentUser.staffId || p.thucHienIds?.includes(currentUser.staffId));
  }, [projects, apiFilteredProjects, currentUser]);

  // Tách 2 cấp: Dự án cha (DU_AN) và Công việc/gói thầu con (CONG_VIEC).
  // Chỉ công việc con mới lên Kanban / danh sách tiến độ; dự án cha chỉ để đăng ký & làm cha.
  const parentProjects = useMemo(() => rbacProjects.filter(p => p.loaiBanGhi === 'DU_AN'), [rbacProjects]);
  const workItems = useMemo(() => rbacProjects.filter(p => p.loaiBanGhi !== 'DU_AN'), [rbacProjects]);
  // Một CÔNG VIỆC coi là ĐÃ XONG khi hoàn thành đúng/trễ hạn hoặc đã có kết quả trúng/rớt.
  const isWorkDone = (p: Project) =>
    p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN' ||
    p.tinhTrangDuAn === 'Đã trúng thầu' || p.tinhTrangDuAn === 'Rớt thầu';
  // Một DỰ ÁN CHA coi là ĐÃ XONG khi CÓ công việc con và TẤT CẢ công việc con đã xong.
  const isParentDone = (dp: Project) => {
    const kids = projects.filter(p => p.duAnChaId === dp.id);
    return kids.length > 0 && kids.every(isWorkDone);
  };
  // Áp bộ lọc trạng thái (ACTIVE = đang làm, DONE = đã xong, ALL = tất cả)
  const applyStatusFilter = <T,>(list: T[], doneOf: (x: T) => boolean) =>
    projStatusFilter === 'ALL' ? list : list.filter(x => (projStatusFilter === 'DONE' ? doneOf(x) : !doneOf(x)));
  // Công việc CHỜ TRƯỞNG PHÒNG DUYỆT: bộ phận đã làm xong (100%) nhưng Phòng chưa chốt (<100%),
  // và chưa có kết quả cuối (chưa trúng/rớt). Hiển thị trên chuông để TP vào nhập tiến độ Phòng.
  const tpPendingItems = useMemo(() => workItems.filter(p =>
    (p.tienDoBoPhan || 0) >= 100 &&
    (p.tienDoPhong || 0) < 100 &&
    (p.soNgayDuKien || 0) > 0 &&
    p.tinhTrangDuAn !== 'Đã trúng thầu' && p.tinhTrangDuAn !== 'Rớt thầu'
  ), [workItems]);
  // Công việc CHỜ TP DUYỆT: Quản lý vừa tạo (tpDaDuyet=false) hoặc chưa có thời hạn.
  // TP mở từ chuông, kiểm tra kế hoạch, thêm ngày kiểm tra của mình, lưu → duyệt xong mới lên Kanban & Gantt.
  const tpSetupItems = useMemo(() => workItems.filter(p =>
    (p.tpDaDuyet === false || (p.soNgayDuKien || 0) <= 0 || p.choDuyetLai === true) &&
    p.tinhTrangDuAn !== 'Đã trúng thầu' && p.tinhTrangDuAn !== 'Rớt thầu'
  ), [workItems]);
  // Công việc TP đã duyệt và có thời hạn → mới lên Kanban / Gantt
  const scheduledWorkItems = useMemo(() => workItems.filter(p =>
    (p.soNgayDuKien || 0) > 0 && p.tpDaDuyet !== false
  ), [workItems]);
  // Tra tên Dự án cha theo id (hiển thị nhãn trên thẻ/công việc)
  const parentNameById = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach(p => { if (p.loaiBanGhi === 'DU_AN') m[p.id] = p.tenDuAn; });
    return m;
  }, [projects]);

  // Dashboard scope: only WORK ITEMS belonging to the selected year
  const dashboardProjects = useMemo(() => {
    if (dashboardYear === 'ALL') return workItems;
    return workItems.filter(p =>
      (p.ngayBatDau || '').startsWith(dashboardYear) || (p.projectId || '').includes(dashboardYear)
    );
  }, [workItems, dashboardYear]);

  // Activity-log visibility scoped per user:
  // - BOOD (Trưởng phòng) sees everything.
  // - Others see only their own actions + project actions where they are a participant.
  //   System actions (no relatedStaffIds) are hidden from non-BOOD to avoid noise.
  const visibleLogs = useMemo(() => {
    if (!currentUser) return [];
    // Không hiển thị hoạt động đăng nhập / đăng xuất trong nhật ký (kể cả bản ghi cũ)
    const workLogs = activityLogs.filter(l => l.action !== 'Đăng nhập' && l.action !== 'Đăng xuất');
    if (currentUser.role === 'BOOD') return workLogs;
    const me = currentUser.staffId;
    return workLogs.filter(l =>
      l.userId === me ||
      (l.relatedStaffIds && l.relatedStaffIds.includes(me))
    );
  }, [activityLogs, currentUser]);

  // Filtering Logic (applied on top of RBAC filtered source of truth)
  const filteredProjects = useMemo(() => {
    const anyTaskMatchesSearch = (tasksList: ProjectTask[], query: string): boolean => {
      if (!query) return false;
      const q = query.toLowerCase();
      return tasksList.some(t => {
        if (t.name.toLowerCase().includes(q)) return true;
        if (t.subtasks && t.subtasks.length > 0) {
          return anyTaskMatchesSearch(t.subtasks, query);
        }
        return false;
      });
    };

    return workItems.filter(p => {
      const matchSearch = p.tenDuAn.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.moTa.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.projectId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          anyTaskMatchesSearch(p.tasks || [], searchQuery);

      const matchStatus = filterStatus === 'ALL' || p.trangThai === filterStatus;
      const matchCategory = filterCategory === 'ALL' || p.hangMuc === filterCategory;

      let matchStaffMember = true;
      if (filterStaff !== 'ALL') {
        matchStaffMember = isProjectManager(p, filterStaff) || p.thucHienId === filterStaff || p.thucHienIds?.includes(filterStaff);
      }

      return matchSearch && matchStatus && matchCategory && matchStaffMember;
    });
  }, [workItems, searchQuery, filterStatus, filterCategory, filterStaff]);

  // Generate next sequential Project_ID (YYYY.NN)
  const nextProjectId = useMemo(() => {
    const year = new Date().getFullYear();
    const prefix = `${year}.`;
    const thisYearProjects = projects.filter(p => (p.projectId || '').startsWith(prefix));
    if (thisYearProjects.length === 0) {
      return `${prefix}01`;
    }
    const maxNum = Math.max(...thisYearProjects.map(p => {
      const parts = (p.projectId || '').split('.');
      return parts.length > 1 ? parseInt(parts[1]) || 0 : 0;
    }));
    const nextNum = maxNum + 1;
    const nextNumStr = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
    return `${prefix}${nextNumStr}`;
  }, [projects]);

  // Fetch filtered projects from backend API
  const handleDateRangeFilter = async (start: string, end: string) => {
    if (!start && !end) {
      setApiFilteredProjects(null);
      return;
    }
    try {
      const res = await fetch(`/api/projects?start_date=${start || ''}&end_date=${end || ''}`);
      if (res.ok) {
        const data = await res.json();
        setApiFilteredProjects(data);
        triggerToast(`Đã lọc thành công ${data.length} dự án đấu thầu trong khoảng ngày!`);
      } else {
        const err = await res.json();
        triggerToast(`Lỗi lọc theo ngày: ${err.error || 'Lỗi không xác định'}`);
      }
    } catch (err: any) {
      triggerToast(`Lỗi kết nối API lọc: ${err.message}`);
    }
  };

  // Perform secure Excel Import via standard base64 parsing and validation rollback
  const handleFileUpload = (file: File) => {
    if (!file) return;
    
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      triggerToast("Định dạng tệp không hợp lệ! Vui lòng chọn tệp Excel (.xlsx, .xls) hoặc CSV (.csv)");
      return;
    }
    
    setIsImporting(true);
    setValidationErrors([]);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = e.target?.result as string;
        const base64Data = result.split(',')[1] || result;
        
        const response = await fetch('/api/projects/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fileData: base64Data })
        });
        
        const resData = await response.json();
        
        if (response.ok && resData.status === 'success') {
          setProjects(resData.projects);
          triggerToast(resData.message || "Nhập thầu thành công!");
          setShowImportPanel(false);
          setValidationErrors([]);
          logAction('Nhập Excel', `Nhập thành công danh sách hồ sơ thầu từ tệp Excel: ${file.name}`);
        } else {
          // Lỗi Form - Rollback occurred
          setValidationErrors(resData.errors || [{ row: "Tất cả", col: "Cấu trúc tệp", val: "Lỗi cấu trúc", msg: resData.message || 'Lỗi không xác định' }]);
          triggerToast("⚠️ Lỗi kiểm soát cấu trúc: Giao dịch thầu đã được tự động ROLLBACK!");
          logAction('Lỗi nhập thầu Excel', `Thử nhập tệp ${file.name} thất bại do sai cấu trúc cột dữ liệu. Hệ thống tự động ROLLBACK giao dịch.`);
        }
      } catch (err: any) {
        setValidationErrors([{ row: "Hệ thống", col: "Mạng", msg: `Không thể kết nối đến dịch vụ: ${err.message}` }]);
        triggerToast("⚠️ Lỗi kết nối đến dịch vụ nhập thầu.");
        logAction('Lỗi nhập thầu Excel', `Lỗi mạng khi tải tệp ${file.name}: ${err.message}`);
      } finally {
        setIsImporting(false);
      }
    };
    reader.onerror = () => {
      triggerToast("Lỗi đọc tệp tin.");
      setIsImporting(false);
    };
    reader.readAsDataURL(file);
  };

  // Generate and download a standard template sheet
  const handleDownloadTemplate = () => {
    try {
      const headers = [
        ["Mã Dự Án", "Tên Dự Án", "Hạng Mục", "Ngày Bắt Đầu", "Số Ngày Dự Kiến", "Mô Tả", "Quản Lý", "Thực Hiện", "Nghiên cứu hồ sơ thầu & Thiết kế sơ bộ", "Bóc tách khối lượng BOQ Kiến trúc & MEPF", "Xây dựng đơn giá chi tiết & Áp giá vật tư", "Phê duyệt tờ trình thầu & Đóng gói hồ sơ"],
        ["2026.09", "Dự án mẫu Trung tâm Thương mại HP-Cons", "Báo giá chi tiết", "2026-07-01", 30, "Mẫu lập hồ sơ thầu", "S001", "S003", "✔", "✔", "Đang làm", "Chưa làm"],
        ["2026.10", "Dự án mẫu Cải tạo Văn phòng Quận 1", "Cải tạo", "2026-08-01", 15, "Lập hồ sơ thầu cải tạo", "S001", "S004", "✔", "Chưa làm", "Chưa làm", "Chưa làm"]
      ];
      
      const ws = xlsx.utils.aoa_to_sheet(headers);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Template_DauThau");
      
      const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'binary' });
      
      function s2ab(s: string) {
        const buf = new ArrayBuffer(s.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
        return buf;
      }
      
      const blob = new Blob([s2ab(wbout)], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Template_NhapThau_HPCons.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      triggerToast("Đã tải tệp Excel mẫu chuẩn HP-CONS thành công!");
      logAction('Tải Excel mẫu thầu', 'Tải tệp Excel cấu trúc mẫu thầu tiêu chuẩn của HP-CONS');
    } catch (err: any) {
      triggerToast(`Lỗi tạo mẫu: ${err.message}`);
    }
  };

  // Expand or collapse notes drawer inside the grid
  const toggleRowExpand = (id: string) => {
    setExpandedProjectId(expandedProjectId === id ? null : id);
  };

  // Tìm task theo id trong cây công việc (phục vụ kiểm tra điều kiện hoàn thành)
  const findTaskInTree = (list: ProjectTask[], taskId: string): ProjectTask | undefined => {
    for (const t of list) {
      if (t.id === taskId) return t;
      if (t.subtasks && t.subtasks.length > 0) {
        const found = findTaskInTree(t.subtasks, taskId);
        if (found) return found;
      }
    }
    return undefined;
  };

  // Interactive Subtask completion inside the list for Staff (Level 3)
  const handleToggleSubtask = (projId: string, taskId: string) => {
    // Quy tắc đánh dấu hoàn thành: phải có kết quả công việc và tiến độ đạt 100%
    const targetProject = projects.find(p => p.id === projId);
    const searchTasks = targetProject && targetProject.tasks && targetProject.tasks.length > 0
      ? targetProject.tasks
      : DEFAULT_PROJECT_TASKS;
    const targetTask = targetProject ? findTaskInTree(searchTasks, taskId) : undefined;
    if (targetTask && !targetTask.isCompleted) {
      if (!(targetTask.ketQuaCongViec || '').trim()) {
        triggerToast('⚠ Chưa thể đánh dấu hoàn thành: cần bấm "CẬP NHẬT KQ" và nhập kết quả công việc trước!');
        return;
      }
      if ((targetTask.staffProgress ?? 0) < 100) {
        triggerToast(`⚠ Chưa thể đánh dấu hoàn thành: tiến độ thực hiện phải đạt 100% (hiện tại ${targetTask.staffProgress ?? 0}%)!`);
        return;
      }
    }
    const updated = projects.map(proj => {
      if (proj.id === projId) {
        const currentTasks = proj.tasks && proj.tasks.length > 0 ? proj.tasks : [
          { id: 'T1', name: 'Nghiên cứu hồ sơ thầu & Thiết kế sơ bộ', weight: 25, isCompleted: false },
          { id: 'T2', name: 'Bóc tách khối lượng BOQ Kiến trúc & MEPF', weight: 40, isCompleted: false },
          { id: 'T3', name: 'Xây dựng đơn giá chi tiết & Áp giá vật tư', weight: 20, isCompleted: false },
          { id: 'T4', name: 'Phê duyệt tờ trình thầu & Đóng gói hồ sơ', weight: 15, isCompleted: false }
        ];
        
        let foundCompleted = false;
        const findAndToggle = (list: ProjectTask[]): ProjectTask[] => {
          return updateTaskInTree(list, taskId, (t) => {
            foundCompleted = t.isCompleted;
            return {
              isCompleted: !foundCompleted,
              completedAt: !foundCompleted ? new Date().toISOString().split('T')[0] : undefined
            };
          });
        };

        const nextTasks = findAndToggle(currentTasks);
        const nextBoPhan = calculateProjectProgress(nextTasks);

        // Auto-update status based on progress completion rates
        let nextStatus = proj.trangThai;
        if (nextBoPhan === 100 && proj.tienDoPhong === 100) {
          nextStatus = 'HOAN_THANH_DUNG_HAN';
        }

        return {
          ...proj,
          tasks: nextTasks,
          tienDoBoPhan: nextBoPhan,
          trangThai: nextStatus
        };
      }
      return proj;
    });

    setProjects(updated);
    triggerToast("Đã ghi nhận hoàn thành tác vụ thành phần. Tiến độ bộ phận tự động cộng dồn!");
    
    // Log the action
    const targetProj = projects.find(p => p.id === projId);
    if (targetProj) {
      logAction('Cập nhật tác vụ', `Cập nhật trạng thái một số công việc thầu thành phần của hồ sơ ${targetProj.projectId} - ${targetProj.tenDuAn}`, undefined, getProjectParticipants(targetProj));
    }
  };

  const handleUpdateTasks = (projId: string, updatedTasks: ProjectTask[]) => {
    // Tổng hợp lại NGƯỜI THỰC HIỆN từ người được giao các việc con — đổi người trong kế hoạch
    // là nhân sự mới thấy được công việc ngay (RBAC lọc theo thucHienId/thucHienIds)
    const assigneeCount: Record<string, number> = {};
    const walkAssignees = (list: ProjectTask[]) => list.forEach(t => {
      const ids = [t.assignedTo, ...(t.assignedStaffIds || [])].filter(Boolean) as string[];
      new Set(ids).forEach(id => { assigneeCount[id] = (assigneeCount[id] || 0) + 1; });
      if (t.subtasks?.length) walkAssignees(t.subtasks);
    });
    walkAssignees(updatedTasks);
    const assignees = Object.entries(assigneeCount).sort((a, b) => b[1] - a[1]).map(([id]) => id);

    // Mốc KẾT THÚC của kế hoạch (max ngày kết thúc các việc con có đặt ngày)
    const DAY = 24 * 60 * 60 * 1000;
    const planEnd = (list: ProjectTask[]): number | null => {
      let max: number | null = null;
      const walk = (ts: ProjectTask[]) => ts.forEach(t => {
        if (t.ngayBatDau) {
          const s = new Date(t.ngayBatDau).getTime();
          if (!isNaN(s)) { const e = s + Math.max(1, t.soNgay || 1) * DAY; if (max === null || e > max) max = e; }
        }
        if (t.subtasks?.length) walk(t.subtasks);
      });
      walk(list);
      return max;
    };

    // Quản lý sửa kế hoạch làm tiến độ DELAY xa hơn đã báo → gắn cờ chờ TP duyệt lại.
    // Không kéo dài (giữ nguyên/rút ngắn) → im lặng, không làm phiền TP.
    const targetBefore = projects.find(p => p.id === projId);
    let delayed = false;
    if (currentUser?.role === 'MANAGER' && targetBefore) {
      const oldEnd = planEnd(targetBefore.tasks || []);
      const newEnd = planEnd(updatedTasks);
      delayed = oldEnd !== null && newEnd !== null && newEnd > oldEnd;
    }

    const updated = projects.map(proj => {
      if (proj.id === projId) {
        const nextBoPhan = calculateProjectProgress(updatedTasks);

        // Auto-update status based on progress completion rates
        let nextStatus = proj.trangThai;
        if (nextBoPhan === 100 && proj.tienDoPhong === 100) {
          nextStatus = 'HOAN_THANH_DUNG_HAN';
        }

        return {
          ...proj,
          tasks: updatedTasks,
          tienDoBoPhan: nextBoPhan,
          trangThai: nextStatus,
          ...(assignees.length > 0 ? { thucHienId: assignees[0], thucHienIds: assignees } : {}),
          ...(delayed ? { choDuyetLai: true } : {})
        };
      }
      return proj;
    });

    setProjects(updated);
    triggerToast(delayed
      ? '⚠ Kế hoạch bị kéo dài so với tiến độ đã báo — hệ thống đã báo Trưởng phòng duyệt lại!'
      : 'Đã cập nhật tiến độ công việc con. Tiến độ bộ phận tự động tính gộp!');

    // Log the action + thông báo
    const targetProj = projects.find(p => p.id === projId);
    if (targetProj) {
      logAction('Cập nhật tác vụ', `Cập nhật cây công việc và tiến độ con cho hồ sơ ${targetProj.projectId} - ${targetProj.tenDuAn}`, undefined, getProjectParticipants(targetProj));
      pushNotify(allManagerIds(targetProj), `Công việc "${targetProj.hangMuc} — ${targetProj.tenDuAn}" vừa chỉnh sửa kế hoạch.`, targetProj.id);
      // Người MỚI được giao việc (chưa có trong danh sách cũ) — chỉ báo khi công việc đã được TP duyệt
      if (targetProj.tpDaDuyet !== false) {
        const oldIds = new Set([targetProj.thucHienId, ...(targetProj.thucHienIds || [])].filter(Boolean));
        const newcomers = assignees.filter(id => !oldIds.has(id));
        pushNotify(newcomers, `Bạn được giao công việc "${targetProj.hangMuc} — ${targetProj.tenDuAn}".`, targetProj.id);
      }
    }
  };

  // Cập nhật ngày bắt đầu / số ngày của một công việc con (phục vụ sơ đồ Gantt)
  // Di chuyển thẻ hồ sơ trên bảng Kanban (RBAC đã được KanbanBoard kiểm tra, kiểm lại lần cuối tại đây)
  const handleKanbanMove = (projectId: string, fromStep: number, toStep: number) => {
    if (currentUser?.role !== 'BOOD' && currentUser?.role !== 'MANAGER') return;
    // Quản lý (L2) được đẩy thẻ lên tối đa bước 3 (Duyệt giá cấp phòng); từ bước 3 trở đi do Trưởng phòng.
    if (currentUser.role === 'MANAGER' && (fromStep > 2 || toStep > 3)) {
      triggerToast('Quản lý (L2) chỉ đẩy được tối đa đến bước 3 (Duyệt giá cấp phòng) để báo Trưởng phòng. Từ bước 3 do Trưởng phòng thao tác!');
      return;
    }
    const target = projects.find(p => p.id === projectId);
    if (!target) return;
    // Đồng bộ tình trạng hồ sơ theo cột: bước 5 = Đang triển khai (gửi CĐT), 6 = Đã trúng thầu, 7 = Rớt thầu
    let step5AutoMsg = '';
    setProjects(projects.map(p => {
      if (p.id !== projectId) return p;
      let tinhTrangDuAn = p.tinhTrangDuAn;
      if (toStep === 6) tinhTrangDuAn = 'Đã trúng thầu';
      else if (toStep === 7) tinhTrangDuAn = 'Rớt thầu';
      else if (toStep === 5) tinhTrangDuAn = 'Đang triển khai';
      else if ((p.tinhTrangDuAn === 'Đã trúng thầu' || p.tinhTrangDuAn === 'Rớt thầu') && toStep < 5) {
        // Lùi hồ sơ về giai đoạn trước khi có kết quả → quay lại đang triển khai
        tinhTrangDuAn = 'Đang triển khai';
      }
      // Bước 5 "Hồ sơ đã gửi CĐT" = đóng gói thầu: tự chốt ngày đóng hồ sơ thực tế (giữ ngày TP đã
      // nhập tay nếu có) và đánh giá đúng hạn/trễ theo THỜI HẠN HẸN CĐT (không có hẹn thì theo hạn hiện tại).
      // TP vẫn có thể vào form sửa tay ngày thực tế nếu ngày gửi thật khác ngày kéo thẻ.
      let dongGoi: Partial<Project> = {};
      if (toStep === 5 && fromStep < 5) {
        const actual = p.ngayHoanThanhThucTe || new Date().toISOString().split('T')[0];
        const benchmark = p.hanHenCDT || ymdOf(getTenderDeadline(p));
        const treHan = !!benchmark && new Date(actual) > new Date(benchmark);
        dongGoi = { ngayHoanThanhThucTe: actual, trangThai: treHan ? 'HOAN_THANH_TRE_HAN' : 'HOAN_THANH_DUNG_HAN' };
        step5AutoMsg = ` Đã chốt ngày gửi CĐT ${actual.split('-').reverse().join('-')} — ${treHan ? 'TRỄ' : 'ĐÚNG'} hạn ${p.hanHenCDT ? 'hẹn CĐT' : 'hiện tại'}.`;
      } else if (fromStep >= 5 && toStep < 5) {
        // Kéo lùi về trước bước 5: hồ sơ coi như chưa gửi → bỏ mốc tự chốt, trở lại đang thực hiện
        dongGoi = { ngayHoanThanhThucTe: undefined, trangThai: 'DANG_THUC_HIEN' };
      }
      return { ...p, kanbanStep: toStep, tinhTrangDuAn, ...dongGoi };
    }));
    const stepTitle = KANBAN_STEPS.find(s => s.id === toStep)?.title || `Bước ${toStep}`;
    triggerToast(`Đã chuyển "${target.tenDuAn}" sang bước ${toStep}: ${stepTitle}.${step5AutoMsg}`);
    logAction('Chuyển bước Kanban', `Chuyển hồ sơ ${target.projectId} - ${target.tenDuAn} từ bước ${fromStep} sang bước ${toStep} (${stepTitle})`, undefined, getProjectParticipants(target));
    // Kéo đến bước 6 "Trúng thầu" → báo tin mừng cho TOÀN BỘ quản lý & nhân viên tham gia dự án
    if (toStep === 6 && fromStep !== 6) {
      const parentName = (target.duAnChaId && projects.find(x => x.id === target.duAnChaId)?.tenDuAn) || target.tenDuAn;
      pushNotify(getProjectParticipants(target), `🎉 Chúc mừng! Gói thầu "${target.hangMuc} — ${parentName}" đã TRÚNG THẦU. Cảm ơn cả nhóm đã tham gia!`, target.id);
    }
  };

  // "Có ảnh hưởng hạn nộp" → mở popup dời hạn + sửa việc con (khớp hạn).
  const handlePullBackImpact = (p: Project) => {
    setPullBackProject(null);
    setPullBackDelayProject(p);
  };

  // Áp dụng dời hạn khi kéo về Bước 1: cập nhật việc con, cộng hạn = số ngày dời THỰC, kéo về Bước 1,
  // ghi Delay Log. Định tuyến duyệt (GĐ D): L1 (BOOD) tự áp; L2 (MANAGER) gắn cờ chờ TP duyệt lại.
  const handlePullBackApply = (projId: string, newTasks: ProjectTask[], delayDays: number, reason: string) => {
    const isL2 = currentUser?.role === 'MANAGER';
    let target: Project | undefined;
    const DAY = 24 * 60 * 60 * 1000;
    const updated = projects.map(p => {
      if (p.id !== projId) return p;
      target = p;
      const newProg = calculateProjectProgress(newTasks);
      const today = new Date().toISOString().split('T')[0];
      const newDeadline = new Date(new Date(p.ngayHoanThanhDuKienHienTai).getTime() + delayDays * DAY)
        .toISOString().split('T')[0];
      const delayLog: DelayLog = {
        id: `DL-${Date.now()}`,
        ngayThayDoi: today,
        ngayCu: p.ngayHoanThanhDuKienHienTai,
        ngayMoi: newDeadline,
        soNgayLech: delayDays,
        lyDo: reason,
        nguoiDuyet: isL2 ? '' : (currentUser?.name || ''), // L2 chờ TP duyệt → chưa có người duyệt
      };
      return {
        ...p,
        tasks: newTasks,
        tienDoBoPhan: newProg,
        tienDoPhong: 0,            // kéo về Bước 1 → tiến độ Phòng reset, chờ duyệt lại
        ketQuaPhong: undefined,
        ngayHoanThanhDuKienHienTai: newDeadline,
        kanbanStep: 1,
        tinhTrangDuAn: 'Đang triển khai' as const,
        trangThai: 'DANG_THUC_HIEN' as const,
        delayLogs: [...(p.delayLogs || []), delayLog],
        // L2 dời → chờ TP duyệt lại tiến độ Phòng; L1 tự dời → không cần cờ.
        ...(isL2 ? { choDuyetLai: true } : { choDuyetLai: undefined }),
      };
    });
    setProjects(updated);
    setPullBackDelayProject(null);
    if (!target) return;
    if (isL2) {
      const boodIds = staff.filter(s => s.role === 'BOOD' && !s.daNghi).map(s => s.id);
      triggerToast(`Đã gửi yêu cầu dời hạn +${delayDays} ngày cho "${target.hangMuc}" — chờ Trưởng phòng duyệt lại tiến độ Phòng.`);
      pushNotify(boodIds, `Quản lý xin dời hạn +${delayDays} ngày (kéo về Bước 1) cho "${target.hangMuc} — ${target.tenDuAn}". Lý do: ${reason}. Cần duyệt lại tiến độ Phòng.`, target.id);
    } else {
      triggerToast(`Đã dời hạn +${delayDays} ngày & kéo "${target.hangMuc}" về Bước 1.`);
    }
    // #3: hồ sơ kéo về Bước 1 (Tiếp nhận) → tự báo Quản lý phụ trách vào tạo/cập nhật công việc con
    // cho nhân viên; sau đó chạy tiếp logic cũ (tạo cv con + tiến độ → Trưởng phòng duyệt lại → chạy tiếp).
    if (target.quanLyId && target.quanLyId !== currentUser?.staffId) {
      pushNotify([target.quanLyId], `Hồ sơ "${target.hangMuc} — ${target.tenDuAn}" đã được kéo về Bước 1 (Tiếp nhận thông tin). Vui lòng vào tạo/cập nhật công việc con cho nhân viên; sau đó Trưởng phòng duyệt lại tiến độ để chạy tiếp.`, target.id);
    }
    logAction('Dời hạn (kéo về Bước 1)', `${isL2 ? 'Quản lý xin' : 'Trưởng phòng'} dời hạn +${delayDays} ngày hồ sơ ${target.projectId} - ${target.tenDuAn}, kéo về Bước 1. Lý do: ${reason}.`, undefined, getProjectParticipants(target));
  };

  // Trưởng phòng kiểm tra & cập nhật kết quả + tiến độ cấp Phòng cho hồ sơ
  const handleUpdatePhongResult = (projId: string, tienDoPhong: number, ketQuaPhong: string) => {
    if (currentUser?.role !== 'BOOD') {
      triggerToast('Chỉ Trưởng phòng (Level 1) mới được cập nhật kết quả & tiến độ cấp Phòng!');
      return;
    }
    const updated = projects.map(proj => {
      if (proj.id !== projId) return proj;
      let nextStatus = proj.trangThai;
      if (proj.tienDoBoPhan === 100 && tienDoPhong === 100 && proj.trangThai === 'DANG_THUC_HIEN') {
        nextStatus = 'HOAN_THANH_DUNG_HAN';
      }
      return { ...proj, tienDoPhong, ketQuaPhong: ketQuaPhong.trim() || undefined, trangThai: nextStatus };
    });
    setProjects(updated);
    const target = projects.find(p => p.id === projId);
    triggerToast('Đã cập nhật kết quả & tiến độ cấp Phòng!');
    if (target) {
      logAction('Cập nhật kết quả Phòng', `Trưởng phòng cập nhật tiến độ Phòng ${tienDoPhong}% và kết quả kiểm tra cho hồ sơ ${target.projectId} - ${target.tenDuAn}`, undefined, getProjectParticipants(target));
      const daHoanThanh = target.tienDoBoPhan === 100 && tienDoPhong === 100 && target.trangThai === 'DANG_THUC_HIEN';
      pushNotify(allManagerIds(target), daHoanThanh
        ? `Công việc "${target.hangMuc} — ${target.tenDuAn}" đã HOÀN THÀNH (Phòng duyệt 100%).`
        : `Trưởng phòng vừa cập nhật tiến độ Phòng ${tienDoPhong}% cho "${target.hangMuc} — ${target.tenDuAn}".`, target.id);
    }
  };

  // Export to Excel (chronological by Project_ID, with strict RBAC limits to prevent data leaks)
  const handleExportExcel = () => {
    const exportData = [...filteredProjects];
    // Sort chronologically by Project_ID
    exportData.sort((a, b) => a.projectId.localeCompare(b.projectId));

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; font-size: 13px; }
          th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; border: 1px solid #94a3b8; padding: 12px 10px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 10px 8px; text-align: left; vertical-align: top; }
          tr:nth-child(even) td { background-color: #f8fafc; }
          .title { font-size: 22px; font-weight: bold; color: #1e3a8a; text-align: center; padding: 20px 0 5px 0; text-transform: uppercase; }
          .subtitle { font-size: 13px; font-weight: bold; color: #475569; text-align: center; padding-bottom: 20px; }
          .meta { font-size: 11px; color: #64748b; padding: 15px; background-color: #f1f5f9; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; line-height: 1.6; }
          .percentage { text-align: right; font-weight: bold; }
          .numeric { text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: bold; }
          .bold-text { font-weight: bold; color: #0f172a; }
          .status-badge { font-weight: bold; padding: 4px 8px; border-radius: 4px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="title">Bảng thống kê dự án đấu thầu</div>
        <div class="subtitle">Báo cáo tổng hợp quy mô, tiến độ và kết quả đấu thầu phòng dự án</div>
        <div class="meta">
          <b>THÔNG TIN HỆ THỐNG TRÍCH XUẤT:</b> <br/>
          • Hệ thống phần mềm: HP Cons BPM ERP Enterprise v1.5 <br/>
          • Ngày giờ trích xuất dữ liệu: ${fmtDateTimeVN(new Date())} (Giờ địa phương GMT+7) <br/>
          • Nhân sự thực hiện xuất báo cáo: ${currentUser?.name || 'Hệ thống'} • Phân quyền bảo mật: Level ${currentUser?.role === 'BOOD' ? '1 (Trưởng phòng)' : currentUser?.role === 'MANAGER' ? '2 (Quản lý)' : '3 (Chuyên viên Chuyên môn)'} <br/>
          • <b>Cơ chế kiểm soát dữ liệu (DLP & RBAC):</b> Tự động che dấu / thu gọn thông số phòng duyệt nhạy cảm dựa theo quyền tài khoản đăng nhập hiện tại để bảo đảm tuyệt đối bí mật kinh doanh.
        </div>
        <table>
          <thead>
            <tr>
              <th style="background-color: #1e3a8a; color: #ffffff;">Mã Dự Án</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">Tên Gói Thầu / Dự Án</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">Chủ Đầu Tư (CĐT)</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">Địa Chỉ Công Trình</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">Hình Thức Báo Giá / Hạng Mục</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">Hình Thức Đấu Thầu</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">Tiến Độ Cam Kết (Hạn Gốc)</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">Tiến Độ Điều Chỉnh (Hạn Mới)</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">Tiến Độ Thực Tế Thực Hiện</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">Trạng Thái Tiến Độ</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">Tình Trạng Dự Án</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">Quản Lý Đảm Nhận</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">Chuyên Viên Chính</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">Điểm KPI Đạt Được (Theo Tiến Độ)</th>
            </tr>
          </thead>
          <tbody>
    `;

    exportData.forEach(p => {
      // 1. Progress Status Strings
      let statusStr = 'Đang tiến hành';
      let statusStyle = 'color: #2563eb;';
      if (p.trangThai === 'HOAN_THANH_DUNG_HAN') {
        statusStr = 'Đúng hạn thầu';
        statusStyle = 'color: #16a34a;';
      } else if (p.trangThai === 'HOAN_THANH_TRE_HAN') {
        statusStr = 'Hoàn thành trễ';
        statusStyle = 'color: #d97706;';
      } else if (p.trangThai === 'TRE_TIEN_DO') {
        statusStr = 'Quá hạn hồ sơ';
        statusStyle = 'color: #dc2626; font-weight: bold;';
      }

      // 2. Real-world Project Tendering Status (won/lost/negotiating/ongoing)
      const prjResult = p.tinhTrangDuAn || 'Đang triển khai';
      let resultStyle = 'color: #475569;';
      if (prjResult === 'Đã trúng thầu') resultStyle = 'color: #16a34a; font-weight: bold;';
      else if (prjResult === 'Rớt thầu') resultStyle = 'color: #dc2626;';
      else if (prjResult === 'Đang thương thảo') resultStyle = 'color: #4f46e5;';

      // 3. Security masking based on RBAC Level
      const isStaff = currentUser?.role === 'STAFF';
      const bpText = isStaff ? '🔒 Bảo mật' : `${p.tienDoBoPhan}%`;
      const pText = isStaff ? '🔒 Bảo mật' : `${p.tienDoPhong}%`;

      // 4. Progress Text Detailed Breakdown
      let actualProgressText = '';
      if (p.ngayHoanThanhThucTe) {
        actualProgressText = `Hoàn thành thực tế ngày: ${fmtDateVN(p.ngayHoanThanhThucTe)} (Phòng duyệt: ${pText})`;
      } else {
        actualProgressText = `Đang thực hiện (Bộ phận: ${bpText} | Phòng duyệt: ${pText})`;
      }

      // 5. Look up human resource names
      const managerMain = staff.find(s => s.id === p.quanLyId)?.hoTen || 'Chưa gán';
      const managerPhu = (p.quanLyIdsPhu || []).map(id => staff.find(s => s.id === id)?.hoTen).filter(Boolean);
      const managerName = managerPhu.length ? `${managerMain} (+ ${managerPhu.join(', ')})` : managerMain;
      const mainStaffName = staff.find(s => s.id === p.thucHienId)?.hoTen || 'Chưa gán';

      // 6. Scores (KPI chỉ tính theo tiến độ) — nhân viên không được xem KPI
      const kpiScore = isStaff ? '🔒 Bảo mật' : (p.kpi !== undefined ? p.kpi.toFixed(1) : 'Chưa thẩm định');

      html += `
        <tr>
          <td class="bold-text" style="text-align: center; font-family: monospace;">${p.projectId}</td>
          <td class="bold-text">${p.tenDuAn}</td>
          <td>${p.chuDauTu || 'Chưa cập nhật'}</td>
          <td>${p.diaChi || 'Chưa cập nhật'}</td>
          <td>${p.hangMuc}</td>
          <td>${p.hinhThucDauThau || 'Đấu thầu cạnh tranh'}</td>
          <td style="text-align: center;">${fmtDateVN(p.ngayHoanThanhDuKienGoc)}</td>
          <td style="text-align: center;">${fmtDateVN(getTenderDeadline(p))}</td>
          <td>${actualProgressText}</td>
          <td style="${statusStyle}">${statusStr}</td>
          <td style="${resultStyle}">${prjResult}</td>
          <td>${managerName}</td>
          <td>${mainStaffName}</td>
          <td class="numeric">${kpiScore}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bang_Thong_Ke_Du_An_Dau_Thau_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast(`Đã xuất báo cáo Excel thành công (${exportData.length} dự án thầu, xếp chronologically theo Project_ID)!`);
    logAction('Xuất báo cáo Excel', `Trích xuất dữ liệu thầu ra tệp Excel (${exportData.length} dự án thầu, phân quyền: ${currentUser?.role})`);
  };

  // Export to Strategic Goals Report (Mẫu số 1 / Template 1 chuẩn Phòng Đấu thầu)
  const handleExportStrategicReport = () => {
    const exportData = [...filteredProjects];
    exportData.sort((a, b) => a.projectId.localeCompare(b.projectId));

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Strategic Goals Report</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #1e293b; }
          table { border-collapse: collapse; width: 100%; border: 2px solid #0f172a; }
          th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #475569; padding: 10px 6px; text-align: center; font-size: 11px; }
          td { border: 1px solid #94a3b8; padding: 8px 6px; font-size: 11px; vertical-align: middle; }
          .title-primary { font-size: 18px; font-weight: bold; color: #1e3a8a; text-align: center; padding: 15px 0 2px 0; text-transform: uppercase; }
          .title-secondary { font-size: 12px; font-weight: bold; color: #475569; text-align: center; padding-bottom: 15px; }
          .bold-text { font-weight: bold; color: #000000; }
          .numeric { text-align: right; font-weight: bold; }
          .center-text { text-align: center; }
          .badge-completed { background-color: #d1fae5; color: #065f46; font-weight: bold; text-align: center; }
          .badge-pending { background-color: #fef3c7; color: #92400e; font-weight: bold; text-align: center; }
          .total-row { background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }
          .header-meta { font-size: 11px; font-weight: bold; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="title-primary">BẢNG THỐNG KÊ DỰ ÁN ĐẤU THẦU PHỤC VỤ BÁO CÁO MỤC TIÊU CHIẾN LƯỢC</div>
        <div class="title-secondary">PHÒNG ĐẤU THẦU HP CONS &bull; TIỂU CHUẨN THỐNG KÊ QUY MÔ DỰ ÁN NĂM 2026</div>

        <table style="margin-bottom: 15px; border: none; width: 100%;">
          <tr style="border: none;">
            <td style="border: none; font-size: 11px; width: 33%;"><b>Người xem xét:</b> Hồ Hữu Phương (Phó TGĐ Kinh tế dự án)</td>
            <td style="border: none; font-size: 11px; width: 33%; text-align: center;"><b>Người phụ trách:</b> Ngô Nữ Quỳnh Trâm (Trưởng phòng)</td>
            <td style="border: none; font-size: 11px; width: 33%; text-align: right;"><b>Người lập báo cáo:</b> Phan Thành Quốc / Bùi Khắc Huy</td>
          </tr>
          <tr style="border: none;">
            <td style="border: none; font-size: 11px;"><b>Kỳ báo cáo:</b> Toàn bộ mục tiêu năm 2026</td>
            <td style="border: none; font-size: 11px; text-align: center;"><b>Bộ phận ứng dụng:</b> Đấu thầu thầu phụ &amp; Khối lượng BOQ</td>
            <td style="border: none; font-size: 11px; text-align: right;"><b>Ngày lập:</b> ${fmtDateVN(new Date())}</td>
          </tr>
        </table>

        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 4%; background-color: #1e3a8a; color: #ffffff;">STT</th>
              <th rowspan="2" style="width: 18%; background-color: #1e3a8a; color: #ffffff;">Tên Dự Án / Gói Thầu</th>
              <th rowspan="2" style="width: 12%; background-color: #1e3a8a; color: #ffffff;">Chủ Đầu Tư</th>
              <th rowspan="2" style="width: 8%; background-color: #1e3a8a; color: #ffffff;">Mã Dự Án</th>
              <th rowspan="2" style="width: 8%; background-color: #1e3a8a; color: #ffffff;">Phân Rã Công Việc</th>
              <th rowspan="2" style="width: 10%; background-color: #1e3a8a; color: #ffffff;">Hình Thức Báo Giá</th>
              <th rowspan="2" style="width: 10%; background-color: #1e3a8a; color: #ffffff;">Hình Thức Đấu Thầu</th>
              <th rowspan="2" style="width: 8%; background-color: #1e3a8a; color: #ffffff;">Hạn Thầu BLĐ</th>
              <th rowspan="2" style="width: 8%; background-color: #1e3a8a; color: #ffffff;">Tiến Độ Thực Tế</th>
              <th rowspan="2" style="width: 10%; background-color: #1e3a8a; color: #ffffff;">Giá Trị Báo Giá (KHĐ gần nhất)</th>
              <th colspan="3" style="background-color: #1e3a8a; color: #ffffff;">Hồ Sơ Mời Thầu Thiết Kế Bởi</th>
              <th rowspan="2" style="width: 10%; background-color: #1e3a8a; color: #ffffff;">Vị Trí Công Trình</th>
              <th rowspan="2" style="width: 10%; background-color: #1e3a8a; color: #ffffff;">Tình Trạng Dự Án</th>
            </tr>
            <tr>
              <th style="width: 6%; background-color: #1e3a8a; color: #ffffff;">HP Thiết Kế</th>
              <th style="width: 6%; background-color: #1e3a8a; color: #ffffff;">CĐT Phát Thầu</th>
              <th style="width: 6%; background-color: #1e3a8a; color: #ffffff;">Đơn Vị Khác</th>
            </tr>
          </thead>
          <tbody>
    `;

    let countTrungThau = 0;
    let countChoKq = 0;
    let countRotThau = 0;

    exportData.forEach((p, idx) => {
      // Status counters
      if (p.tinhTrangDuAn === 'Đã trúng thầu') countTrungThau++;
      else if (p.tinhTrangDuAn === 'Rớt thầu') countRotThau++;
      else countChoKq++;

      const isStaff = currentUser?.role === 'STAFF';
      const bpText = isStaff ? 'Bảo mật' : `${p.tienDoBoPhan}%`;
      const pText = isStaff ? 'Bảo mật' : `${p.tienDoPhong}%`;

      let actualProgressText = '';
      if (p.ngayHoanThanhThucTe) {
        actualProgressText = `H.Thành: ${fmtDateVN(p.ngayHoanThanhThucTe)}`;
      } else {
        actualProgressText = `Bộ phận: ${bpText} | Phòng: ${pText}`;
      }

      // Nguồn thiết kế hồ sơ mời thầu — 3 lựa chọn tách riêng
      const isHpDesign = p.hoSoPhatThau === 'HP thiết kế';
      const isCdtDesign = p.hoSoPhatThau === 'CĐT phát thầu';
      const isOtherDesign = p.hoSoPhatThau === 'Đơn vị khác thiết kế';

      // Check task breakdown sync state (checkmark if tasks are present)
      const isSynced = p.tasks && p.tasks.length > 0;

      html += `
        <tr>
          <td class="center-text">${idx + 1}</td>
          <td class="bold-text">${p.tenDuAn}</td>
          <td>${p.chuDauTu || 'Chưa cập nhật'}</td>
          <td class="center-text" style="font-family: monospace;">${p.projectId}</td>
          <td class="center-text ${isSynced ? 'badge-completed' : 'badge-pending'}">${isSynced ? '✔ Đã phân rã' : '✘ Chưa đồng bộ'}</td>
          <td class="center-text">${p.hangMuc}</td>
          <td class="center-text">${p.hinhThucDauThau || 'Đấu thầu cạnh tranh'}</td>
          <td class="center-text">${fmtDateVN(p.ngayHoanThanhDuKienGoc)}</td>
          <td>${actualProgressText}</td>
          <td class="numeric">${p.giaTriBaoGia ? p.giaTriBaoGia.toLocaleString('vi-VN') + ' đ' : ''}</td>
          <td class="center-text" style="font-size: 14px; font-weight: bold; color: green;">${isHpDesign ? '✔' : ''}</td>
          <td class="center-text" style="font-size: 14px; font-weight: bold; color: #475569;">${isCdtDesign ? '✔' : ''}</td>
          <td class="center-text" style="font-size: 14px; font-weight: bold; color: #b45309;">${isOtherDesign ? '✔' : ''}</td>
          <td>${p.diaChi || 'Chưa cập nhật'}</td>
          <td class="bold-text center-text" style="color: ${p.tinhTrangDuAn === 'Đã trúng thầu' ? '#16a34a' : p.tinhTrangDuAn === 'Rớt thầu' ? '#dc2626' : '#2563eb'}">${p.tinhTrangDuAn || 'Đang triển khai'}</td>
        </tr>
      `;
    });

    // Summary row
    html += `
        <tr class="total-row">
          <td colspan="6" style="text-align: right; padding-right: 15px;">TỔNG CỘNG THỐNG KÊ / CHỈ TIÊU CHIẾN LƯỢC:</td>
          <td colspan="7"></td>
          <td colspan="2" style="font-size: 10px; font-weight: bold; color: #1e3a8a;">
            Trúng: ${countTrungThau} | Rớt: ${countRotThau} | Chờ KQ: ${countChoKq}
          </td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 30px; font-size: 11px; width: 100%;">
      <table style="border: none; width: 100%;">
        <tr style="border: none;">
          <td style="border: none; text-align: center; width: 33%; font-weight: bold;">NGƯỜI XEM XÉT THẨM ĐỊNH<br/><span style="font-size: 9px; font-weight: normal; color: #64748b;">(Ký, ghi rõ họ tên)</span><br/><br/><br/><br/>Hồ Hữu Phương</td>
          <td style="border: none; text-align: center; width: 33%; font-weight: bold;">NGƯỜI PHỤ TRÁCH ĐƠN VỊ<br/><span style="font-size: 9px; font-weight: normal; color: #64748b;">(Ký, ghi rõ họ tên)</span><br/><br/><br/><br/>Ngô Nữ Quỳnh Trâm</td>
          <td style="border: none; text-align: center; width: 33%; font-weight: bold;">NGƯỜI LẬP BIỂU BÁO CÁO<br/><span style="font-size: 9px; font-weight: normal; color: #64748b;">(Ký, ghi rõ họ tên)</span><br/><br/><br/><br/>Hệ thống BPM v1.5</td>
        </tr>
      </table>
    </div>
  </body>
  </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_Cao_Muc_Tieu_Chien_Luoc_Nam_2026_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast(`Đã xuất báo cáo Mục tiêu chiến lược thành công (${exportData.length} dự án)!`);
    logAction('Xuất báo cáo Chiến lược', `Trích xuất biểu mẫu báo cáo mục tiêu chiến lược phòng đấu thầu ra Excel (${exportData.length} dự án thầu, phân quyền: ${currentUser?.role})`);
  };

  const getStatusBadge = (status: Project['trangThai']) => {
    // Chấm tròn cùng màu chữ badge (bg-current) — Badge V1.1 §E4
    const dot = <span className="h-1.5 w-1.5 rounded-full bg-current" />;
    switch (status) {
      case 'HOAN_THANH_DUNG_HAN':
        return <Badge variant="success" icon={dot}>Đúng hạn thầu</Badge>;
      case 'HOAN_THANH_TRE_HAN':
        return <Badge variant="primary" icon={dot}>Hoàn thành trễ</Badge>;
      case 'TRE_TIEN_DO':
        return <Badge variant="danger" icon={dot} className="animate-pulse">Quá hạn hồ sơ</Badge>;
      case 'DANG_THUC_HIEN':
        return <Badge variant="primary" icon={dot}>Đang lập thầu</Badge>;
      default:
        return null;
    }
  };

  // If not logged in, render the beautiful, secured Webform Login
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-dark-bg text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
        {/* Ambient radial blur backdrops */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-brand-accent/15 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] bg-brand-warning/10 rounded-full blur-[150px] pointer-events-none" />

        {/* Global tiny grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        {/* Header containing HP CONS Logo with empty logo slot */}
        <header className="p-6 shrink-0 z-20">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HpConsLogo className="h-10" light={true} />
            </div>

            {/* Real-time UTC Monospace Clock Widget */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-card border border-slate-800 rounded-full text-xs font-mono font-bold tracking-wider text-slate-300">
              <span className="w-2 h-2 rounded-full bg-brand-danger animate-pulse" />
              <span>{utcTime || "00:00:00 UTC"}</span>
            </div>
          </div>
        </header>

        {/* Bố cục 2 cột: Bảng thương hiệu vs Biểu mẫu đăng nhập */}
        <main className="flex-grow flex items-center justify-center p-6 z-10">
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* LEFT SIDE: Bảng thương hiệu HP-CONS / Phòng Đấu Thầu */}
            <div className="lg:col-span-6 hidden lg:flex flex-col space-y-7">
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-warning bg-brand-warning/10 px-2.5 py-1 rounded-full w-max font-bold border border-brand-warning/20">
                  HP-CONS • Phòng Đấu Thầu
                </span>
                <h1 className="text-3xl font-black text-white leading-[1.5] uppercase pb-1">
                  Hệ Thống Quản Trị <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-warning via-brand-warning to-brand-accent-400 inline-block pb-1">
                    Tiến Độ Đấu Thầu
                  </span>
                </h1>
                <p className="text-xs text-slate-400 max-w-md font-medium leading-relaxed">
                  Quản lý quy trình thầu theo bảng Kanban, phân rã công việc, theo dõi tiến độ và KPI của Phòng Đấu Thầu — tập trung, minh bạch, thời gian thực.
                </p>
              </div>

              {/* Các trụ cột tính năng của hệ thống */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: LayoutGrid, color: 'text-brand-accent-400', bg: 'bg-brand-accent/10 border-brand-accent/20', title: 'Bảng Kanban 7 bước', desc: 'Từ tiếp nhận đến gửi CĐT, tự rẽ nhánh Trúng / Rớt.' },
                  { icon: Clock, color: 'text-brand-warning', bg: 'bg-brand-warning/10 border-brand-warning/20', title: 'Tiến độ & Hạn thầu', desc: 'Theo dõi tiến độ Bộ phận và Phòng theo từng chặng.' },
                  { icon: Users, color: 'text-brand-primary-400', bg: 'bg-brand-primary/10 border-brand-primary/20', title: 'Phân quyền RBAC', desc: 'Ban giám đốc, Trưởng/Phó phòng, Quản lý, Chuyên viên.' },
                  { icon: FileCheck, color: 'text-brand-accent-400', bg: 'bg-brand-accent/10 border-brand-accent/20', title: 'KPI & Báo cáo', desc: 'Chấm điểm KPI và xuất báo cáo tiến độ đấu thầu.' },
                ].map((f, i) => (
                  <div key={i} className={`bg-dark-card border ${f.bg} p-4 rounded-2xl shadow-xl hover:scale-[1.02] transition-all duration-300`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${f.bg} border mb-2.5`}>
                      <f.icon className={`w-5 h-5 ${f.color}`} />
                    </div>
                    <h4 className="text-[11px] font-black text-white uppercase tracking-wide leading-tight">{f.title}</h4>
                    <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT SIDE: Immersive Tactical Login Form */}
            <div className="lg:col-span-6 flex flex-col justify-center">
              <div className="w-full max-w-md mx-auto bg-dark-card border border-slate-800 shadow-2xl rounded-2xl p-6 md:p-8 space-y-6 relative">
                
                {/* Yellow tactical border accent line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-warning via-brand-warning to-brand-accent rounded-t-2xl" />

                <div className="text-center space-y-2">
                  <div className="mx-auto w-12 h-12 bg-brand-warning/10 text-brand-warning rounded-full flex items-center justify-center border border-brand-warning/20">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-black text-white uppercase tracking-wider">
                    Đăng Nhập Hệ Thống
                  </h2>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wide">
                    Phòng Đấu Thầu - HP CONS BPM
                  </p>
                </div>

                {loginError && (
                  <div className="bg-brand-danger/10 border border-brand-danger/20 rounded-xl p-3 text-xs text-brand-danger font-bold flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-danger shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Tên đăng nhập *
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="Nhập tên đăng nhập"
                      className="w-full px-4 py-3 bg-dark-card border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-600 focus:outline-none focus:border-brand-warning/50 focus:ring-1 focus:ring-brand-warning transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Mật Khẩu Kiểm Soát *
                    </label>
                    <input 
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full px-4 py-3 bg-dark-card border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-600 focus:outline-none focus:border-brand-warning/50 focus:ring-1 focus:ring-brand-warning transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-brand-warning hover:bg-brand-warning/85 text-black font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Xác thực hệ thống
                  </button>
                </form>

                <div className="relative border-t border-slate-800 pt-4">
                  <p className="text-[10px] text-slate-500 text-center font-medium leading-relaxed">
                    Đăng nhập bằng <strong className="text-slate-300">tên đăng nhập</strong> do quản trị viên cấp.
                    <br />Lần đầu đăng nhập, hệ thống sẽ yêu cầu thêm ảnh đại diện và đổi mật khẩu.
                    <br /><span className="text-slate-600">Bảo mật bởi Firebase Authentication — mật khẩu được mã hóa.</span>
                  </p>
                </div>
              </div>
            </div>

          </div>
        </main>

        <footer className="py-4 text-center text-[10px] text-slate-500 z-10 shrink-0 font-mono">
          © {new Date().getFullYear()} HP-CONS • HỆ THỐNG QUẢN TRỊ TIẾN ĐỘ PHÒNG ĐẤU THẦU • BẢO MẬT NỘI BỘ
        </footer>
      </div>
    );
  }

  // If logged in, render the main full application workspace
  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 bg-background text-foreground ${darkMode ? 'dark' : ''}`}>
      
      {/* Toast alert banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-dark-elevated text-white px-5 py-3 rounded-xl shadow-lg border border-slate-800 dark:border-slate-700 flex items-center gap-2.5 text-xs font-bold"
          >
            <CheckCircle className="w-4 h-4 text-brand-success-400" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar tràn full chiều cao + cột phải (Header/Main/Footer) */}
      <div className="flex-grow flex flex-col md:flex-row min-h-0">
        {/* Left Sidebar / Thanh tác vụ bên trái */}
        <aside className={`w-full ${sidebarCollapsed ? 'md:w-18 sidebar-collapsed' : 'md:w-64'} bg-nav-base text-slate-100 border-r border-white/10 p-4 shrink-0 hidden md:flex flex-col justify-between transition-all duration-200`} id="app-sidebar">
          <div className="space-y-6">
            {/* Nút thu/mở sidebar (chỉ md+; mobile giữ dải nav ngang) */}
            <button
              type="button"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              aria-label={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              className="hidden md:flex items-center justify-center w-full py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all"
              id="sidebar-toggle"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Brand Logo & System Name inside Sidebar */}
            <div className="hidden md:flex flex-col items-center text-center gap-4 bg-black/15 p-4 rounded-2xl border border-white/10 relative" id="sidebar-brand">
              <div className="absolute top-3 right-3">
                <span className="bg-brand-warning/20 text-brand-warning dark:text-brand-warning text-[8px] px-1.5 py-0.5 rounded font-black border border-brand-warning/30 uppercase tracking-wider">
                  ERP v1.4
                </span>
              </div>
              <HpConsLogo className="h-10 shrink-0" light={true} />
              <div className="mt-1">
                <h1 className="text-xs font-black uppercase tracking-widest text-slate-200 leading-snug">
                  Phòng Đấu Thầu
                </h1>
              </div>
            </div>

            <div className="hidden md:block" id="sidebar-tasklabel">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-300">
                Thanh tác vụ
              </span>
            </div>
            
            <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0" id="sidebar-nav">
              {/* Tab: Liên kết phòng ban — ẩn với Level 3 (Chuyên viên); dữ liệu do IT bổ sung sau */}
              {currentUser.role !== 'STAFF' && (
              <button
                id="btn-nav-deptlinks"
                onClick={() => { setActiveTab('DEPTLINKS'); setShowForm(false); }}
                className={`w-full h-11 px-4 font-bold transition-all rounded-xl flex items-center gap-3 text-left border-l-4 ${
                  activeTab === 'DEPTLINKS' && !showForm
                    ? 'border-brand-accent text-white bg-brand-accent/25 shadow-sm'
                    : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="text-xs">Liên kết phòng ban</span>
              </button>
              )}

              {/* Tab: Dashboard */}
              <button
                id="btn-nav-dashboard"
                onClick={() => { setActiveTab('DASHBOARD'); setShowForm(false); }}
                className={`w-full h-11 px-4 font-bold transition-all rounded-xl flex items-center gap-3 text-left border-l-4 ${
                  activeTab === 'DASHBOARD' && !showForm
                    ? 'border-brand-accent text-white bg-brand-accent/25 shadow-sm' 
                    : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                <span className="text-xs">{currentUser.role === 'STAFF' ? 'KPI Cá Nhân' : 'Dashboard'}</span>
              </button>

              {/* Tabs: PROJECTS & GANTT */}
              {currentUser.role !== 'STAFF' && (
                <>
                  <button
                    id="btn-nav-projects"
                    onClick={() => { setActiveTab('PROJECTS'); setShowForm(false); }}
                    className={`w-full h-11 px-4 font-bold transition-all rounded-xl flex items-center gap-3 text-left border-l-4 ${
                      activeTab === 'PROJECTS' || showForm
                        ? 'border-brand-accent text-white bg-brand-accent/25 shadow-sm'
                        : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <ListTodo className="w-4 h-4 shrink-0" />
                    <span className="text-xs flex items-center justify-between w-full">
                      <span>Báo Cáo Tiến Độ</span>
                      <span className="bg-slate-200 text-slate-600 dark:bg-dark-elevated dark:text-slate-300 px-1.5 py-0.5 rounded-full text-[9px] font-black">{filteredProjects.length}</span>
                    </span>
                  </button>

                  <button
                    id="btn-nav-kanban"
                    onClick={() => { setActiveTab('KANBAN'); setShowForm(false); }}
                    className={`w-full h-11 px-4 font-bold transition-all rounded-xl flex items-center gap-3 text-left border-l-4 ${
                      activeTab === 'KANBAN' && !showForm
                        ? 'border-brand-accent text-white bg-brand-accent/25 shadow-sm'
                        : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4 shrink-0" />
                    <span className="text-xs">Bảng Kanban</span>
                  </button>

                  <button
                    id="btn-nav-gantt"
                    onClick={() => { setActiveTab('GANTT'); setShowForm(false); }}
                    className={`w-full h-11 px-4 font-bold transition-all rounded-xl flex items-center gap-3 text-left border-l-4 ${
                      activeTab === 'GANTT' && !showForm
                        ? 'border-brand-accent text-white bg-brand-accent/25 shadow-sm'
                        : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span className="text-xs">Biểu Đồ Gantt</span>
                  </button>
                </>
              )}

              {/* Tab: Đội Ngũ — BOOD (đầy đủ) và MANAGER (tạo tài khoản Chuyên viên) */}
              {(currentUser.role === 'BOOD' || currentUser.role === 'MANAGER') && (
                <button
                  id="btn-nav-staff"
                  onClick={() => { setActiveTab('STAFF'); setShowForm(false); }}
                  className={`w-full h-11 px-4 font-bold transition-all rounded-xl flex items-center gap-3 text-left border-l-4 ${
                    activeTab === 'STAFF' && !showForm
                      ? 'border-brand-accent text-white bg-brand-accent/25 shadow-sm'
                      : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="text-xs">{currentUser.role === 'MANAGER' ? 'Nhân sự' : 'Đội Ngũ & KPI'}</span>
                </button>
              )}

              {/* Tab: Hệ thống (gộp CSDL SQL DDL + Luồng Nghiệp Vụ) — chỉ Trưởng phòng (BOOD) */}
              {currentUser.role === 'BOOD' && (
                <button
                  id="btn-nav-system"
                  onClick={() => { setActiveTab('SYSTEM'); setShowForm(false); }}
                  className={`w-full h-11 px-4 font-bold transition-all rounded-xl flex items-center gap-3 text-left border-l-4 ${
                    activeTab === 'SYSTEM' && !showForm
                      ? 'border-brand-accent text-white bg-brand-accent/25 shadow-sm'
                      : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Database className="w-4 h-4 shrink-0" />
                  <span className="text-xs">Hệ thống</span>
                </button>
              )}

              {/* Tab: Nhật ký hoạt động */}
              {/* Tab: Lịch cá nhân — mọi vai trò (việc riêng + nhắc trên chuông) */}
              <button
                id="btn-nav-calendar"
                onClick={() => { setActiveTab('CALENDAR'); setShowForm(false); }}
                className={`w-full h-11 px-4 font-bold transition-all rounded-xl flex items-center gap-3 text-left border-l-4 ${
                  activeTab === 'CALENDAR' && !showForm
                    ? 'border-brand-accent text-white bg-brand-accent/25 shadow-sm'
                    : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <CalendarDays className="w-4 h-4 shrink-0" />
                <span className="text-xs flex items-center justify-between w-full">
                  <span>Lịch cá nhân</span>
                  {(() => { const n = personalTasks.filter(t => !t.done && t.ownerId === currentUser?.staffId).length; return n > 0 ? <span className="bg-brand-primary text-white px-1.5 py-0.5 rounded-full text-[9px] font-black">{n}</span> : null; })()}
                </span>
              </button>

              <button
                id="btn-nav-history"
                onClick={() => { setActiveTab('HISTORY'); setShowForm(false); }}
                className={`w-full h-11 px-4 font-bold transition-all rounded-xl flex items-center gap-3 text-left border-l-4 ${
                  activeTab === 'HISTORY' && !showForm
                    ? 'border-brand-accent text-white bg-brand-accent/25 shadow-sm'
                    : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <History className="w-4 h-4 shrink-0" />
                <span className="text-xs">Nhật Ký Hoạt Động</span>
              </button>
            </nav>
          </div>

          {/* Quick Stats or Footer in sidebar for Desktop */}
          <div className="hidden md:block border-t border-white/10 pt-4 mt-6 space-y-3" id="sidebar-footer">
            <div className="bg-black/15 p-3 rounded-xl border border-white/10">
              <div className="text-[10px] text-slate-300 uppercase font-black tracking-wider mb-1">Dự án thầu</div>
              <div className="text-xl font-black text-brand-primary">{filteredProjects.length} <span className="text-xs text-slate-300 font-medium">hồ sơ</span></div>
            </div>
            <div className="text-[9px] text-slate-400 text-center font-medium">
              HP-CONS ERP • 2026
            </div>
          </div>
        </aside>

        {/* ===== Bottom Navigation mobile <768px (06-mobile/layout.md + 08-navigation/bottom-navigation.md):
              tối đa 5 mục = 4 tab chính + "Thêm" (bottom sheet chứa tab còn lại); vùng chạm ≥44px (luật 10) ===== */}
        {(() => {
          type NavKey = typeof activeTab;
          const items: { key: NavKey; label: string; icon: typeof Briefcase; badge?: number }[] = [
            ...(currentUser.role !== 'STAFF' ? [{ key: 'DEPTLINKS' as NavKey, label: 'Liên kết phòng ban', icon: Building2 }] : []),
            { key: 'DASHBOARD', label: currentUser.role === 'STAFF' ? 'KPI Cá Nhân' : 'Dashboard', icon: Briefcase },
            ...(currentUser.role !== 'STAFF' ? [
              { key: 'PROJECTS' as NavKey, label: 'Tiến Độ', icon: ListTodo, badge: filteredProjects.length },
              { key: 'KANBAN' as NavKey, label: 'Kanban', icon: LayoutGrid },
              { key: 'GANTT' as NavKey, label: 'Gantt', icon: Calendar },
            ] : []),
            ...((currentUser.role === 'BOOD' || currentUser.role === 'MANAGER') ? [
              { key: 'STAFF' as NavKey, label: currentUser.role === 'MANAGER' ? 'Nhân sự' : 'Đội Ngũ', icon: Users },
            ] : []),
            ...(currentUser.role === 'BOOD' ? [
              { key: 'SYSTEM' as NavKey, label: 'Hệ thống', icon: Database },
            ] : []),
            { key: 'CALENDAR' as NavKey, label: 'Lịch', icon: CalendarDays },
            { key: 'HISTORY', label: 'Nhật Ký', icon: History },
          ];
          const mainItems = items.length > 5 ? items.slice(0, 4) : items;
          const moreItems = items.length > 5 ? items.slice(4) : [];
          const isActive = (k: NavKey) =>
            k === 'PROJECTS' ? (activeTab === 'PROJECTS' || showForm) : (activeTab === k && !showForm);
          const moreActive = moreItems.some(it => isActive(it.key));
          const go = (k: NavKey) => { setActiveTab(k); setShowForm(false); setShowMoreNav(false); };
          return (
            <>
              <nav aria-label="Điều hướng chính" className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-nav-base border-t border-white/10 pb-[env(safe-area-inset-bottom)]" id="mobile-bottom-nav">
                <div className="flex h-16">
                  {mainItems.map(it => (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => go(it.key)}
                      aria-current={isActive(it.key) ? 'page' : undefined}
                      className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 transition-colors ${isActive(it.key) ? 'text-white' : 'text-slate-300 hover:text-white'}`}
                    >
                      <span className={`relative flex items-center justify-center w-11 h-7 rounded-full transition-colors ${isActive(it.key) ? 'bg-brand-accent/30' : ''}`}>
                        <it.icon className="w-[22px] h-[22px]" />
                        {(it.badge ?? 0) > 0 && (
                          <span className="absolute -top-1 -right-1 bg-brand-primary text-white text-[9px] font-black px-1 min-w-4 h-4 rounded-full flex items-center justify-center">{it.badge}</span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold truncate max-w-full px-0.5">{it.label}</span>
                    </button>
                  ))}
                  {moreItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowMoreNav(true)}
                      aria-haspopup="dialog"
                      aria-expanded={showMoreNav}
                      className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 transition-colors ${moreActive ? 'text-white' : 'text-slate-300 hover:text-white'}`}
                    >
                      <span className={`flex items-center justify-center w-11 h-7 rounded-full transition-colors ${moreActive ? 'bg-brand-accent/30' : ''}`}>
                        <MoreHorizontal className="w-[22px] h-[22px]" />
                      </span>
                      <span className="text-[10px] font-bold">Thêm</span>
                    </button>
                  )}
                </div>
              </nav>
              {showMoreNav && (
                <div className="fixed inset-0 z-50 md:hidden" onClick={() => setShowMoreNav(false)}>
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                  <div
                    ref={moreNavRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Thêm mục điều hướng"
                    tabIndex={-1}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-0 inset-x-0 bg-nav-base rounded-t-2xl border-t border-white/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200"
                  >
                    <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
                    {moreItems.map(it => (
                      <button
                        key={it.key}
                        type="button"
                        onClick={() => go(it.key)}
                        aria-current={isActive(it.key) ? 'page' : undefined}
                        className={`w-full h-12 min-h-[44px] px-4 rounded-xl flex items-center gap-3 text-left font-bold text-xs transition-colors ${isActive(it.key) ? 'text-white bg-brand-accent/25 border-l-4 border-brand-accent' : 'text-slate-300 hover:text-white hover:bg-white/10 border-l-4 border-transparent'}`}
                      >
                        <it.icon className="w-5 h-5 shrink-0" />
                        {it.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Main Content Area */}
        {/* Cột phải: header thông tin phụ + nội dung + footer */}
        <div className="flex-grow flex flex-col min-h-0 min-w-0">

      {/* Main Enterprise Header */}
      <header className="bg-white text-slate-800 border-b border-slate-200 dark:bg-dark-card dark:text-white dark:border-slate-800 shrink-0 shadow-sm dark:shadow-md">
        {/* V1.1 §C: Header desktop cao 60px (chỉ chức năng phụ); mobile giữ 2 hàng đã tinh chỉnh */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-0 md:h-[60px] md:flex md:items-center">
          <div className="flex items-center justify-between gap-3 w-full">
            {/* Logo mobile: giữ hình, bỏ chữ (chị chốt 14/07) — cao 104px = đúng mép trên/dưới của 2 hàng công tắc (44 + 6 + 54) */}
            <div className="md:hidden flex items-center shrink-0">
              <HpConsLogo iconSize="w-26 h-26" light={darkMode} />
            </div>
            {/* Quick action controls & RBAC User session profile — ml-auto để dính sát mép phải, thẳng hàng khối nội dung dưới.
                Mobile <768px: công tắc dạng icon gọn + avatar/tên tắt (chị chốt 14/07) */}
            <div className="flex flex-col items-end gap-1.5 md:flex-row md:items-center md:justify-end md:gap-2 md:flex-wrap ml-auto">
              {/* Hàng công tắc mobile: trải đều hết bề rộng (justify-between) để công tắc canh trái,
                  chuông canh phải — thẳng 2 mép với khối tài khoản hàng dưới. md+: display contents (hàng ngang desktop). */}
              <div className="flex items-center justify-between w-full gap-1 md:contents">
              {/* Theme Toggle Switch (Thanh gạt) — mobile đồng bộ chiều cao 44px với các nút khác */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-dark-elevated border border-slate-200 dark:border-slate-700 px-2.5 md:px-2 py-1 min-h-[44px] md:min-h-0 rounded-xl shrink-0">
                <Sun className="w-3.5 h-3.5 text-brand-warning dark:text-slate-400" />
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    darkMode ? 'bg-brand-accent' : 'bg-slate-600'
                  }`}
                  title={darkMode ? "Chuyển qua Chế độ sáng" : "Chuyển qua Chế độ tối"}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      darkMode ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <Moon className="w-3.5 h-3.5 text-brand-accent-400" />
              </div>

              {/* Cỡ chữ A− / A+ (desktop) — phóng to cả app bằng CSS zoom cho người mắt kém.
                  Bấm nút hoặc Ctrl + lăn chuột; mức phóng được ghi nhớ. */}
              <div className="hidden md:flex items-center gap-0.5 bg-slate-100 dark:bg-dark-elevated border border-slate-200 dark:border-slate-700 px-1 py-1 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setFontScale(prev => Math.max(0.85, Math.round((prev - 0.1) * 100) / 100))}
                  disabled={fontScale <= 0.85}
                  title="Giảm cỡ chữ (Ctrl + lăn chuột xuống)"
                  aria-label="Giảm cỡ chữ"
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  A−
                </button>
                <button
                  type="button"
                  onClick={() => setFontScale(1)}
                  title={`Cỡ chữ ${Math.round(fontScale * 100)}% — bấm để về 100%`}
                  aria-label="Đặt lại cỡ chữ 100%"
                  className="min-w-[34px] h-6 px-1 flex items-center justify-center rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 transition-colors tabular-nums"
                >
                  {Math.round(fontScale * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setFontScale(prev => Math.min(1.4, Math.round((prev + 0.1) * 100) / 100))}
                  disabled={fontScale >= 1.4}
                  title="Tăng cỡ chữ (Ctrl + lăn chuột lên)"
                  aria-label="Tăng cỡ chữ"
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-[14px] font-black text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  A+
                </button>
              </div>

              {/* Add Project button - ONLY visible/clickable for Level 1 (BOOD) */}
              {currentUser.role === 'BOOD' && (
                <button
                  onClick={handleCreateClick}
                  className="text-[11px] bg-brand-success hover:bg-brand-success-hover text-white font-black px-2 md:px-3 py-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-xl flex items-center justify-center gap-1 transition-all shadow-md hover:shadow-lg cursor-pointer whitespace-nowrap shrink-0 active:scale-95"
                  title="Đăng ký một DỰ ÁN mới (chỉ tên/CĐT — không lên Kanban). Sau đó thêm công việc con vào dự án này."
                  aria-label="Đăng ký dự án mới"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="hidden md:inline">DỰ ÁN MỚI</span>
                </button>
              )}

              {/* Add Task/Work button - Visible for Level 1 (BOOD) & Level 2 (MANAGER) */}
              {(currentUser.role === 'BOOD' || currentUser.role === 'MANAGER') && (
                <button
                  onClick={handleAddWorkClick}
                  className="text-[11px] bg-brand-accent hover:bg-brand-accent-700 text-white font-black px-2 md:px-3 py-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-xl flex items-center justify-center gap-1 transition-all shadow-md hover:shadow-lg cursor-pointer whitespace-nowrap shrink-0 active:scale-95"
                  title="Thêm một CÔNG VIỆC (báo giá chi tiết, khái toán, VE...) vào một Dự án — công việc này sẽ lên Kanban"
                  aria-label="Thêm công việc mới"
                >
                  <Plus className="w-4 h-4 shrink-0 md:hidden" />
                  <CheckSquare className="hidden md:block w-4 h-4 shrink-0" />
                  <span className="hidden md:inline">CÔNG VIỆC MỚI</span>
                </button>
              )}

              {/* Ngày giờ hệ thống — header chỉ chứa thông tin phụ (08-navigation/header.md) */}
              <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 dark:bg-dark-elevated/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl shrink-0 text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5 text-brand-accent dark:text-brand-accent-300 shrink-0" />
                <span>{['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][localNow.getDay()]}, {fmtDateVN(localNow)}</span>
                <span className="text-slate-400 dark:text-slate-500">•</span>
                <span className="font-black text-slate-700 dark:text-slate-200">{String(localNow.getHours()).padStart(2, '0')}:{String(localNow.getMinutes()).padStart(2, '0')}</span>
              </div>

              {/* Chuông thông báo: TP thấy hàng chờ duyệt; Quản lý & Nhân viên thấy thông báo của mình */}
              {(
                <div className="relative shrink-0">
                  <button
                    onClick={() => {
                      setShowNotif(v => {
                        // Mở chuông để xem = đánh dấu đã đọc → số đếm tắt (tin vẫn giữ trong danh sách)
                        if (!v && currentUser.role !== 'BOOD') markMyNotifsRead();
                        return !v;
                      });
                    }}
                    title={currentUser.role === 'BOOD' ? 'Thông báo: công việc chờ Trưởng phòng duyệt tiến độ Phòng' : 'Thông báo của bạn'}
                    className="relative p-2 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-brand-warning dark:hover:text-brand-warning bg-slate-100 dark:bg-dark-elevated/80 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    <Bell className="w-4 h-4" />
                    {(currentUser.role === 'BOOD' ? (tpPendingItems.length + tpSetupItems.length) : myUnreadCount) > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-black text-white bg-brand-danger rounded-full animate-pulse">
                        {currentUser.role === 'BOOD' ? (tpPendingItems.length + tpSetupItems.length) : myUnreadCount}
                      </span>
                    )}
                  </button>
                  {showNotif && currentUser.role !== 'BOOD' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
                      <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 text-left">
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 sticky top-0 bg-white dark:bg-dark-card">
                          <Bell className="w-4 h-4 text-brand-warning" />
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Thông báo của bạn</span>
                          {myNotifs.length > 0 && (
                            <button onClick={clearMyNotifs} className="ml-auto text-[10px] font-black text-brand-danger hover:underline cursor-pointer">Xóa tất cả</button>
                          )}
                        </div>
                        {myNotifs.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">Không có thông báo nào 🎉</div>
                        ) : (
                          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {myNotifs.map(n => (
                              <li key={n.id}>
                                <button
                                  onClick={() => {
                                    setShowNotif(false);
                                    if (n.projId && currentUser.role === 'MANAGER') { setActiveTab('PROJECTS'); setExpandedProjectId(n.projId); }
                                  }}
                                  className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-dark-elevated/60 transition-colors cursor-pointer"
                                >
                                  <div className={`text-[11px] leading-snug ${n.daDoc ? 'font-medium text-slate-500 dark:text-slate-400' : 'font-bold text-slate-700 dark:text-slate-200'}`}>{n.text}</div>
                                  <div className="text-[9px] text-slate-400 mt-0.5">{fmtDateTimeVN(n.ngay)}</div>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                  {showNotif && currentUser.role === 'BOOD' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
                      <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 text-left">
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 sticky top-0 bg-white dark:bg-dark-card">
                          <Bell className="w-4 h-4 text-brand-warning" />
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Chờ Trưởng phòng xử lý</span>
                          <span className="ml-auto text-[10px] font-black bg-brand-danger/10 text-brand-danger dark:bg-brand-danger/10 dark:text-brand-danger px-1.5 py-0.5 rounded-full">{tpPendingItems.length + tpSetupItems.length}</span>
                        </div>
                        {/* Nhóm 1: công việc CHỜ TP DUYỆT (Quản lý mới tạo / chưa có thời hạn) — TP kiểm tra kế hoạch,
                            thêm ngày kiểm tra của mình & lưu → duyệt xong mới lên Kanban/Gantt */}
                        {tpSetupItems.length > 0 && (
                          <>
                            <div className="px-3 py-1.5 bg-brand-accent/5 dark:bg-brand-accent/10 text-[9px] font-black uppercase tracking-wider text-brand-accent dark:text-brand-accent-300">
                              📝 Công việc chờ duyệt ({tpSetupItems.length}) — kiểm tra &amp; lưu để lên Kanban/Gantt
                            </div>
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                              {tpSetupItems.map(p => (
                                <li key={p.id}>
                                  <button
                                    onClick={() => { setShowNotif(false); handleEditClick(p); }}
                                    className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-dark-elevated/60 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-mono font-black bg-slate-100 dark:bg-dark-elevated text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded">{p.projectId}</span>
                                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{p.hangMuc}</span>
                                    </div>
                                    <div className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 line-clamp-1">📁 {(p.duAnChaId && parentNameById[p.duAnChaId]) || p.tenDuAn}</div>
                                    <div className="flex items-center gap-2 mt-1 text-[10px]">
                                      <span className="text-brand-accent dark:text-brand-accent-300 font-bold">Bộ phận: {p.tienDoBoPhan}%</span>
                                      <span className={`font-bold ${p.choDuyetLai ? 'text-brand-danger dark:text-brand-danger' : 'text-brand-accent dark:text-brand-accent-300'}`}>
                                        {p.choDuyetLai ? '⚠ Kế hoạch bị DELAY — chờ duyệt lại' : '📝 Chờ Trưởng phòng duyệt'}
                                      </span>
                                    </div>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                        {tpPendingItems.length > 0 && (
                          <div className="px-3 py-1.5 bg-brand-warning/5 dark:bg-brand-warning/10 text-[9px] font-black uppercase tracking-wider text-brand-warning dark:text-brand-warning">
                            ✅ Chờ duyệt tiến độ Phòng ({tpPendingItems.length})
                          </div>
                        )}
                        {(tpPendingItems.length === 0 && tpSetupItems.length === 0) ? (
                          <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">Không có công việc nào chờ xử lý 🎉</div>
                        ) : (
                          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {tpPendingItems.map(p => {
                              const deadline = getDeptDeadline(p);
                              const overdue = deadline.getTime() < Date.now();
                              return (
                                <li key={p.id}>
                                  <button
                                    onClick={() => { setShowNotif(false); setActiveTab('PROJECTS'); setExpandedProjectId(p.id); }}
                                    className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-dark-elevated/60 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-mono font-black bg-slate-100 dark:bg-dark-elevated text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded">{p.projectId}</span>
                                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{p.hangMuc}</span>
                                    </div>
                                    <div className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 line-clamp-1">📁 {(p.duAnChaId && parentNameById[p.duAnChaId]) || p.tenDuAn}</div>
                                    <div className="flex items-center gap-2 mt-1 text-[10px]">
                                      <span className="text-brand-accent dark:text-brand-accent-300 font-bold">Bộ phận: {p.tienDoBoPhan}%</span>
                                      <span className={`font-bold ${overdue ? 'text-brand-danger' : 'text-slate-500 dark:text-slate-400'}`}>Hạn phòng: {fmtDateVN(deadline)}{overdue ? ' ⚠ trễ' : ''}</span>
                                    </div>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
              </div>

              {/* User Avatar & Session block */}
              <div className="flex items-center gap-1 md:gap-2 bg-slate-100 dark:bg-dark-elevated/80 px-1.5 py-1 md:p-1 md:pr-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 w-full md:w-auto">
                {/* Mobile: ảnh đại diện + tên tắt người đăng nhập (md+ hiện khối đầy đủ bên dưới) */}
                {(() => {
                  const myAvatar = staff.find(s => s.id === currentUser.staffId)?.avatar;
                  return (
                    <div className="flex md:hidden items-center gap-2 pl-1">
                      {myAvatar && myAvatar.startsWith('data:') ? (
                        <img src={myAvatar} alt={currentUser.name} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 object-cover" />
                      ) : (
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-black uppercase ${getInitialsColor(currentUser.name)}`}>
                          {getInitials(currentUser.name)}
                        </div>
                      )}
                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 whitespace-nowrap uppercase tracking-wide">
                        {getInitials(currentUser.name)}
                      </span>
                    </div>
                  );
                })()}
                <div className="w-7 h-7 bg-brand-accent rounded-lg hidden md:flex items-center justify-center text-xs font-black uppercase text-white shadow">
                  {currentUser.role}
                </div>
                <div className="text-left text-[10px] min-w-0 hidden md:block">
                  <span className="block text-slate-700 dark:text-slate-300 font-bold whitespace-nowrap">{currentUser.name}</span>
                  <span className="block text-[9px] text-slate-500 uppercase tracking-wider whitespace-nowrap">Quyền: Level {currentUser.role === 'BOOD' ? '1 (Trưởng phòng)' : currentUser.role === 'MANAGER' ? '2 (Quản lý)' : '3 (Nhân viên)'}</span>
                </div>
                <button
                  onClick={() => setPwModal('self')}
                  title="Đổi mật khẩu"
                  aria-label="Đổi mật khẩu"
                  className="p-1 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-brand-accent dark:hover:text-brand-accent-300 rounded transition-colors ml-auto md:ml-2"
                >
                  <Key className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleLogout}
                  title="Đăng xuất khỏi hệ thống"
                  aria-label="Đăng xuất khỏi hệ thống"
                  className="p-1 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-brand-danger dark:hover:text-brand-danger rounded transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

        <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6 overflow-y-auto" id="app-main-content">
        
        {/* Render Form Drawer / Screen if visible */}
        {showForm ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-2"
          >
            <ProjectForm 
              project={editingProject}
              staffList={staff}
              nextProjectId={nextProjectId}
              onSave={handleSaveProject}
              onCancel={() => { setShowForm(false); setEditingProject(undefined); }}
              currentUserRole={currentUser?.role}
              formMode={formMode}
              projectsListForSelect={parentProjects}
            />
          </motion.div>
        ) : (
          <div className="space-y-6">
            
            {/* 1. DASHBOARD VIEW */}
            {activeTab === 'DEPTLINKS' && currentUser.role !== 'STAFF' && (
              <div className="space-y-6">
                {/* ===== TRANG LIÊN KẾT PHÒNG BAN (hệ sinh thái HP Cons) =====
                    Truy cập nhanh ứng dụng các phòng ban khác (HRM, ITAsset, Workflow, CRM, Kho, Mua hàng...).
                    TẠM THỜI để trống dữ liệu theo yêu cầu — IT bổ sung sau bằng cách thêm phần tử vào mảng deptLinks:
                    { label: 'Tên phòng ban / ứng dụng', url: 'https://...', desc?: 'mô tả ngắn (tùy chọn)' } */}
                <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-5">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-brand-accent dark:text-brand-accent-300" />
                        Liên kết phòng ban
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Truy cập nhanh ứng dụng các phòng ban khác trong hệ sinh thái HP Cons
                      </p>
                    </div>
                  </div>
                  {(() => {
                    // IT: thêm liên kết vào mảng này. Để rỗng [] sẽ hiển thị trạng thái "đang cập nhật".
                    const deptLinks: { label: string; url: string; desc?: string }[] = [];
                    return deptLinks.length === 0 ? (
                      <EmptyState
                        icon={<Building2 className="w-6 h-6" />}
                        title="Đang cập nhật liên kết"
                        description="IT sẽ bổ sung liên kết tới ứng dụng các phòng ban tại đây."
                      />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {deptLinks.map((lnk) => (
                          <a
                            key={lnk.url}
                            href={lnk.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-dark-elevated/40 hover:border-brand-primary hover:bg-brand-primary/5 transition-colors"
                          >
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary dark:text-brand-primary-300 shrink-0">
                              <ExternalLink className="w-4 h-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{lnk.label}</span>
                              {lnk.desc && <span className="block text-[10px] text-slate-400 truncate">{lnk.desc}</span>}
                            </span>
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {activeTab === 'DASHBOARD' && (
              <div className="space-y-6">
                {/* Year scope selector */}
                <div className="bg-white dark:bg-dark-card px-4 py-3 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-brand-accent dark:text-brand-accent-300" />
                    Phạm vi thống kê theo năm
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={dashboardYear}
                      onChange={(e) => setDashboardYear(e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated focus:ring-brand-accent"
                    >
                      <option value="ALL">-- Tất cả các năm --</option>
                      {dashboardYears.map(y => (
                        <option key={y} value={y}>Năm {y}</option>
                      ))}
                    </select>
                    <span className="text-[10px] bg-brand-accent/10 dark:bg-brand-accent/15 text-brand-accent dark:text-brand-accent-300 font-black px-2 py-1 rounded-lg">
                      {dashboardProjects.length} hồ sơ
                    </span>
                  </div>
                </div>

                <StatsDashboard
                  projects={dashboardProjects}
                  staff={kpiStaff}
                  currentUserRole={currentUser?.role}
                  currentUserId={currentUser?.staffId}
                />

                {currentUser.role === 'STAFF' ? (
                  /* STAFF PERSONAL WORKSPACE VIEW */
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                    {/* Left Columns: Assigned Tasks List */}
                    <div className="lg:col-span-2 space-y-4">
                      <MyTasksPanel
                        projects={rbacProjects}
                        currentUserId={currentUser.staffId}
                        personalOnly={true}
                        title="Danh sách tác vụ đấu thầu đang phụ trách"
                        subtitle="Các việc được giao đích danh cho bạn — cập nhật kết quả, % tiến độ và đánh dấu hoàn thành ngay tại đây."
                        onUpdateTasks={handleUpdateTasks}
                        onToggleTask={handleToggleSubtask}
                      />
                    </div>

                    {/* Right Column: Personal Instruction Guideline Card */}
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-brand-accent-800 to-brand-accent-950 text-white p-5 rounded-xl border border-white/10 shadow-md">
                        <h4 className="text-xs font-black uppercase tracking-wider text-brand-warning flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-brand-warning animate-pulse" />
                          HƯỚNG DẪN DÀNH CHO CHUYÊN VIÊN
                        </h4>
                        <p className="text-[10px] text-slate-300 mt-2 leading-relaxed font-medium">
                          Chào chuyên viên <strong>{currentUser.name}</strong>! Căn cứ quy chế phối hợp đóng thầu, hệ thống đã cấu hình bộ lọc phân quyền hạn chế ở cấp Level 3:
                        </p>
                        <div className="mt-4 space-y-3 text-[10.5px]">
                          <div className="flex gap-2 items-start bg-white/5 p-2 rounded-lg border border-white/5">
                            <span className="text-brand-success-300 font-extrabold text-xs">✓</span>
                            <span>Bạn chỉ có quyền xem &amp; tương tác các tác vụ trực thuộc các hồ sơ thầu được giao trực tiếp.</span>
                          </div>
                          <div className="flex gap-2 items-start bg-white/5 p-2 rounded-lg border border-white/5">
                            <span className="text-brand-success-300 font-extrabold text-xs">✓</span>
                            <span>Vui lòng click <strong>&quot;ĐÁNH DẤU XONG&quot;</strong> khi hoàn thành từng giai đoạn nhỏ để hệ thống tính điểm KPI lũy tiến tự động.</span>
                          </div>
                          <div className="flex gap-2 items-start bg-white/5 p-2 rounded-lg border border-white/5">
                            <span className="text-brand-success-300 font-extrabold text-xs">✓</span>
                            <span>Mọi vấn đề về dời lịch hoặc điều chỉnh hạn mời thầu gốc, vui lòng liên hệ trực tiếp với Quản lý của bạn.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* STANDARD MANAGER & BOOD VISUAL WORKSPACE VIEW */
                  <div className="space-y-6 animate-fade-in">
                    {/* 0. Danh sách tác vụ cá nhân dành cho Quản lý (Level 2) — cập nhật nhanh không cần mở từng dự án */}
                    {currentUser.role === 'MANAGER' && (
                      <MyTasksPanel
                        projects={rbacProjects}
                        currentUserId={currentUser.staffId}
                        personalOnly={true}
                        title="Danh sách tác vụ cá nhân của Quản lý"
                        subtitle="Các tác vụ được giao đích danh cho bạn trên mọi dự án — cập nhật kết quả & tiến độ nhanh tại đây."
                        onUpdateTasks={handleUpdateTasks}
                        onToggleTask={handleToggleSubtask}
                      />
                    )}

                    {/* 1. Tender Status Summary (Polite and professional header) */}
                    <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                          <AlertCircle className="text-brand-warning w-4 h-4 animate-pulse" />
                          TỔNG HỢP TÌNH TRẠNG CÁC HỒ SƠ ĐẤU THẦU
                        </h3>
                        {/* Nút lọc: ẩn bớt hồ sơ đã hoàn thành */}
                        <StatusFilterPills value={projStatusFilter} onChange={setProjStatusFilter}
                          counts={{ active: dashboardProjects.filter(x => !isWorkDone(x)).length, done: dashboardProjects.filter(isWorkDone).length, all: dashboardProjects.length }} />
                      </div>

                      {/* Khung cao ~5 hồ sơ (chị chốt 15/07) — còn lại trượt xuống; đang làm + hạn thầu gần lên trước */}
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-128 md:max-h-104 overflow-y-auto overflow-x-hidden pr-1">
                        {(() => {
                          const sortedDashList = [...applyStatusFilter(dashboardProjects, isWorkDone)].sort((a, b) => {
                            const aDone = isWorkDone(a), bDone = isWorkDone(b);
                            if (aDone !== bDone) return aDone ? 1 : -1; // đang làm lên trước
                            return getTenderDeadline(a).getTime() - getTenderDeadline(b).getTime(); // hạn thầu gần lên trước, hạn xa trượt xuống
                          });
                          return sortedDashList.length === 0 ? (
                          <EmptyState
                            icon={<CheckCircle className="w-6 h-6" />}
                            title="Không có gói thầu phù hợp"
                            description={projStatusFilter === 'DONE' ? 'Chưa có hồ sơ nào hoàn thành.' : projStatusFilter === 'ACTIVE' ? 'Không có hồ sơ nào đang thực hiện.' : 'Hiện tại không có gói thầu nào được ghi nhận trong cơ sở dữ liệu.'}
                          />
                        ) : (
                          sortedDashList.map(p => {
                            const delayDays = p.delayLogs?.reduce((acc, curr) => acc + curr.soNgayLech, 0) || 0;
                            return (
                              <div
                                key={p.id}
                                onClick={() => { setActiveTab('PROJECTS'); setExpandedProjectId(p.id); }}
                                title="Bấm để xem chi tiết gói thầu, tiến độ và KPI công việc con"
                                className="py-3 px-2 -mx-2 flex items-start justify-between gap-4 lg:grid lg:grid-cols-[22rem_1fr_auto] lg:items-center cursor-pointer rounded-lg hover:bg-brand-accent/10 dark:hover:bg-brand-accent/5 transition-colors"
                              >
                                <div className="space-y-1.5 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] font-extrabold text-brand-accent dark:text-brand-accent-300 bg-brand-accent/10 dark:bg-brand-accent/15 px-1.5 py-0.5 rounded uppercase font-mono">
                                      ID: {p.projectId}
                                    </span>
                                    {/* HẠNG MỤC — thông tin trọng yếu, hiển thị nổi bật */}
                                    <span className="text-[10px] font-black uppercase tracking-wide bg-brand-accent text-white px-2 py-0.5 rounded-md shadow-2xs">
                                      {p.hangMuc}
                                    </span>
                                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{p.tenDuAn}</h4>
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                                    {delayDays > 0 && (
                                      <span className="text-brand-warning dark:text-brand-warning font-bold bg-brand-warning/10 dark:bg-brand-warning/10 px-1.5 py-0.5 rounded">
                                        Đã dời hạn {p.delayLogs.length} lần (+{delayDays} ngày)
                                      </span>
                                    )}
                                  </div>
                                  {p.nguyenNhanTreHan && (
                                    <p className="text-[10px] bg-brand-danger/10 dark:bg-brand-danger/10 text-brand-danger dark:text-brand-danger p-2 rounded-lg border border-brand-danger/15 dark:border-brand-danger/25 italic mt-1.5">
                                      <strong>Nguyên nhân trễ:</strong> {p.nguyenNhanTreHan}
                                    </p>
                                  )}
                                </div>
                                {/* Tiến độ PHÒNG duyệt (%) — lấp khoảng trống giữa dòng, nhìn nhanh mức TP đã kiểm */}
                                <div className="hidden md:flex flex-col justify-center flex-1 max-w-[240px] px-2 gap-1 self-center">
                                  <div className="flex items-center justify-between text-[9px] font-bold">
                                    <span className="text-slate-400 uppercase tracking-wider">Tiến độ Phòng duyệt</span>
                                    <span className={`text-[11px] font-black ${(p.tienDoPhong || 0) >= 100 ? 'text-brand-success dark:text-brand-success-300' : 'text-brand-accent dark:text-brand-accent-300'}`}>{p.tienDoPhong || 0}%</span>
                                  </div>
                                  <div className="h-2 bg-slate-100 dark:bg-dark-elevated rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${(p.tienDoPhong || 0) >= 100 ? 'bg-brand-success' : 'bg-brand-accent'}`} style={{ width: `${p.tienDoPhong || 0}%` }} />
                                  </div>
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-1.5">
                                  {getStatusBadge(p.trangThai)}
                                  {/* HẠN THẦU — thông tin trọng yếu, hiển thị nổi bật (đỏ khi đã quá hạn) */}
                                  {(() => {
                                    const qua = p.trangThai === 'DANG_THUC_HIEN' && getTenderDeadline(p).getTime() < Date.now();
                                    return (
                                      <span className={`text-[11px] font-black px-2 py-1 rounded-lg border flex items-center gap-1 ${
                                        qua ? 'bg-brand-danger/10 text-brand-danger border-brand-danger/25 dark:bg-brand-danger/10 dark:text-brand-danger dark:border-brand-danger/20'
                                            : 'bg-brand-primary/10 text-brand-primary border-brand-primary/25 dark:bg-brand-primary/10 dark:text-brand-primary-300 dark:border-brand-primary/20'
                                      }`}>
                                        ⏰ Hạn thầu: {fmtDateVN(getTenderDeadline(p))}{qua ? ' — QUÁ HẠN' : ''}
                                      </span>
                                    );
                                  })()}
                                  {p.hanHenCDT && (
                                    <span className="text-[9px] font-bold text-brand-accent dark:text-brand-accent-300">🤝 Hẹn CĐT: {fmtDateVN(p.hanHenCDT)}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        );
                        })()}
                      </div>
                    </div>

                    {/* 3. KPI Leaderboard (Repositioned to the bottom and structured horizontally) */}
                    <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Bảng Xếp Hạng KPI Đấu Thầu ({kpiStaff.length} Nhân sự)
                          {currentUser?.role === 'MANAGER' && <span className="ml-1 text-[9px] font-bold text-slate-400 normal-case">· bản thân + thành viên dự án bạn chủ trì</span>}
                        </h3>
                        {currentUser?.role === 'BOOD' && (
                          <span className="text-xs text-brand-accent dark:text-brand-accent-300 font-bold hover:underline cursor-pointer" onClick={() => setActiveTab('STAFF')}>Xem chi tiết</span>
                        )}
                      </div>

                      {/* Mobile <768px: hiện ~3 người, còn lại trượt xuống (chị chốt 15/07); md+: lưới đầy đủ */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-h-60 overflow-y-auto md:max-h-none md:overflow-visible pr-1 md:pr-0">
                        {[...kpiStaff].sort((a,b) => b.kpiDiem - a.kpiDiem).map((member, index) => (
                          <div key={member.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-dark-bg/40 rounded-xl border border-slate-200/40 dark:border-slate-800/60">
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                {member.avatar && member.avatar.startsWith('data:') ? (
                                  <img 
                                    src={member.avatar} 
                                    alt={member.hoTen}
                                    className="w-10 h-10 rounded-full border border-slate-100 dark:border-slate-800 object-cover"
                                  />
                                ) : (
                                  <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-xs font-black uppercase ${getInitialsColor(member.hoTen)}`}>
                                    {getInitials(member.hoTen)}
                                  </div>
                                )}
                                <span className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center border shadow-sm ${
                                  index === 0 ? 'bg-brand-warning text-slate-900 border-brand-warning/50' :
                                  index === 1 ? 'bg-slate-300 text-slate-800 border-slate-200' :
                                  index === 2 ? 'bg-brand-warning/70 text-slate-900 border-brand-warning/40' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-dark-elevated dark:text-slate-400'
                                }`}>
                                  #{index + 1}
                                </span>
                              </div>
                              <div className="truncate max-w-[120px]">
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{member.hoTen}</h4>
                                <span className="text-[9px] text-slate-400 block truncate">{member.chucVu}</span>
                              </div>
                            </div>
                            <span className={`text-xs font-black px-2 py-1 rounded-lg shrink-0 ${
                              member.kpiDiem >= 90 ? 'bg-brand-success/10 text-brand-success dark:bg-brand-success/10 dark:text-brand-success-300' :
                              member.kpiDiem >= 80 ? 'bg-brand-accent/10 text-brand-accent dark:bg-brand-accent/15 dark:text-brand-accent-300' : 'bg-brand-warning/10 text-brand-warning dark:bg-brand-warning/10 dark:text-brand-warning'
                            }`}>
                              {member.kpiDiem} đ
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. PROJECTS REPORT LIST VIEW */}
            {activeTab === 'PROJECTS' && (
              <div className="space-y-4">
                
                {/* Filters section */}
                <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Search bar */}
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text"
                        aria-label="Tìm kiếm hồ sơ thầu"
                        placeholder="Tìm kiếm theo Tên thầu, Mã dự án thầu, nội dung bóc BOQ..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium focus:ring-brand-accent text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Filter by Status */}
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full sm:w-auto px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-dark-card"
                      >
                        <option value="ALL">-- Tất cả Trạng thái --</option>
                        <option value="DANG_THUC_HIEN">Đang lập thầu</option>
                        <option value="HOAN_THANH_DUNG_HAN">Đúng hạn thầu</option>
                        <option value="HOAN_THANH_TRE_HAN">Hoàn thành trễ</option>
                        <option value="TRE_TIEN_DO">Quá hạn hồ sơ</option>
                      </select>

                      {/* Filter by Category */}
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full sm:w-auto px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-dark-card"
                      >
                        <option value="ALL">-- Tất cả Hạng mục --</option>
                        <option value="Báo giá chi tiết">Báo giá chi tiết</option>
                        <option value="Khái toán">Khái toán</option>
                        <option value="Báo giá phát sinh">Báo giá phát sinh</option>
                        <option value="Cải tạo">Cải tạo</option>
                        <option value="VE">VE</option>
                        <option value="Lập hồ sơ thầu">Lập hồ sơ thầu</option>
                      </select>

                      {/* Filter by Staff */}
                      <select
                        value={filterStaff}
                        onChange={(e) => setFilterStaff(e.target.value)}
                        className="w-full sm:w-auto px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-dark-card"
                      >
                        <option value="ALL">-- Tất cả Nhân sự --</option>
                        {staff.map(s => (
                          <option key={s.id} value={s.id}>{s.hoTen} ({s.chucVu}){s.daNghi ? ' — Đã nghỉ' : ''}</option>
                        ))}
                      </select>

                      {/* Secure Exports Group */}
                      <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-800 pl-3">
                        {currentUser?.role === 'BOOD' && (
                          <button
                            onClick={() => setShowImportPanel(!showImportPanel)}
                            className="px-3 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                            title="Nhập dữ liệu dự án thầu từ file Excel chuẩn"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Nhập Excel
                          </button>
                        )}

                        <button
                          onClick={handleExportExcel}
                          className="px-3 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Xuất file Excel bảo mật theo phân quyền người dùng"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Xuất Excel
                        </button>

                        <button
                          onClick={handleExportStrategicReport}
                          className="px-3 py-2 bg-brand-accent hover:bg-brand-accent-hover text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                          title="Xuất file báo cáo thống kê mục tiêu chiến lược năm 2026 chuẩn Mẫu số 1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          📑 Báo cáo Chiến lược
                        </button>

                      </div>
                    </div>
                  </div>

                  {/* Date range filter and secure excel import layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/80">
                    {/* Date Picker inputs */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Khoảng ngày:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <DateInput
                          value={startDateFilter}
                          onChange={(v) => {
                            setStartDateFilter(v);
                            handleDateRangeFilter(v, endDateFilter);
                          }}
                          className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-dark-bg focus:ring-brand-accent focus:outline-hidden w-28"
                          title="Từ ngày bắt đầu"
                        />
                        <span className="text-slate-400 text-[10px]">đến</span>
                        <DateInput
                          value={endDateFilter}
                          onChange={(v) => {
                            setEndDateFilter(v);
                            handleDateRangeFilter(startDateFilter, v);
                          }}
                          className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-dark-bg focus:ring-brand-accent focus:outline-hidden w-28"
                          title="Đến ngày hoàn thành"
                        />
                        {(startDateFilter || endDateFilter) && (
                          <button
                            onClick={() => {
                              setStartDateFilter('');
                              setEndDateFilter('');
                              setApiFilteredProjects(null);
                              triggerToast("Đã xóa bộ lọc khoảng ngày.");
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-dark-elevated dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded text-[10px] font-bold transition-all"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Fast filter statistics pills */}
                  <div className="flex items-center gap-2 text-xs text-slate-400 pt-1 flex-wrap font-medium">
                    <span>Lọc nhanh:</span>
                    <button 
                      onClick={() => { setFilterStatus('ALL'); setFilterCategory('ALL'); setFilterStaff('ALL'); setSearchQuery(''); }}
                      className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-dark-elevated dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-all"
                    >
                      Xóa bộ lọc
                    </button>
                    <button 
                      onClick={() => setFilterStatus('TRE_TIEN_DO')}
                      className="px-2.5 py-1 rounded-full bg-brand-danger/15 hover:bg-brand-danger/25 dark:bg-brand-danger/10 dark:hover:bg-brand-danger/20 text-brand-danger dark:text-brand-danger font-bold transition-all"
                    >
                      Đang trễ hạn thầu ({rbacProjects.filter(p=>p.trangThai==='TRE_TIEN_DO').length})
                    </button>
                    <button 
                      onClick={() => setFilterCategory('Báo giá chi tiết')}
                      className="px-2.5 py-1 rounded-full bg-brand-accent/10 hover:bg-brand-accent/20 dark:bg-brand-accent/15 dark:hover:bg-brand-accent/20 text-brand-accent dark:text-brand-accent-300 font-bold transition-all"
                    >
                      Báo giá chi tiết ({rbacProjects.filter(p=>p.hangMuc==='Báo giá chi tiết').length})
                    </button>
                  </div>
                </div>

                {/* Danh sách DỰ ÁN CHA: CHỈ Trưởng phòng (Level 1) thấy — xem thông tin, sửa, xóa */}
                {currentUser.role === 'BOOD' && parentProjects.length > 0 && (
                  <div className="bg-white dark:bg-dark-card p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-brand-accent dark:text-brand-accent-300" />
                        Danh sách Dự án ({applyStatusFilter(parentProjects, isParentDone).length}/{parentProjects.length})
                      </h3>
                      {/* Nút lọc trạng thái dự án */}
                      <StatusFilterPills value={projStatusFilter} onChange={setProjStatusFilter}
                        counts={{ active: parentProjects.filter(x => !isParentDone(x)).length, done: parentProjects.filter(isParentDone).length, all: parentProjects.length }} />
                    </div>
                    {applyStatusFilter(parentProjects, isParentDone).length === 0 ? (
                      <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 py-4 italic">Không có dự án nào ở trạng thái này.</p>
                    ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {applyStatusFilter(parentProjects, isParentDone).map(dp => {
                        const childCount = projects.filter(p => p.duAnChaId === dp.id).length;
                        return (
                          <div key={dp.id} className="bg-slate-50/70 dark:bg-dark-bg/40 border border-slate-200/70 dark:border-slate-800 rounded-lg p-3 flex flex-col gap-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-mono font-black bg-slate-200/70 dark:bg-dark-elevated text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded shrink-0">{dp.projectId}</span>
                                  <span className="text-[9px] font-black bg-brand-accent/10 text-brand-accent dark:bg-brand-accent/15 dark:text-brand-accent-300 px-1.5 py-0.5 rounded-full shrink-0">{childCount} công việc</span>
                                </div>
                                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1 leading-tight">📁 {dp.tenDuAn}</h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1" title={`${dp.chuDauTu || 'Chưa có CĐT'} • ${dp.diaChi || 'Chưa có địa chỉ'}`}>
                                  {dp.chuDauTu || 'Chưa có CĐT'}{dp.diaChi ? ` • ${dp.diaChi}` : ''}
                                </p>
                              </div>
                              {currentUser.role === 'BOOD' && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleEditClick(dp)}
                                    title="Sửa thông tin dự án"
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-brand-accent hover:bg-brand-accent/10 dark:text-brand-accent-300 dark:hover:bg-brand-accent/20 transition-colors"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteParent(dp)}
                                    title={childCount > 0 ? `Xóa dự án (kèm ${childCount} công việc con)` : 'Xóa dự án'}
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-brand-danger hover:bg-brand-danger/10 dark:text-brand-danger dark:hover:bg-brand-danger/20 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                )}

                {/* Excel Import Panel with Drag-and-Drop Dropzone & Error/Rollback display */}
                {showImportPanel && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-dark-card p-5 rounded-xl border border-brand-accent/30 dark:border-brand-accent/30 shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Upload className="w-5 h-5 text-brand-accent dark:text-brand-accent-300" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          Nhập Dự Án từ File Excel (.xlsx) hoặc CSV Kinh Doanh (Template 2)
                        </h4>
                      </div>
                      <button 
                        onClick={handleDownloadTemplate}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-dark-elevated dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Tải Mẫu Chuẩn HP-CONS
                      </button>
                    </div>

                    <div 
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-brand-accent', 'bg-brand-accent/5'); }}
                      onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-brand-accent', 'bg-brand-accent/5'); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('border-brand-accent', 'bg-brand-accent/5');
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleFileUpload(e.dataTransfer.files[0]);
                        }
                      }}
                      className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-brand-accent-400 dark:hover:border-brand-accent-900 rounded-xl p-8 text-center transition-all cursor-pointer relative"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.xlsx, .xls, .csv';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleFileUpload(file);
                        };
                        input.click();
                      }}
                    >
                      {isImporting ? (
                        <div className="space-y-2 py-4">
                          <RefreshCw className="w-8 h-8 text-brand-accent dark:text-brand-accent-300 animate-spin mx-auto" />
                          <p className="text-xs font-bold text-brand-accent dark:text-brand-accent-300 animate-pulse">
                            Đang bóc tách dữ liệu & thực hiện kiểm duyệt quy trình...
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 py-4">
                          <Upload className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Kéo thả file Excel (.xlsx) hoặc CSV kinh doanh vào đây hoặc <span className="text-brand-accent dark:text-brand-accent-300 hover:underline">nhấp để duyệt</span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Hỗ trợ Template 2 từ kinh doanh (Mã DA, Chủ đầu tư, KCN, Giai đoạn...). Các cột giá trị tiền sẽ tự động bị bỏ qua để bảo mật.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Detailed validation errors and rollback confirmation log */}
                    {validationErrors.length > 0 && (
                      <div className="space-y-2.5 p-4 bg-brand-danger/10 dark:bg-brand-danger/10 border border-brand-danger/25 dark:border-brand-danger/25 rounded-xl">
                        <div className="flex items-start gap-2 text-brand-danger dark:text-brand-danger">
                          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                          <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider">
                              CẢNH BÁO: Lỗi kiểm soát form - Giao dịch đấu thầu bị HỦY!
                            </h5>
                            <p className="text-[11px] mt-0.5 text-brand-danger dark:text-brand-danger">
                              Dữ liệu đã tự động **ROLLBACK** về trạng thái an toàn gần nhất. Hãy chỉnh sửa các lỗi sau trong file Excel của bạn:
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto border border-brand-danger/20 dark:border-brand-danger/20 rounded-lg max-h-48 overflow-y-auto">
                          <table className="w-full text-left text-[11px] border-collapse bg-white dark:bg-dark-card/50">
                            <thead>
                              <tr className="bg-brand-danger/15 dark:bg-brand-danger/20 text-brand-danger dark:text-brand-danger text-[10px] uppercase font-bold tracking-wider">
                                <th className="p-2 border-b border-brand-danger/20 dark:border-brand-danger/20 text-center w-14">Dòng</th>
                                <th className="p-2 border-b border-brand-danger/20 dark:border-brand-danger/20 w-24">Cột / Trường</th>
                                <th className="p-2 border-b border-brand-danger/20 dark:border-brand-danger/20 max-w-xs truncate">Giá trị lỗi</th>
                                <th className="p-2 border-b border-brand-danger/20 dark:border-brand-danger/20">Chi tiết lý do từ chối</th>
                              </tr>
                            </thead>
                            <tbody>
                              {validationErrors.map((err, idx) => (
                                <tr key={idx} className="hover:bg-brand-danger/5 dark:hover:bg-brand-danger/10 text-slate-700 dark:text-slate-300 border-b border-brand-danger/15 dark:border-brand-danger/10">
                                  <td className="p-2 font-bold text-center text-brand-danger dark:text-brand-danger">{err.row}</td>
                                  <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">{err.col}</td>
                                  <td className="p-2 font-mono text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">{String(err.val !== undefined ? err.val : '')}</td>
                                  <td className="p-2 text-brand-danger dark:text-brand-danger font-medium">{err.msg}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Table list of projects */}
                <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
                  {/* Nút lọc trạng thái công việc (Level 1+2) — cùng bộ với danh sách Dự án cha */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <ListTodo className="w-4 h-4 text-brand-accent dark:text-brand-accent-300" />
                      Danh sách Công việc ({applyStatusFilter(filteredProjects, isWorkDone).length}/{filteredProjects.length})
                    </h3>
                    <StatusFilterPills value={projStatusFilter} onChange={setProjStatusFilter}
                      counts={{ active: filteredProjects.filter(x => !isWorkDone(x)).length, done: filteredProjects.filter(isWorkDone).length, all: filteredProjects.length }} />
                  </div>
                  {applyStatusFilter(filteredProjects, isWorkDone).length === 0 ? (
                    <EmptyState
                      icon={<Info className="w-6 h-6" />}
                      title="Không tìm thấy dự án thầu"
                      description="Không có dự án thầu nào phù hợp với điều kiện phân quyền và bộ lọc hiện tại."
                    />
                  ) : (
                    <div className="md:overflow-x-auto">
                      {/* Mobile <768px: bảng reflow thành Card List (luật 9 — cùng DOM, không nhân đôi logic); md+: bảng đầy đủ như cũ */}
                      <table className="w-full text-left text-xs border-collapse block md:table">
                        <thead className="hidden md:table-header-group">
                          <tr className="bg-slate-900 text-white uppercase text-[9px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                            {/* Expand toggle column */}
                            <th className="p-3 w-8 text-center"></th>
                            <th className="p-3 font-bold text-center w-20">Mã Dự Án</th>
                            <th className="p-3 font-bold w-[32%]">Thông Tin Gói Thầu / Dự Án</th>
                            <th className="p-3 font-bold w-40">Nhân Sự Trách Nhiệm (Lookup)</th>
                            <th className="p-3 font-bold w-48">Thời Hạn Đấu Thầu</th>
                            <th className="p-3 font-bold text-center w-28">Độ Trễ</th>
                            <th className="p-3 font-bold w-52 text-center">Tiến Độ Phòng/Ban</th>
                            <th className="p-3 font-bold text-center w-[1%] whitespace-nowrap">Tình Hình Dự Án</th>
                            <th className="p-3 font-bold text-center w-24">Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody className="block md:table-row-group divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-600 dark:text-slate-300">
                          {applyStatusFilter(filteredProjects, isWorkDone).map((p) => {
                            const isExpanded = expandedProjectId === p.id;
                            const manager = staff.find(s => s.id === p.quanLyId);
                            const implementer = staff.find(s => s.id === p.thucHienId);
                            const totalOffsets = p.delayLogs.reduce((sum, curr) => sum + curr.soNgayLech, 0);

                            // Collect all personnel involved
                            const otherPersonnel = staff.filter(s => p.thucHienIds?.includes(s.id) && s.id !== p.thucHienId);

                            return (
                              <React.Fragment key={p.id}>
                                <tr 
                                  onClick={(e) => {
                                    const target = e.target as HTMLElement;
                                    if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('select')) {
                                      return;
                                    }
                                    toggleRowExpand(p.id);
                                  }}
                                  className={`grid grid-cols-2 gap-x-2 items-start md:table-row relative py-2 md:py-0 hover:bg-slate-50/50 dark:hover:bg-dark-elevated/20 cursor-pointer transition-colors ${isExpanded ? 'bg-brand-accent/5 dark:bg-brand-accent/5 font-semibold text-slate-900 dark:text-white' : ''}`}
                                >
                                  {/* Expand Toggle Button — mobile ẩn (chạm cả hàng để mở rộng) */}
                                  <td className="hidden md:table-cell p-3 text-center">
                                    <button 
                                      onClick={() => toggleRowExpand(p.id)}
                                      className="p-1 hover:bg-slate-100 dark:hover:bg-dark-elevated rounded transition-colors"
                                      title={isExpanded ? "Thu gọn ghi chú" : "Xem nhanh tác vụ & ghi chú chi tiết"}
                                    >
                                      {isExpanded ? <ChevronUp className="w-4 h-4 text-brand-accent" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                    </button>
                                  </td>

                                  {/* Mã Dự Án (Project_ID in format YYYY.NN) */}
                                  <td className="col-span-2 block md:table-cell px-4 pt-3 pb-0 md:p-3 text-left md:text-center font-mono font-bold text-slate-900 dark:text-slate-100 md:bg-slate-50/30 md:dark:bg-dark-card/30">
                                    {p.projectId}
                                  </td>

                                  {/* Project Info (Optimized desktop width & responsive truncation) */}
                                  <td className="col-start-1 row-start-2 block md:table-cell px-4 py-1.5 md:p-3 md:min-w-[210px] md:max-w-sm">
                                    <div>
                                      <span className="text-[9px] font-extrabold uppercase bg-brand-accent/10 dark:bg-brand-accent/15 text-brand-accent dark:text-brand-accent-300 px-1.5 py-0.5 rounded">
                                        {p.hangMuc}
                                      </span>
                                      <h4 className="text-[13px] font-bold text-slate-900 dark:text-white mt-1 leading-snug">
                                        {p.tenDuAn}
                                      </h4>
                                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                                        {p.moTa && (
                                          <span className="text-slate-400 truncate max-w-[200px]" title={p.moTa}>{p.moTa}</span>
                                        )}
                                        {p.oneDriveLink && (
                                          <a 
                                            href={p.oneDriveLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 bg-brand-accent/10 hover:bg-brand-accent/20 dark:bg-brand-accent/15 dark:hover:bg-brand-accent/20 text-brand-accent dark:text-brand-accent-300 font-extrabold px-2 py-0.5 rounded text-[9px] transition-all"
                                            title="Mở thư mục hồ sơ đấu thầu OneDrive"
                                          >
                                            <Cloud className="w-3 h-3 text-brand-accent dark:text-brand-accent-300" />
                                            OneDrive Link
                                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Assigned Staff (Unified Manager & Implementers list) */}
                                  <td className="col-start-1 row-start-3 block md:table-cell px-4 py-1.5 md:p-3">
                                    <div className="space-y-1 text-slate-700 dark:text-slate-300 text-[11px]">
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <span className="text-[9px] bg-slate-100 dark:bg-dark-elevated text-slate-500 px-1 rounded font-bold">QL</span>
                                        <span className="font-semibold">{manager ? `${manager.hoTen}${manager.daNghi ? ' (Đã nghỉ)' : ''}` : 'Chưa gán'}</span>
                                        {(p.quanLyIdsPhu || []).length > 0 && (
                                          <span className="text-[9px] bg-brand-primary/10 text-brand-primary dark:text-brand-primary-300 px-1 rounded font-bold" title={`Quản lý phụ/kế thừa: ${(p.quanLyIdsPhu || []).map(id => staff.find(s => s.id === id)?.hoTen).filter(Boolean).join(', ')}`}>+{(p.quanLyIdsPhu || []).length} phụ</span>
                                        )}
                                      </div>
                                      {p.thucHienIds && p.thucHienIds.length > 0 ? (
                                        <div className="flex items-center gap-1">
                                          <span className="text-[9px] bg-brand-accent/10 dark:bg-brand-accent/15 text-brand-accent px-1 rounded font-bold">TH</span>
                                          <span className="font-semibold truncate max-w-[140px]" title={staff.filter(s => p.thucHienIds?.includes(s.id)).map(s => s.hoTen).join(', ')}>
                                            {staff.filter(s => p.thucHienIds?.includes(s.id)).map(s => s.hoTen.split(' ').pop()).join(', ')}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <span className="text-[9px] bg-brand-accent/10 dark:bg-brand-accent/15 text-brand-accent px-1 rounded font-bold">TH</span>
                                          <span className="font-semibold text-slate-400">Chưa gán</span>
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  {/* Thời hạn tách 3 mốc: Bộ phận (BĐ → KT) · Phòng (KT sau TP duyệt) · Hẹn CĐT (nếu có) */}
                                  <td className="col-start-1 row-start-4 block md:table-cell px-4 py-1.5 md:p-3 whitespace-nowrap">
                                    {(() => {
                                      const fmtD = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                                      const start = new Date(p.ngayBatDau);
                                      const bpEnd = new Date(start); bpEnd.setDate(bpEnd.getDate() + (p.soNgayThucHien ?? Math.max(1, (p.soNgayDuKien || 1) - 1)));
                                      const phongEnd = getDeptDeadline(p);
                                      return (
                                        <div className="space-y-1 text-[11px] whitespace-nowrap">
                                          <div className="flex items-center gap-1 text-brand-accent dark:text-brand-accent-300 font-bold" title="Chặng Bộ phận thực hiện: ngày bắt đầu → ngày kết thúc">
                                            🛠️ BP: <strong>{fmtD(start)} → {fmtD(bpEnd)}</strong>
                                          </div>
                                          <div className="flex items-center gap-1 text-brand-warning dark:text-brand-warning font-bold" title="Hạn Phòng: thời điểm Trưởng phòng duyệt xong">
                                            🏢 Phòng: <strong>{fmtD(phongEnd)}</strong>
                                          </div>
                                          <div className={`flex items-center gap-1 font-bold ${p.hanHenCDT ? 'text-brand-primary dark:text-brand-primary-300' : 'text-slate-400 dark:text-slate-500'}`} title="Thời hạn đã hẹn với Chủ đầu tư (nhập ở form sửa công việc)">
                                            🤝 Hẹn CĐT: <strong>{fmtDateVN(p.hanHenCDT) || '—'}</strong>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </td>

                                  {/* Delays (Auto-Offset status) */}
                                  <td className="col-start-2 row-start-4 block md:table-cell px-4 py-1.5 md:p-3 text-right md:text-center">
                                    {p.delayLogs && p.delayLogs.length > 0 ? (
                                      <div className="inline-flex flex-col items-center">
                                        <span className="bg-brand-warning/15 dark:bg-brand-warning/10 text-brand-warning dark:text-brand-warning text-[10px] px-2 py-0.5 rounded font-extrabold border border-brand-warning/25 dark:border-brand-warning/20 whitespace-nowrap">
                                          {p.delayLogs.length} lần dời
                                        </span>
                                        <span className="text-[10px] text-brand-warning dark:text-brand-warning font-bold mt-1 whitespace-nowrap">
                                          (+{totalOffsets} ngày trễ)
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 dark:text-slate-500 text-[11px] italic whitespace-nowrap">Bám sát tiến độ</span>
                                    )}
                                  </td>

                                  {/* Dual progress bars */}
                                  <td className="col-start-2 row-start-3 block md:table-cell px-4 py-1.5 md:p-3">
                                    <div className="space-y-2 max-w-[190px] ml-auto md:mx-auto">
                                      {currentUser?.role === 'STAFF' ? (
                                        <div className="text-center py-2 px-3 bg-slate-50 dark:bg-dark-card/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                          <Lock className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
                                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">🔒 Bảo mật</span>
                                        </div>
                                      ) : (
                                        <>
                                          {/* Team level */}
                                          <div>
                                            <div className="flex items-center justify-between text-[11px] mb-0.5 whitespace-nowrap gap-2">
                                              <span className="text-brand-accent dark:text-brand-accent-300 font-bold">Bộ phận:</span>
                                              <span className="font-extrabold text-brand-accent dark:text-brand-accent-300">{p.tienDoBoPhan}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-dark-elevated h-1.5 rounded-full overflow-hidden">
                                              <div style={{ width: `${p.tienDoBoPhan}%` }} className="h-full bg-brand-accent rounded-full" />
                                            </div>
                                          </div>

                                          {/* Dept level */}
                                          <div>
                                            <div className="flex items-center justify-between text-[11px] mb-0.5 whitespace-nowrap gap-2">
                                              <span className="text-brand-success dark:text-brand-success-300 font-bold">Phòng duyệt:</span>
                                              <span className="font-extrabold text-brand-success dark:text-brand-success-300">{p.tienDoPhong}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-dark-elevated h-1.5 rounded-full overflow-hidden">
                                              <div style={{ width: `${p.tienDoPhong}%` }} className="h-full bg-brand-success rounded-full" />
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </td>

                                  {/* Status badge - Min-content shrink optimized */}
                                  <td className="col-start-2 row-start-2 block md:table-cell px-4 py-1.5 md:p-3 text-right self-center md:text-center md:self-auto md:w-[1%] whitespace-nowrap">
                                    {getStatusBadge(p.trangThai)}
                                  </td>

                                  {/* Action Buttons — mobile: nổi góc phải trên (gọn thẻ); desktop: ô bảng bình thường */}
                                  <td className="absolute top-1.5 right-2 z-20 md:static block md:table-cell px-0 py-0 md:p-3 text-left md:text-center">
                                    <div className="flex items-center justify-end md:justify-center gap-1">
                                      {p.loaiBanGhi !== 'DU_AN' && currentUser.role !== 'STAFF' && (
                                        <button
                                          onClick={() => setCdtRevisionProject(p)}
                                          title="CĐT điều chỉnh — kéo tiến độ về bước trước, giữ việc đã xong, thêm việc mới"
                                          className="p-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 inline-flex items-center justify-center rounded-lg transition-colors border border-slate-100 dark:border-slate-800 text-brand-warning hover:bg-brand-warning/10 dark:text-brand-warning dark:hover:bg-brand-warning/20"
                                        >
                                          <RefreshCw className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleEditClick(p)}
                                        title={currentUser.role === 'STAFF' ? "Nhân viên không có quyền chỉnh sửa hồ sơ thầu" : "Chỉnh sửa hồ sơ"}
                                        disabled={currentUser.role === 'STAFF'}
                                        className={`p-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 inline-flex items-center justify-center rounded-lg transition-colors border border-slate-100 dark:border-slate-800 ${currentUser.role === 'STAFF' ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-brand-accent hover:bg-brand-accent/10 dark:text-brand-accent-300 dark:hover:bg-brand-accent/20'}`}
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      
                                      <button
                                        onClick={() => handleDeleteProject(p.id, p.tenDuAn)}
                                        title={currentUser.role !== 'BOOD' ? "Chỉ Trưởng phòng mới có quyền xóa" : "Xóa hồ sơ"}
                                        disabled={currentUser.role !== 'BOOD'}
                                        className={`p-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 inline-flex items-center justify-center rounded-lg transition-colors border border-slate-100 dark:border-slate-800 ${currentUser.role !== 'BOOD' ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-brand-danger hover:bg-brand-danger/10 dark:text-brand-danger dark:hover:bg-brand-danger/20'}`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {/* Nested Accordion Drawer for Expanded notes, comments, and task checklist */}
                                {isExpanded && (
                                  <tr key={`${p.id}-drawer`} className="block md:table-row bg-slate-50/60 dark:bg-dark-card/40 border-b border-slate-200/50 dark:border-slate-800/80">
                                    <td colSpan={9} className="block md:table-cell p-4 md:p-6">
                                      <div className="space-y-4">
                                        {/* Drawer = chế độ XEM; mọi chỉnh sửa đi qua nút ✏️ (mở form có nút Lưu) */}
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-dark-elevated/40 border border-slate-200/60 dark:border-slate-800 rounded-lg px-3 py-2">
                                          <Info className="w-3.5 h-3.5 shrink-0 text-brand-accent dark:text-brand-accent-300" />
                                          <span>Chế độ xem nhanh — muốn chỉnh sửa hoặc cập nhật kết quả, bấm nút <Edit2 className="w-3 h-3 inline text-brand-accent dark:text-brand-accent-300" /> ở cột Thao Tác để mở form và Lưu hồ sơ.</span>
                                        </div>
                                        {/* V1.1 §E2: Timeline Progress — dòng thời gian hạn thầu (thời gian đã dùng · còn lại) */}
                                        {p.ngayBatDau && (
                                          <div className="bg-white dark:bg-dark-card border border-slate-200/60 dark:border-slate-800 rounded-xl p-4">
                                            <span className="text-xs uppercase font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-2">
                                              <Clock className="w-4 h-4 text-brand-accent dark:text-brand-accent-300 shrink-0" />
                                              Dòng thời gian hạn thầu
                                            </span>
                                            <TimelineProgress
                                              startDate={p.ngayBatDau}
                                              endDate={ymdOf(getTenderDeadline(p))}
                                              isCompleted={isWorkDone(p)}
                                            />
                                          </div>
                                        )}
                                        {/* Official Project Information & Delay Logs (full width, stacked) */}
                                        <div className="space-y-4">
                                          {/* Official Project Information Card */}
                                          <div className="bg-white dark:bg-dark-card border border-slate-200/60 dark:border-slate-800 rounded-xl p-4 space-y-3">
                                            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-2">
                                              <span className="text-xs uppercase font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                <Briefcase className="w-4 h-4 text-brand-accent dark:text-brand-accent-300 shrink-0" />
                                                Thông tin chính thức dự án thầu
                                              </span>
                                              <span className="text-[9px] bg-brand-accent/10 dark:bg-brand-accent/15 text-brand-accent dark:text-brand-accent-300 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                                HP-CONS Spec
                                              </span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                                              <div className="space-y-1 bg-slate-50/50 dark:bg-dark-elevated/10 p-2 rounded-lg border border-slate-100/60 dark:border-slate-800/40">
                                                <span className="text-[9px] text-slate-400 uppercase font-bold block">Chủ đầu tư (CĐT)</span>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                  <span className="font-extrabold text-slate-950 dark:text-slate-100">{p.chuDauTu || 'Chưa cập nhật'}</span>
                                                  {p.quocTich && <span className="text-[9px] bg-brand-accent/10 dark:bg-brand-accent-950 text-brand-accent dark:text-brand-accent-300 px-1.5 py-0.2 rounded font-bold">{p.quocTich}</span>}
                                                </div>
                                              </div>

                                              <div className="space-y-1 bg-slate-50/50 dark:bg-dark-elevated/10 p-2 rounded-lg border border-slate-100/60 dark:border-slate-800/40">
                                                <span className="text-[9px] text-slate-400 uppercase font-bold block">Địa chỉ & Khu công nghiệp</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300 break-words">{p.diaChi || 'Chưa cập nhật'}</span>
                                                {(p.khuCongNghiep || p.tinhThanh) && (
                                                  <div className="text-[9px] text-slate-400 mt-0.5 font-medium">
                                                    {p.khuCongNghiep && <span>KCN: <strong className="dark:text-slate-300 font-bold">{p.khuCongNghiep}</strong></span>}
                                                    {p.tinhThanh && <span> {p.khuCongNghiep ? '•' : ''} Tỉnh/Thành: <strong className="dark:text-slate-300 font-bold">{p.tinhThanh}</strong></span>}
                                                  </div>
                                                )}
                                              </div>

                                              <div className="space-y-1 bg-slate-50/50 dark:bg-dark-elevated/10 p-2 rounded-lg border border-slate-100/60 dark:border-slate-800/40">
                                                <span className="text-[9px] text-slate-400 uppercase font-bold block">Loại hình & Quy mô xây dựng</span>
                                                <div className="space-y-0.5 text-slate-700 dark:text-slate-300 font-semibold">
                                                  <div>Loại công trình: <strong className="text-slate-950 dark:text-slate-100 font-bold">{p.loaiCongTrinh || 'Chưa cập nhật'}</strong></div>
                                                  <div>Hình thức xây mới: <strong className="text-slate-950 dark:text-slate-100 font-bold">{p.hinhThucXayDung || 'Chưa cập nhật'}</strong></div>
                                                  <div>Diện tích đất: <strong className="text-slate-950 dark:text-slate-100 font-bold">{p.dienTichDat ? `${p.dienTichDat.toLocaleString('vi-VN')} m²` : 'Chưa cập nhật'}</strong></div>
                                                </div>
                                              </div>

                                              <div className="space-y-1 bg-slate-50/50 dark:bg-dark-elevated/10 p-2 rounded-lg border border-slate-100/60 dark:border-slate-800/40">
                                                <span className="text-[9px] text-slate-400 uppercase font-bold block">Hình thức thầu & Thiết kế</span>
                                                <div className="space-y-0.5 text-slate-700 dark:text-slate-300 font-semibold">
                                                  <div>Hình thức đấu thầu: <strong className="text-slate-950 dark:text-slate-100 font-bold">{p.hinhThucDauThau || 'Chưa cập nhật'}</strong></div>
                                                  <div>Thiết kế hồ sơ: <strong className="text-slate-950 dark:text-slate-100 font-bold">{p.hoSoPhatThau || 'Chưa cập nhật'}</strong></div>
                                                  <div>Giai đoạn hồ sơ: <strong className="text-slate-950 dark:text-slate-100 font-bold">{p.giaiDoanDuAn || 'Chưa cập nhật'}</strong></div>
                                                </div>
                                              </div>

                                            </div>
                                          </div>

                                          {/* Description notes */}
                                          <div className="bg-white dark:bg-dark-card border border-slate-200/60 dark:border-slate-800 rounded-xl p-4 space-y-2">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Ghi chú &amp; Mô tả chi tiết gói thầu</span>
                                            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                              {p.moTa || 'Không có ghi chú mô tả cụ thể.'}
                                            </div>
                                          </div>

                                          {/* Kết quả + tiến độ cấp Phòng — CHỈ XEM tại drawer; sửa qua nút ✏️ mở form
                                              (chị chốt 15/07: tránh 2 đường sửa đá nhau) */}
                                          <PhongResultCard
                                            project={p}
                                            canEdit={false}
                                            hideNotes
                                            onSave={(td, kq) => handleUpdatePhongResult(p.id, td, kq)}
                                          />

                                          {/* Delay Logs details */}
                                          <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nhật ký dời lịch thầu (Delay Logs)</span>
                                            {p.delayLogs.length === 0 ? (
                                              <p className="text-[11px] text-slate-400 italic bg-white dark:bg-dark-card p-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                                                Gói thầu này bám sát tiến độ gốc, không dời mốc nộp hồ sơ.
                                              </p>
                                            ) : (
                                              <div className="bg-white dark:bg-dark-card border border-slate-200/60 dark:border-slate-800 rounded-xl overflow-x-auto">
                                                <table className="w-full text-left text-[11px]">
                                                  <thead>
                                                    <tr className="bg-slate-50 dark:bg-dark-elevated/50 text-slate-500 border-b border-slate-200/50 dark:border-slate-800 text-[9px] uppercase font-bold">
                                                      <th className="p-2">Ngày cập nhật</th>
                                                      <th className="p-2">Mốc mới</th>
                                                      <th className="p-2">Offset</th>
                                                      <th className="p-2">Lý do</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                                                    {p.delayLogs.map(log => (
                                                      <tr key={log.id}>
                                                        <td className="p-2">{fmtDateVN(log.ngayThayDoi)}</td>
                                                        <td className="p-2 font-bold text-brand-accent dark:text-brand-accent-300">{fmtDateVN(log.ngayMoi)}</td>
                                                        {/* Lệch hiển thị tính từ cặp hạn cũ/mới (log dời do kế hoạch có soNgayLech=0 tránh cộng trùng) */}
                                                        <td className="p-2 font-black text-brand-warning">+{Math.max(0, Math.round((new Date(log.ngayMoi).getTime() - new Date(log.ngayCu).getTime()) / 86400000))}d</td>
                                                        <td className="p-2 italic max-w-xs truncate" title={log.lyDo}>{log.lyDo}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                      </div>

                                      {/* Full-width: phân rã công việc con (tick · tỉ trọng · người giao · ngày · số ngày) GỘP sơ đồ Gantt */}
                                      <div className="mt-5 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-brand-accent dark:text-brand-accent-300" />
                                            Phân rã công việc con &amp; Sơ đồ Gantt (tiến độ Bộ phận tự động gộp: <strong className="text-brand-accent dark:text-brand-accent-300">{p.tienDoBoPhan}%</strong>)
                                          </span>
                                          <span className="text-[10px] bg-brand-accent/10 dark:bg-brand-accent/15 text-brand-accent dark:text-brand-accent-300 px-2 py-0.5 rounded font-black uppercase">
                                            Trực quan tiến độ
                                          </span>
                                        </div>
                                        {/* CHỈ XEM tại drawer — chỉnh sửa phân rã qua nút ✏️ mở form (chị chốt 15/07) */}
                                        <SubtaskGantt
                                          tasks={p.tasks && p.tasks.length > 0 ? p.tasks : DEFAULT_PROJECT_TASKS}
                                          staff={staff}
                                          projectStartDate={p.ngayBatDau}
                                          canEdit={false}
                                          isBOOD={currentUser?.role === 'BOOD'}
                                          hideFooter
                                          onChange={(updatedTasks) => handleUpdateTasks(p.id, updatedTasks)}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2b. KANBAN BOARD VIEW (7 bước quy trình thầu) */}
            {activeTab === 'KANBAN' && (
              <KanbanBoard
                projects={scheduledWorkItems}
                staff={staff}
                parentNameById={parentNameById}
                currentUserRole={currentUser?.role}
                onMove={handleKanbanMove}
                onDenied={(msg) => triggerToast(msg)}
                onOpenProject={(pid) => { setActiveTab('PROJECTS'); setExpandedProjectId(pid); }}
                onPullBackToStart={(pid) => setPullBackProject(projects.find(p => p.id === pid) || null)}
              />
            )}

            {/* 3. GANTT CHART VIEW */}
            {activeTab === 'GANTT' && (
              <GanttChart projects={scheduledWorkItems} staff={staff} currentUserRole={currentUser?.role} />
            )}

            {/* 4. STAFF KPI & LIST VIEW */}
            {activeTab === 'STAFF' && (
              <div className="space-y-6">
                
                {/* Info block about reward rules */}
                <div className="bg-brand-accent-900 text-white p-5 rounded-xl border border-white/10 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black uppercase tracking-wider text-brand-warning">
                      Cơ chế kiểm toán KPI Phòng Đấu Thầu (BPM-ERP Audit)
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                      Hệ thống tự động chấm điểm và đánh giá KPI của đội ngũ chuyên viên lập thầu định kỳ. 
                      Các dự án hoàn thành đúng thời hạn hoặc vượt mốc BOQ định mức mang lại hệ số đánh giá tối đa. 
                      Mọi dời hạn trễ không có lý do điều chỉnh sẽ khấu trừ trực tiếp vào thang KPI kiểm toán cuối kỳ.
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-4 bg-white/5 p-3 rounded-lg border border-white/10 text-xs">
                    <div>
                      <span className="block text-slate-400">Quy mô đội ngũ</span>
                      <strong className="text-white text-sm">{kpiStaff.length} Nhân Sự</strong>
                    </div>
                  </div>
                </div>

                {/* Staff list controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-dark-card p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Danh sách tài khoản &amp; KPI ({kpiStaff.length} nhân sự)
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Đại diện cho các thành viên HP CONS tham gia bóc tách BOQ và quản lý hồ sơ thầu. Bạn có thể tự do chỉnh sửa và thêm mới tài khoản đăng nhập cho quản lý &amp; nhân viên.
                    </p>
                  </div>
                  {(currentUser?.role === 'BOOD' || currentUser?.role === 'MANAGER') ? (
                    <button
                      onClick={() => setIsAddingStaff(true)}
                      className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-md hover:scale-102 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      {currentUser?.role === 'MANAGER' ? 'THÊM CHUYÊN VIÊN' : 'THÊM TÀI KHOẢN MỚI'}
                    </button>
                  ) : (
                    <div className="text-[10px] text-brand-warning italic font-medium max-w-xs text-right bg-brand-warning/10 px-3 py-1.5 rounded-lg border border-brand-warning/20">
                      🔒 Chỉ Trưởng phòng (Level 1) mới có quyền khởi tạo &amp; xóa tài khoản.
                    </div>
                  )}
                </div>

                {/* Staff Cards Grid — dùng kpiStaff (theo đội ngũ):
                    Trưởng phòng (L1) thấy tất cả; Quản lý (L2) chỉ thấy bản thân + nhân viên được gán
                    "Quản lý phụ trách" = mình; nhân viên chưa gán quản lý thì chỉ Trưởng phòng thấy. */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="staff-grid">
                  {kpiStaff.map(member => {
                    const progressOnTime = member.tiLeDungHan;
                    // Find projects assigned — Quản lý chỉ thấy dự án do chính mình quản lý
                    const memberProjects = projects.filter(p =>
                      (p.thucHienId === member.id || p.thucHienIds?.includes(member.id)) &&
                      (currentUser?.role !== 'MANAGER' || isProjectManager(p, currentUser.staffId))
                    );

                    return (
                      <div key={member.id} className="bg-white dark:bg-dark-card rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="space-y-4">
                          {/* Top row info */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div
                                className={`relative group shrink-0 ${currentUser?.role === 'BOOD' ? 'cursor-pointer' : ''}`}
                                onClick={() => { if (currentUser?.role === 'BOOD') setEditingStaff(member); }}
                                title={currentUser?.role === 'BOOD' ? 'Nhấp để thay đổi ảnh đại diện' : undefined}
                              >
                                {member.avatar && member.avatar.startsWith('data:') ? (
                                  <img
                                    src={member.avatar}
                                    alt={member.hoTen}
                                    className="w-12 h-12 rounded-full border-2 border-slate-100 dark:border-slate-850 object-cover transition-all group-hover:scale-105"
                                  />
                                ) : (
                                  <div className={`w-12 h-12 rounded-full border flex items-center justify-center text-sm font-black uppercase transition-all group-hover:scale-105 ${getInitialsColor(member.hoTen)}`}>
                                    {getInitials(member.hoTen)}
                                  </div>
                                )}
                                {currentUser?.role === 'BOOD' && (
                                <div className="absolute inset-0 bg-black/45 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Camera className="w-3.5 h-3.5 text-white" />
                                </div>
                                )}
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight">{member.hoTen}</h4>
                                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">{member.chucVu}</span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <span className="text-[9px] bg-slate-100 dark:bg-dark-elevated text-slate-500 dark:text-slate-400 font-extrabold px-1 py-0.5 rounded inline-block">
                                    ID: {member.id}
                                  </span>
                                  <span className={`text-[8px] uppercase font-black px-1 py-0.5 rounded inline-block ${
                                    (member.role || chucVuToRole(member.chucVu)) === 'BOOD' ? 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300' :
                                    (member.role || chucVuToRole(member.chucVu)) === 'MANAGER' ? 'bg-brand-warning/15 text-brand-warning' :
                                    'bg-slate-100 text-slate-700 dark:bg-dark-elevated dark:text-slate-400'
                                  }`}>
                                    {(member.role || chucVuToRole(member.chucVu)) === 'BOOD' ? 'Level 1' :
                                     (member.role || chucVuToRole(member.chucVu)) === 'MANAGER' ? 'Level 2' : 'Level 3'}
                                  </span>
                                </div>
                                {member.email && (
                                  <div className="mt-2 space-y-0.5 border-t border-slate-100 dark:border-slate-800/80 pt-1.5">
                                    <div className="text-[9px] font-mono text-slate-600 dark:text-slate-300 font-bold truncate max-w-[130px]" title={member.email}>
                                      ✉️ {member.email}
                                    </div>
                                    <div className="text-[9px] text-slate-500 font-bold">
                                      🔐 Mật khẩu: <span className="text-[8px] font-medium">Firebase quản lý (mã hóa)</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* KPI circle points — Quản lý chỉ thấy KPI bản thân + nhân viên tham gia dự án mình quản lý */}
                            <div className="text-right">
                              {currentUser?.role === 'MANAGER' && member.id !== currentUser.staffId && memberProjects.length === 0 ? (
                                <span className="inline-block text-xs font-black px-2 py-1 rounded-lg bg-slate-100 text-slate-400 border border-slate-200 dark:bg-dark-elevated dark:text-slate-500 dark:border-slate-700"
                                  title="Chỉ xem được KPI của nhân sự tham gia dự án bạn quản lý">
                                  🔒 KPI
                                </span>
                              ) : (
                              <span className={`inline-block text-xs font-black px-2 py-1 rounded-lg ${
                                member.kpiDiem >= 90 ? 'bg-brand-success/10 text-brand-success border border-brand-success/20' :
                                member.kpiDiem >= 80 ? 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300 border border-brand-accent/20' :
                                'bg-brand-danger/10 text-brand-danger border border-brand-danger/20'
                              }`}>
                                {member.kpiDiem}/100 đ
                              </span>
                              )}
                            </div>
                          </div>

                          {/* Work statistics progress */}
                          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                              <span>Số gói thầu phụ trách:</span>
                              <strong className="text-slate-800 dark:text-slate-200">{member.soDuAnDangLam} hồ sơ</strong>
                            </div>

                            <div>
                              <div className="flex items-center justify-between text-[10px] mb-1 text-slate-500 dark:text-slate-400">
                                <span>Tỷ lệ nộp đúng hạn:</span>
                                <strong className="text-slate-800 dark:text-slate-200">{progressOnTime}%</strong>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-dark-elevated h-1.5 rounded-full overflow-hidden">
                                <div 
                                  style={{ width: `${progressOnTime}%` }} 
                                  className={`h-full rounded-full ${
                                    progressOnTime >= 90 ? 'bg-brand-success' :
                                    progressOnTime >= 80 ? 'bg-brand-accent' : 'bg-brand-warning'
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* List of active projects they are handling */}
                        {memberProjects.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Dự án đang bóc BOQ</span>
                            <div className="space-y-1 max-h-16 overflow-y-auto">
                              {memberProjects.slice(0, 2).map(p => (
                                <div key={p.id} className="text-[10px] text-slate-600 dark:text-slate-300 font-bold truncate">
                                  • [{p.projectId}] {p.tenDuAn}
                                </div>
                              ))}
                              {memberProjects.length > 2 && (
                                <span className="text-[9px] text-slate-400 italic font-medium">+ {memberProjects.length - 2} dự án khác...</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Edit & Delete Actions */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center gap-2">
                          <div>
                            {currentUser?.role === 'BOOD' && currentUser?.staffId !== member.id && (
                              deletingStaffId === member.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDeleteStaff(member)}
                                    title="Xóa tài khoản đăng nhập. Công việc đã/đang thực hiện của nhân sự vẫn được giữ nguyên."
                                    className="text-[9px] font-black text-white bg-brand-danger hover:brightness-110 uppercase tracking-wider px-2 py-1 rounded transition-all cursor-pointer animate-pulse"
                                  >
                                    ĐỒNG Ý XÓA?
                                  </button>
                                  <button
                                    onClick={() => setDeletingStaffId(null)}
                                    className="text-[9px] font-bold text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 uppercase tracking-wider px-1 py-1 rounded transition-all cursor-pointer"
                                  >
                                    HỦY
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingStaffId(member.id)}
                                  className="text-[10px] font-bold text-brand-danger hover:bg-brand-danger/20 uppercase tracking-wider flex items-center gap-1 bg-brand-danger/10 px-2 py-1 rounded transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  XÓA
                                </button>
                              )
                            )}
                          </div>
                          
                          {/* Đổi ảnh / chỉnh sửa hồ sơ nhân sự: CHỈ Trưởng phòng.
                              Quản lý (L2) chỉ được THÊM chuyên viên mới (nút ở đầu trang). */}
                          {currentUser?.role === 'BOOD' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setEditingStaff(member)}
                              className="text-[10px] font-black text-brand-primary hover:bg-brand-primary/20 uppercase tracking-wider flex items-center gap-1 bg-brand-primary/10 px-2.5 py-1 rounded hover:scale-102 transition-all cursor-pointer"
                              title="Thay đổi hình đại diện nhanh cho tài khoản"
                            >
                              <Camera className="w-3 h-3" />
                              ĐỔI ẢNH
                            </button>
                            <button
                              onClick={() => setEditingStaff(member)}
                              className="text-[10px] font-black text-brand-accent dark:text-brand-accent-300 hover:bg-brand-accent/20 uppercase tracking-wider flex items-center gap-1 bg-brand-accent/10 px-2.5 py-1 rounded hover:scale-102 transition-all cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                              CHỈNH SỬA
                            </button>
                          </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Nhân sự đã nghỉ việc: tài khoản bị khóa nhưng công việc đã/đang làm vẫn giữ nguyên */}
                {staff.some(s => s.daNghi) && (
                  <div className="bg-slate-50 dark:bg-dark-card/60 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      🗂 Nhân sự đã nghỉ việc ({staff.filter(s => s.daNghi).length}) — công việc đã/đang thực hiện vẫn được bảo toàn
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {staff.filter(s => s.daNghi).map(member => (
                        <span
                          key={member.id}
                          className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-full flex items-center gap-1.5"
                          title={`${member.hoTen} (${member.chucVu}) — tài khoản đã khóa, tên vẫn hiển thị trên các công việc cũ`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          {member.hoTen} • {member.chucVu}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5+6. HỆ THỐNG — gộp CSDL SQL DDL + Luồng Nghiệp Vụ, chọn bằng nút gạt */}
            {activeTab === 'SYSTEM' && (
              <div className="space-y-4">
                {/* Nút gạt chọn nội dung con */}
                <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-dark-elevated p-0.5 rounded-lg w-full sm:w-auto sm:inline-flex" role="tablist" aria-label="Chọn nội dung Hệ thống">
                  {([['SCHEMA', 'CSDL SQL DDL', Database], ['WORKFLOW', 'Luồng Nghiệp Vụ', FileCheck]] as const).map(([k, label, Icon]) => (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={systemSubtab === k}
                      onClick={() => setSystemSubtab(k)}
                      className={`flex-1 sm:flex-none min-h-[44px] px-4 rounded-md text-xs font-black transition-colors flex items-center justify-center gap-1.5 ${systemSubtab === k ? 'bg-white dark:bg-dark-card text-brand-accent dark:text-brand-accent-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>

                {systemSubtab === 'SCHEMA' ? (
                  <SchemaExplorer />
                ) : (
                  <div className="space-y-6">
                    <TenderMindmap />
                    <WorkflowViewer />
                  </div>
                )}
              </div>
            )}

            {/* 6.5 LỊCH CÁ NHÂN — việc riêng + nhắc hạn trên chuông */}
            {activeTab === 'CALENDAR' && (() => {
              const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const todayStr = ymd(new Date());
              const mine = personalTasks.filter(t => t.ownerId === currentUser?.staffId);
              // Việc xảy ra trong 1 ngày (tính cả lặp lại) — sắp theo giờ rồi tới việc cả ngày
              const tasksOn = (ds: string) => {
                const d = new Date(ds + 'T00:00:00');
                return mine.filter(t => ptOccursOn(t, d))
                  .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (a.dueTime || '99').localeCompare(b.dueTime || '99'));
              };
              // Lưới tháng: bắt đầu từ Thứ 2 của tuần chứa ngày 1 → 42 ô (6 tuần)
              const first = new Date(calCursor.getFullYear(), calCursor.getMonth(), 1);
              const startOffset = (first.getDay() + 6) % 7; // 0=Thứ 2 ... 6=Chủ nhật
              const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - startOffset);
              const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
              const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
              // Màu chip theo trạng thái tại NGÀY hiển thị (ds) — dùng cho cả việc lặp lại
              const chipStyle = (t: PersonalTask, ds: string) => {
                if (t.done) return 'bg-brand-muted/15 text-brand-muted line-through';
                if (ds < todayStr) return 'bg-brand-danger/15 text-brand-danger dark:text-brand-danger';
                if (ds === todayStr || (new Date(ds).getTime() - Date.now()) <= 3 * 86400000) return 'bg-brand-warning/15 text-brand-warning';
                return 'bg-brand-accent/15 text-brand-accent dark:text-brand-accent-300';
              };
              const openDay = (dateStr: string) => { setNewPtTitle(''); setNewPtNote(''); setNewPtTime(''); setNewPtRepeat('none'); setCalDayModal(dateStr); };
              const modalTasks = calDayModal ? tasksOn(calDayModal) : [];

              // ===== Avatar nhân sự BẬN VIỆC theo ngày (chị chốt 18/07) =====
              // L1 xem toàn bộ L2+L3; L2 xem đội mình phụ trách (tái dùng kpiStaff — đã lọc theo
              // quanLyPhuTrachId). Lấy theo LỊCH VIỆC CON: ngày bắt đầu + số ngày − 1 (khớp Gantt con).
              // Rê chuột vào avatar → tooltip liệt kê việc đang làm + tiến độ % (70/30) + khoảng ngày.
              const canSeeTeamBusy = currentUser?.role === 'BOOD' || currentUser?.role === 'MANAGER';
              const teamBusy = new Map<string, Map<string, { member: Staff; jobs: string[] }>>();
              if (canSeeTeamBusy) {
                const scope = kpiStaff.filter(s => (s.role || chucVuToRole(s.chucVu)) !== 'BOOD');
                const memberById = new Map<string, Staff>(scope.map(s => [s.id, s]));
                const gridEnd = cells[cells.length - 1];
                const walkTasks = (ts: ProjectTask[] | undefined, cb: (t: ProjectTask) => void) => {
                  for (const t of ts || []) { cb(t); walkTasks(t.subtasks, cb); }
                };
                // Ghi 1 khoảng bận [start..end] cho danh sách nhân sự vào bản đồ ngày
                const markBusy = (ids: string[], start: Date, end: Date, job: string) => {
                  if (end < cells[0] || start > gridEnd) return;
                  const d = new Date(Math.max(start.getTime(), cells[0].getTime()));
                  for (; d <= end && d <= gridEnd; d.setDate(d.getDate() + 1)) {
                    const ds = ymd(d);
                    let day = teamBusy.get(ds);
                    if (!day) { day = new Map(); teamBusy.set(ds, day); }
                    for (const id of ids) {
                      let ent = day.get(id);
                      if (!ent) { ent = { member: memberById.get(id)!, jobs: [] }; day.set(id, ent); }
                      ent.jobs.push(job);
                    }
                  }
                };
                for (const p of scheduledWorkItems) {
                  const projLabel = `${(p.duAnChaId && parentNameById[p.duAnChaId]) || p.tenDuAn} · ${p.hangMuc}`;
                  const projStart = new Date(p.ngayBatDau + 'T00:00:00');
                  const projEnd = new Date((p.ngayHoanThanhThucTe || p.ngayHoanThanhDuKienHienTai || p.ngayHoanThanhDuKienGoc) + 'T00:00:00');
                  const daGanTrongHoSo = new Set<string>();
                  walkTasks(p.tasks, t => {
                    const assignees = Array.from(new Set([t.assignedTo, ...(t.assignedStaffIds || [])]))
                      .filter((x): x is string => !!x && memberById.has(x));
                    if (assignees.length === 0) return;
                    assignees.forEach(id => daGanTrongHoSo.add(id));
                    const prog = t.isCompleted ? 100 : getTaskProgress(t);
                    if (t.ngayBatDau && (t.soNgay || 0) > 0) {
                      // Việc con có lịch riêng → bận đúng khoảng đó
                      const start = new Date(t.ngayBatDau + 'T00:00:00');
                      const end = new Date(start);
                      end.setDate(end.getDate() + (t.soNgay || 1) - 1);
                      markBusy(assignees, start, end, `${t.name} · ${prog}%${t.isCompleted ? ' ✓' : ''} — ${projLabel} (${fmtDateVN(start)} → ${fmtDateVN(end)})`);
                    } else {
                      // Việc con CHƯA đặt lịch riêng → tạm tính bận theo khung thời hạn hồ sơ
                      markBusy(assignees, projStart, projEnd, `${t.name} · ${prog}%${t.isCompleted ? ' ✓' : ''} — ${projLabel} (chưa đặt lịch riêng — theo hạn hồ sơ ${fmtDateVN(projStart)} → ${fmtDateVN(projEnd)})`);
                    }
                  });
                  // Tham gia hồ sơ (Thực hiện) nhưng chưa được gán việc con nào → vẫn hiện theo khung hồ sơ
                  const thamGiaChuaGan = Array.from(new Set([p.thucHienId, ...(p.thucHienIds || [])]))
                    .filter((x): x is string => !!x && memberById.has(x) && !daGanTrongHoSo.has(x));
                  if (thamGiaChuaGan.length > 0) {
                    markBusy(thamGiaChuaGan, projStart, projEnd, `Tham gia hồ sơ (chưa phân rã việc con) — ${projLabel} (${fmtDateVN(projStart)} → ${fmtDateVN(projEnd)})`);
                  }
                }
              }

              return (
              <div className="space-y-4">
                <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
                  {/* Thanh tiêu đề + điều hướng tháng (kiểu Google Calendar) */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setCalCursor(new Date())}
                        className="text-[11px] font-black px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors">
                        Hôm nay
                      </button>
                      <div className="flex items-center">
                        <button type="button" aria-label="Tháng trước" onClick={() => setCalCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-brand-accent hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                        <button type="button" aria-label="Tháng sau" onClick={() => setCalCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-brand-accent hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors"><ChevronRight className="w-5 h-5" /></button>
                      </div>
                      <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2 ml-1">
                        <CalendarDays className="text-brand-accent dark:text-brand-accent-300 w-5 h-5 shrink-0" />
                        Tháng {calCursor.getMonth() + 1} / {calCursor.getFullYear()}
                      </h3>
                    </div>
                    {notifPerm === 'granted' ? (
                      <span className="text-[10px] font-bold text-brand-success bg-brand-success/10 px-2.5 py-1.5 rounded-lg shrink-0">✓ Đã bật thông báo</span>
                    ) : notifPerm !== 'unsupported' ? (
                      <button type="button" onClick={requestNotifPerm} className="text-[10px] font-black bg-brand-accent hover:bg-brand-accent-700 text-white px-3 py-1.5 rounded-lg shrink-0">🔔 Bật thông báo trình duyệt</button>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 px-4 pt-2.5">
                    Bấm vào một ngày để thêm lịch hẹn. Nhắc trên chuông 🔔: trước hạn ~3 ngày · trước hạn ~1 ngày · và tới hạn (đúng giờ hẹn nếu có giờ, hoặc 8h00 sáng ngày hẹn nếu chỉ có ngày). Chỉ mình bạn thấy.
                    {canSeeTeamBusy && <> Góc phải mỗi ô: <strong className="text-slate-600 dark:text-slate-300">avatar nhân sự có việc trong ngày</strong> (theo lịch việc con{currentUser?.role === 'MANAGER' ? ', đội ngũ bạn phụ trách' : ''}) — rê chuột vào avatar để xem việc đang làm &amp; tiến độ.</>}
                  </p>

                  {/* Hàng thứ trong tuần */}
                  <div className="grid grid-cols-7 px-2 pt-2">
                    {weekdayLabels.map((w, i) => (
                      <div key={w} className={`text-center text-[10px] font-black uppercase tracking-wider py-1.5 ${i === 6 ? 'text-brand-danger/80' : 'text-slate-400 dark:text-slate-500'}`}>{w}</div>
                    ))}
                  </div>

                  {/* Lưới 6 tuần */}
                  <div className="grid grid-cols-7 gap-1 p-2">
                    {cells.map((d, i) => {
                      const ds = ymd(d);
                      const inMonth = d.getMonth() === calCursor.getMonth();
                      const isToday = ds === todayStr;
                      const isSunday = d.getDay() === 0;
                      const dayTasks = tasksOn(ds);
                      return (
                        <button
                          type="button"
                          key={i}
                          onClick={() => openDay(ds)}
                          title="Bấm để xem / thêm lịch hẹn ngày này"
                          className={`relative min-h-[76px] md:min-h-[104px] p-1.5 rounded-lg border text-left align-top flex flex-col gap-1 transition-colors cursor-pointer
                            ${inMonth ? 'bg-white dark:bg-dark-bg/40 border-slate-100 dark:border-slate-800' : 'bg-slate-50/60 dark:bg-dark-bg/10 border-transparent'}
                            ${isToday ? 'ring-1 ring-brand-accent border-brand-accent' : ''}
                            hover:bg-brand-accent/5 dark:hover:bg-brand-accent/10`}
                        >
                          <span className="flex items-start justify-between gap-1 w-full">
                            <span className={`text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0
                              ${isToday ? 'bg-brand-accent text-white' : isSunday ? 'text-brand-danger/80' : inMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600'}`}>
                              {d.getDate()}
                            </span>
                            {/* Avatar nhân sự có việc con trong ngày — hiện ĐỦ, không chồng, tự xuống dòng; rê chuột xem việc + tiến độ */}
                            {canSeeTeamBusy && (() => {
                              const day = teamBusy.get(ds);
                              if (!day || day.size === 0) return null;
                              return (
                                <span className="flex flex-wrap gap-0.5 justify-end items-center min-w-0">
                                  {Array.from(day.values()).map(({ member, jobs }) => {
                                    const tip = `${member.hoTen} — ${jobs.length} việc:\n${jobs.map(j => '• ' + j).join('\n')}`;
                                    return member.avatar && member.avatar.startsWith('data:') ? (
                                      <img key={member.id} src={member.avatar} alt={member.hoTen} title={tip}
                                        className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-sm shrink-0" />
                                    ) : (
                                      <span key={member.id} title={tip}
                                        className={`w-5 h-5 rounded-full border flex items-center justify-center text-[7px] font-black uppercase shadow-sm shrink-0 ${getInitialsColor(member.hoTen)}`}>
                                        {getInitials(member.hoTen)}
                                      </span>
                                    );
                                  })}
                                </span>
                              );
                            })()}
                          </span>
                          <span className="flex flex-col gap-0.5 w-full overflow-hidden">
                            {dayTasks.slice(0, 3).map(t => (
                              <span key={t.id} className={`text-[9px] font-bold px-1.5 py-0.5 rounded truncate w-full text-left ${chipStyle(t, ds)}`} title={`${t.dueTime ? t.dueTime + ' ' : ''}${t.title}${t.repeat && t.repeat !== 'none' ? ' · ' + REPEAT_LABEL[t.repeat] : ''}`}>
                                {t.dueTime ? <span className="font-black">{t.dueTime} </span> : null}{t.title}
                              </span>
                            ))}
                            {dayTasks.length > 3 && (
                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 px-1.5">+{dayTasks.length - 3} việc nữa</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Modal 1 NGÀY: xem việc + thêm nhanh (bấm ô ngày mở ra) */}
                {calDayModal && (
                  <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCalDayModal(null)}>
                    <div ref={calDayModalRef} role="dialog" aria-modal="true" aria-labelledby="cal-day-title" tabIndex={-1} onClick={e => e.stopPropagation()}
                      className="bg-white dark:bg-dark-card w-full max-w-md rounded-t-2xl md:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
                      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-brand-accent/10">
                        <h3 id="cal-day-title" className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-brand-accent dark:text-brand-accent-300 shrink-0" />
                          {fmtDateVN(calDayModal)}
                        </h3>
                        <button type="button" onClick={() => setCalDayModal(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-elevated text-slate-400" aria-label="Đóng"><X className="w-4 h-4" /></button>
                      </div>

                      <div className="p-4 space-y-3 overflow-y-auto flex-1">
                        {/* Việc đã có trong ngày */}
                        {modalTasks.length > 0 ? (
                          <div className="space-y-1.5">
                            {modalTasks.map(t => (
                              <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-dark-bg/40 border border-slate-100 dark:border-slate-800">
                                <button type="button" onClick={() => togglePersonalDone(t.id)} className="shrink-0 text-slate-400 hover:text-brand-primary min-h-[44px] min-w-[32px] flex items-center justify-center" title={t.done ? 'Bỏ đánh dấu xong' : 'Đánh dấu xong'}>
                                  {t.done ? <CheckSquare className="w-5 h-5 text-brand-success" /> : <Square className="w-5 h-5" />}
                                </button>
                                <div className="flex-1 min-w-0 py-1">
                                  <div className={`text-xs font-bold ${t.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>{t.title}</div>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                    {t.dueTime && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300">🕐 {t.dueTime}</span>}
                                    {t.repeat && t.repeat !== 'none' && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary dark:text-brand-primary-300">🔁 {REPEAT_LABEL[t.repeat]}</span>}
                                  </div>
                                  {t.note && <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t.note}</div>}
                                </div>
                                <button type="button" onClick={() => calDayModal && requestDeletePersonalTask(t, calDayModal)} className="shrink-0 text-slate-300 hover:text-brand-danger min-h-[44px] min-w-[32px] flex items-center justify-center" title="Xóa việc"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 italic text-center py-2">Chưa có lịch hẹn nào trong ngày này.</p>
                        )}

                        {/* Thêm nhanh cho ngày này */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Thêm lịch hẹn mới</label>
                          <input autoFocus value={newPtTitle} onChange={e => setNewPtTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addPersonalTaskOn(calDayModal); }}
                            placeholder="VD: Gọi CĐT xác nhận hồ sơ thầu..."
                            className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-brand-accent focus:outline-none" />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Giờ hẹn (tùy chọn)</label>
                              <input type="time" value={newPtTime} onChange={e => setNewPtTime(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-brand-accent focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Lặp lại</label>
                              <select value={newPtRepeat} onChange={e => setNewPtRepeat(e.target.value as typeof newPtRepeat)}
                                className="w-full px-2.5 py-2 text-xs font-bold bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-brand-accent focus:outline-none">
                                <option value="none">Không lặp lại</option>
                                <option value="daily">Hàng ngày</option>
                                <option value="weekly">Hàng tuần</option>
                                <option value="monthly">Hàng tháng</option>
                                <option value="yearly">Hàng năm</option>
                              </select>
                            </div>
                          </div>
                          <input value={newPtNote} onChange={e => setNewPtNote(e.target.value)} placeholder="Ghi chú thêm (tùy chọn)..."
                            className="w-full px-3 py-1.5 text-[11px] bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:ring-1 focus:ring-brand-accent focus:outline-none" />
                          <button type="button" onClick={() => addPersonalTaskOn(calDayModal)} disabled={!newPtTitle.trim()}
                            className="w-full px-4 py-2.5 min-h-[44px] bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-black flex items-center justify-center gap-1.5">
                            <Plus className="w-4 h-4" /> Thêm vào ngày {fmtDateVN(calDayModal)}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}

            {/* 7. ACTIVITY HISTORY LOG */}
            {activeTab === 'HISTORY' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <History className="text-brand-accent dark:text-brand-accent-300 w-4 h-4" />
                        NHẬT KÝ HOẠT ĐỘNG HỆ THỐNG
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        {currentUser?.role === 'BOOD'
                          ? 'Trưởng phòng xem toàn bộ hoạt động của hệ thống và các phòng ban.'
                          : 'Chỉ hiển thị hoạt động của các dự án bạn đang tham gia và thao tác của chính bạn.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={logSearch}
                        onChange={(e) => setLogSearch(e.target.value)}
                        aria-label="Tìm kiếm nhật ký hoạt động"
                        placeholder="Tìm theo hành động, người dùng, nội dung..."
                        className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium bg-white dark:bg-dark-elevated text-slate-700 dark:text-slate-200 focus:ring-brand-accent w-56 max-w-full"
                      />
                      <span className="text-[10px] bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300 font-black px-2 py-1 rounded-lg shrink-0">
                        {visibleLogs.length} bản ghi
                      </span>
                    </div>
                  </div>

                  {(() => {
                    const q = logSearch.trim().toLowerCase();
                    const filtered = q
                      ? visibleLogs.filter(l =>
                          l.action.toLowerCase().includes(q) ||
                          l.userName.toLowerCase().includes(q) ||
                          (l.details || '').toLowerCase().includes(q)
                        )
                      : visibleLogs;

                    // Colour cue per action family
                    // Màu theo nhóm hành động — dùng token thương hiệu HPCons (danger/accent/primary/warning/muted).
                    // Màu accent (#0969A7) tối nên chữ ở dark mode dùng sắc độ sáng hơn (accent-300).
                    const actionStyle = (action: string) => {
                      const a = action.toLowerCase();
                      if (a.includes('xóa') || a.includes('lỗi')) return 'bg-brand-danger/10 text-brand-danger';
                      if (a.includes('đăng ký') || a.includes('mới')) return 'bg-brand-primary/10 text-brand-primary';
                      if (a.includes('đăng nhập')) return 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300';
                      if (a.includes('đăng xuất')) return 'bg-brand-muted/15 text-brand-muted';
                      if (a.includes('nhập') || a.includes('xuất') || a.includes('sao lưu')) return 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300';
                      return 'bg-brand-warning/10 text-brand-warning';
                    };

                    if (filtered.length === 0) {
                      return (
                        <EmptyState
                          icon={<History className="w-6 h-6" />}
                          title={q ? 'Không tìm thấy bản ghi' : 'Chưa có hoạt động'}
                          description={q ? 'Không có bản ghi phù hợp với từ khóa tìm kiếm.' : 'Chưa có hoạt động nào được ghi nhận.'}
                        />
                      );
                    }

                    return (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[560px] overflow-y-auto pr-1">
                        {filtered.map(log => (
                          <div key={log.id} className="py-3 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-dark-elevated flex items-center justify-center shrink-0 mt-0.5">
                              <Clock className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${actionStyle(log.action)}`}>
                                  {log.action}
                                </span>
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{log.userName}</span>
                                <span className="text-[9px] text-slate-400 font-mono">{fmtDateTimeVN(log.timestamp)}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed break-words">
                                {log.details}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* Modern Compact Footer */}
      <footer className="bg-white dark:bg-dark-card border-t border-slate-200/50 dark:border-slate-800/80 py-4 text-center text-[11px] text-slate-400 dark:text-slate-500 select-none shrink-0" id="app-footer">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-2">
          <span>
            Hệ thống Quản lý và Cập nhật Tiến độ Tích hợp Phòng Đấu thầu • ERP BPM Software
          </span>
        </div>
      </footer>
        </div>
      </div>


      {(editingStaff || isAddingStaff) && (
        <StaffEditModal
          member={editingStaff}
          existingStaff={staff}
          currentUserRole={currentUser?.role}
          onSave={(updatedMember) => {
            if (isAddingStaff) {
              const updatedStaffList = [...staff, updatedMember];
              setStaff(updatedStaffList);
              localStorage.setItem('erp_staff', JSON.stringify(updatedStaffList));
              updateStaffStats(projects, updatedStaffList);
              setIsAddingStaff(false);
              triggerToast(`Đã thêm mới tài khoản: ${updatedMember.hoTen}`);
            } else {
              handleSaveStaff(updatedMember);
            }
          }}
          onClose={() => {
            setEditingStaff(null);
            setIsAddingStaff(false);
          }}
        />
      )}

      {cdtRevisionProject && (
        <CdtRevisionModal
          project={cdtRevisionProject}
          onSubmit={(noiDung, buocVe, newTasks) => handleCdtRevision(cdtRevisionProject.id, noiDung, buocVe, newTasks)}
          onClose={() => setCdtRevisionProject(null)}
        />
      )}

      {/* Kéo hồ sơ về Bước 1 — hộp hỏi ảnh hưởng hạn nộp (GĐ A/B). Không ảnh hưởng → không kéo. */}
      {pullBackProject && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setPullBackProject(null)}>
          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-warning/15 text-brand-warning">
                <AlertCircle className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Kéo hồ sơ về Bước 1</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{pullBackProject.projectId} — {pullBackProject.hangMuc}</p>
              </div>
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
              Việc kéo hồ sơ về Bước 1 <b>có ảnh hưởng tiến độ (hạn nộp)</b> của gói thầu không?
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const p = pullBackProject;
                  setPullBackProject(null);
                  triggerToast(`"${p.hangMuc}" không ảnh hưởng hạn nộp → không cần kéo về Bước 1. Cứ cập nhật nội bộ (việc con/ghi chú) tại chỗ.`);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors cursor-pointer"
              >
                Không ảnh hưởng
              </button>
              <button
                type="button"
                onClick={() => handlePullBackImpact(pullBackProject)}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-black bg-brand-warning hover:bg-brand-warning/85 text-black transition-colors cursor-pointer"
              >
                Có, ảnh hưởng hạn nộp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup dời hạn + sửa việc con (khớp hạn) khi kéo về Bước 1 — GĐ C+D */}
      {pullBackDelayProject && (
        <PullBackDelayModal
          project={pullBackDelayProject}
          staff={staff}
          isBOOD={currentUser?.role === 'BOOD'}
          onCancel={() => setPullBackDelayProject(null)}
          onApply={(tasks, delayDays, reason) => handlePullBackApply(pullBackDelayProject.id, tasks, delayDays, reason)}
        />
      )}

      {/* Hộp xác nhận xóa chung (dự án · công việc · việc lịch không lặp) — phải bấm "Xóa" lần nữa mới xóa */}
      {confirmState && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConfirmState(null)}>
          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-danger/10 text-brand-danger"><Trash2 className="w-5 h-5" /></span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{confirmState.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{confirmState.message}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setConfirmState(null)} className="flex-1 px-4 py-2.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors cursor-pointer">Hủy</button>
              <button type="button" onClick={() => { const fn = confirmState.onConfirm; setConfirmState(null); fn(); }} className="flex-1 px-4 py-2.5 rounded-xl text-xs font-black bg-brand-danger hover:bg-brand-danger/85 text-white transition-colors cursor-pointer">{confirmState.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {/* Hộp xóa việc lịch LẶP LẠI — hỏi phạm vi xóa (buổi này / buổi này & các buổi sau) */}
      {recurDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setRecurDelete(null)}>
          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-lg">🔁</span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Xóa lịch lặp lại</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Việc <b className="text-slate-700 dark:text-slate-200">"{recurDelete.task.title}"</b> lặp {(REPEAT_LABEL[recurDelete.task.repeat || 'none'] || '').toLowerCase()}. Bạn muốn xóa buổi ngày <b className="text-slate-700 dark:text-slate-200">{fmtDateVN(recurDelete.occ)}</b> như thế nào?
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button type="button" onClick={() => applyRecurDelete('one')} className="w-full px-4 py-2.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors cursor-pointer">Chỉ xóa buổi này</button>
              <button type="button" onClick={() => applyRecurDelete('following')} className="w-full px-4 py-2.5 rounded-xl text-xs font-black bg-brand-danger hover:bg-brand-danger/85 text-white transition-colors cursor-pointer">Xóa buổi này &amp; các buổi sau</button>
              <button type="button" onClick={() => setRecurDelete(null)} className="w-full px-4 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors cursor-pointer">Hủy</button>
            </div>
          </div>
        </div>
      )}

      {pwModal && (
        <ChangePasswordModal
          mode={pwModal}
          currentAvatar={staff.find(s => s.id === currentUser?.staffId)?.avatar}
          hoTen={staff.find(s => s.id === currentUser?.staffId)?.hoTen}
          onSubmit={handleChangePassword}
          onCancel={pwModal === 'forced' ? handleLogout : () => setPwModal(null)}
        />
      )}

    </div>
  );
}
