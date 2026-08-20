"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, Staff, ProjectTask, ActivityLog, AppNotification, PersonalTask, DelayLog , TenderTemplate, ThongBaoNoiBo } from './types';
import { mockProjects, mockStaff, ADMIN_SEED } from './data/mockData';
import StatsDashboard from './components/StatsDashboard';
import GanttChart from './components/GanttChart';
import SchemaExplorer from './components/SchemaExplorer';
import WorkflowViewer from './components/WorkflowViewer';
import ProjectForm from './components/ProjectForm';
import HpConsLogo from './components/HpConsLogo';
import StaffEditModal from './components/StaffEditModal';
import TenderMindmap from './components/TenderMindmap';
import KanbanBoard, { KANBAN_STEPS, KANBAN_L1_ONLY_FROM, deriveKanbanStep } from './components/KanbanBoard';
import NotificationFeed from './components/NotificationFeed';
import MyTasksPanel, { DEFAULT_PROJECT_TASKS, taskDeadlineISO, taskHanText, todayISO, hoSoChoTPDuyet, laNuaNgayViec } from './components/MyTasksPanel';
import StaffTaskResultPanel from './components/StaffTaskResultPanel';
import SubtaskGantt, { DEFAULT_TASK_DAYS } from './components/SubtaskGantt';
import { AppLauncher } from './components/AppLauncher';
import TextWithLinks from './components/TextWithLinks';
import { Badge, TimelineProgress, EmptyState, AutoGrowTextarea } from './components/ui';
import { updateTaskInTree, calculateProjectProgress, getTaskProgress, progressOfRound, weightIssue, weightSumAllRounds, soVongCoViec, tasksOfRound } from './utils/taskTree';
import { fmtDateVN, fmtDateTimeVN, tongNgayDoiHan, nowVN, namHienTaiVN, chuanHoaGio, mocHanViec } from './utils/dateVN';
import { tongSoLanGuiCDT, nhanLanGui, lanGuiKeTiep, soLanGuiTruocApp } from './utils/guiCDT';
import { dungBangThongKeISO, tenTepBangISO, type KyBaoCao } from './utils/bangThongKeISO';
import { parseAttachments } from './utils/attachments';
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
  ExternalLink,
  History,
  LayoutGrid,
  Clock,
  Bell,
  CalendarDays,
  X,
  MoreHorizontal
, FileSpreadsheet, Megaphone, ShieldCheck, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CdtRevisionModal from './components/CdtRevisionModal';
import PullBackDelayModal from './components/PullBackDelayModal';
import PhongProgressModal from './components/PhongProgressModal';
import AnhBaoCaoModal from './components/AnhBaoCaoModal';
import { dungThuVienTenViecCon } from './utils/thuVienViecCon';
import { taiAnhVe } from './utils/anhDinhKem';
import ThongBaoNoiBoPanel from './components/ThongBaoNoiBoPanel';
import TemplateMauPanel from './components/TemplateMauPanel';
import DateInput from './components/DateInput';
import { subscribeCollection, pushCollection, watchAuth, authEmailFor, signInWithHpcoreToken, signInAnonymouslyFb, signOutFb, fbAuth, projectIdDangChay, PROJECT_THAT } from './lib/firebase';
import { reportActivity } from './lib/reportActivity';
import { sandboxStaff, duAnNhap } from './data/sandboxData';

// ===== BẢN THỬ (chỉ chạy trên máy cá nhân) =====
// Bật bằng cách thêm NEXT_PUBLIC_DEV_SANDBOX=1 vào .env.local (file này KHÔNG lên git).
// HAI lớp chặn để không bao giờ lọt lên production:
//   1. process.env.NODE_ENV !== 'production' — bản build production luôn là 'production';
//   2. phải có biến NEXT_PUBLIC_DEV_SANDBOX=1.
// Khi bật: BỎ QUA đăng nhập SSO App Tổng và KHÔNG kết nối Firestore — mọi dữ liệu chỉ nằm
// trong localStorage của máy đang chạy, thử phá thoải mái không ảnh hưởng dữ liệu thật.
const DEV_SANDBOX =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_SANDBOX === '1';

// ===== THỬ-CLOUD (chỉ chạy trên máy cá nhân, chỉ với project Firebase THỬ) =====
// Bật bằng NEXT_PUBLIC_DEV_CLOUD_TEST=1 trong .env.local. Dùng để nghiệm thu những thứ Bản thử
// KHÔNG chạm tới được: Sao lưu/Khôi phục có đẩy lên Firestore, đồng bộ realtime giữa 2 máy.
// Khác Bản thử: VẪN đọc/ghi Firestore. Giống Bản thử: bỏ qua SSO (cookie App Tổng không gửi tới
// localhost) và dùng màn chọn vai trò; phiên Firebase lấy bằng đăng nhập ẨN DANH nên Rules vẫn
// giữ đúng chuẩn "phải đăng nhập mới được ghi".
//
// BA lớp chặn để không bao giờ đụng dữ liệu thật:
//   1. process.env.NODE_ENV !== 'production';
//   2. phải có biến NEXT_PUBLIC_DEV_CLOUD_TEST=1;
//   3. projectId đang chạy PHẢI KHÁC project thật — quên đổi config sang project thử là cờ tự tắt,
//      không có chuyện thử ghi/xóa trên Firestore của Phòng.
const DEV_CLOUD_TEST_DUOC_YEU_CAU =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_CLOUD_TEST === '1';

// ===== BẢN DEMO TRÊN WEB =====
// Giống thử-cloud, nhưng CHẠY CẢ TRÊN BẢN BUILD PRODUCTION (để deploy lên Vercel cho Sếp xem
// từ máy khác / điện thoại). Lý do phải có: app thật đăng nhập bằng SSO App Tổng, mà cookie
// phiên hpcore.vn chỉ gửi tới subdomain hpcore.vn — mở trên *.vercel.app là quay vòng đăng nhập.
//
// AI CÓ LINK CŨNG VÀO ĐƯỢC và sửa được dữ liệu → TUYỆT ĐỐI không trỏ vào project thật.
// Khóa an toàn: vẫn phải projectId KHÁC project thật, nên bản demo không thể chạm dữ liệu Phòng.
// Trỏ project thử bằng biến NEXT_PUBLIC_FIREBASE_CONFIG (xem src/lib/firebase.ts).
const DEMO_WEB_DUOC_YEU_CAU = process.env.NEXT_PUBLIC_DEMO_WEB === '1';

const CLOUD_KHONG_SSO_DUOC_YEU_CAU = DEV_CLOUD_TEST_DUOC_YEU_CAU || DEMO_WEB_DUOC_YEU_CAU;
const DEV_CLOUD_TEST = CLOUD_KHONG_SSO_DUOC_YEU_CAU && projectIdDangChay() !== PROJECT_THAT;
// Yêu cầu thử-cloud bị TỪ CHỐI vì đang trỏ project thật — App hiện thông báo rõ thay vì
// im lặng rơi về luồng SSO (trên localhost sẽ nhảy sang account.hpcore.vn, rất khó hiểu).
const DEV_CLOUD_TEST_BI_CHAN = CLOUD_KHONG_SSO_DUOC_YEU_CAU && !DEV_CLOUD_TEST;
// Nhãn hiển thị: bản deploy cho người khác xem thì gọi "BẢN DEMO", chạy trên máy thì "Thử-cloud".
const NHAN_CHE_DO_CLOUD = DEMO_WEB_DUOC_YEU_CAU ? 'BẢN DEMO' : 'Thử-cloud';

// Hai chế độ dev đều KHÔNG đăng nhập SSO và đều dùng màn chọn vai trò của Bản thử.
const DEV_CHON_VAI_TRO = DEV_SANDBOX || DEV_CLOUD_TEST;

// Giờ Việt Nam dùng hàm chung `nowVN` trong src/utils/dateVN.ts (xem lý do cố định múi giờ ở đó).

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

// Chấp nhận cả ảnh upload local (data: base64) lẫn avatar thật đồng bộ từ hồ sơ
// App Tổng (https://... Firebase Storage) — trước đây chỉ nhận data: nên avatar
// đồng bộ từ account.hpcore.vn bị bỏ qua, luôn hiện chữ viết tắt thay vì ảnh thật.
export const isAvatarUrl = (v?: string | null): v is string =>
  !!v && (v.startsWith('data:') || v.startsWith('http://') || v.startsWith('https://'));

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

// Ánh xạ chức danh → quyền hệ thống (RBAC) khi tài khoản CHƯA gán quyền tường minh.
// Đây chỉ là mức MẶC ĐỊNH: nếu bản ghi nhân sự đã có `role` thì `role` luôn thắng
// (mọi chỗ gọi đều viết `s.role || chucVuToRole(s.chucVu)`).
//
// THANG LEVEL (chị Trâm chốt 17/08/2026):
//   Level 1 = Trưởng phòng + Phó phòng   (+ Quản trị hệ thống: tài khoản kỹ thuật vận hành app)
//   Level 2 = Quản lý
//   Level 3 = Nhân viên (Chuyên viên đấu thầu)
//   Level 4 = Ban giám đốc — xem HẾT nhưng KHÔNG thao tác
//
// ĐỔI SO VỚI TRƯỚC: 'Ban giám đốc' trước đây mặc định là BOOD (Level 1), nay mặc định là
// VIEWER (Level 4). Ban giám đốc nào cần toàn quyền thì Trưởng phòng gán thẳng role BOOD cho
// người đó — khi ấy được thêm/xóa/sửa TẤT CẢ dự án, kể cả dự án không liên quan tới mình.
export const chucVuToRole = (chucVu?: string): 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER' =>
  (chucVu === 'Trưởng phòng' || chucVu === 'Phó phòng' || chucVu === 'Quản trị hệ thống') ? 'BOOD' :
  chucVu === 'Quản lý' ? 'MANAGER' :
  // 'Khách (chỉ xem)' là chức danh CŨ, giữ lại để bản ghi đã lưu không bị hiểu sai thành Level 3.
  (chucVu === 'Ban giám đốc' || chucVu === 'Khách (chỉ xem)') ? 'VIEWER' : 'STAFF';

// ===== LEVEL 4 — BAN GIÁM ĐỐC (VIEWER) =====
// Chỉ ĐỌC: không thêm/sửa/xóa, không kéo thẻ Kanban, không duyệt gì.
//
// Chị Trâm chốt 17/08/2026: "L4 = Ban giám đốc, thay cho chữ Khách mời, còn tính năng thì không
// thay đổi gì cả — CHO XEM HẾT, chỉ là không cho thao tác thôi."
// → Trước đây chỉ mở 4 mục (DEPTLINKS, DASHBOARD, PROJECTS, KANBAN). Nay mở TẤT CẢ mục xem được:
//   thêm GANTT (biểu đồ Gantt), CALENDAR (lịch cá nhân), HISTORY (nhật ký), STAFF (đội ngũ & KPI).
// CỐ Ý KHÔNG mở 'SYSTEM': đó là mục kỹ thuật (xem cấu trúc dữ liệu, Sao lưu/Khôi phục) dành cho
//   Trưởng phòng vận hành app, không phải thông tin điều hành. Chị Trâm muốn mở luôn thì thêm vào đây.
export const VIEWER_TABS = ['DEPTLINKS', 'DASHBOARD', 'PROJECTS', 'KANBAN', 'GANTT', 'CALENDAR', 'TEMPLATES', 'HISTORY', 'STAFF'];
/** Người đang đăng nhập CHỈ ĐƯỢC XEM (Level 4 — Ban giám đốc) — dùng để tắt mọi nút thêm/sửa/xóa. */
export const laKhachChiXem = (role?: string): boolean => role === 'VIEWER';

// ===== AI ĐƯỢC QUẢN LÝ TÀI KHOẢN NHÂN SỰ (chị Trâm chốt 18/08/2026) =====
// "Level4 cho xem danh sách nhân sự. cho xóa và thêm nhân sự như level 1 đi em."
// Trước đây Ban giám đốc (L4) bị coi là "khách chỉ xem" nên tab Đội ngũ ra 0 nhân sự và không có
// nút nào — trong khi BGĐ là cấp trên của Phòng, việc mở/khoá tài khoản là quyền của họ.
// Nay L1 và L4 quản lý tài khoản NGANG NHAU. Giữ nguyên laKhachChiXem cho các phần khác (BGĐ vẫn
// chỉ xem hồ sơ/tiến độ, không thao tác nghiệp vụ) — chỉ mở đúng phần nhân sự.
export const quanLyDuocNhanSu = (role?: string): boolean => role === 'BOOD' || role === 'VIEWER';

// Các chức danh KHÔNG tính là nhân sự Phòng Đấu thầu (chị Trâm chốt 27/07/2026) — không đứng
// trong "Danh sách nhân sự", không đếm vào quân số, không chấm KPI:
//   · Ban giám đốc      — cấp trên, không nhận việc đấu thầu, không ai chấm KPI cấp đó.
//   · Quản trị hệ thống — tài khoản kỹ thuật để vận hành app, không phải người làm hồ sơ thầu.
//   · Khách (chỉ xem)   — người ngoài được mời vào theo dõi tiến độ.
// Các tài khoản này VẪN nằm ở tab "Đội ngũ" để Trưởng phòng quản lý (đổi quyền, khoá/mở).
export const CHUC_VU_KHONG_TINH_NHAN_SU: string[] = ['Ban giám đốc', 'Quản trị hệ thống', 'Khách (chỉ xem)'];

/** Số Level hiển thị cho 4 mức quyền: BOOD = 1 · MANAGER = 2 · STAFF = 3 · VIEWER = 4. */
export const nhanLevelSo = (role?: string): string =>
  role === 'BOOD' ? '1' : role === 'MANAGER' ? '2' : role === 'VIEWER' ? '4' : '3';

// ===== MẶC ĐỊNH BỘ LỌC TRẠNG THÁI HỒ SƠ (chị Trâm chốt 17/08/2026 — góp ý #9) =====
// "Level 1 được phép xem toàn bộ công việc, kể cả lịch sử công việc đã xong; hiện tại chưa được
//  xem các công việc đã xong khi công việc đó đang làm giữa TP và Quản lý."
//
// Dữ liệu thì L1 vốn đã thấy hết (rbacProjects trả nguyên danh sách cho BOOD) — cái chặn tầm nhìn
// là BỘ LỌC MẶC ĐỊNH 'ACTIVE' áp cho mọi vai trò, nên mở app lên là việc đã xong bị ẩn sạch.
//   · L1 (Trưởng phòng/Phó phòng) và L4 (Ban giám đốc, "cho xem hết") → mặc định 'ALL'.
//   · L2/L3 giữ 'ACTIVE' cho danh sách gọn, đúng phần việc đang phải làm.
// Người dùng vẫn tự bấm đổi được; đây chỉ là điểm khởi đầu.
export const macDinhLocTrangThai = (role?: string): 'ACTIVE' | 'DONE' | 'ALL' =>
  (role === 'BOOD' || role === 'VIEWER') ? 'ALL' : 'ACTIVE';

// ===== CHỐT TIẾN ĐỘ PHÒNG 100% TRƯỚC KHI ĐI TIẾP =====
// Liệt kê các bước mà khi RỜI khỏi bước đó để TIẾN lên bước kế tiếp, hồ sơ bắt buộc phải có
// tiến độ Phòng đủ 100% (Trưởng phòng đã duyệt xong). Đổi phương án chỉ cần sửa đúng mảng này:
//   [3]    → dời chốt về 3 → 4 và bỏ chốt ở 4 → 5                — phương án (a), ĐANG DÙNG
//   [4]    → chỉ chặn 4 → 5 (chốt cũ, giữ nguyên như trước)      — phương án (c)
//   [3, 4] → giữ CẢ HAI lớp                                      — phương án (b)
// Chị Trâm chốt phương án (a) ngày 27/07/2026: chặn MỘT lần ở cửa 3 → 4 cho gọn — hồ sơ chưa
// duyệt xong cấp Phòng thì không trình BLĐ được, đã trình BLĐ rồi thì đi tiếp tự do.
// LƯU Ý khi vận hành: vì không còn cửa 4 → 5, những hồ sơ ĐANG đứng sẵn ở bước 4 với tiến độ
// Phòng < 100% (vào bước 4 từ trước khi có chốt này) sẽ sang bước 5 được mà không ai chặn —
// chúng không đi qua cửa 3 → 4 nữa. Cần rà lại nhóm hồ sơ đó một lượt sau khi lên bản mới.
export const CHOT_TIEN_DO_PHONG_KHI_ROI_BUOC: number[] = [3];

// ===== CHỐT TIẾN ĐỘ BỘ PHẬN 100% TRƯỚC KHI TRÌNH PHÒNG DUYỆT (chị Trâm chốt 27/07/2026) =====
// Bước 2 "Triển khai hồ sơ thầu" là phần việc của Bộ phận. Chưa làm xong 100% thì không đẩy sang
// bước 3 (Duyệt hồ sơ thầu cấp phòng) được — Trưởng phòng chỉ duyệt khi hồ sơ đã hoàn chỉnh.
// Áp cho CẢ Quản lý lẫn Trưởng phòng: TP cũng không kéo tay qua cửa này.
// Cùng cách đọc với CHOT_TIEN_DO_PHONG_KHI_ROI_BUOC: liệt kê bước mà khi RỜI khỏi để tiến lên
// thì phải đủ 100%. Muốn bỏ chốt thì để mảng rỗng.
export const CHOT_TIEN_DO_BO_PHAN_KHI_ROI_BUOC: number[] = [2];

// ===== ẢNH BÁO CÁO ĐÃ GỬI BÁO GIÁ: BẮT BUỘC hay CHỈ NHẮC? (chị Trâm chốt 18/08/2026) =====
// Ban đầu đây là CỬA CHẶN của bước 2 → 3 (góp ý #12, chính chị Trâm đặt ra). Nhưng ảnh cần lưu vào
// collection `anhDinhKem` mà Firestore chưa mở quyền, nên trên bản web việc kéo 2 → 3 bị KẸT CỨNG —
// chị Trâm: "tại vì sợ IT ko mở, nếu mở ảnh hưởng tới luồng hệ thống, cái này c đưa sau này cũng đc"
// và "còn giờ đừng gán cứng, cũng cực cho anh em quản lý".
//
// Nay để `false` = chỉ NHẮC: thiếu ảnh vẫn cho thẻ sang Bước 3, app hiện câu nhắc bổ sung sau.
// 👉 KHI IT ĐÃ MỞ QUYỀN và Phòng muốn siết lại: đổi đúng MỘT dòng này thành `true` là quay về bắt buộc,
//    không phải sửa chỗ nào khác.
export const ANH_BAO_CAO_BAT_BUOC = false;

// Đa quản lý (chị chốt 17/07): 1 quản lý CHÍNH + nhiều quản lý PHỤ/kế thừa đều có quyền thao tác.
// Dùng cho mọi kiểm tra "người này có phải quản lý của dự án không".
export const isProjectManager = (p: { quanLyId?: string; quanLyIdsPhu?: string[] }, staffId?: string): boolean =>
  !!staffId && (p.quanLyId === staffId || !!p.quanLyIdsPhu?.includes(staffId));
// Danh sách toàn bộ quản lý (chính + phụ), lọc rỗng — để gửi thông báo cho tất cả.
export const allManagerIds = (p: { quanLyId?: string; quanLyIdsPhu?: string[] }): string[] =>
  Array.from(new Set([p.quanLyId, ...(p.quanLyIdsPhu || [])].filter(Boolean))) as string[];

// KHÓA CẬP NHẬT TIẾN ĐỘ VIỆC CON từ bước 3 (Duyệt hồ sơ thầu cấp Phòng) trở đi.
// Lý do nghiệp vụ: Bộ phận phải làm xong TRƯỚC, rồi Trưởng phòng mới kiểm tra & duyệt. Nếu vẫn cho
// sửa việc con trong lúc TP đang duyệt thì sinh mâu thuẫn: Bộ phận chưa xong mà Phòng đã duyệt 100%
// (chị Trâm chốt 26/07/2026). Muốn sửa lại thì TP kéo hồ sơ về bước trước.
export const khoaCapNhatViecCon = (p?: { kanbanStep?: number }): boolean =>
  (p?.kanbanStep || 1) >= KANBAN_L1_ONLY_FROM;

// CHỮ KÝ KẾ HOẠCH — chỉ gồm những gì thuộc về "kế hoạch": danh sách việc con, tên, tỉ trọng,
// người được giao, lịch (ngày bắt đầu / số ngày) và vòng. CỐ Ý BỎ tiến độ, kết quả, cờ hoàn thành.
// Chị Trâm báo 28/07/2026: nhân viên chỉ cập nhật tiến độ mà Quản lý vẫn nhận tin "vừa chỉnh sửa
// kế hoạch" — vì code cũ so sánh JSON toàn bộ cây việc, tiến độ nhúc nhích là coi như đổi kế hoạch.
export const chuKyKeHoach = (list?: ProjectTask[]): string => {
  const walk = (arr?: ProjectTask[]): unknown[] => (arr || []).map(t => [
    t.id,
    t.name,
    t.weight ?? 0,
    t.assignedTo || '',
    [...(t.assignedStaffIds || [])].sort().join(','),
    t.ngayBatDau || '',
    t.soNgay ?? 0,
    t.vong ?? 1,
    walk(t.subtasks),
  ]);
  return JSON.stringify(walk(list));
};

// Toàn bộ nhân sự được giao việc BÊN TRONG kế hoạch (quét đệ quy cả cây việc con).
// Cần thiết vì thucHienId/thucHienIds ở cấp hồ sơ chỉ được tổng hợp lại khi kế hoạch
// đi qua form hoặc màn công việc con — hồ sơ nhập từ Excel / dữ liệu cũ thì 2 trường
// đó có thể rỗng, dẫn tới nhân viên trong kế hoạch không nhận được thông báo.
export const taskAssigneeIds = (tasks?: ProjectTask[]): string[] => {
  const out = new Set<string>();
  const walk = (list?: ProjectTask[]) => (list || []).forEach(t => {
    [t.assignedTo, ...(t.assignedStaffIds || [])].forEach(id => { if (id) out.add(id); });
    walk(t.subtasks);
  });
  walk(tasks);
  return Array.from(out);
};

// Mọi nhân sự THỰC HIỆN của một hồ sơ: cấp hồ sơ + trong cây việc con.
export const allAssigneeIds = (p: { thucHienId?: string; thucHienIds?: string[]; tasks?: ProjectTask[] }): string[] =>
  Array.from(new Set([p.thucHienId, ...(p.thucHienIds || []), ...taskAssigneeIds(p.tasks)].filter(Boolean))) as string[];

// ===== MỌI "hạn" bám 1 NGUỒN duy nhất = mốc kết thúc VIỆC CON (sơ đồ Gantt) =====
type DeadlineFields = { ngayBatDau: string; tasks?: ProjectTask[]; soNgayThucHien?: number; soNgayDuyetTP?: number; soNgayDuyetBLD?: number; soNgayDuKien?: number; vongHienTai?: number };

// Ngày BẮT ĐẦU của VÒNG hiện tại (chị Trâm báo lỗi 27/07/2026).
// Vòng 1 = ngày bắt đầu dự án. Vòng ≥ 2 (hồ sơ bị CĐT trả về làm lại) = ngày bắt đầu SỚM NHẤT
// trong các việc con của vòng đó — để dòng thời gian & hạn thầu tính LẠI từ vòng mới, không kéo
// dài từ lần gửi CĐT đầu tiên. Vòng vừa mở chưa lập việc con thì tạm lấy ngày bắt đầu dự án.
export const getRoundStart = (p: DeadlineFields): Date => {
  const vong = Math.max(1, p.vongHienTai || 1);
  if (vong <= 1) return new Date(p.ngayBatDau);
  const roundTasks = tasksOfRound(p.tasks, vong).filter(t => t.ngayBatDau);
  if (roundTasks.length === 0) return new Date(p.ngayBatDau);
  const earliest = roundTasks.reduce(
    (min, t) => Math.min(min, new Date(t.ngayBatDau!).getTime()),
    Infinity
  );
  return new Date(earliest);
};
// Mốc KẾT THÚC thực hiện = ngày kết thúc muộn nhất của các việc con (cùng cách xếp lịch với SubtaskGantt:
// việc chưa đặt ngày thì xếp nối tiếp từ ngày bắt đầu dự án). Không có việc con → dùng số ngày thực hiện dự kiến.
// TÍNH CẢ NGÀY ĐẦU (chị Trâm báo lỗi 25/07/2026): việc bắt đầu 25/07 làm 3 ngày thì NGÀY CUỐI là 27/07,
// không phải 28/07. Trước đây hàm này cộng thẳng `days` (bỏ ngày đầu) nên hạn tổng bị lệch 1 ngày so với
// sơ đồ Gantt và ô "Bộ phận thực hiện" — cùng một form mà Gantt ghi 20/07→27/07 còn hạn lại ra 29/07.
export const getExecEnd = (p: DeadlineFields): Date => {
  const DAY = 24 * 60 * 60 * 1000;
  const vong = Math.max(1, p.vongHienTai || 1);
  const start = getRoundStart(p);
  // CHỈ tính việc con của VÒNG hiện tại. Vòng 1 gồm cả việc con dữ liệu cũ không ghi `vong`
  // (vongCuaViec coi thiếu = 1) nên hồ sơ 1 vòng chạy y như trước. Vòng ≥ 2 bỏ qua việc con vòng cũ.
  const list = tasksOfRound(p.tasks, vong);
  if (list.length === 0) {
    const execDays = p.soNgayThucHien ?? Math.max(1, (p.soNgayDuKien ?? 3) - 2);
    return new Date(start.getTime() + Math.max(0, execDays - 1) * DAY);
  }
  let cursor = start.getTime();   // ngày làm việc tiếp theo còn trống
  let maxEnd = cursor;
  for (const t of list) {
    const ts = t.ngayBatDau ? new Date(t.ngayBatDau).getTime() : cursor;
    const days = t.soNgay && t.soNgay > 0 ? t.soNgay : DEFAULT_TASK_DAYS;
    const end = ts + Math.max(0, days - 1) * DAY;  // NGÀY CUỐI làm việc
    cursor = end + DAY;                            // việc kế tiếp bắt đầu ngày hôm sau
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
        // So theo NGÀY, không so giờ: hạn là 00:00 nên so thẳng với Date.now() sẽ báo trễ ngay
        // từ nửa đêm của chính ngày hết hạn, dù ngày đó vẫn còn nguyên chưa hết (chị Trâm báo 28/07/2026).
        const overdue = ymdOf(dl) < todayISO() && (project.tienDoPhong || 0) < 100;
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
          <AutoGrowTextarea
            value={ketQua}
            onChange={(e) => setKetQua(e.target.value)}
            placeholder="VD: Đã rà soát toàn bộ đơn giá và khối lượng BOQ, hồ sơ đạt yêu cầu trình ký..."
            className="w-full p-2 text-xs bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        ) : (
          <div className="p-2.5 bg-slate-50 dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 min-h-10 font-medium whitespace-pre-wrap">
            {project.ketQuaPhong?.trim() || 'Trưởng phòng chưa cập nhật kết quả kiểm tra cấp Phòng.'}
          </div>
        )}
      </div>
      )}

      {/* NHẬT KÝ GỬI CĐT: mỗi lần TP kéo hồ sơ từ bước 4 sang bước 5 = 1 lần gửi.
          Chụp lại tiến độ Phòng & kết quả của đúng vòng đó để đối chiếu về sau. */}
      {(project.guiCDTLogs || []).length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
            Nhật ký gửi CĐT ({tongSoLanGuiCDT(project)} lần{soLanGuiTruocApp(project) > 0 ? ` — trong đó ${soLanGuiTruocApp(project)} lần khai tay từ trước khi dùng app` : ''}):
          </span>
          {/* Chỉ ghi LẦN MẤY + NGÀY GỬI (chị Trâm chốt 25/07/2026 — không cần tiến độ/người gửi/kết quả) */}
          <ul className="space-y-1">
            {[...(project.guiCDTLogs || [])].sort((a, b) => b.lan - a.lan).map(log => (
              <li key={log.lan} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-black">
                <span className="text-brand-accent dark:text-brand-accent-300">📤 Gửi CĐT lần {nhanLanGui(project, log.lan)}</span>
                <span className="text-slate-500 dark:text-slate-400">{log.ngay.split('-').reverse().join('-')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ẢNH BÁO CÁO ĐÃ GỬI BÁO GIÁ (góp ý #12) — Quản lý đính kèm ở cửa Bước 2 → 3; TP xem tại đây
          để biết báo giá đã thực sự gửi CĐT trước khi duyệt cấp Phòng. */}
      {parseAttachments(project.anhBaoCaoGuiBaoGia).length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
            Ảnh báo cáo đã gửi báo giá ({parseAttachments(project.anhBaoCaoGuiBaoGia).length}):
          </span>
          <ul className="space-y-1">
            {parseAttachments(project.anhBaoCaoGuiBaoGia).map((name, i) => (
              <li key={`${name}-${i}`} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-lg px-2 py-1">
                <span className="flex-1 truncate" title={name}>🖼 {name}</span>
                {/* TẢI ẢNH VỀ LÀM BẰNG CHỨNG (chị Trâm 18/08/2026: "khi c báo cáo mục tiêu c cần tải
                    ảnh này về làm bằng chứng"). Ảnh thêm từ bản 18/08 có nội dung thật; ảnh khai từ
                    trước chỉ có tên nên app nói rõ là không tải được, tránh bấm mà không hiểu vì sao. */}
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await taiAnhVe(project.id, name);
                    if (!ok) {
                      window.alert(`Ảnh "${name}" chỉ được khai TÊN từ trước (bản cũ của app chưa lưu nội dung tệp) nên không tải về được.

Mở hồ sơ và dán lại ảnh để app lưu tệp thật, sau đó tải về bình thường.`);
                    }
                  }}
                  className="shrink-0 text-brand-accent dark:text-brand-accent-300 hover:underline cursor-pointer"
                  title={`Tải ảnh "${name}" về máy`}
                >
                  ⬇ Tải về
                </button>
              </li>
            ))}
          </ul>
          {project.ghiChuGuiBaoGia && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">{project.ghiChuGuiBaoGia}</p>
          )}
        </div>
      )}

      {/* Tệp/ảnh kết quả công việc cấp Phòng (nhập tại form hoặc hộp cửa Bước 3→4) — có nội dung
          thật từ 20/08/2026 nên tải về được ngay (xem PhongProgressModal.tsx / ProjectForm.tsx). */}
      {parseAttachments(project.taiLieuKetQuaPhong).length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Tệp kết quả công việc:</span>
          <ul className="space-y-1">
            {parseAttachments(project.taiLieuKetQuaPhong).map((name, i) => (
              <li key={`${name}-${i}`} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-lg px-2 py-1">
                <span className="flex-1 truncate" title={name}>📎 {name}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await taiAnhVe(project.id, name);
                    if (!ok) {
                      window.alert(`Tệp "${name}" chỉ được khai TÊN từ trước (chưa lưu nội dung tệp) nên không tải về được.\n\nMở hồ sơ và đính lại tệp/ảnh để app lưu nội dung thật, sau đó tải về bình thường.`);
                    }
                  }}
                  className="shrink-0 text-brand-accent dark:text-brand-accent-300 hover:underline cursor-pointer"
                  title={`Tải "${name}" về máy`}
                >
                  ⬇ Tải về
                </button>
              </li>
            ))}
          </ul>
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

// Dải cảnh báo "không đọc được dữ liệu cloud". Dùng ở CẢ màn chọn vai trò (bản thử/thử-cloud)
// lẫn app chính, nên tách riêng ra đây. Cho đóng được để không chắn màn hình khi đang thao tác,
// nhưng mặc định là hiện — mất đồng bộ cloud là chuyện phải biết ngay.
function BannerLoiCloud({ noiDung, onDong }: { noiDung: string; onDong: () => void }) {
  return (
    <div className="flex items-start gap-2 bg-brand-danger/10 border border-brand-danger/40 text-brand-danger rounded-xl px-3 py-2.5">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1 text-[11px] font-bold leading-relaxed">
        {noiDung}
        <div className="font-semibold opacity-80 mt-0.5">
          App vẫn chạy bằng dữ liệu trên máy này, nhưng KHÔNG đồng bộ với các máy khác.
        </div>
      </div>
      <button
        type="button"
        onClick={onDong}
        title="Ẩn cảnh báo (lỗi vẫn còn — tải lại trang là hiện lại)"
        className="text-[11px] font-black px-1.5 rounded hover:bg-brand-danger/15 cursor-pointer"
      >
        ✕
      </button>
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

  // Current logged in user (RBAC state) — danh tính + vai trò do SSO App Tổng (hpcore.vn)
  // xác lập; localStorage chỉ là cache hiển thị tức thời khi mở lại app, effect SSO bên
  // dưới sẽ đối chiếu lại với bản ghi staff/{uid} thật ngay khi có phiên Firebase.
  const [currentUser, setCurrentUser] = useState<{ email: string; role: 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER'; staffId: string; name: string } | null>(() => {
    const saved = localStorage.getItem('erp_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Dark/Light mode theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // Default to dark mode as requested (do not default to light)
  });

  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PROJECTS' | 'KANBAN' | 'GANTT' | 'STAFF' | 'SYSTEM' | 'HISTORY' | 'CALENDAR' | 'DEPTLINKS' | 'TEMPLATES'>('DASHBOARD');

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

  // Lưới ứng dụng HPCons App Tổng — mở khi bấm logo ở đầu Sidebar (giống pkd_crm-next/Task Manager)
  const [appLauncherOpen, setAppLauncherOpen] = useState(false);

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
    reportActivity({ action, entityType: 'dauthau_action', entityId: newLog.id, detail: details });
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
  // Tab "Đội Ngũ & KPI" tách 2 MỤC CON (chị Trâm chốt 26/07/2026): Đội ngũ (tài khoản & phân quyền)
  // và KPI (chỉ số). Cách tính KPI chị Trâm sẽ gửi sau → mục KPI hiện dùng bảng xếp hạng tạm.
  const [staffSubTab, setStaffSubTab] = useState<'DOI_NGU' | 'KPI'>('DOI_NGU');
  // Chuông thông báo cho Trưởng phòng (báo TP vào nhập tiến độ Phòng)
  const [showNotif, setShowNotif] = useState(false);
  // Công việc đang mở modal "CĐT điều chỉnh"
  const [cdtRevisionProject, setCdtRevisionProject] = useState<Project | null>(null);
  // Kéo hồ sơ về Bước 1: hộp hỏi "có ảnh hưởng hạn nộp không?" (Stage 1). Nếu có → mở popup dời hạn (Stage 2).
  const [pullBackProject, setPullBackProject] = useState<Project | null>(null);
  const [pullBackDelayProject, setPullBackDelayProject] = useState<Project | null>(null);
  // Bảng phân bổ đang mở ở chế độ nào: true = CÓ dời hạn, false = giữ nguyên hạn, chỉ chia lại
  // việc con (chị Trâm chốt 29/07/2026 — xem chú thích trong PullBackDelayModal).
  const [pullBackDoiTienDo, setPullBackDoiTienDo] = useState(true);
  // Hồ sơ đang mở bảng "Nhập tiến độ & kết quả cấp Phòng" — tự mở khi kéo hồ sơ sang bước 4,
  // hoặc khi TP kéo sang bước 5 mà tiến độ Phòng chưa đủ 100%.
  const [phongInputProject, setPhongInputProject] = useState<Project | null>(null);
  // Bước mà Trưởng phòng ĐANG muốn chuyển tới khi bảng nhập bật lên vì bị cửa chốt 100% chặn.
  // Nhập đủ 100% rồi bấm Lưu là hệ thống đi tiếp luôn sang bước đó, khỏi bắt kéo thẻ lại lần nữa.
  // null = bảng mở theo kiểu thông thường (không phải do bị chặn) → lưu xong đứng yên tại chỗ.
  const [phongInputChuyenBuoc, setPhongInputChuyenBuoc] = useState<number | null>(null);
  // Hồ sơ đang bị chặn ở cửa Bước 2 → 3 vì chưa có ảnh báo cáo đã gửi báo giá (góp ý #12).
  // Đính kèm ảnh trong hộp rồi lưu là thẻ tự đi tiếp sang Bước 3.
  const [anhBaoCaoProject, setAnhBaoCaoProject] = useState<Project | null>(null);
  // ===== NỚI CỬA BƯỚC 2 → 3 CHO QUẢN LÝ (chị Trâm chốt 18/08/2026 — góp ý #75) =====
  // "Quản lý level 2 ko bị khóa phải nhập tiến độ cv của mình và mô tả cv con mới đc quăng bước 2 qua
  //  bước 3... thì mở trường dự án lên cho quản lý + thông báo cần hoàn thành cv con + chụp ảnh màn
  //  hình đã báo cáo, sau khi quản lý cập nhật đầy đủ và bấm lưu dự án thì tự động qua bước 3."
  // Ghi lại mã hồ sơ Quản lý vừa kéo: lưu xong mà đã đủ điều kiện thì tự đưa thẻ sang Bước 3.
  const [choQuaBuoc3, setChoQuaBuoc3] = useState<string | null>(null);
  // ===== HỘP THOẠI XÁC NHẬN TRÌNH BƯỚC 3 — DÙNG HỘP CỦA APP (chị Trâm chốt 18/08/2026) =====
  // "cái thông báo này của e ngộ quá, e hiện thông báo dạng ô vuông giữa màn hình, và định dạng mẫu
  //  như cái thông báo kéo về hỏi có làm thay đổi tiến độ ko á e."
  // Bản trước dùng window.confirm — hộp của TRÌNH DUYỆT nên hiện cả tên miền "…vercel.app cho biết",
  // chữ và nút không theo app, đọc lên như trang lạ. Nay dùng hộp riêng giữa màn hình, cùng kiểu với
  // hộp "kéo về Bước 1 — có thay đổi tiến độ không".
  const [xacNhanQuaB3, setXacNhanQuaB3] = useState<Project | null>(null);
  // ===== BẤM THÔNG BÁO "ĐƯỢC CHỌN LÀM QUẢN LÝ" LÀ VÀO THẲNG FORM CÔNG VIỆC MỚI (góp ý #87) =====
  // Chị Trâm chốt 18/08/2026: "khi quản lý nhận đc thông báo đc chọn làm quản lý dự án A, lúc click vô
  // e thẳng tới trường công việc mới + chọn đúng tên dự án đó sẵn cho họ tạo luôn, còn thao tác thủ
  // công bấm nút tạo công việc sau đó chọn dự án vẫn giữ nguyên bình thường."
  const [duAnChonSanChoCVMoi, setDuAnChonSanChoCVMoi] = useState<string | undefined>(undefined);
  // Danh mục TEMPLATE MẪU dùng chung của phòng (góp ý #8) — đồng bộ cloud như các bảng khác.
  // Kỳ & năm cho bảng thống kê ISO (góp ý #13). Kỳ 1 = tháng 4-7 · Kỳ 2 = 8-11 · Kỳ 3 = 12,1,2,3.
  // Mặc định chọn đúng kỳ đang chạy theo tháng hiện tại (giờ Việt Nam).
  const [kyISO, setKyISO] = useState<KyBaoCao>(() => {
    const th = nowVN().getMonth() + 1;
    return (th >= 4 && th <= 7) ? 1 : (th >= 8 && th <= 11) ? 2 : 3;
  });
  const [namISO, setNamISO] = useState<string>(() => namHienTaiVN());
  const [templates, setTemplates] = useState<TenderTemplate[]>(() => {
    if (typeof localStorage === 'undefined') return [];
    try { const x = JSON.parse(localStorage.getItem('erp_templates') || '[]'); return Array.isArray(x) ? x : []; }
    catch { return []; }
  });
  const lastRemoteTemplates = useRef<string | null>(null);
  // ===== THÔNG BÁO NỘI BỘ CÓ LƯU LẠI (chị Trâm chốt 18/08/2026) =====
  // Tin trên chuông chỉ giữ 30 tin/người nên thông báo cũ bị trôi mất. Danh sách này giữ NGUYÊN VĂN
  // từng thông báo nội bộ đã gửi, đồng bộ cloud giống danh mục Template mẫu.
  const [thongBaoNoiBo, setThongBaoNoiBo] = useState<ThongBaoNoiBo[]>(() => {
    if (typeof localStorage === 'undefined') return [];
    try { const x = JSON.parse(localStorage.getItem('erp_thongbao_noibo') || '[]'); return Array.isArray(x) ? x : []; }
    catch { return []; }
  });
  const lastRemoteThongBao = useRef<string | null>(null);
  // Hộp xác nhận trước khi ghi nhận 1 LẦN GỬI CĐT (kéo bước 4 → 5). Chặn ghi nhầm khi TP
  // chỉ lỡ tay kéo qua kéo lại mà không thật sự gửi hồ sơ cho Chủ đầu tư.
  const [guiCDTConfirm, setGuiCDTConfirm] = useState<{ project: Project; lan: number } | null>(null);
  // Hộp hỏi khi TP kéo hồ sơ ĐÃ GỬI CĐT về Bước 1: mở vòng mới (lập lại việc con đủ 100%) hay
  // chỉ sửa nhỏ trong vòng hiện tại.
  const [vongMoiAsk, setVongMoiAsk] = useState<Project | null>(null);
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
  // Ô chọn tệp ẩn cho nút "Khôi phục" (tệp sao lưu .json)
  const saoLuuInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  // Expanded project accordion state
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Bề rộng VÙNG ĐANG THẤY của bảng Báo cáo tiến độ (khung cuộn ngang), tính bằng CSS px.
  // Khay "xem nhanh hồ sơ" nằm trong một <td> nên mặc định giãn theo BỀ RỘNG CẢ BẢNG; phóng to chữ
  // (Ctrl + lăn chuột) là bảng rộng gần gấp đôi vùng thấy → nửa khay lọt ra ngoài khung, phải cuộn
  // ngang mới thấy và nhiều thông tin bị cắt (chị Trâm báo 18/08/2026). Đo số này rồi ghim khay theo nó.
  const [khungCuonBang, setKhungCuonBang] = useState<HTMLDivElement | null>(null);
  const [rongVungXemBang, setRongVungXemBang] = useState<number>(0);

  useEffect(() => {
    if (!khungCuonBang) return;
    const doLai = () => setRongVungXemBang(khungCuonBang.clientWidth);
    doLai();
    // ResizeObserver bắt cả 3 trường hợp: đổi cỡ cửa sổ, thu/mở thanh điều hướng, và đổi cỡ chữ
    // (zoom đặt trên <body> làm clientWidth theo CSS px thay đổi theo).
    const ro = new ResizeObserver(doLai);
    ro.observe(khungCuonBang);
    return () => ro.disconnect();
  }, [khungCuonBang]);

  // Staff personal workspace: which task has its result editor open (key: `${projectId}-${taskId}`)
  const [expandedStaffTaskId, setExpandedStaffTaskId] = useState<string | null>(null);

  // Bộ lọc năm của Dashboard — mặc định NĂM HIỆN TẠI theo lịch Việt Nam (tự đổi khi qua năm mới,
  // không phải sửa code). Trước đây lấy new Date().getFullYear() = năm theo giờ máy.
  const [dashboardYear, setDashboardYear] = useState<string>(() => namHienTaiVN());
  // Lọc dự án/hồ sơ theo trạng thái hoàn thành (dùng cho "Danh sách dự án" & "Tổng hợp tình trạng").
  // Mặc định TÙY VAI TRÒ — xem macDinhLocTrangThai (L1 & L4 thấy hết, L2/L3 chỉ việc đang làm).
  const [projStatusFilter, setProjStatusFilter] = useState<'ACTIVE' | 'DONE' | 'ALL'>(
    () => macDinhLocTrangThai(currentUser?.role)
  );
  // Đổi người đăng nhập (hoặc bấm xem thử L1/L2/L3/L4 trong Bản thử) → đặt lại bộ lọc về mặc
  // định của vai trò MỚI. Bám theo ref để chỉ đặt lại khi VAI TRÒ đổi — nếu đặt lại theo mỗi
  // lần render thì người dùng vừa bấm chọn "Đã xong" xong là bị nhảy về ngay.
  const vaiTroDaApLocMacDinh = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const vaiTro = currentUser?.role ?? null;
    if (vaiTroDaApLocMacDinh.current === vaiTro) return;
    vaiTroDaApLocMacDinh.current = vaiTro;
    setProjStatusFilter(macDinhLocTrangThai(vaiTro ?? undefined));
  }, [currentUser?.role]);

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

  // Đồng hồ hiển thị ở góc trang đăng nhập + ngày giờ trên header sau đăng nhập.
  // CẢ HAI đều lấy GIỜ VIỆT NAM cố định (xem nowVN) — trước đây đồng hồ trang đăng nhập in giờ
  // UTC nên lệch 7 tiếng, còn header thì lấy giờ máy nên máy cài sai múi giờ là hiện sai
  // (chị Trâm báo 17/08/2026).
  const [vnTime, setVnTime] = useState('');
  const [localNow, setLocalNow] = useState(() => nowVN());

  useEffect(() => {
    const updateTime = () => {
      const vn = nowVN();
      const h = String(vn.getHours()).padStart(2, '0');
      const m = String(vn.getMinutes()).padStart(2, '0');
      const s = String(vn.getSeconds()).padStart(2, '0');
      setVnTime(`${h}:${m}:${s}`);
      setLocalNow(vn);
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
  // Lỗi ĐỌC dữ liệu cloud (thường là Rules chặn) — hiện banner giữ nguyên trên màn hình,
  // vì app vẫn chạy bình thường với dữ liệu cục bộ nên rất dễ tưởng "cloud đang ổn".
  const [loiCloud, setLoiCloud] = useState<string | null>(null);
  // Lỗi cầu nối SSO (khác 401) — hiện thông báo + nút thử lại thay vì treo màn hình mãi.
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [ssoRetryTick, setSsoRetryTick] = useState(0);
  // Đã đăng nhập App Tổng hợp lệ NHƯNG chưa được cấp quyền dùng app Đấu Thầu
  // (app_permissions/{uid}.dauthau chưa gán) — chặn hẳn, không tự cấp STAFF mặc định nữa.
  const [ssoUnauthorized, setSsoUnauthorized] = useState(false);
  // Đã đối chiếu quyền với App Tổng THÀNH CÔNG lần này chưa — false thì luôn hiện màn
  // xác thực/chặn, KHÔNG render app chính bằng currentUser cache cũ (tránh lọt hình 1-2s
  // trước khi bị khóa khi quyền đã bị thu hồi).
  const [sessionVerified, setSessionVerified] = useState(false);

  useEffect(() => watchAuth(u => {
    setFbAuthed(!!u);
    if (!u) {
      // Phiên Firebase kết thúc → khóa dữ liệu cloud
      lastRemoteProjects.current = null;
      lastRemoteStaff.current = null;
      lastRemoteNotifs.current = null;
    }
  }), []);

  // Cầu nối SSO: chưa có phiên Firebase → xin Custom Token từ App Tổng (hpcore.vn) rồi
  // đăng nhập. Không có phiên hpcore hợp lệ (cookie thiếu/hết hạn) → rời sang trang
  // đăng nhập App Tổng, quay lại đúng URL hiện tại sau khi đăng nhập xong.
  useEffect(() => {
    // CỐ Ý không "if (fbAuthed) return" — phiên Firebase cũ (đăng nhập từ trước khi bị thu hồi
    // quyền, hoặc cache currentUser trong localStorage) vẫn phải được đối chiếu lại với quyền
    // trung tâm MỖI LẦN mở app, không thì người đã bị gỡ quyền vẫn lọt vào bằng phiên cũ.
    // BẢN THỬ: không gọi SSO, không rời trang sang App Tổng — mở màn chọn vai trò ngay.
    if (DEV_SANDBOX) {
      setSessionVerified(true);
      return;
    }
    // Yêu cầu thử-cloud nhưng đang trỏ project THẬT → chặn hẳn, nói rõ lý do, KHÔNG redirect.
    if (DEV_CLOUD_TEST_BI_CHAN) {
      // Nói đúng việc cần làm theo từng chế độ: bản demo trên web thì khai BIẾN MÔI TRƯỜNG ở nơi
      // deploy, còn chạy trên máy thì sửa config trong file. Chỉ đường sai là mất cả buổi.
      setSsoError(
        DEMO_WEB_DUOC_YEU_CAU
          ? `Đã bật NEXT_PUBLIC_DEMO_WEB=1 nhưng app vẫn đang trỏ project Firebase THẬT `
            + `("${PROJECT_THAT}"). Bản demo bị chặn để dữ liệu thật của Phòng không bị ai sửa. `
            + `Hãy khai thêm biến môi trường NEXT_PUBLIC_FIREBASE_CONFIG (JSON config của project `
            + `Firebase THỬ) ở nơi deploy rồi deploy lại.`
          : `Đã bật NEXT_PUBLIC_DEV_CLOUD_TEST=1 nhưng src/lib/firebase.ts vẫn đang trỏ project THẬT `
            + `("${PROJECT_THAT}"). Chế độ thử-cloud bị chặn để không ghi/xóa dữ liệu thật của Phòng. `
            + `Hãy đổi config sang project Firebase THỬ rồi tải lại trang.`
      );
      return;
    }
    // THỬ-CLOUD: bỏ qua SSO (cookie App Tổng không tới localhost), lấy phiên Firebase bằng
    // đăng nhập ẩn danh để Rules vẫn thấy "đã đăng nhập", rồi mở màn chọn vai trò.
    if (DEV_CLOUD_TEST) {
      setSessionVerified(true);
      signInAnonymouslyFb().catch(e => {
        console.error('[Thử-cloud] Không đăng nhập ẩn danh được:', e);
        setSsoError(
          `Không đăng nhập ẩn danh được vào project thử "${projectIdDangChay()}": ${e?.message || e}. `
          + `Kiểm tra Firebase Console → Authentication → Sign-in method → bật "Anonymous".`
        );
      });
      return;
    }
    let cancelled = false;
    setSsoError(null);
    setSsoUnauthorized(false);
    (async () => {
      try {
        const res = await fetch('/api/auth/hpcore-session');
        if (res.status === 401) {
          // Không có phiên hpcore hợp lệ (thiếu/hết hạn cookie) → sang trang đăng nhập App Tổng.
          window.location.href = `https://account.hpcore.vn/login?next=${encodeURIComponent(window.location.href)}`;
          return;
        }
        if (res.status === 403) {
          // Đăng nhập App Tổng hợp lệ nhưng chưa/không còn được cấp quyền dùng app này —
          // đăng xuất khỏi Firebase + xóa cache hiển thị cũ, dừng hẳn tại đây.
          localStorage.removeItem('erp_current_user');
          if (!cancelled) setCurrentUser(null);
          await signOutFb().catch(() => {});
          if (!cancelled) setSsoUnauthorized(true);
          return;
        }
        if (!res.ok) {
          // Lỗi khác (vd. server chưa cấu hình đủ biến môi trường) — không redirect vòng lặp,
          // hiện thông báo + nút thử lại thay vì treo màn hình mãi.
          const body = await res.json().catch(() => ({}));
          console.error('[SSO] Lỗi cấp Custom Token:', res.status, body);
          if (!cancelled) setSsoError(body?.error || `Lỗi ${res.status}`);
          return;
        }
        const { token } = await res.json();
        if (!cancelled) await signInWithHpcoreToken(token);
        if (!cancelled) setSessionVerified(true);
      } catch (e: any) {
        console.error('[SSO] Lỗi đăng nhập qua App Tổng:', e);
        if (!cancelled) setSsoError(e?.message || 'Lỗi kết nối');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cố ý KHÔNG phụ thuộc fbAuthed
    // (xem comment đầu effect) — chỉ chạy lại khi mount lần đầu hoặc bấm "Thử lại".
  }, [ssoRetryTick]);

  useEffect(() => {
    if (DEV_SANDBOX) return; // BẢN THỬ: không đọc/ghi Firestore — dữ liệu thật tuyệt đối không bị đụng
    if (!fbAuthed) return; // Rules yêu cầu đăng nhập — chỉ lắng nghe dữ liệu sau khi có phiên Firebase
    // Không đọc được cloud thì PHẢI nói ra: 3 collection cùng lỗi nên chỉ báo MỘT lần cho gọn.
    // Im lặng ở đây là người dùng chỉ thấy app trắng dữ liệu và không biết tại sao.
    // Dùng BANNER giữ nguyên trên màn hình, không phải toast tự tắt sau vài giây: đây là lỗi
    // cấu hình/kết nối, còn lỗi là còn phải thấy. Toast cũng bắn kèm cho ai đang nhìn chỗ khác.
    let daBaoLoiCloud = false;
    const baoLoiCloud = (colName: string, message: string) => {
      if (daBaoLoiCloud) return;
      daBaoLoiCloud = true;
      const noiDung = /permission/i.test(message)
        ? `Không đọc được dữ liệu trên cloud (collection "${colName}"): bị Rules của Firestore chặn. `
          + `Kiểm tra Firebase Console → Firestore → Rules.`
        : `Không đọc được dữ liệu trên cloud (collection "${colName}"): ${message}`;
      setLoiCloud(noiDung);
      triggerToast(noiDung);
    };
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
    }, baoLoiCloud);
    const unsubStaff = subscribeCollection<Staff>('staff', (items, isEmpty) => {
      if (isEmpty) {
        setStaff(prev => {
          lastRemoteStaff.current = JSON.stringify(prev.length > 0 ? prev : []);
          if (prev.length > 0) {
            pushCollection('staff', prev).catch(err => console.error('[Firebase] Lỗi đẩy nhân sự lần đầu:', err));
          }
          return prev;
        });
        return;
      }
      const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
      lastRemoteStaff.current = JSON.stringify(sorted);
      setStaff(sorted);
    }, baoLoiCloud);
    const unsubNotifs = subscribeCollection<AppNotification>('notifications', (items, isEmpty) => {
      if (isEmpty) { lastRemoteNotifs.current = '[]'; setNotifs([]); return; }
      const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
      lastRemoteNotifs.current = JSON.stringify(sorted);
      setNotifs(sorted);
    }, baoLoiCloud);
    const unsubTemplates = subscribeCollection<TenderTemplate>('templates', (items, isEmpty) => {
      if (isEmpty) { lastRemoteTemplates.current = '[]'; setTemplates([]); return; }
      const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
      lastRemoteTemplates.current = JSON.stringify(sorted);
      setTemplates(sorted);
    }, baoLoiCloud);
    const unsubThongBao = subscribeCollection<ThongBaoNoiBo>('announcements', (items, isEmpty) => {
      if (isEmpty) { lastRemoteThongBao.current = '[]'; setThongBaoNoiBo([]); return; }
      const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
      lastRemoteThongBao.current = JSON.stringify(sorted);
      setThongBaoNoiBo(sorted);
    }, baoLoiCloud);
    return () => { unsubProjects(); unsubStaff(); unsubNotifs(); unsubTemplates(); unsubThongBao(); };
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

  // Đồng bộ danh mục Template mẫu lên cloud (chỉ sau snapshot đầu, tránh ghi đè)
  useEffect(() => {
    localStorage.setItem('erp_templates', JSON.stringify(templates));
    const sorted = [...templates].sort((a, b) => a.id.localeCompare(b.id));
    const serialized = JSON.stringify(sorted);
    if (lastRemoteTemplates.current !== null && serialized !== lastRemoteTemplates.current) {
      lastRemoteTemplates.current = serialized;
      pushCollection('templates', sorted).catch(err => console.error('[Firebase] Lỗi đồng bộ template mẫu:', err));
    }
  }, [templates]);

  // Đồng bộ danh sách thông báo nội bộ đã lưu lên cloud (chỉ sau snapshot đầu, tránh ghi đè)
  useEffect(() => {
    localStorage.setItem('erp_thongbao_noibo', JSON.stringify(thongBaoNoiBo));
    const sorted = [...thongBaoNoiBo].sort((a, b) => a.id.localeCompare(b.id));
    const serialized = JSON.stringify(sorted);
    if (lastRemoteThongBao.current !== null && serialized !== lastRemoteThongBao.current) {
      lastRemoteThongBao.current = serialized;
      pushCollection('announcements', sorted).catch(err => console.error('[Firebase] Lỗi đồng bộ thông báo nội bộ:', err));
    }
  }, [thongBaoNoiBo]);

  // Gửi thông báo tới danh sách nhân sự (bỏ qua chính mình); giữ tối đa 30 thông báo/người.
  // CHỐNG TRÙNG: cùng người nhận + cùng nội dung + cùng hồ sơ → chỉ giữ 1 thông báo
  // (tránh việc chỉnh kế hoạch nhiều lần bắn lặp "bạn được giao việc" cho nhân sự).
  // ===== LỌC THÔNG BÁO THEO BƯỚC HỒ SƠ (chị Trâm chốt 27/07/2026) =====
  // Hồ sơ đã lên bước 3 (Duyệt hồ sơ thầu cấp phòng) trở đi là phần việc của Trưởng phòng, nên
  // Quản lý (L2) và Nhân viên (L3) KHÔNG nhận tin nữa cho đỡ nhiễu chuông. Từ mốc đó họ chỉ còn
  // được báo đúng 3 việc, và các chỗ đó gọi pushNotify với luonBao = true để đi xuyên bộ lọc:
  //   · Gói thầu TRÚNG THẦU        · Gói thầu RỚT THẦU
  //   · Hồ sơ bị kéo NGƯỢC về Bước 1 / Bước 2 để chỉnh sửa (việc quay lại tay họ)
  // Trưởng phòng (BOOD) không bị lọc — vẫn nhận đủ mọi tin như trước.
  const vaiTroCuaNhanSu = (id: string): string | undefined => {
    const s = staff.find(x => x.id === id);
    return s && (s.role || chucVuToRole(s.chucVu));
  };

  // ===== TIN HỆ THỐNG KHÔNG ĐƯỢC MANG TÊN NGƯỜI (chị Trâm báo 17/08/2026, kèm ảnh) =====
  // Tin nhắc hạn do BỘ ĐẾM THỜI GIAN tự bắn, không phải ai thao tác. Trước đây pushNotify gán
  // actorId = người đang đăng nhập cho MỌI tin, nên chuông hiện ảnh + tên của người tình cờ đang
  // mở app lúc đồng hồ chạy tới mốc nhắc — đọc lên y như "người đó giao/làm việc con này", trong
  // khi họ hoàn toàn không liên quan tới việc con đó. Truyền laTinHeThong = true để BỎ TRỐNG
  // actorId; NotificationFeed thấy trống thì hiện biểu tượng chuông + nhãn "Hệ thống nhắc".
  const pushNotify = (targetIds: (string | undefined)[], text: string, projId?: string, luonBao = false, laTinHeThong = false) => {
    let ids = Array.from(new Set(targetIds.filter(Boolean) as string[])).filter(id => id !== currentUser?.staffId);
    if (!luonBao && projId) {
      const hoSo = projects.find(x => x.id === projId);
      if (hoSo && deriveKanbanStep(hoSo) >= KANBAN_L1_ONLY_FROM) {
        ids = ids.filter(id => vaiTroCuaNhanSu(id) === 'BOOD');
      }
    }
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setNotifs(prev => {
      const items: AppNotification[] = ids
        .filter(tid => !prev.some(n => n.targetId === tid && n.text === text && n.projId === projId))
        // actorId gán TẠI ĐÂY (không phải ở từng chỗ gọi): mọi tin do pushNotify bắn ra đều là
        // hệ quả của việc người đang đăng nhập vừa làm, nên lấy luôn — khỏi sửa hàng chục chỗ gọi.
        .map((tid, i) => ({
          id: `N${Date.now()}-${i}-${tid}`, targetId: tid, text, projId, ngay: now,
          actorId: laTinHeThong ? undefined : currentUser?.staffId,
        }));
      if (items.length === 0) return prev;
      const merged = [...prev, ...items];
      const byTarget: Record<string, AppNotification[]> = {};
      merged.forEach(n => { (byTarget[n.targetId] = byTarget[n.targetId] || []).push(n); });
      return Object.values(byTarget).flatMap(list => [...list].sort((a, b) => a.ngay.localeCompare(b.ngay)).slice(-30));
    });
  };

  // Tự nhắc CHÍNH MÌNH (khác pushNotify — pushNotify loại trừ bản thân). Dùng cho Lịch cá nhân:
  // đẩy tin lên chuông + popup thông báo trình duyệt (nếu đã được cấp quyền).
  // projId: hồ sơ liên quan — có thì bấm vào tin mở đúng hồ sơ đó (tin nhắc hạn việc con cần cái
  // này, trước đây để trống nên bấm vào không đi đâu). Tin tự nhắc luôn KHÔNG có actorId → chuông
  // hiện "Hệ thống nhắc".
  const notifySelf = (text: string, projId?: string) => {
    const id = currentUser?.staffId;
    if (!id) return;
    const now = new Date().toISOString();
    setNotifs(prev => {
      if (prev.some(n => n.targetId === id && n.text === text)) return prev;
      const merged = [...prev, { id: `N${Date.now()}-self`, targetId: id, text, projId, ngay: now } as AppNotification];
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

  // ===== NHẮC HẠN CÔNG VIỆC CON (chị Trâm chốt 25/07/2026) =====
  // Hai mốc nhắc, mỗi mốc 1 lần:
  //   • 08h00 NGÀY TRƯỚC ngày hết hạn  → "còn 1 ngày"
  //   • 13h30 NGÀY HẾT HẠN             → "còn nửa ngày"
  // Người nhận: CHỈ nhân sự được giao việc con (chị Trâm chốt 27/07/2026).
  // Trước đó Quản lý chính/phụ cũng nhận, nhưng hồ sơ nhiều việc con cùng hạn thì chuông của
  // Quản lý bị dội hàng loạt tin trùng nội dung → bỏ hẳn. Quản lý theo dõi hạn qua Kanban/Gantt.
  // Chống gửi trùng: pushNotify/notifySelf đã bỏ qua tin cùng người nhận + cùng nội dung, và
  // thông báo đồng bộ qua cloud nên nhiều máy cùng mở app cũng chỉ ra 1 tin/người.
  // Cửa sổ nhắc có giới hạn (mốc 2 chỉ trong ~1,5 ngày) để việc quá hạn lâu không nhắc lại mãi
  // khi danh sách thông báo cũ bị dọn (giữ tối đa 30 tin/người).
  useEffect(() => {
    if (!currentUser?.staffId) return;
    const DAY = 86400000;
    const check = () => {
      const now = Date.now();
      projects.forEach(p => {
        if (p.loaiBanGhi === 'DU_AN') return;          // dự án cha không có việc con
        if (hoSoChoTPDuyet(p)) return;                 // kế hoạch chưa được TP duyệt (kể cả vòng mới) thì chưa nhắc
        if (p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN') return;
        const hanGoi = p.ngayHoanThanhDuKienHienTai || p.ngayHoanThanhDuKienGoc;
        const walk = (list?: ProjectTask[]) => (list || []).forEach(t => {
          walk(t.subtasks);
          if (t.isCompleted) return;
          if (t.subtasks?.length) return;              // chỉ nhắc việc lá (việc thực làm)
          const han = taskDeadlineISO(t, hanGoi);
          if (!han) return;
          // Mốc 0h của NGÀY hạn — dùng để đặt hai mốc nhắc (08h ngày trước hạn · 13h30 ngày hạn).
          const hanMs = new Date(`${han}T00:00:00`).getTime();
          if (isNaN(hanMs)) return;
          // Giờ hạn thật của việc con (góp ý #20): có nhập giờ thì nhắc & ghi đúng giờ đó,
          // bỏ trống thì giữ nguyên cách cũ — hết ngày, tức "phải xong trước 23:59".
          // ===== VIỆC LẺ NỬA NGÀY THÌ HẠN LÀ 12:00 TRƯA (chị Trâm hỏi 18/08/2026) =====
          // "em xem hạn thông báo của nhân sự khi họ nhận đc tiến độ có lẻ 0.5 ngày em tính như thế nào".
          // LỆCH THẬT em tìm ra: ô "Giờ hạn" (`gioHan`) đã BỎ ở mục #24 khi chuyển sang bước nửa ngày,
          // nên `t.gioHan` nay luôn trống → chỗ nhắc hạn này rơi về mốc 23:59 cho MỌI việc, kể cả việc
          // 3,5 ngày mà hạn thật là 12:00 trưa. Trong khi màn tác vụ của nhân sự (taskHanText) lại hiện
          // đúng "21-08-2026 12:00" → hai chỗ nói hai giờ khác nhau cho cùng một việc.
          // Nay dùng CHUNG luật với màn tác vụ: việc lẻ nửa ngày → 12:00, việc tròn ngày → hết ngày.
          const gioHanChuan = chuanHoaGio(t.gioHan) || (laNuaNgayViec(t) ? '12:00' : undefined);
          const gioHanChu = gioHanChuan || '23:59';
          const nguoiNhan = Array.from(new Set(
            [t.assignedTo, ...(t.assignedStaffIds || [])].filter(Boolean) as string[]
          ));
          if (!nguoiNhan.length) return;
          const moc1 = hanMs - DAY + 8 * 3600000;        // 08h00 ngày trước hạn
          // Mốc nhắc trong NGÀY HẠN: mặc định 13h30. Việc con có giờ hạn sớm hơn (vd hạn 10:00)
          // thì nhắc TRƯỚC 2 tiếng, chứ 13h30 mới nhắc thì đã trễ mất rồi (góp ý #20).
          const mocGioHan = gioHanChuan ? mocHanViec(han, gioHanChuan) : NaN;
          const moc2 = gioHanChuan
            ? Math.min(hanMs + 13.5 * 3600000, Math.max(hanMs, mocGioHan - 2 * 3600000))
            : hanMs + 13.5 * 3600000;
          const hanVN = han.split('-').reverse().join('-');
          const nhan = (text: string) => {
            // laTinHeThong = true: nhắc hạn là tin của HỆ THỐNG, không gán tên người đang mở app.
            if (nguoiNhan.includes(currentUser.staffId)) notifySelf(text, p.id);
            pushNotify(nguoiNhan, text, p.id, false, true);
          };
          // DÙNG CHUNG MỘT BIỂU TƯỢNG ⏰ cho mọi tin nhắc hạn (chị Trâm chốt 29/07/2026):
          // trước đây mốc 1 dùng ⏰ còn mốc 2 dùng ⚠, hai tin cùng loại mà nhìn như hai hệ thống
          // khác nhau. Mức độ gấp thể hiện bằng CÂU CHỮ, không phải bằng đổi biểu tượng.
          // Bỏ chữ "còn nửa ngày": hạn tính tới HẾT NGÀY nên đúng ngày hạn vẫn còn giờ làm,
          // nói "nửa ngày" là tự đặt ra một mốc không có trong quy định.
          if (now >= moc1 && now < moc2) {
            nhan(`⏰ Còn 1 ngày: việc "${t.name}" (${p.hangMuc} — ${p.tenDuAn}) tới hạn ngày ${hanVN}${gioHanChuan ? ` lúc ${gioHanChuan}` : ''}.`);
          } else if (now >= moc2 && now < hanMs + 2 * DAY) {
            nhan(`⏰ Đến hạn hôm nay: việc "${t.name}" (${p.hangMuc} — ${p.tenDuAn}) phải xong trước ${gioHanChu} ngày ${hanVN}.`);
          }
        });
        walk(p.tasks);
      });
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notifySelf/pushNotify đọc state mới nhất qua setNotifs
  }, [currentUser?.staffId, projects]);

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

  // ===== Popup trình duyệt cho thông báo MỚI nhận được (chuông không đủ nổi bật) =====
  // Chỉ popup tin xuất hiện SAU khi app đã nạp xong danh sách hiện có: lần chạy đầu chỉ
  // ghi nhận id để làm mốc, nếu không mỗi lần mở app sẽ popup lại toàn bộ tin cũ.
  // Nhiều tin cùng lúc → gộp 1 popup để không lấp màn hình. Cần quyền Notification.
  const popupedNotifIds = useRef<Set<string>>(new Set());
  const notifPopupReady = useRef(false);
  useEffect(() => {
    if (!currentUser?.staffId) { notifPopupReady.current = false; popupedNotifIds.current = new Set(); return; }
    if (!notifPopupReady.current) {
      myNotifs.forEach(n => popupedNotifIds.current.add(n.id));
      notifPopupReady.current = true;
      return;
    }
    const fresh = myNotifs.filter(n => !n.daDoc && !popupedNotifIds.current.has(n.id));
    if (!fresh.length) return;
    fresh.forEach(n => popupedNotifIds.current.add(n.id));
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      if (fresh.length === 1) {
        new Notification('HP-CONS ERP — Thông báo mới', { body: fresh[0].text, tag: fresh[0].id });
      } else {
        new Notification(`HP-CONS ERP — ${fresh.length} thông báo mới`, {
          body: fresh.slice(0, 3).map(n => `• ${n.text}`).join('\n') + (fresh.length > 3 ? `\n• …và ${fresh.length - 3} tin khác` : ''),
        });
      }
    } catch { /* trình duyệt chặn */ }
  }, [myNotifs, currentUser?.staffId]);

  // Sync projects to localStorage, Firestore (cloud), server backup, and trigger staff stats recalculation
  useEffect(() => {
    localStorage.setItem('erp_projects', JSON.stringify(projects));
    updateStaffStats(projects);

    // Đẩy lên Firestore khi dữ liệu thực sự đổi so với bản cloud gần nhất.
    // QUAN TRỌNG: chỉ đẩy SAU khi đã nhận snapshot đầu tiên (lastRemote != null) —
    // tránh máy vừa mở app ghi đè dữ liệu cloud bằng bản cục bộ cũ.
    const serialized = JSON.stringify(projects);
    if (lastRemoteProjects.current !== null && serialized !== lastRemoteProjects.current) {
      const banCloudTruocDo = lastRemoteProjects.current; // để trả lại nếu đẩy trượt
      lastRemoteProjects.current = serialized;
      pushCollection('projects', projects).catch(err => {
        console.error('[Firebase] Lỗi đồng bộ dự án lên cloud:', err);
        // Trả mốc về bản cloud cũ để lần thay đổi kế tiếp còn đẩy lại (không gán null —
        // null nghĩa là "chưa nhận snapshot" và sẽ chặn mọi lần đẩy sau).
        lastRemoteProjects.current = banCloudTruocDo;
        // PHẢI báo ra ngoài: đẩy trượt là dữ liệu chỉ nằm trên máy này, F5 là mất.
        // Trước đây chỉ ghi console nên khôi phục sao lưu thất bại mà người dùng không hề biết.
        triggerToast(`Chưa đồng bộ được lên cloud: ${err?.message || 'lỗi kết nối'}. Dữ liệu đang chỉ nằm trên máy này — đừng tải lại trang, hãy thử lại.`);
      });
    }
  }, [projects]);

  // Sync staff to localStorage, Firestore (cloud) and backend server
  useEffect(() => {
    localStorage.setItem('erp_staff', JSON.stringify(staff));

    // Chỉ đẩy lên cloud sau khi đã nhận snapshot đầu tiên (tránh ghi đè dữ liệu chung)
    const serialized = JSON.stringify(staff);
    if (lastRemoteStaff.current !== null && serialized !== lastRemoteStaff.current) {
      const banCloudTruocDo = lastRemoteStaff.current;
      lastRemoteStaff.current = serialized;
      // BẢO MẬT: không bao giờ ghi trường mật khẩu lên cloud — Firebase Auth quản lý mật khẩu
      const stripped = staff.map(({ password: _pw, ...rest }) => rest);
      pushCollection('staff', stripped).catch(err => {
        console.error('[Firebase] Lỗi đồng bộ nhân sự lên cloud:', err);
        lastRemoteStaff.current = banCloudTruocDo;
        triggerToast(`Chưa đồng bộ được danh sách nhân sự lên cloud: ${err?.message || 'lỗi kết nối'}. Hãy thử lại.`);
      });
      // Danh sách email được PHÉP truy cập dữ liệu (Rules đối chiếu) — bám theo danh sách nhân sự còn hiệu lực
      const allowDocs = staff
        .filter(s => s.username && !s.daNghi)
        .map(s => ({ id: authEmailFor(s.username!) }));
      pushCollection('authAllow', allowDocs).catch(err => console.error('[Firebase] Lỗi đồng bộ danh sách truy cập:', err));
    }
  }, [staff]);

  // Enforce role-based restrictions on tab selection.
  // STAFF may use DASHBOARD (their KPI workspace) and HISTORY (their activity log).
  // MANAGER may use the STAFF tab (to create Level-3 accounts) but not the DB/Workflow admin tabs.
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'VIEWER' && !VIEWER_TABS.includes(activeTab)) {
      setActiveTab('DASHBOARD');
    } else if (currentUser.role === 'STAFF' && !['DASHBOARD', 'HISTORY', 'CALENDAR', 'TEMPLATES'].includes(activeTab)) {
      setActiveTab('DASHBOARD');
    } else if (currentUser.role === 'MANAGER' && activeTab === 'SYSTEM') {
      setActiveTab('DASHBOARD');
    }
  }, [currentUser, activeTab]);

  // Sau khi có phiên Firebase thật (qua cầu nối SSO App Tổng bên dưới) VÀ đã nhận
  // được bản ghi staff/{uid} tương ứng từ Firestore (route /api/auth/hpcore-session
  // đã upsert sẵn, vai trò lấy từ App Tổng) → dựng currentUser từ đúng bản ghi đó.
  useEffect(() => {
    if (!fbAuthed || currentUser) return;
    const uid = fbAuth.currentUser?.uid;
    if (!uid) return;
    const matched = staff.find(s => s.id === uid);
    if (!matched) return; // Doc Firestore có thể tới sau vài trăm ms — effect tự chạy lại khi staff cập nhật
    const u = {
      email: matched.email || '',
      role: (matched.role || 'STAFF') as 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER',
      staffId: matched.id,
      name: matched.hoTen
    };
    setCurrentUser(u);
    localStorage.setItem('erp_current_user', JSON.stringify(u));
  }, [fbAuthed, staff, currentUser]);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('erp_current_user');
    signOutFb().finally(() => {
      window.location.href = 'https://account.hpcore.vn';
    });
  };

  // ===== TỰ ĐỘNG ĐĂNG XUẤT KHI BỊ ĐỔI QUYỀN GIỮA PHIÊN (chị Trâm chốt 28/07/2026) =====
  // Trước đây: đổi quyền/khóa tài khoản ai đó chỉ có hiệu lực từ LẦN ĐĂNG NHẬP SAU — người đang
  // mở sẵn app (currentUser cache trong state/localStorage) vẫn thao tác với quyền CŨ tới khi họ
  // tự đăng xuất. Giờ staff đồng bộ realtime qua Firestore nên phát hiện gần như ngay lập tức:
  // Trưởng phòng vừa đổi quyền/đánh dấu nghỉ việc ở máy khác → người đó bị đăng xuất ngay tại đây,
  // đăng nhập lại là nhận đúng quyền mới. Không đụng tới màn "Đổi vai trò" của Bản thử — ở đó
  // currentUser.role luôn được set TRÙNG với staff record cùng lúc nên effect này không bị kích nhầm.
  useEffect(() => {
    if (!currentUser) return;
    const matched = staff.find(s => s.id === currentUser.staffId);
    if (!matched) return; // bản ghi staff chưa kịp tải/đồng bộ — đừng vội đăng xuất nhầm
    const vaiTroMoi = (matched.role || chucVuToRole(matched.chucVu)) as typeof currentUser.role;
    if (!matched.daNghi && vaiTroMoi === currentUser.role) return; // không có gì đổi
    triggerToast(matched.daNghi
      ? '🔒 Tài khoản của bạn vừa bị khóa (đánh dấu nghỉ việc) — đã đăng xuất để bảo vệ dữ liệu.'
      : `🔒 Quyền của bạn vừa được Trưởng phòng đổi thành Level ${nhanLevelSo(vaiTroMoi)} — đã đăng xuất, đăng nhập lại để dùng đúng quyền mới.`);
    if (DEV_CHON_VAI_TRO) {
      // Bản thử / thử-cloud: về màn chọn vai trò, KHÔNG rời trang sang App Tổng
      localStorage.removeItem('erp_current_user');
      setCurrentUser(null);
    } else {
      handleLogout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ cần theo dõi staff đổi, không phải currentUser (tránh vòng lặp)
  }, [staff]);

  // ===== BẢN THỬ — XEM REVIEW 4 LEVEL =====
  // Đổi NGAY sang xem app bằng con mắt của một vai trò khác (thanh L1/L2/L3/L4 ở góc dưới trái),
  // không phải đăng xuất rồi chọn lại từ đầu. Chỉ thay người đang đăng nhập, KHÔNG đụng dữ liệu.
  // Chỉ tồn tại trong Bản thử (DEV_SANDBOX) — bản production không bao giờ dựng thanh này.
  // Đại diện để bấm thử của một level. Tài khoản Khách (Level 4) KHÔNG nằm trong danh sách nhân sự
  // thật, nên nếu dữ liệu đang chạy chưa có ai ở level đó thì lấy tài khoản mẫu tương ứng ra dùng.
  // Nhờ vậy 4 level luôn bấm được ngay, khỏi phải nạp lại danh sách nhân sự.
  // Người mặc định cho từng nút, chị Trâm chọn 27/07/2026 — có đúng người thì dùng, không thì lấy
  // người đầu tiên của level đó.
  const daiDienLevelBanThu = (role: 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER'): Staff | undefined => {
    const uuTien: Partial<Record<typeof role, string>> = {
      BOOD: 'Ngô Nữ Quỳnh Trâm',
      STAFF: 'Trần Đức Mạnh',
    };
    const dsLevel = staff.filter(s => (s.role || chucVuToRole(s.chucVu)) === role && !s.daNghi);
    const ten = uuTien[role];
    return (ten && dsLevel.find(s => s.hoTen === ten))
      || dsLevel[0]
      || sandboxStaff().find(s => (s.role || chucVuToRole(s.chucVu)) === role);
  };

  const doiVaiTroBanThu = (s: Staff) => {
    // Tài khoản mẫu chưa có trong danh sách đang chạy (thường là Khách Level 4) → bổ sung vào trước
    // khi vào, vì nhiều màn tra cứu nhân sự theo id và sẽ không tìm thấy người đang đăng nhập.
    if (!staff.some(x => x.id === s.id)) {
      const dsMoi = [...staff, s];
      setStaff(dsMoi);
      localStorage.setItem('erp_staff', JSON.stringify(dsMoi));
    }
    const u = {
      email: s.email || `${s.username || s.id}@sandbox.local`,
      role: (s.role || chucVuToRole(s.chucVu)) as 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER',
      staffId: s.id,
      name: s.hoTen,
    };
    localStorage.setItem('erp_current_user', JSON.stringify(u));
    setCurrentUser(u);
    // Về màn mặc định để không kẹt ở tab mà vai trò mới không có quyền xem
    setActiveTab('DASHBOARD');
    setShowForm(false);
    triggerToast(`Đang xem bằng vai trò: ${s.hoTen} — ${s.chucVu} (Level ${nhanLevelSo(u.role)}).`);
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
        savedProject.lyDoChoDuyetLai = undefined;
      } else if (!exists) {
        savedProject.tpDaDuyet = false;
      } else if (currentUser?.role === 'MANAGER' && old &&
                 savedProject.ngayHoanThanhDuKienGoc > old.ngayHoanThanhDuKienGoc) {
        // Quản lý sửa qua form làm hạn tổng bị lùi xa hơn đã báo → chờ TP duyệt lại.
        // Hạn thật sự bị đẩy ra nên đây là DELAY thật.
        savedProject.choDuyetLai = true;
        savedProject.lyDoChoDuyetLai = 'DOI_HAN';
      }
    }

    // GỠ NHÃN TRÚNG/RỚT THẦU DÍNH SAI (chị Trâm báo 27/07/2026). Công việc con tạo trước bản vá
    // kế thừa tình trạng của dự án cha, nên gói mới lập đã mang nhãn "Đã trúng thầu" — bị xếp vào
    // "Đã xong" và đếm sai thống kê. Một gói thầu CHƯA từng được Trưởng phòng duyệt kế hoạch thì
    // không thể đã có kết quả thầu, nên khi TP mở ra duyệt là chuẩn hóa lại luôn.
    // Ô này bị khóa trong form công việc con nên TP không tự sửa tay được.
    if (savedProject.loaiBanGhi !== 'DU_AN' && old?.tpDaDuyet === false &&
        (savedProject.tinhTrangDuAn === 'Đã trúng thầu' || savedProject.tinhTrangDuAn === 'Rớt thầu')) {
      savedProject.tinhTrangDuAn = 'Đang triển khai';
    }

    // GIỮ CÁC TRƯỜNG FORM KHÔNG QUẢN LÝ. ProjectForm dựng lại đối tượng Project từ các ô trên
    // form nên mọi trường nó không biết sẽ bị mất khi lưu. Trước đây:
    //   - mất kanbanStep → hồ sơ bị suy ra bước theo trạng thái, TP kéo tiến độ Phòng 100% rồi lưu
    //     là nhảy thẳng sang bước 5 dù đang ở bước 4 (chị Trâm báo 25/07/2026);
    //   - mất comments (thảo luận), cdtDieuChinh (lịch sử CĐT yêu cầu điều chỉnh), createdBy.
    // Chỉ bù khi form KHÔNG có giá trị — form vẫn được quyền xóa dữ liệu nó quản lý (vd. ketQuaPhong).
    if (old) {
      (['kanbanStep', 'comments', 'cdtDieuChinh', 'createdBy', 'guiCDTLogs', 'vongHienTai'] as const).forEach(k => {
        if (savedProject[k] === undefined && old[k] !== undefined) {
          (savedProject as any)[k] = old[k];
        }
      });
    }

    // TP vừa duyệt kế hoạch → thẻ tự nhảy sang bước 2 (Triển khai hồ sơ thầu)
    const approvedNow = savedProject.loaiBanGhi !== 'DU_AN' && old?.tpDaDuyet === false && savedProject.tpDaDuyet === true;
    if (approvedNow) {
      savedProject.kanbanStep = Math.max(savedProject.kanbanStep || 1, 2);
    }
    // TP DUYỆT LẠI kế hoạch đã bị delay (cờ choDuyetLai được TP xóa khi lưu) — nhân sự
    // trong kế hoạch cũng cần biết là hạn mới đã được chốt, không chỉ riêng Quản lý.
    // Hồ sơ CŨ không có cờ duyệt (tpDaDuyet/choDuyetLai trống) → im lặng (chị chốt 25/07/2026),
    // tránh việc TP chỉ sửa thông tin mà nhân viên bị báo "kế hoạch vừa được duyệt".
    const reapprovedNow = savedProject.loaiBanGhi !== 'DU_AN' && !approvedNow &&
      old?.choDuyetLai === true && savedProject.choDuyetLai !== true;
    // Hồ sơ bị kéo về Bước 1 làm lại: Quản lý lập lại công việc con → TP duyệt tiến độ là hồ sơ
    // TỰ NHẢY SANG BƯỚC 2 (Triển khai hồ sơ thầu), không phải kéo tay lần nữa (chị Trâm chốt 25/07/2026).
    //
    // SỬA 27/07/2026 — chị Trâm báo "bấm Lưu Hồ Sơ mà thẻ vẫn nằm ở Bước 1":
    // điều kiện cũ đòi phải có cờ choDuyetLai. Nhưng hồ sơ về Bước 1 bằng NHIỀU đường, và có đường
    // KHÔNG gắn cờ đó — cụ thể là khi chính Trưởng phòng kéo thẻ về Bước 1 qua luồng dời hạn
    // (handlePullBackApply, nhánh L1 đặt choDuyetLai = undefined vì TP tự dời thì không chờ ai duyệt).
    // Hồ sơ kiểu đó cờ trống nên reapprovedNow không bao giờ đúng → lưu bao nhiêu lần thẻ vẫn kẹt.
    // Nay bổ sung: Trưởng phòng lưu một hồ sơ CÔNG VIỆC đã tồn tại, đang ở Bước 1 và đã có thời hạn
    // = coi như đã khai báo & duyệt xong → sang Bước 2. Bước 1 chỉ là "Tiếp nhận & khai báo gói thầu",
    // TP mở ra kiểm tra rồi Lưu thì không còn lý do gì để nằm lại đó.
    // Lưu ý: TP sửa vặt một hồ sơ đang ở Bước 1 cũng sẽ đẩy nó lên Bước 2 — muốn giữ lại thì kéo
    // thẻ về Bước 1, TP có toàn quyền kéo qua kéo lại.
    const tpLuuTaiBuoc1 = exists && savedProject.loaiBanGhi !== 'DU_AN' &&
      currentUser?.role === 'BOOD' && (savedProject.soNgayDuKien || 0) > 0;
    if ((reapprovedNow || tpLuuTaiBuoc1) && (savedProject.kanbanStep || 1) <= 1) {
      savedProject.kanbanStep = 2;
    }

    // ===== QUẢN LÝ LƯU XONG THÌ TỰ SANG BƯỚC 3 (chị Trâm chốt 18/08/2026 — góp ý #75) =====
    // Chỉ chạy cho ĐÚNG hồ sơ Quản lý vừa kéo Bước 2 → 3 (cờ choQuaBuoc3), nên các lần lưu khác
    // không bị hỏi thêm câu nào.
    //
    // XÁC NHẬN 2 LẦN đúng như chị Trâm yêu cầu: lần 1 là bấm "Lưu Hồ Sơ", lần 2 là câu hỏi lại ở
    // đây ("chắc chắn lưu chỉnh sửa"). Bấm Huỷ thì VẪN LƯU phần vừa sửa, chỉ là thẻ chưa sang bước
    // — không để công sức nhập liệu bị mất.
    if (choQuaBuoc3 === savedProject.id && (savedProject.kanbanStep || 1) === 2) {
      const conThieu: string[] = [];
      if ((savedProject.tienDoBoPhan || 0) < 100) {
        conThieu.push(`tiến độ công việc con mới ${savedProject.tienDoBoPhan || 0}% (cần đủ 100%)`);
      }
      if (ANH_BAO_CAO_BAT_BUOC && !(savedProject.anhBaoCaoGuiBaoGia || '').trim()) {
        conThieu.push('chưa có ảnh báo cáo đã gửi báo giá');
      }
      if (conThieu.length > 0) {
        // Chưa đủ thì cứ lưu phần đã sửa, giữ cờ để lần lưu sau còn tự đẩy bước.
        triggerToast(`Đã lưu. Hồ sơ chưa sang Bước 3 vì còn thiếu: ${conThieu.join(' · ')}.`);
      } else {
        // Đủ điều kiện → LƯU trước, rồi mở hộp thoại của app để xác nhận lần 2 (chị Trâm yêu cầu
        // xác nhận 2 lần: bấm Lưu + xác nhận ở hộp). Bấm Đồng ý mới đẩy thẻ sang Bước 3.
        setXacNhanQuaB3(savedProject);
      }
    }

    // ===== Thông báo chuông 🔔 =====
    const label = savedProject.loaiBanGhi === 'DU_AN'
      ? `dự án "${savedProject.tenDuAn}"`
      : `công việc "${savedProject.hangMuc} — ${savedProject.tenDuAn}"`;
    // ===== BÁO TRƯỞNG PHÒNG NGAY KHI CÓ VIỆC CẦN DUYỆT (chị Trâm chốt 17/08/2026) =====
    // "Level 1 chưa được bật thông báo popup khi có thay đổi trên app." Nguyên nhân: hồ sơ Quản lý
    // vừa lập chỉ CHẠY VÀO DANH SÁCH "Chờ Trưởng phòng xử lý" trong chuông, mà danh sách đó là ô
    // tính sẵn — không sinh tin, nên không có popup nào bắn ra. Nay mỗi lần Quản lý lập/sửa kế
    // hoạch mà hồ sơ đang chờ duyệt thì bắn tin thẳng cho Trưởng phòng → chuông đỏ + popup trình
    // duyệt (nếu đã cấp quyền) hiện đè lên ứng dụng đang mở.
    const idsTruongPhong = staff
      .filter(x => (x.role || chucVuToRole(x.chucVu)) === 'BOOD' && !x.daNghi)
      .map(x => x.id);
    if (savedProject.loaiBanGhi !== 'DU_AN' && currentUser?.role !== 'BOOD' && hoSoChoTPDuyet(savedProject)) {
      pushNotify(
        idsTruongPhong,
        `📝 ${currentUser?.name || 'Quản lý'} vừa ${exists ? 'cập nhật' : 'lập'} kế hoạch ${label} — đang chờ Trưởng phòng kiểm tra & duyệt để hồ sơ lên Kanban.`,
        savedProject.id,
        true,
      );
    }

    if (!exists) {
      // Quản lý (chính + phụ) được chọn phụ trách khi khởi tạo
      pushNotify(allManagerIds(savedProject), `Bạn được chọn làm Quản lý cho ${label}.`, savedProject.id);
    } else if (approvedNow || reapprovedNow) {
      // Kế hoạch được TP duyệt → báo Quản lý (chính + phụ) + MỌI nhân sự có tham gia kế hoạch.
      // Người nhận gom từ cả bản cũ và bản mới, và quét cả cây việc con (allAssigneeIds) —
      // nếu chỉ lấy thucHienId/thucHienIds thì nhân sự chỉ nằm trong việc con sẽ bị bỏ sót.
      pushNotify([...allManagerIds(old!), ...allManagerIds(savedProject)], approvedNow
        ? `Kế hoạch ${label} đã được Trưởng phòng duyệt — bắt đầu triển khai (bước 2).`
        : `Kế hoạch điều chỉnh của ${label} đã được Trưởng phòng duyệt lại.`, savedProject.id);
      pushNotify([...allAssigneeIds(old!), ...allAssigneeIds(savedProject)], approvedNow
        ? `Bạn được giao ${label} — Trưởng phòng đã duyệt kế hoạch, bắt đầu thực hiện.`
        : `Kế hoạch ${label} bạn tham gia đã được Trưởng phòng duyệt lại — kiểm tra lại hạn công việc của bạn.`, savedProject.id);
    } else if (old) {
      const hoanThanh = old.trangThai === 'DANG_THUC_HIEN' && (savedProject.trangThai === 'HOAN_THANH_DUNG_HAN' || savedProject.trangThai === 'HOAN_THANH_TRE_HAN');
      const keHoachDoi = chuKyKeHoach(old.tasks) !== chuKyKeHoach(savedProject.tasks);
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
      // Quản lý/Trưởng phòng SỬA TAY % tiến độ thực hiện của việc con người khác (form Kế hoạch —
      // ô "Bộ phận thực hiện" ở SubtaskGantt) → báo đúng người bị sửa, tăng hay giảm đều báo, để
      // họ biết ai vừa đụng vào số của mình (chị Trâm chốt 27/07/2026). Không tự báo nếu người sửa
      // chính là người được giao việc đó (tự cập nhật % của mình qua "Cập nhật KQ" không đi qua đây).
      if (currentUser?.role === 'MANAGER' || currentUser?.role === 'BOOD') {
        const spCu: Record<string, { sp: number; name: string }> = {};
        const gomCu = (list?: ProjectTask[]) => (list || []).forEach(t => {
          spCu[t.id] = { sp: t.staffProgress ?? (t.isCompleted ? 100 : 0), name: t.name };
          gomCu(t.subtasks);
        });
        gomCu(old.tasks);
        const nguoiSua = currentUser.role === 'BOOD' ? 'Trưởng phòng' : 'Quản lý';
        const baoThayDoi = (list?: ProjectTask[]) => (list || []).forEach(t => {
          const truoc = spCu[t.id];
          const sau = t.staffProgress ?? (t.isCompleted ? 100 : 0);
          // ===== CHỈ BÁO VIỆC LÁ, KHÔNG BÁO VIỆC CẤP 1 ĐÃ CHIA (chị Trâm báo 18/08/2026) =====
          // "sao nhân viên lại đc nhận thông báo này" — kèm ảnh 2 tin TRÙNG cùng lúc 16:33:
          // một tin cho việc cấp 1 "Nghiên cứu hồ sơ thầu & Thiết kế sơ bộ" và một tin cho phần
          // cấp 2 "... — Trần Đức Mạnh".
          // Nguyên nhân: việc cấp 1 đã chia vẫn giữ đủ `assignedStaffIds` của mọi người tham gia
          // (để RBAC không cắt tầm nhìn — xem datNguoiLam), nên vòng quét báo CẢ HAI cấp cho cùng
          // một người. Nay bỏ qua việc đã chia, chỉ báo phần việc người ta THỰC LÀM — đúng luật
          // chị Trâm đã chốt ở mục #73d cho màn tác vụ ("chỉ hiển thị 1 công việc con cấp 2 thôi").
          if ((t.subtasks || []).length > 0) { baoThayDoi(t.subtasks); return; }
          if (truoc && truoc.sp !== sau) {
            const nguoiNhan = Array.from(new Set(
              [t.assignedTo, ...(t.assignedStaffIds || [])].filter(Boolean) as string[]
            )).filter(id => id !== currentUser?.staffId);
            if (nguoiNhan.length) {
              const tang = sau > truoc.sp;
              pushNotify(nguoiNhan,
                `${nguoiSua} vừa ${tang ? 'tăng' : 'giảm'} tiến độ thực hiện việc "${t.name}" (${label}) từ ${truoc.sp}% ${tang ? 'lên' : 'xuống'} ${sau}%.`,
                savedProject.id);
            }
          }
          // (Việc đã chia đã được đệ quy ở nhánh trên — tới đây chắc chắn là việc lá, không đệ quy nữa.)
        });
        baoThayDoi(savedProject.tasks);

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
    
    // ===== ĐỔI THÔNG TIN DỰ ÁN → CÁC CÔNG VIỆC CON TỰ CẬP NHẬT THEO =====
    // Công việc con lưu bản sao các trường của dự án (tên dự án, CĐT, địa chỉ...) từ lúc khởi tạo.
    // Trước đây sửa tên ở hồ sơ Dự án thì công việc đã tạo vẫn kẹt tên CŨ (chị Trâm báo 25/07/2026).
    // Nay lưu hồ sơ Dự án là đồng bộ xuống toàn bộ công việc con. Danh sách trường đồng bộ đúng bằng
    // danh sách ProjectForm sao chép từ dự án cha khi tạo công việc mới, nên không ghi đè dữ liệu
    // riêng của công việc (hạng mục, tiến độ, cây việc con, nhân sự...).
    if (exists && savedProject.loaiBanGhi === 'DU_AN') {
      const keThua = [
        // MÃ DỰ ÁN: công việc con dùng chung mã của dự án cha. Trước đây thiếu trường này nên chị
        // sửa mã ở hồ sơ Dự án mà công việc đã tạo vẫn kẹt mã cũ (chị Trâm báo 26/07/2026).
        'projectId',
        'tenDuAn', 'chuDauTu', 'diaChi', 'hinhThucDauThau', 'tinhTrangDuAn', 'quocTich',
        'khuCongNghiep', 'tinhThanh', 'loaiCongTrinh', 'hinhThucXayDung', 'giaiDoanDuAn',
        'dienTichDat', 'hoSoPhatThau',
        // CỐ Ý KHÔNG đồng bộ 'moTa': moTa của công việc là GHI CHÚ RIÊNG do Quản lý ghi
        // (link thư mục team...), khác với mô tả dự án. Đồng bộ sẽ xóa mất ghi chú của họ.
      ] as const;
      let soConDoi = 0;
      updated = updated.map(p => {
        if (p.duAnChaId !== savedProject.id) return p;
        const patch: Partial<Project> = {};
        keThua.forEach(k => {
          if (p[k] !== savedProject[k]) (patch as any)[k] = savedProject[k];
        });
        if (Object.keys(patch).length === 0) return p;
        soConDoi++;
        return { ...p, ...patch };
      });
      if (soConDoi > 0) {
        triggerToast(`Đã cập nhật thông tin dự án và đồng bộ (kể cả mã dự án) sang ${soConDoi} công việc thuộc dự án này.`);
        logAction('Đồng bộ thông tin dự án', `Cập nhật hồ sơ Dự án "${savedProject.tenDuAn}" và đồng bộ thông tin dự án sang ${soConDoi} công việc con`);
      }
    }

    // Sắp xếp theo Mã dự án. Từ 26/07/2026 các công việc con DÙNG CHUNG mã của dự án cha nên
    // riêng mã là hòa nhau — thêm tiêu chí phụ để thứ tự không nhảy mỗi lần lưu:
    // cùng mã thì hồ sơ Dự án đứng trước, rồi xếp theo hạng mục, cuối cùng theo id.
    updated.sort((a, b) => {
      const theoMa = (a.projectId || '').localeCompare(b.projectId || '');
      if (theoMa !== 0) return theoMa;
      const chaTruoc = (a.loaiBanGhi === 'DU_AN' ? 0 : 1) - (b.loaiBanGhi === 'DU_AN' ? 0 : 1);
      if (chaTruoc !== 0) return chaTruoc;
      const theoHangMuc = (a.hangMuc || '').localeCompare(b.hangMuc || '');
      return theoHangMuc !== 0 ? theoHangMuc : (a.id || '').localeCompare(b.id || '');
    });
      // ===== BÁO CHO NHÂN SỰ MỚI TIẾP NHẬN VIỆC (chị Trâm chốt 18/08/2026) =====
    // ⚠ PHẢI ĐẶT NGOÀI chuỗi if/else-if của phần thông báo: bản đầu em để trong nhánh
    // `else if (old)`, mà Trưởng phòng lưu hồ sơ thường rơi vào nhánh `approvedNow ||
    // reapprovedNow` phía trên → tin tiếp nhận việc KHÔNG BAO GIỜ bắn. Nay chạy cho mọi lần lưu
    // một hồ sơ đã tồn tại, nên đổi người giữa chừng là người mới nhận được tin ngay.
      // "thêm cơ chế thông báo cho nhân sự mới tiếp nhận công việc, lúc đầu cv này của nhân sự
      //  khác, sau chuyển qua cho nhân sự này, thì trên tag cv có hiện nhưng thiếu chuông thông báo."
      //
      // Trước đây app chỉ báo "Bạn được giao …" lúc Trưởng phòng DUYỆT KẾ HOẠCH (cấp hồ sơ). Việc
      // đổi người giữa chừng — Quản lý mở form, bấm ô "Người thực hiện" chọn người khác — không sinh
      // tin nào: việc lặng lẽ xuất hiện trong danh sách của người mới, họ không biết mà làm.
      //
      // Chỉ xét VIỆC LÁ (việc thực làm) để không báo trùng cho việc cấp 1 đã chia — cùng luật với
      // mục #100. Phân biệt 2 tình huống cho câu chữ đúng việc:
      //   · việc đã có từ trước, nay thêm người  → "vừa được tiếp nhận" (chuyển việc);
      //   · việc vừa được tạo trong lần lưu này  → "vừa được giao việc mới".
      {
        const nguoiCu: Record<string, string[]> = {};
        const gomNguoiCu = (list?: ProjectTask[]) => (list || []).forEach(t => {
          if ((t.subtasks || []).length > 0) { gomNguoiCu(t.subtasks); return; }
          nguoiCu[t.id] = Array.from(new Set(
            [t.assignedTo, ...(t.assignedStaffIds || [])].filter(Boolean) as string[]
          ));
        });
        // old.tasks?. — hồ sơ MỚI (old chưa tồn tại) coi như "chưa ai nhận việc nào" (mảng rỗng),
        // KHÔNG bỏ qua cả khối: mọi việc trong hồ sơ mới đều phải báo "giao việc mới" cho người
        // được gán — chỉ bỏ so sánh với người CŨ (không có gì để so). Trước đây gọi thẳng
        // `old.tasks` không có `?.` — hồ sơ mới `old` là `undefined` nên vỡ ngay
        // `Cannot read properties of undefined (reading 'tasks')`, chặn đứng toàn bộ hàm lưu
        // GIỮA ĐƯỜNG (chưa tới `setProjects`/`setShowForm(false)`) → hồ sơ không hiện lên Kanban
        // dù người dùng đã bấm Lưu (phát hiện 20/08/2026, Sếp báo "lưu xong thẻ không hiện").
        gomNguoiCu(old?.tasks);

        const baoTiepNhan = (list?: ProjectTask[]) => (list || []).forEach(t => {
          if ((t.subtasks || []).length > 0) { baoTiepNhan(t.subtasks); return; }
          const truoc = nguoiCu[t.id];
          const sau = Array.from(new Set(
            [t.assignedTo, ...(t.assignedStaffIds || [])].filter(Boolean) as string[]
          ));
          const laViecMoi = truoc === undefined;
          const nguoiMoi = sau.filter(id => (laViecMoi || !truoc.includes(id)) && id !== currentUser?.staffId);
          // Ai vừa giao — nói rõ cấp cho người nhận biết ai đụng vào việc của mình.
          const aiGiao = currentUser?.role === 'BOOD' ? 'Trưởng phòng'
            : currentUser?.role === 'MANAGER' ? 'Quản lý' : (currentUser?.name || 'Người phụ trách');
          if (nguoiMoi.length === 0) return;
          const han = taskHanText(t, savedProject.ngayHoanThanhDuKienHienTai || savedProject.ngayHoanThanhDuKienGoc);
          pushNotify(nguoiMoi, laViecMoi
            ? `📌 ${aiGiao} vừa giao bạn việc mới: "${t.name}" (${label})${han ? ` — hạn ${han}` : ''}.`
            : `🔄 ${aiGiao} vừa chuyển việc "${t.name}" (${label}) sang cho bạn${han ? ` — hạn ${han}` : ''}.`,
            savedProject.id);
        });
        baoTiepNhan(savedProject.tasks);
      }

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
      // Việc thêm mới thuộc VÒNG đang chạy → tỉ trọng tính riêng theo vòng
      const vong = Math.max(1, p.vongHienTai || 1);
      const newTasks: ProjectTask[] = newTaskDefs.map((t, i) => ({
        id: `T${Date.now()}-${i}`, name: t.name, weight: t.weight, isCompleted: false, staffProgress: 0, managerProgress: 0, vong,
      }));
      const allTasks = [...(p.tasks || []), ...newTasks];
      const newProg = soVongCoViec(allTasks) > 1 ? progressOfRound(allTasks, vong) : calculateProjectProgress(allTasks);
      const rev = { ngay: new Date().toISOString().split('T')[0], noiDung, buocVe };
      return {
        ...p,
        tasks: allTasks,
        tienDoBoPhan: newProg,
        tienDoPhong: 0,
        // GIỮ NGUYÊN kết quả kiểm tra & tệp (chị Trâm chốt 28/07/2026) — chỉ reset % tiến độ.
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
    years.add(namHienTaiVN()); // năm hiện tại luôn có trong danh sách, kể cả chưa có hồ sơ nào
    return Array.from(years).sort().reverse();
  }, [projects]);

  const handleAddWorkClick = () => {
    if (currentUser?.role !== 'BOOD' && currentUser?.role !== 'MANAGER') {
      triggerToast('Chỉ có Trưởng phòng (Level 1) hoặc Quản lý (Level 2) mới được quyền thiết lập công việc mới!');
      return;
    }
    setFormMode('ADD_WORK');
    setEditingProject(undefined);
    setDuAnChonSanChoCVMoi(undefined);   // bấm tay thì KHÔNG chọn sẵn — giữ nguyên cách làm cũ
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
    // LOẠI tài khoản Ban giám đốc (Level 4) khỏi DANH SÁCH NHÂN SỰ ĐƯỢC ĐẾM (chị Trâm chốt 27/07/2026):
    // BGĐ không nhận việc, không có KPI, nên không tính vào quân số Phòng Đấu thầu.
    // ⚠ Đây chỉ là chuyện "được đếm là nhân sự phòng" — từ 18/08/2026 BGĐ VẪN xem và thêm/xoá tài
    // khoản như Trưởng phòng (xem quanLyDuocNhanSu).
    const nhanSuPhong = activeStaff.filter(s => (s.role || chucVuToRole(s.chucVu)) !== 'VIEWER');
    if (!currentUser) return nhanSuPhong;
    // L1 và L4 (Ban giám đốc) thấy TOÀN BỘ danh sách — xem quanLyDuocNhanSu.
    // Trước đây L4 rơi vào nhánh dưới nên bị lọc còn 0 người (chị Trâm báo 18/08/2026).
    if (quanLyDuocNhanSu(currentUser.role)) return nhanSuPhong;
    return nhanSuPhong.filter(s => {
      if (s.id === currentUser.staffId) return true;              // luôn thấy chính mình
      if (currentUser.role !== 'MANAGER') return false;            // L3 chỉ thấy mình
      if ((s.role || chucVuToRole(s.chucVu)) === 'BOOD') return false; // QL không xem KPI Trưởng phòng
      return s.quanLyPhuTrachId === currentUser.staffId;           // chỉ đội ngũ của mình
    });
  }, [activeStaff, currentUser]);

  // Nhân sự ĐƯỢC THEO DÕI HIỆU SUẤT của Phòng Đấu thầu (chị Trâm chốt 27/07/2026).
  // Dùng cho khối "Danh sách nhân sự" ở Dashboard, thẻ KPI đội ngũ và bảng tab KPI.
  // Tab "Đội ngũ" vẫn dùng kpiStaff (còn đủ mọi tài khoản) vì đó là nơi Trưởng phòng quản lý TÀI KHOẢN.
  const nhanSuTheoDoi = useMemo(
    () => kpiStaff.filter(s => !CHUC_VU_KHONG_TINH_NHAN_SU.includes(s.chucVu)),
    [kpiStaff]
  );

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
    // Level 4 — Khách: XEM ĐƯỢC TẤT CẢ hồ sơ (mời BGĐ/khách vào theo dõi tiến độ toàn phòng),
    // nhưng mọi nút thêm/sửa/xóa/kéo thẻ đều bị khóa (chị Trâm chốt 26/07/2026).
    if (currentUser.role === 'VIEWER') return sourceProjects;
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

  // Hồ sơ Quản lý (L2) ĐANG PHỤ TRÁCH (quản lý chính hoặc phụ) — đưa vào file kết xuất của
  // Quản lý để họ báo cáo được cả phần mình quản lý, không chỉ việc giao đích danh cho mình.
  const managedWorkItems = useMemo(() => {
    if (!currentUser || currentUser.role !== 'MANAGER') return [];
    return rbacProjects.filter(p => p.loaiBanGhi !== 'DU_AN' && isProjectManager(p, currentUser.staffId));
  }, [rbacProjects, currentUser]);
  // Tra tên nhân sự theo id — cho cột "Người thực hiện" trong file kết xuất của Quản lý
  const staffNameById = useMemo(
    () => Object.fromEntries(staff.map(s => [s.id, s.hoTen])) as Record<string, string>,
    [staff]
  );

  // Thông tin MÔ TẢ của dự án cha để nhân sự thực hiện (kể cả Nhân viên L3) xem được hồ sơ mình
  // đang làm (chị Trâm chốt 25/07/2026). Gom từ TOÀN BỘ projects vì rbacProjects của nhân viên
  // không chứa bản ghi dự án cha (dự án cha không gán người thực hiện).
  // CHỈ chiếu đúng 4 trường mô tả — KHÔNG truyền nguyên bản ghi Project, để không đời nào lọt
  // tiến độ Bộ phận / Phòng duyệt / KPI xuống panel của nhân viên.
  const duAnChaInfoById = useMemo(() => {
    const out: Record<string, { tenDuAn: string; chuDauTu?: string; diaChi?: string; moTa?: string }> = {};
    projects.forEach(p => {
      if (p.loaiBanGhi !== 'DU_AN') return;
      out[p.id] = { tenDuAn: p.tenDuAn, chuDauTu: p.chuDauTu, diaChi: p.diaChi, moTa: p.moTa };
    });
    return out;
  }, [projects]);

  // Tách 2 cấp: Dự án cha (DU_AN) và Công việc/gói thầu con (CONG_VIEC).
  // Chỉ công việc con mới lên Kanban / danh sách tiến độ; dự án cha chỉ để đăng ký & làm cha.
  const parentProjects = useMemo(() => rbacProjects.filter(p => p.loaiBanGhi === 'DU_AN'), [rbacProjects]);
  // ===== THÔNG TIN MẪU CỦA MỖI DỰ ÁN (chị Trâm nhắc 18/08/2026) =====
  // Hồ sơ DỰ ÁN CHA thường chỉ khai tên + Chủ đầu tư + địa chỉ; còn quốc tịch CĐT, KCN, tỉnh/thành,
  // loại công trình, hình thức xây dựng, diện tích, hồ sơ phát thầu, hình thức đấu thầu... lại nằm ở
  // GÓI THẦU CON. Nên khi "lấy thông tin từ dự án cũ" mà chỉ đọc dự án cha thì phần lớn ô vẫn trống.
  // Ở đây gộp sẵn: lấy dự án cha làm gốc, ô nào trống thì lấy của gói thầu con MỚI NHẤT.
  // ===== THƯ VIỆN TÊN VIỆC CON (chị Trâm — góp ý #62, 18/08/2026) =====
  // Đếm lại tên việc con của TẤT CẢ hồ sơ, sắp theo số lần xuất hiện. Truyền xuống bảng phân rã để
  // khi bấm "Thêm việc con" là xổ danh sách tên thường gặp cho chọn (2 tên đầu thành nút bấm nhanh).
  const thuVienTenViecCon = useMemo(() => dungThuVienTenViecCon(projects), [projects]);

  const mauThongTinTheoDuAn = useMemo(() => {
    const out: Record<string, Partial<Project>> = {};
    parentProjects.forEach(cha => {
      const con = projects
        .filter(p => p.duAnChaId === cha.id && p.loaiBanGhi !== 'DU_AN')
        .sort((a, b) => (b.ngayBatDau || '').localeCompare(a.ngayBatDau || ''))[0];
      if (!con) return;
      const gop: Partial<Project> = {};
      const lay = <K extends keyof Project>(k: K) => {
        const vCha = cha[k];
        const coGiaTri = vCha !== undefined && vCha !== null && vCha !== '' && vCha !== 0;
        if (!coGiaTri && con[k] !== undefined) gop[k] = con[k];
      };
      ([
        'chuDauTu', 'diaChi', 'quocTich', 'khuCongNghiep', 'tinhThanh', 'loaiCongTrinh',
        'hinhThucXayDung', 'giaiDoanDuAn', 'dienTichDat', 'mucUuTien', 'hoSoPhatThau',
        'hinhThucDauThau', 'tinhTrangDuAn', 'moTa', 'quanLyId', 'quanLyIdsPhu',
      ] as (keyof Project)[]).forEach(lay);
      out[cha.id] = gop;
    });
    return out;
  }, [parentProjects, projects]);
  const workItems = useMemo(() => rbacProjects.filter(p => p.loaiBanGhi !== 'DU_AN'), [rbacProjects]);
  // ===== DANH SÁCH NĂM CHO BẢNG THỐNG KÊ (chị Trâm chốt 18/08/2026) =====
  // "Cho luôn cái xổ xuống để năm nào chọn năm đó; năm nay 2026, qua năm sau phải có 2027."
  // Danh sách = 2026 → ĐÚNG NĂM HIỆN TẠI, KHÔNG cộng thêm năm sau (chị Trâm nhắc 18/08/2026:
  // "chưa tới 2027 mà sao lại hiện rồi"). Sang 01/01/2027 thì 2027 tự có, không phải sửa code.
  // Cộng thêm mọi năm đang có trong dữ liệu để hồ sơ cũ (hoặc hồ sơ đã lên lịch sang năm) vẫn xuất được.
  const dsNamISO = useMemo(() => {
    const nay = parseInt(namHienTaiVN(), 10);
    const nam = new Set<number>();
    for (let n = 2026; n <= nay; n++) nam.add(n);
    workItems.forEach(p => {
      const tuNgay = parseInt((p.ngayBatDau || '').slice(0, 4), 10);
      if (Number.isFinite(tuNgay) && tuNgay >= 2000 && tuNgay <= 2100) nam.add(tuNgay);
      (p.guiCDTLogs || []).forEach(g => {
        const y = parseInt((g.ngay || '').slice(0, 4), 10);
        if (Number.isFinite(y) && y >= 2000 && y <= 2100) nam.add(y);
      });
    });
    return [...nam].sort((a, b) => b - a);
  }, [workItems]);

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
  //
  // ===== PHẢI ĐÃ SANG BƯỚC 3 MỚI GỌI TP DUYỆT (chị Trâm báo 17/08/2026 — góp ý #23) =====
  // "Xong việc con nhưng Quản lý chưa kéo hồ sơ từ Bước 2 sang Bước 3 thì TP chưa được nhận thông
  //  báo phê duyệt." Trước đây chỉ xét tiến độ Bộ phận = 100%, nên hồ sơ còn đứng ở Bước 2 (Quản lý
  // chưa trình, chưa đính kèm ảnh báo cáo đã gửi báo giá) đã nhảy vào chuông của Trưởng phòng —
  // TP duyệt sớm là bỏ qua đúng cái cửa mà quy trình đặt ra. Nay bắt buộc thẻ đã ở Bước 3 trở lên:
  // hành động TRÌNH của Quản lý mới là thứ gọi Trưởng phòng vào việc, không phải con số 100%.
  const tpPendingItems = useMemo(() => workItems.filter(p =>
    (p.tienDoBoPhan || 0) >= 100 &&
    (p.tienDoPhong || 0) < 100 &&
    (p.soNgayDuKien || 0) > 0 &&
    deriveKanbanStep(p) >= KANBAN_L1_ONLY_FROM &&
    p.tinhTrangDuAn !== 'Đã trúng thầu' && p.tinhTrangDuAn !== 'Rớt thầu'
  ), [workItems]);
  // Công việc CHỜ TP DUYỆT: Quản lý vừa tạo (tpDaDuyet=false) hoặc chưa có thời hạn.
  // TP mở từ chuông, kiểm tra kế hoạch, thêm ngày kiểm tra của mình, lưu → duyệt xong mới lên Kanban & Gantt.
  // Hồ sơ CHƯA ĐƯỢC TP DUYỆT thì luôn phải hiện ở đây, kể cả khi mang nhãn trúng/rớt thầu
  // (chị Trâm báo 27/07/2026): trước đây lọc nhãn trước nên một công việc mới lỡ mang nhãn
  // "Đã trúng thầu" sẽ biến mất khỏi chuông — không ai duyệt được, mà chưa duyệt thì cũng không
  // lên Kanban → kẹt cứng. Nhãn trúng/rớt chỉ dùng để bỏ qua các hồ sơ ĐÃ duyệt xong xuôi.
  const tpSetupItems = useMemo(() => workItems.filter(p =>
    p.tpDaDuyet === false ||
    (((p.soNgayDuKien || 0) <= 0 || p.choDuyetLai === true) &&
      p.tinhTrangDuAn !== 'Đã trúng thầu' && p.tinhTrangDuAn !== 'Rớt thầu')
  ), [workItems]);
  // Công việc TP đã duyệt và có thời hạn → lên sơ đồ GANTT.
  // Gantt là trục thời gian nên bắt buộc phải có kế hoạch đã chốt: hồ sơ chưa có hạn hoặc chưa
  // được duyệt mà vẽ lên thì vạch tiến độ là số ảo.
  const scheduledWorkItems = useMemo(() => workItems.filter(p =>
    (p.soNgayDuKien || 0) > 0 && p.tpDaDuyet !== false
  ), [workItems]);
  // BẢNG KANBAN LẤY TOÀN BỘ CÔNG VIỆC (chị Trâm chốt 29/07/2026). Trước đây hồ sơ Quản lý vừa lập
  // bị giấu khỏi bảng cho tới khi Trưởng phòng duyệt — mở Kanban thấy Bước 1 trống trơn, không ai
  // hiểu vì sao. Nay công việc vừa tạo đứng luôn ở Bước 1 (Tiếp nhận & khai báo gói thầu) cho thấy
  // được là đang có việc, chỉ KHÓA không cho đẩy thẻ tiến lên; Trưởng phòng duyệt xong hồ sơ tự
  // sang Bước 2 như cũ (xem approvedNow trong handleSaveProject).
  const kanbanWorkItems = workItems;
  // Tra tên Dự án cha theo id (hiển thị nhãn trên thẻ/công việc)
  const parentNameById = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach(p => { if (p.loaiBanGhi === 'DU_AN') m[p.id] = p.tenDuAn; });
    return m;
  }, [projects]);

  // Dashboard scope: only WORK ITEMS belonging to the selected year
  const dashboardProjects = useMemo(() => {
    // Quản lý (L2): Dashboard CHỈ thống kê hồ sơ họ LÀM QUẢN LÝ (chính hoặc phụ), không tính các
    // hồ sơ họ chỉ được giao thực hiện (chị Trâm chốt 27/07/2026). Các vai khác giữ nguyên phạm vi
    // theo RBAC (workItems đã lọc sẵn: BOOD/VIEWER thấy tất cả, STAFF thấy việc mình tham gia).
    const base = currentUser?.role === 'MANAGER'
      ? workItems.filter(p => isProjectManager(p, currentUser.staffId))
      : workItems;
    if (dashboardYear === 'ALL') return base;
    return base.filter(p =>
      (p.ngayBatDau || '').startsWith(dashboardYear) || (p.projectId || '').includes(dashboardYear)
    );
  }, [workItems, dashboardYear, currentUser]);

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
      const res = await fetch('/api/projects/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects, start_date: start, end_date: end })
      });
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
          body: JSON.stringify({ fileData: base64Data, projects, staff })
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
          triggerToast("⚠ Lỗi kiểm soát cấu trúc: Giao dịch thầu đã được tự động ROLLBACK!");
          logAction('Lỗi nhập thầu Excel', `Thử nhập tệp ${file.name} thất bại do sai cấu trúc cột dữ liệu. Hệ thống tự động ROLLBACK giao dịch.`);
        }
      } catch (err: any) {
        setValidationErrors([{ row: "Hệ thống", col: "Mạng", msg: `Không thể kết nối đến dịch vụ: ${err.message}` }]);
        triggerToast("⚠ Lỗi kết nối đến dịch vụ nhập thầu.");
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

  // MỞ MỘT HỒ SƠ TỪ NƠI KHÁC (thẻ Kanban, chuông thông báo, thẻ ở Dashboard) → sang màn Báo cáo
  // tiến độ và bung sẵn hồ sơ đó. Phải chỉnh bộ lọc trạng thái cho khớp, nếu không hồ sơ nằm ngoài
  // bộ lọc đang bật thì bấm vào chẳng thấy gì — chị Trâm báo 28/07/2026: hồ sơ ở bước 5/6/7 đã xong
  // mà bộ lọc mặc định là "Đang làm" nên danh sách trống trơn.
  const moHoSo = (projId: string) => {
    const p = projects.find(x => x.id === projId);
    if (p) setProjStatusFilter(isWorkDone(p) ? 'DONE' : 'ACTIVE');
    setActiveTab('PROJECTS');
    // ĐANG MỞ FORM SỬA thì phải đóng, nếu không form che kín danh sách và người dùng tưởng
    // bấm thông báo không có tác dụng gì (chị Trâm báo 17/08/2026 — góp ý #1).
    setShowForm(false);
    setExpandedProjectId(projId);
    // Ghi nhớ hồ sơ cần cuộn tới. Không cuộn ngay tại đây được vì hàng của hồ sơ mới CHƯA render
    // (bộ lọc trạng thái vừa đổi) — để effect bên dưới cuộn sau khi danh sách đã dựng lại.
    hoSoCanCuonToi.current = projId;
  };

  // ===== CUỘN TỚI HỒ SƠ VỪA MỞ TỪ CHUÔNG / KANBAN / DASHBOARD =====
  // Chị Trâm báo 17/08/2026 (góp ý #1): "bấm vào tin thứ 1 xem xong, bấm qua tin thứ 2 thì không
  // tự chuyển phân rã, vẫn còn kẹt ở màn hình dự án 1".
  // Nguyên nhân: expandedProjectId ĐÃ đổi đúng sang hồ sơ 2, nhưng trang không tự cuộn nên mắt
  // vẫn đang ở vùng của hồ sơ 1 — trông y như không có gì xảy ra.
  const hoSoCanCuonToi = useRef<string | null>(null);
  useEffect(() => {
    const projId = hoSoCanCuonToi.current;
    if (!projId || activeTab !== 'PROJECTS' || showForm) return;
    hoSoCanCuonToi.current = null;
    // Chờ 1 nhịp cho danh sách render xong hàng của hồ sơ mới rồi mới cuộn.
    const hen = setTimeout(() => {
      const hang = document.getElementById(`hang-ho-so-${projId}`);
      hang?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
    return () => clearTimeout(hen);
  }, [activeTab, showForm, expandedProjectId, projStatusFilter]);

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
    // TỪ BƯỚC 3 (Duyệt hồ sơ thầu cấp Phòng) TRỞ ĐI: khóa cập nhật tiến độ việc con.
    // Bộ phận phải xong TRƯỚC rồi Trưởng phòng mới kiểm tra; còn cho sửa việc con lúc TP đang
    // duyệt là mâu thuẫn logic — bộ phận chưa xong mà Phòng đã duyệt 100% (chị Trâm chốt 26/07/2026).
    // Kế hoạch chưa được Trưởng phòng duyệt thì chưa ai được bắt tay làm (chị Trâm chốt 27/07/2026).
    // Trưởng phòng KHÔNG bị khóa này — chính họ là người duyệt, chặn họ lại là vô lý.
    if (targetProject && hoSoChoTPDuyet(targetProject) && currentUser?.role !== 'BOOD') {
      triggerToast('⏳ Kế hoạch đang chờ Trưởng phòng duyệt — chưa đánh dấu hoàn thành được. Duyệt xong bạn sẽ nhận thông báo.');
      return;
    }
    if (targetProject && khoaCapNhatViecCon(targetProject)) {
      triggerToast(`🔒 Hồ sơ đã sang bước ${targetProject.kanbanStep} (${KANBAN_STEPS.find(s => s.id === targetProject.kanbanStep)?.title}) — không cập nhật tiến độ công việc con được nữa. Cần sửa thì đề nghị Trưởng phòng kéo hồ sơ về bước trước.`);
      return;
    }
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
    // ===== HỒ SƠ ĐANG CHỜ TRƯỞNG PHÒNG DUYỆT =====
    // Chị Trâm chốt 17/08/2026 (góp ý #2 — "Quản lý lỡ bấm Lưu dự án thì không thấy và không sửa
    // được những gì mình vừa tạo"):
    //   · Quản lý phụ trách hồ sơ VẪN ĐƯỢC xem + SỬA KẾ HOẠCH việc con của chính mình
    //     (tên việc, tỉ trọng, người giao, ngày bắt đầu, số ngày, kế hoạch chi tiết, thêm/bớt việc).
    //   · Nhưng KHÔNG được CẬP NHẬT TIẾN ĐỘ (%, đánh dấu hoàn thành, nhập kết quả) — vì TP còn
    //     có thể duyệt lại đổi người/đổi hạn/đổi tỉ trọng, làm sớm là công cốc.
    //
    // TRƯỚC ĐÂY chặn SẠCH mọi cập nhật, nên Quản lý bị kẹt luôn cả việc sửa kế hoạch của mình.
    // Trưởng phòng KHÔNG bị khóa này — chính họ là người duyệt.
    const hoSoDangSua = projects.find(p => p.id === projId);
    if (hoSoDangSua && hoSoChoTPDuyet(hoSoDangSua) && currentUser?.role !== 'BOOD') {
      // Gom cây việc con thành map theo id để so từng việc trước/sau.
      const trai = (list: ProjectTask[], out: Record<string, ProjectTask> = {}) => {
        list.forEach(t => { out[t.id] = t; if (t.subtasks?.length) trai(t.subtasks, out); });
        return out;
      };
      const truoc = trai(hoSoDangSua.tasks || []);
      const sau = trai(updatedTasks);
      // Các trường thuộc TIẾN ĐỘ / KẾT QUẢ — sửa mấy trường này thì vẫn bị chặn.
      const truongTienDo: (keyof ProjectTask)[] = [
        'isCompleted', 'completedAt', 'staffProgress', 'managerProgress',
        'ketQuaCongViec', 'taiLieuDinhKem', 'kpi', 'overdueReason',
      ];
      const doiTienDo = Object.keys(sau).some(id => {
        const a = truoc[id], b = sau[id];
        if (!a) return false; // việc MỚI thêm là sửa kế hoạch, không phải cập nhật tiến độ
        return truongTienDo.some(k => (a[k] ?? null) !== (b[k] ?? null));
      });
      // Chỉ Quản lý ĐANG PHỤ TRÁCH hồ sơ mới được sửa kế hoạch của hồ sơ đó.
      const laQuanLyHoSoNay = currentUser?.role === 'MANAGER'
        && isProjectManager(hoSoDangSua, currentUser.staffId);

      if (doiTienDo) {
        triggerToast('⏳ Kế hoạch đang chờ Trưởng phòng duyệt — chưa cập nhật TIẾN ĐỘ được. Duyệt xong bạn sẽ nhận thông báo. (Vẫn sửa được kế hoạch việc con.)');
        return;
      }
      if (!laQuanLyHoSoNay) {
        triggerToast('⏳ Kế hoạch đang chờ Trưởng phòng duyệt — chỉ Quản lý phụ trách hồ sơ này mới sửa được kế hoạch lúc này.');
        return;
      }
    }
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

    // Vòng làm việc đang chạy — tiến độ Bộ phận tính RIÊNG cho vòng này (vòng mới bắt đầu lại từ 0%).
    const vongCuaHoSo = Math.max(1, projects.find(p => p.id === projId)?.vongHienTai || 1);
    const soVongCuaHoSo = Math.max(vongCuaHoSo, soVongCoViec(updatedTasks));

    const updated = projects.map(proj => {
      if (proj.id === projId) {
        const nextBoPhan = soVongCuaHoSo > 1
          ? progressOfRound(updatedTasks, vongCuaHoSo)
          : calculateProjectProgress(updatedTasks);

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
          // Kế hoạch bị đẩy hạn ra → DELAY thật, chuông báo màu đỏ cho Trưởng phòng.
          ...(delayed ? { choDuyetLai: true, lyDoChoDuyetLai: 'DOI_HAN' as const } : {})
        };
      }
      return proj;
    });

    setProjects(updated);
    // TỈ TRỌNG LỆCH: bảng phân rã sửa nhanh lưu ngay từng thao tác nên KHÔNG chặn ở đây (sẽ kẹt giữa
    // lúc đang chia), nhưng phải cảnh báo + báo chuông cho Quản lý biết đang kẹt chỗ nào.
    const tiTrongLech = weightIssue(updatedTasks, vongCuaHoSo);
    triggerToast(delayed
      ? '⚠ Kế hoạch bị kéo dài so với tiến độ đã báo — hệ thống đã báo Trưởng phòng duyệt lại!'
      : tiTrongLech
        ? `⚠ ${tiTrongLech.moTa} Hồ sơ chỉ lưu được khi chia đủ 100%.`
        : 'Đã cập nhật tiến độ công việc con. Tiến độ bộ phận tự động tính gộp!');

    // Log the action + thông báo
    const targetProj = projects.find(p => p.id === projId);
    if (targetProj) {
      if (tiTrongLech) {
        pushNotify(allManagerIds(targetProj), `⚠ Phân bổ tỉ trọng chưa đủ: "${targetProj.hangMuc} — ${targetProj.tenDuAn}" — ${tiTrongLech.moTa}`, targetProj.id);
      }
      logAction('Cập nhật tác vụ', `Cập nhật cây công việc và tiến độ con cho hồ sơ ${targetProj.projectId} - ${targetProj.tenDuAn}`, undefined, getProjectParticipants(targetProj));
      // CHỈ báo khi KẾ HOẠCH thật sự đổi (thêm/xoá việc, đổi tên, tỉ trọng, người giao, lịch).
      // Nhân viên chỉ kéo tiến độ / nhập kết quả thì KHÔNG báo — Quản lý nhìn % trên bảng là thấy,
      // báo mỗi lần nhúc nhích chỉ làm nhiễu chuông (chị Trâm báo 28/07/2026).
      if (chuKyKeHoach(targetProj.tasks) !== chuKyKeHoach(updatedTasks)) {
        pushNotify(allManagerIds(targetProj), `Công việc "${targetProj.hangMuc} — ${targetProj.tenDuAn}" vừa chỉnh sửa kế hoạch.`, targetProj.id);
      }
      // Người MỚI được giao việc (chưa có trong danh sách cũ) — chỉ báo khi công việc đã được TP duyệt
      if (!hoSoChoTPDuyet(targetProj)) {
        const oldIds = new Set([targetProj.thucHienId, ...(targetProj.thucHienIds || [])].filter(Boolean));
        const newcomers = assignees.filter(id => !oldIds.has(id));
        pushNotify(newcomers, `Bạn được giao công việc "${targetProj.hangMuc} — ${targetProj.tenDuAn}".`, targetProj.id);
      }
    }
  };

  // Cập nhật ngày bắt đầu / số ngày của một công việc con (phục vụ sơ đồ Gantt)
  // Di chuyển thẻ hồ sơ trên bảng Kanban (RBAC đã được KanbanBoard kiểm tra, kiểm lại lần cuối tại đây)
  // daXacNhanGuiCDT: chỉ true khi TP đã bấm "Đúng, ghi nhận" trong hộp xác nhận gửi CĐT.
  const handleKanbanMove = (projectId: string, fromStep: number, toStep: number, daXacNhanGuiCDT = false) => {
    if (currentUser?.role !== 'BOOD' && currentUser?.role !== 'MANAGER') return;
    // Quản lý (L2) được đẩy thẻ lên tối đa bước 3 (Duyệt giá cấp phòng); từ bước 3 trở đi do Trưởng phòng.
    if (currentUser.role === 'MANAGER' && (fromStep > 2 || toStep > 3)) {
      triggerToast('Quản lý (L2) chỉ đẩy được tối đa đến bước 3 (Duyệt giá cấp phòng) để báo Trưởng phòng. Từ bước 3 do Trưởng phòng thao tác!');
      return;
    }
    const target = projects.find(p => p.id === projectId);
    if (!target) return;

    // ===== HỒ SƠ ĐANG CHỜ TRƯỞNG PHÒNG DUYỆT KẾ HOẠCH: KHÔNG AI ĐẨY THẺ TIẾN LÊN BẰNG TAY =====
    // Chị Trâm báo 28/07/2026: Quản lý kéo được thẳng Bước 1 → Bước 2 dù CHƯA phân bổ lại công việc
    // con. Như vậy là lách cả quy trình duyệt: hồ sơ về Bước 1 nghĩa là kế hoạch phải lập lại và
    // Trưởng phòng duyệt xong hồ sơ MỚI tự sang Bước 2 (xem reapprovedNow trong handleSaveProject).
    // Chặn cả Trưởng phòng: nếu TP kéo tay thì cờ chờ-duyệt vẫn còn, hồ sơ sang Bước 2 mà nhân viên
    // vẫn bị khoá việc con — mâu thuẫn. TP muốn duyệt thì mở hồ sơ bấm "Lưu Hồ Sơ".
    if (toStep > fromStep && hoSoChoTPDuyet(target)) {
      // ===== TP KÉO THẺ LÀ TỰ MỞ HỒ SƠ RA SOÁT (chị Trâm chốt 18/08/2026) =====
      // "Thay vì bấm lưu hồ sơ, Trâm có thể kéo bước 1 qua bước 2; trước khi hiện qua bước 2 thì hiện
      //  bảng box lên cho xem lại, điền đầy đủ xong bấm lưu hoặc xác nhận là xong" ·
      // "Chứ đừng khóa cứng là bấm chạy qua báo cáo tiến độ rồi mới đc qua bước 2 nhé em".
      //
      // Trước đây chỉ hiện một câu nhắc rồi chặn, Trưởng phòng phải tự đi sang tab Báo Cáo Tiến Độ,
      // tìm lại hồ sơ, bấm ✏️ — thao tác vòng vo. Nay kéo thẻ là MỞ LUÔN form hồ sơ đó để soát;
      // bấm "Lưu Hồ Sơ" là cờ chờ-duyệt được xoá và hồ sơ TỰ sang Bước 2 (xem reapprovedNow trong
      // handleSaveProject) — không cần kéo lại thẻ.
      //
      // Vẫn KHÔNG cho kéo tay qua bước 2 mà bỏ qua bước soát: nếu chỉ đổi bước mà cờ chờ-duyệt còn
      // nguyên thì nhân viên vẫn bị khoá việc con, hồ sơ sang bước 2 nhưng không ai làm được gì.
      if (currentUser.role === 'BOOD') {
        setFormMode('EDIT_ALL');
        setEditingProject(target);
        setShowForm(true);
        triggerToast('Mở hồ sơ để Trưởng phòng soát lại kế hoạch — soát xong bấm "Lưu Hồ Sơ" là hồ sơ tự sang Bước 2.');
        return;
      }
      triggerToast('Hồ sơ đang chờ Trưởng phòng duyệt kế hoạch. Vui lòng phân bổ lại công việc con rồi trình duyệt; duyệt xong hồ sơ tự sang Bước 2.');
      return;
    }

    // ===== QUẢN LÝ KÉO BƯỚC 2 → 3: KHÔNG CHẶN CỨNG, MỞ HỒ SƠ CHO SỬA (góp ý #75) =====
    // Chị Trâm chốt 18/08/2026: "cái này nới lỏng cho quản lý level 2 ... mà lúc đó cv con cấp 1 còn
    // kẹt là do quản lý hoặc nhân sự thực hiện, thì mở trường dự án lên cho quản lý + thông báo cần
    // hoàn thành cv con + chụp ảnh màn hình đã báo cáo."
    //
    // Trước đây gặp 2 cửa chặn liên tiếp (tiến độ Bộ phận 100% và ảnh báo cáo đã gửi báo giá) — mỗi
    // cửa chỉ hiện một câu nhắc rồi dừng, Quản lý phải tự mò xem thiếu gì và đi tìm đúng chỗ để sửa.
    // Nay kéo thẻ là mở luôn form hồ sơ, nói rõ thiếu cái gì; cập nhật đủ rồi bấm "Lưu Hồ Sơ" là hồ
    // sơ tự sang Bước 3 (xem nhánh choQuaBuoc3 trong handleSaveProject) — vẫn phải đủ điều kiện,
    // chỉ là không bắt kéo lại thẻ và không bắt đi tìm.
    // ÁP CHO CẢ TRƯỞNG PHÒNG (L1) — chị Trâm báo 18/08/2026: "sao quản lý nắm từ b2 qua b3 còn bị kẹt
    // thông báo mà ko tự chuyển đi qua trường cập nhật kqua và hình ảnh e" (lúc đó chị đang đăng nhập
    // Level 1). Bản đầu em chỉ nới cho MANAGER nên L1 vẫn gặp câu chặn cứng — vô lý vì L1 quyền cao
    // hơn. Nay cả L1 và L2 kéo 2 → 3 mà còn thiếu đều được mở form để cập nhật cho xong.
    const thieuAnhBaoCao = !(target.anhBaoCaoGuiBaoGia || '').trim();
    if (
      (currentUser.role === 'MANAGER' || currentUser.role === 'BOOD') && fromStep === 2 && toStep === 3 &&
      ((target.tienDoBoPhan || 0) < 100 || (ANH_BAO_CAO_BAT_BUOC && thieuAnhBaoCao))
    ) {
      const thieu: string[] = [];
      if ((target.tienDoBoPhan || 0) < 100) {
        thieu.push(`tiến độ công việc con mới ${target.tienDoBoPhan || 0}% (cần đủ 100%)`);
      }
      if (ANH_BAO_CAO_BAT_BUOC && thieuAnhBaoCao) {
        thieu.push('chưa có ảnh báo cáo đã gửi báo giá');
      }
      setChoQuaBuoc3(target.id);
      setFormMode('EDIT_ALL');
      setEditingProject(target);
      setShowForm(true);
      triggerToast(`Còn thiếu: ${thieu.join(' · ')}. Cập nhật xong bấm "Lưu Hồ Sơ" là hồ sơ tự sang Bước 3.`);
      return;
    }

    // ===== CHỐT CỬA TIẾN ĐỘ BỘ PHẬN =====
    // Rời bước 2 để trình Phòng duyệt thì công việc con phải xong 100% (xem hằng số ở đầu file).
    // Chặn cả Quản lý lẫn Trưởng phòng — không ai kéo tay qua được.
    // (Quản lý kéo 2 → 3 đã được nhánh nới cửa ở trên xử lý trước, không rơi xuống đây.)
    if (
      toStep === fromStep + 1 &&
      CHOT_TIEN_DO_BO_PHAN_KHI_ROI_BUOC.includes(fromStep) &&
      (target.tienDoBoPhan || 0) < 100
    ) {
      const tenBuocToi = KANBAN_STEPS.find(s => s.id === toStep)?.title || `Bước ${toStep}`;
      triggerToast(`Không thể chuyển sang bước ${toStep} (${tenBuocToi}): tiến độ Bộ phận hiện đạt ${target.tienDoBoPhan || 0}%. Cần hoàn thành 100% công việc con trước khi trình Phòng duyệt.`);
      return;
    }

    // ===== CỬA ẢNH BÁO CÁO ĐÃ GỬI BÁO GIÁ: BƯỚC 2 → BƯỚC 3 (chị Trâm — góp ý #12) =====
    // "Khi Quản lý kéo từ Bước 2 qua Bước 3, yêu cầu nhập hình ảnh báo cáo đã gửi báo giá mới cho qua."
    // Chặn cả Quản lý lẫn Trưởng phòng — cửa của quy trình, không phải nhắc nhở. Chưa có ảnh thì mở
    // luôn hộp đính kèm và NHỚ hồ sơ đang chờ: lưu ảnh xong hệ thống tự đưa thẻ sang Bước 3.
    if (fromStep === 2 && toStep === 3 && thieuAnhBaoCao) {
      if (ANH_BAO_CAO_BAT_BUOC) {
        setAnhBaoCaoProject(target);
        triggerToast('Cần đính kèm ẢNH BÁO CÁO ĐÃ GỬI BÁO GIÁ trước khi trình Phòng duyệt (Bước 3).');
        return;
      }
      // CHỈ NHẮC (xem ANH_BAO_CAO_BAT_BUOC): cho thẻ đi tiếp, không bắt đính kèm mới cho qua.
      triggerToast('Đã chuyển sang Bước 3. NHẮC: hồ sơ này chưa có ảnh báo cáo đã gửi báo giá — bổ sung trong hồ sơ khi có.');
    }

    // ===== CHỐT CỬA TIẾN ĐỘ PHÒNG (quy trình công ty) =====
    // Điều kiện DUY NHẤT: Trưởng phòng đã duyệt tiến độ Phòng đủ 100% (chị Trâm chốt 25/07/2026).
    // Kết quả công việc KHÔNG bắt buộc — TP nhập mô tả / đính kèm tệp / để trống đều được.
    // Trước đây không có cửa này nên hồ sơ đi thẳng sang bước 5 dù Phòng chưa duyệt xong.
    // Cửa đặt ở những bước liệt kê trong CHOT_TIEN_DO_PHONG_KHI_ROI_BUOC (xem giải thích tại hằng số).
    // Chỉ soi đường TIẾN tuyến tính (3 → 4, 4 → 5); kéo lùi hoặc rẽ nhánh 5 → 6/7 không vướng cửa này.
    if (
      toStep === fromStep + 1 &&
      CHOT_TIEN_DO_PHONG_KHI_ROI_BUOC.includes(fromStep) &&
      (target.tienDoPhong || 0) < 100
    ) {
      const tenBuocToi = KANBAN_STEPS.find(s => s.id === toStep)?.title || `Bước ${toStep}`;
      triggerToast(`Không thể chuyển sang bước ${toStep} (${tenBuocToi}): tiến độ Phòng hiện đạt ${target.tienDoPhong || 0}%. Cần Trưởng phòng duyệt đủ 100% trước khi chuyển bước.`);
      // Mở luôn bảng nhập cho TP xử lý ngay, và NHỚ bước đang muốn tới: nhập đủ 100% rồi Lưu là
      // hệ thống tự đi tiếp sang bước đó (trước đây lưu xong thẻ vẫn đứng yên, TP phải kéo lại).
      setPhongInputProject(target);
      setPhongInputChuyenBuoc(toStep);
      return;
    }

    // XÁC NHẬN trước khi ghi nhận 1 lần gửi CĐT — tránh TP lỡ tay kéo qua kéo lại làm số lần
    // gửi tăng sai. Chỉ hỏi khi thực sự đi 4 → 5 (đường sinh ra bản ghi gửi CĐT).
    if (toStep === 5 && fromStep === 4 && !daXacNhanGuiCDT) {
      setGuiCDTConfirm({ project: target, lan: lanGuiKeTiep(target) });
      return;
    }

    // Đồng bộ tình trạng hồ sơ theo cột: bước 5 = Đang triển khai (gửi CĐT), 6 = Đã trúng thầu, 7 = Rớt thầu
    let step5AutoMsg = '';
    let lanGuiCDT = 0; // > 0 nghĩa là lần này ghi nhận gửi CĐT lần thứ mấy
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
        // GHI NHẬN 1 LẦN GỬI CĐT: TP kéo tay 4→5 = hồ sơ đã gửi CĐT lần này. Hồ sơ bị yêu cầu sửa,
        // kéo về bước 1-3 rồi làm lại và kéo 4→5 nữa → ghi tiếp lần 2, lần 3... (chị Trâm chốt 25/07/2026).
        const lanTruoc = p.guiCDTLogs || [];
        lanGuiCDT = lanTruoc.length + 1;
        dongGoi.guiCDTLogs = [...lanTruoc, {
          lan: lanGuiCDT,
          ngay: actual,
          tienDoPhong: p.tienDoPhong || 0,
          ketQuaPhong: p.ketQuaPhong,
          taiLieuKetQuaPhong: p.taiLieuKetQuaPhong,
          nguoiGui: currentUser?.name || '',
        }];
        step5AutoMsg += ` Đã ghi nhận GỬI CĐT LẦN ${soLanGuiTruocApp(p) + lanGuiCDT}.`;
      } else if (fromStep >= 5 && toStep < 5) {
        // Kéo lùi về trước bước 5: hồ sơ coi như chưa gửi → bỏ mốc tự chốt, trở lại đang thực hiện
        dongGoi = { ngayHoanThanhThucTe: undefined, trangThai: 'DANG_THUC_HIEN' };
      }
      // VÒNG CHỈNH SỬA MỚI: kéo hồ sơ từ bước 4 trở lên về bước 1-3 → tiến độ Phòng reset về 0 để
      // vòng này Trưởng phòng phải duyệt lại từ đầu.
      // GIỮ NGUYÊN kết quả công việc & tệp đính kèm (chị Trâm chốt 27/07/2026): trước đây xóa sạch
      // nên TP kéo hồ sơ về sửa là mất hết phần đã viết, phải gõ lại từ đầu. Nay chỉ tiến độ về 0,
      // còn nội dung cũ để lại làm nền — TP sửa đè hoặc bổ sung cho vòng mới.
      if (fromStep >= 4 && toStep <= 3) {
        dongGoi.tienDoPhong = 0;
      }
      return { ...p, kanbanStep: toStep, tinhTrangDuAn, ...dongGoi };
    }));
    const stepTitle = KANBAN_STEPS.find(s => s.id === toStep)?.title || `Bước ${toStep}`;
    triggerToast(`Đã chuyển "${target.tenDuAn}" sang bước ${toStep}: ${stepTitle}.${step5AutoMsg}`);
    logAction('Chuyển bước Kanban', `Chuyển hồ sơ ${target.projectId} - ${target.tenDuAn} từ bước ${fromStep} sang bước ${toStep} (${stepTitle})`, undefined, getProjectParticipants(target));
    // Vào bước 4 (trình BLĐ/Giám đốc) → MỞ NGAY bảng nhập tiến độ Phòng + kết quả công việc cho
    // Trưởng phòng làm luôn tại chỗ (chị Trâm chốt 25/07/2026), thay vì chỉ nhắc rồi TP phải tự tìm form.
    // Mở ở MỌI vòng (kể cả vòng chỉnh sửa lần 2, 3...) vì mỗi vòng phải nhập lại tiến độ & kết quả.
    // Bảng hiện đúng số liệu hiện tại của hồ sơ (vòng chỉnh sửa đã được reset về 0 lúc kéo lùi).
    // Từ khi có cửa chốt 3 → 4, hồ sơ vào được bước 4 là đã chắc chắn đủ 100% (TP vừa nhập ở cửa đó),
    // nên KHÔNG bật lại bảng nhập nếu TP đã ghi kết quả công việc rồi — tránh popup hiện hai lần liên
    // tiếp. Còn trống kết quả thì vẫn mở để nhắc TP bổ sung trước khi trình BLĐ.
    if (toStep === 4 && fromStep !== 4 && !target.ketQuaPhong) {
      setPhongInputProject({ ...target, kanbanStep: toStep });
      setPhongInputChuyenBuoc(null); // mở để nhắc nhập, không phải do bị chặn → lưu xong đứng yên
    }
    // QUẢN LÝ ĐẨY HỒ SƠ SANG BƯỚC 3 = trình Trưởng phòng duyệt → báo chuông cho toàn bộ Trưởng phòng
    // vào kiểm tra (chị Trâm chốt 27/07/2026). Từ bước 3 trở đi việc thuộc về TP nên phải biết ngay.
    if (toStep === KANBAN_L1_ONLY_FROM && fromStep < KANBAN_L1_ONLY_FROM && currentUser.role === 'MANAGER') {
      const boodIds = staff.filter(s => (s.role || chucVuToRole(s.chucVu)) === 'BOOD' && !s.daNghi).map(s => s.id);
      pushNotify(boodIds, `Quản lý ${currentUser.name} đã trình hồ sơ "${target.hangMuc} — ${target.tenDuAn}" sang bước ${toStep} (${KANBAN_STEPS.find(s => s.id === toStep)?.title}). Tiến độ Bộ phận đạt 100%, đề nghị Trưởng phòng kiểm tra và duyệt.`, target.id);
    }
    // Kéo đến bước 6 "Trúng thầu" → báo tin mừng cho TOÀN BỘ quản lý & nhân viên tham gia dự án
    // (luonBao: một trong 3 mốc vẫn báo cho L2/L3 dù hồ sơ đã qua bước 3 — xem pushNotify)
    if (toStep === 6 && fromStep !== 6) {
      const parentName = (target.duAnChaId && projects.find(x => x.id === target.duAnChaId)?.tenDuAn) || target.tenDuAn;
      pushNotify(getProjectParticipants(target), `🎉 Chúc mừng! Gói thầu "${target.hangMuc} — ${parentName}" đã TRÚNG THẦU. Cảm ơn cả nhóm đã tham gia!`, target.id, true);
    }
    // Kéo đến bước 7 "Rớt thầu" → cũng báo cho cả nhóm, để mọi người biết gói thầu đã khép lại
    // (chị Trâm chốt 27/07/2026: trúng hay rớt đều phải báo).
    if (toStep === 7 && fromStep !== 7) {
      const parentName = (target.duAnChaId && projects.find(x => x.id === target.duAnChaId)?.tenDuAn) || target.tenDuAn;
      pushNotify(getProjectParticipants(target), `Gói thầu "${target.hangMuc} — ${parentName}" đã có kết quả: RỚT THẦU. Hồ sơ khép lại tại bước ${toStep}.`, target.id, true);
    }
    // Kéo NGƯỢC hồ sơ từ bước 3 trở lên về Bước 1 / Bước 2 → việc quay lại tay Quản lý & nhân viên,
    // nên phải báo (mốc thứ ba vẫn xuyên bộ lọc). Kéo về Bước 1 bằng thao tác riêng đã có tin riêng.
    if (fromStep >= KANBAN_L1_ONLY_FROM && toStep <= 2) {
      const tenBuocVe = KANBAN_STEPS.find(s => s.id === toStep)?.title || `Bước ${toStep}`;
      pushNotify(getProjectParticipants(target), `Hồ sơ "${target.hangMuc} — ${target.tenDuAn}" đã được chuyển về Bước ${toStep} (${tenBuocVe}) để chỉnh sửa. Đề nghị kiểm tra và cập nhật lại phần việc phụ trách.`, target.id, true);
    }
  };

  // Mở bảng phân bổ lại việc con. doiTienDo = true → có dời hạn (tự tính số ngày);
  // false → giữ nguyên hạn nộp, chỉ chia lại tỉ trọng / thêm việc con.
  const handlePullBackImpact = (p: Project, doiTienDo: boolean) => {
    setPullBackProject(null);
    setPullBackDoiTienDo(doiTienDo);
    setPullBackDelayProject(p);
  };

  // KÉO HỒ SƠ VỀ BƯỚC 1 mà GIỮ NGUYÊN HẠN (chị Trâm chốt 25/07/2026).
  // Trưởng phòng có toàn quyền kéo về Bước 1, KHÔNG bị hỏi "có ảnh hưởng hạn nộp không" nữa —
  // trước đây chọn "Không ảnh hưởng" thì hệ thống chỉ hiện toast rồi KHÔNG kéo, nên TP bị kẹt.
  // Về Bước 1 = làm lại vòng mới: tiến độ Phòng & kết quả vòng trước reset (số liệu đã lưu trong
  // nhật ký gửi CĐT), gắn cờ chờ duyệt lại và báo Quản lý vào lập lại công việc con để trình TP.
  // TP duyệt tiến độ (lưu hồ sơ) → hồ sơ tự nhảy sang Bước 2 (xem reapprovedNow ở handleSaveProject).
  // moVongMoi = true: mở VÒNG mới (làm lại từ đầu sau khi đã gửi CĐT) — việc con vòng cũ giữ nguyên
  // làm bằng chứng, Quản lý phải lập bộ việc con MỚI đủ 100% cho vòng này (chị Trâm chốt 25/07/2026).
  const handlePullBackKeepDeadline = (p: Project, moVongMoi = false) => {
    setPullBackProject(null);
    const vongMoi = moVongMoi ? Math.max(1, p.vongHienTai || 1) + 1 : Math.max(1, p.vongHienTai || 1);
    setProjects(prev => prev.map(x => x.id !== p.id ? x : {
      ...x,
      kanbanStep: 1,
      tienDoPhong: 0,
      // GIỮ NGUYÊN kết quả kiểm tra & tệp đính kèm (chị Trâm chốt 28/07/2026, áp dụng đồng bộ với
      // luồng 4→3): chỉ reset % tiến độ Phòng về 0 cho TP duyệt lại vòng này — nội dung cũ để lại
      // làm nền, TP sửa đè hoặc bổ sung, không phải gõ lại từ đầu mỗi vòng.
      ngayHoanThanhThucTe: undefined,
      trangThai: 'DANG_THUC_HIEN' as const,
      tinhTrangDuAn: 'Đang triển khai' as const,
      choDuyetLai: true,
      // TP tự kéo về nên hạn nộp không bị đẩy — Quản lý chỉ phải lập lại phân bổ.
      lyDoChoDuyetLai: 'PHAN_BO' as const,
      vongHienTai: vongMoi,
      // Vòng mới → tiến độ Bộ phận đọc theo vòng mới nên bắt đầu lại từ 0%
      ...(moVongMoi ? { tienDoBoPhan: 0 } : {}),
    }));
    triggerToast(moVongMoi
      ? `Đã kéo "${p.hangMuc}" về Bước 1 và MỞ VÒNG ${vongMoi} — Quản lý phải tạo công việc con mới đủ 100% cho vòng này.`
      : `Đã kéo "${p.hangMuc}" về Bước 1 (giữ nguyên hạn nộp, vẫn ở vòng ${vongMoi}) — hệ thống đã báo Quản lý lập lại công việc con để trình duyệt tiến độ.`);
    logAction('Kéo về Bước 1', `Kéo hồ sơ ${p.projectId} - ${p.tenDuAn} về Bước 1, giữ nguyên hạn nộp.${moVongMoi ? ` MỞ VÒNG ${vongMoi} (làm lại sau khi đã gửi CĐT).` : ''} Chờ Quản lý lập lại kế hoạch & trình Trưởng phòng duyệt tiến độ.`, undefined, getProjectParticipants(p));
    // Hàm này giờ CHỈ Trưởng phòng dùng (kéo thẳng về Bước 1, không hỏi). Quản lý đi đường khác:
    // bắt buộc qua bảng phân bổ lại việc con — xem handlePullBackApply.
    // Báo Quản lý phụ trách vào PHÂN BỔ LẠI công việc con để tính lại tiến độ của vòng này.
    pushNotify(allManagerIds(p), moVongMoi
      ? `Trưởng phòng đã kéo hồ sơ "${p.hangMuc} — ${p.tenDuAn}" về Bước 1 và mở VÒNG ${vongMoi}. Vui lòng lập bộ công việc con MỚI cho vòng này, chia tỉ trọng đủ 100% rồi trình Trưởng phòng duyệt tiến độ. Việc của vòng trước được giữ nguyên (chỉ xem).`
      : `Trưởng phòng đã kéo hồ sơ "${p.hangMuc} — ${p.tenDuAn}" về Bước 1. Vui lòng phân bổ lại công việc con để tính lại tiến độ của vòng này, rồi trình Trưởng phòng duyệt; duyệt xong hồ sơ tự sang Bước 2.`, p.id, true);
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
      // delayDays = 0 → CHỈ phân bổ lại, hạn nộp giữ nguyên và KHÔNG ghi Delay Log.
      // Nhật ký dời hạn phải phản ánh đúng những lần hạn thật sự bị đẩy ra; nhét vào đó một dòng
      // "lệch 0 ngày" thì báo cáo độ trễ đọc thành có sự cố, trong khi hạn không hề đổi.
      const coDoiHan = delayDays > 0;
      // HẠN MỚI TÍNH LẠI TỪ KẾ HOẠCH VIỆC CON, KHÔNG CỘNG DỒN (chị Trâm báo lỗi 29/07/2026).
      // Trước đây lấy hạn cũ + số ngày dời. Nhưng số ngày dời được suy ra CHÍNH TỪ việc con, mà
      // hạn gốc lại cũng tự tính từ việc con (getDeptDeadline) — nên cùng một khoảng thời gian bị
      // cộng hai lần: form hiện "Hạn Phòng 01-08" mà "Hạn hiện tại (đã bù lệch)" lại ra 03-08.
      const newDeadline = coDoiHan
        ? ymdOf(getDeptDeadline({ ...p, tasks: newTasks }))
        : p.ngayHoanThanhDuKienHienTai;
      const delayLog: DelayLog = {
        id: `DL-${Date.now()}`,
        ngayThayDoi: today,
        ngayCu: p.ngayHoanThanhDuKienHienTai,
        ngayMoi: newDeadline,
        // Để 0: số ngày này ĐÃ nằm trong kế hoạch việc con nên hạn gốc tự có, cộng thêm là trùng.
        // Số ngày dời thật vẫn đọc được từ cặp ngayCu → ngayMoi (xem tongNgayDoiHan).
        soNgayLech: 0,
        lyDo: reason,
        nguoiDuyet: isL2 ? '' : (currentUser?.name || ''), // L2 chờ TP duyệt → chưa có người duyệt
      };
      return {
        ...p,
        tasks: newTasks,
        tienDoBoPhan: newProg,
        tienDoPhong: 0,            // kéo về Bước 1 → tiến độ Phòng reset, chờ duyệt lại
        // GIỮ NGUYÊN kết quả kiểm tra & tệp (chị Trâm chốt 28/07/2026) — chỉ reset % tiến độ.
        ngayHoanThanhDuKienHienTai: newDeadline,
        kanbanStep: 1,
        tinhTrangDuAn: 'Đang triển khai' as const,
        trangThai: 'DANG_THUC_HIEN' as const,
        delayLogs: coDoiHan ? [...(p.delayLogs || []), delayLog] : (p.delayLogs || []),
        // L2 sửa → chờ TP duyệt lại tiến độ Phòng (tỉ trọng việc con đã đổi); L1 tự sửa → không cần cờ.
        // Ghi rõ VÌ SAO duyệt lại: chỉ đổi phân bổ thì Trưởng phòng duyệt cho nhanh, đừng để chuông
        // báo "DELAY" làm chị tưởng gói thầu bị đẩy hạn (chị Trâm 29/07/2026).
        ...(isL2
          ? { choDuyetLai: true, lyDoChoDuyetLai: (coDoiHan ? 'DOI_HAN' : 'PHAN_BO') as 'DOI_HAN' | 'PHAN_BO' }
          : { choDuyetLai: undefined, lyDoChoDuyetLai: undefined }),
      };
    });
    setProjects(updated);
    setPullBackDelayProject(null);
    if (!target) return;
    const coDoiHan = delayDays > 0;
    if (isL2) {
      const boodIds = staff.filter(s => s.role === 'BOOD' && !s.daNghi).map(s => s.id);
      triggerToast(coDoiHan
        ? `Đã gửi yêu cầu dời hạn +${delayDays} ngày cho "${target.hangMuc}" — chờ Trưởng phòng duyệt lại tiến độ Phòng.`
        : `Đã gửi phân bổ lại việc con cho "${target.hangMuc}" (hạn nộp giữ nguyên) — chờ Trưởng phòng duyệt lại tiến độ Phòng.`);
      pushNotify(boodIds, coDoiHan
        ? `Quản lý xin dời hạn +${delayDays} ngày (kéo về Bước 1) cho "${target.hangMuc} — ${target.tenDuAn}". Lý do: ${reason}. Cần duyệt lại tiến độ Phòng.`
        : `Quản lý phân bổ lại công việc con cho "${target.hangMuc} — ${target.tenDuAn}" — GIỮ NGUYÊN hạn nộp ${fmtDateVN(target.ngayHoanThanhDuKienHienTai)}. Lý do: ${reason}. Cần duyệt lại tiến độ Phòng.`, target.id);
    } else {
      triggerToast(coDoiHan
        ? `Đã dời hạn +${delayDays} ngày & kéo "${target.hangMuc}" về Bước 1.`
        : `Đã lưu phân bổ lại việc con của "${target.hangMuc}" & kéo về Bước 1 — hạn nộp giữ nguyên.`);
    }
    // #3: hồ sơ kéo về Bước 1 (Tiếp nhận) → tự báo Quản lý phụ trách vào tạo/cập nhật công việc con
    // cho nhân viên; sau đó chạy tiếp logic cũ (tạo cv con + tiến độ → Trưởng phòng duyệt lại → chạy tiếp).
    if (target.quanLyId && target.quanLyId !== currentUser?.staffId) {
      pushNotify([target.quanLyId], `Hồ sơ "${target.hangMuc} — ${target.tenDuAn}" đã được kéo về Bước 1 (Tiếp nhận thông tin). Vui lòng vào tạo/cập nhật công việc con cho nhân viên; sau đó Trưởng phòng duyệt lại tiến độ để chạy tiếp.`, target.id, true);
    }
    logAction(
      coDoiHan ? 'Dời hạn (kéo về Bước 1)' : 'Phân bổ lại việc con (giữ nguyên hạn)',
      coDoiHan
        ? `${isL2 ? 'Quản lý xin' : 'Trưởng phòng'} dời hạn +${delayDays} ngày hồ sơ ${target.projectId} - ${target.tenDuAn}, kéo về Bước 1. Lý do: ${reason}.`
        // Không dời hạn thì Delay Log không ghi — nhật ký hoạt động chính là chỗ lưu bằng chứng
        // "ai đổi phân công, đổi lúc nào, vì sao" (chị Trâm 29/07/2026).
        : `${isL2 ? 'Quản lý' : 'Trưởng phòng'} phân bổ lại công việc con hồ sơ ${target.projectId} - ${target.tenDuAn}, kéo về Bước 1, GIỮ NGUYÊN hạn nộp ${fmtDateVN(target.ngayHoanThanhDuKienHienTai)}. Lý do: ${reason}.`,
      undefined,
      getProjectParticipants(target)
    );
  };

  // Trưởng phòng kiểm tra & cập nhật kết quả + tiến độ cấp Phòng cho hồ sơ.
  // taiLieuKetQuaPhong: bỏ qua (undefined) = KHÔNG đụng tệp đang có; truyền chuỗi = ghi lại danh sách tệp.
  // chuyenSangBuoc: bảng nhập được mở vì cửa chốt 100% chặn ở bước trước đó. Lưu đủ 100% thì đi
  // tiếp luôn sang bước đó ngay trong lần lưu này — không bắt Trưởng phòng kéo thẻ lại lần nữa.
  const handleUpdatePhongResult = (projId: string, tienDoPhong: number, ketQuaPhong: string, taiLieuKetQuaPhong?: string, chuyenSangBuoc?: number | null) => {
    if (currentUser?.role !== 'BOOD') {
      triggerToast('Chỉ Trưởng phòng (Level 1) mới được cập nhật kết quả & tiến độ cấp Phòng!');
      return;
    }
    // Chỉ đi tiếp khi đã thật sự đủ 100% — chưa đủ thì lưu bình thường và thẻ đứng nguyên.
    const buocMoi = (chuyenSangBuoc && tienDoPhong >= 100) ? chuyenSangBuoc : undefined;
    const updated = projects.map(proj => {
      if (proj.id !== projId) return proj;
      let nextStatus = proj.trangThai;
      // "Hoàn thành" CHỈ khi hồ sơ đã thực sự GỬI CĐT (kanbanStep >= 5) — nhập/duyệt tiến độ Phòng
      // 100% ở bước sớm hơn (vd đang nhắc nhập tại bước 4) KHÔNG được tự coi là xong, tránh mâu
      // thuẫn với thẻ Kanban vẫn còn nằm ở bước sớm (chị Trâm báo 28/07/2026). Mốc hoàn thành thật
      // sự do handleKanbanMove ghi khi TP xác nhận gửi CĐT (kéo thẻ 4→5), tính đúng hạn/trễ theo
      // hạn hẹn CĐT — chỗ này chỉ đồng bộ lại đúng trạng thái nếu vô tình đã ở bước 5 trở lên.
      const buocSauLuu = buocMoi || proj.kanbanStep || 1;
      if (proj.tienDoBoPhan === 100 && tienDoPhong === 100 && proj.trangThai === 'DANG_THUC_HIEN' && buocSauLuu >= 5) {
        nextStatus = 'HOAN_THANH_DUNG_HAN';
      }
      return {
        ...proj,
        tienDoPhong,
        ketQuaPhong: ketQuaPhong.trim() || undefined,
        ...(taiLieuKetQuaPhong !== undefined ? { taiLieuKetQuaPhong: taiLieuKetQuaPhong || undefined } : {}),
        trangThai: nextStatus,
        ...(buocMoi ? { kanbanStep: buocMoi } : {}),
      };
    });
    setProjects(updated);
    const target = projects.find(p => p.id === projId);
    const tenBuocMoi = buocMoi ? (KANBAN_STEPS.find(s => s.id === buocMoi)?.title || `Bước ${buocMoi}`) : '';
    triggerToast(buocMoi
      ? `Đã duyệt tiến độ Phòng 100%. Hồ sơ chuyển sang bước ${buocMoi}: ${tenBuocMoi}.`
      : 'Đã cập nhật kết quả và tiến độ cấp Phòng.');
    if (target && buocMoi) {
      logAction('Chuyển bước Kanban', `Chuyển hồ sơ ${target.projectId} - ${target.tenDuAn} sang bước ${buocMoi} (${tenBuocMoi}) ngay sau khi Trưởng phòng duyệt tiến độ Phòng 100%`, undefined, getProjectParticipants(target));
    }
    if (target) {
      logAction('Cập nhật kết quả Phòng', `Trưởng phòng cập nhật tiến độ Phòng ${tienDoPhong}% và kết quả kiểm tra cho hồ sơ ${target.projectId} - ${target.tenDuAn}`, undefined, getProjectParticipants(target));
      // Khớp đúng điều kiện với nextStatus ở trên — đừng báo "đã HOÀN THÀNH" trong khi trạng thái
      // thật sự vẫn là DANG_THUC_HIEN (hồ sơ chưa qua bước 5).
      const daHoanThanh = target.tienDoBoPhan === 100 && tienDoPhong === 100 && target.trangThai === 'DANG_THUC_HIEN' && (buocMoi || target.kanbanStep || 1) >= 5;
      pushNotify(allManagerIds(target), daHoanThanh
        ? `Công việc "${target.hangMuc} — ${target.tenDuAn}" đã HOÀN THÀNH (Phòng duyệt 100%).`
        : `Trưởng phòng vừa cập nhật tiến độ Phòng ${tienDoPhong}% cho "${target.hangMuc} — ${target.tenDuAn}".`, target.id);
    }
  };

  // Quản lý (L2) / Nhân viên (L3) tự kết xuất báo cáo phần việc của mình từ panel tác vụ cá nhân.
  // File do MyTasksPanel dựng (chỉ chứa việc của chính họ) — ở đây chỉ báo kết quả & ghi Nhật ký.
  const handleMyWorkExported = (count: number, scope: string) => {
    triggerToast(`Đã xuất báo cáo công việc cá nhân (${count} công việc — ${scope})!`);
    logAction('Xuất báo cáo cá nhân', `Kết xuất báo cáo công việc cá nhân ra tệp Excel (${count} công việc, phạm vi: ${scope})`);
  };

  // Chi tiết TỪNG VÒNG của một hồ sơ (chị Trâm chốt 27/07/2026) — để đo hiệu suất Phòng Đấu thầu:
  // mỗi lần bị CĐT trả về làm lại là 1 vòng, xuất riêng khoảng thời gian + ngày gửi CĐT + tiến độ
  // của đúng vòng đó, không gộp chung. Mốc thời gian mỗi vòng đọc từ việc con mang trường `vong`
  // (dùng lại getExecEnd round-aware) và nhật ký gửi CĐT (guiCDTLogs).
  const chiTietTheoVong = (p: Project): { vong: number; batDau: string; ketThuc: string; soNgay: number | null; ngayGui?: string; tienDo: number }[] => {
    const soVong = Math.max(1, soVongCoViec(p.tasks), p.guiCDTLogs?.length || 0, p.vongHienTai || 1);
    const DAY = 24 * 60 * 60 * 1000;
    const out: { vong: number; batDau: string; ketThuc: string; soNgay: number | null; ngayGui?: string; tienDo: number }[] = [];
    for (let r = 1; r <= soVong; r++) {
      const viecVong = tasksOfRound(p.tasks, r);
      const coNgay = viecVong.filter(t => t.ngayBatDau);
      let batDau = '—', ketThuc = '—', soNgay: number | null = null;
      if (coNgay.length) {
        const startMs = Math.min(...coNgay.map(t => new Date(t.ngayBatDau!).getTime()));
        const startYmd = ymdOf(new Date(startMs));
        const end = getExecEnd({ ngayBatDau: startYmd, tasks: p.tasks, soNgayThucHien: p.soNgayThucHien, soNgayDuyetTP: p.soNgayDuyetTP, vongHienTai: r });
        batDau = fmtDateVN(startYmd);
        ketThuc = fmtDateVN(ymdOf(end));
        soNgay = Math.max(1, Math.round((end.getTime() - startMs) / DAY) + 1);
      }
      const gui = (p.guiCDTLogs || []).find(g => g.lan === r);
      out.push({ vong: r, batDau, ketThuc, soNgay, ngayGui: gui?.ngay, tienDo: progressOfRound(p.tasks, r) });
    }
    return out;
  };

  // ===== SAO LƯU / KHÔI PHỤC NGUYÊN TRẠNG (chị Trâm chốt 28/07/2026) =====
  // Khác hẳn "Xuất Excel" và "Báo cáo Chiến lược" (đều là báo cáo cho lãnh đạo, chỉ có thông tin
  // cấp hồ sơ). Tệp sao lưu này giữ ĐỦ mọi trường của hồ sơ:
  // cây công việc con, tiến độ từng việc, vòng làm việc, nhật ký gửi CĐT, delay logs, kết quả Phòng...
  // → nạp lại là khôi phục đúng nguyên trạng, không mất gì.
  // Định dạng JSON (không phải Excel) vì Excel phẳng không chứa nổi cây việc con nhiều cấp.
  const BAN_SAO_LUU = 1; // tăng số này khi đổi cấu trúc dữ liệu, để bản cũ vẫn nhận diện được

  const handleXuatSaoLuu = () => {
    if (currentUser?.role !== 'BOOD') {
      triggerToast('Chỉ Trưởng phòng (Level 1) mới được xuất tệp sao lưu toàn bộ dữ liệu.');
      return;
    }
    const goi = {
      loai: 'HPCONS_DAUTHAU_BACKUP',
      ban: BAN_SAO_LUU,
      ngayXuat: new Date().toISOString(),
      nguoiXuat: currentUser?.name || '',
      soHoSo: projects.length,
      soNhanSu: staff.length,
      // Mật khẩu KHÔNG bao giờ nằm trong tệp sao lưu — Firebase Auth quản lý, xuất ra là hở bảo mật.
      projects,
      staff: staff.map(({ password: _pw, ...rest }) => rest),
    };
    const blob = new Blob([JSON.stringify(goi, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HPCons_SaoLuu_DauThau_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast(`Đã xuất tệp sao lưu: ${projects.length} hồ sơ, ${staff.length} nhân sự.`);
    logAction('Xuất tệp sao lưu', `Sao lưu toàn bộ dữ liệu ra tệp JSON (${projects.length} hồ sơ, ${staff.length} nhân sự)`);
  };

  // Vá thiếu trường cho hồ sơ đọc từ tệp sao lưu. Tệp xuất từ bản cũ (hoặc bị sửa tay) có thể
  // thiếu mảng/số mà UI cứ thế .map()/.toFixed() → app trắng trang, người dùng chỉ thấy
  // "khôi phục không được". Vá ở đây để hỏng dữ liệu là hỏng 1 ô, không sập cả app.
  const chuanHoaHoSoSaoLuu = (p: any): Project => ({
    ...p,
    id: String(p?.id ?? ''),
    projectId: String(p?.projectId ?? ''),
    tenDuAn: String(p?.tenDuAn ?? '(không có tên)'),
    quanLyId: String(p?.quanLyId ?? ''),
    thucHienId: String(p?.thucHienId ?? ''),
    hangMuc: p?.hangMuc || 'Báo giá chi tiết',
    moTa: String(p?.moTa ?? ''),
    ngayBatDau: String(p?.ngayBatDau ?? ''),
    soNgayDuKien: Number(p?.soNgayDuKien) || 0,
    ngayHoanThanhDuKienGoc: String(p?.ngayHoanThanhDuKienGoc ?? p?.ngayBatDau ?? ''),
    ngayHoanThanhDuKienHienTai: String(p?.ngayHoanThanhDuKienHienTai ?? p?.ngayHoanThanhDuKienGoc ?? p?.ngayBatDau ?? ''),
    tienDoBoPhan: Number(p?.tienDoBoPhan) || 0,
    tienDoPhong: Number(p?.tienDoPhong) || 0,
    trangThai: p?.trangThai || 'DANG_THUC_HIEN',
    tasks: Array.isArray(p?.tasks) ? p.tasks : [],
    delayLogs: Array.isArray(p?.delayLogs) ? p.delayLogs : [],
    comments: Array.isArray(p?.comments) ? p.comments : [],
    guiCDTLogs: Array.isArray(p?.guiCDTLogs) ? p.guiCDTLogs : [],
    soLanGuiCDTTruocApp: Number.isFinite(Number(p?.soLanGuiCDTTruocApp)) ? Number(p.soLanGuiCDTTruocApp) : undefined,
    cdtDieuChinh: Array.isArray(p?.cdtDieuChinh) ? p.cdtDieuChinh : [],
    quanLyIdsPhu: Array.isArray(p?.quanLyIdsPhu) ? p.quanLyIdsPhu : [],
    thucHienIds: Array.isArray(p?.thucHienIds) ? p.thucHienIds : [],
  });

  const handleKhoiPhucSaoLuu = (file: File) => {
    if (currentUser?.role !== 'BOOD') {
      triggerToast('Chỉ Trưởng phòng (Level 1) mới được khôi phục dữ liệu từ tệp sao lưu.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const goi = JSON.parse(String(reader.result || '{}'));
        if (goi?.loai !== 'HPCONS_DAUTHAU_BACKUP' || !Array.isArray(goi.projects)) {
          triggerToast('Tệp không phải bản sao lưu của HP-CONS Đấu Thầu. Dữ liệu hiện tại giữ nguyên.');
          return;
        }
        // Bỏ bản ghi rỗng / thiếu mã hồ sơ (không thể tham chiếu được), vá phần còn lại
        const hoSoDoc: Project[] = goi.projects
          .filter((p: any) => p && (p.id || p.projectId))
          .map(chuanHoaHoSoSaoLuu);
        const soBoQua = goi.projects.length - hoSoDoc.length;
        if (hoSoDoc.length === 0) {
          triggerToast('Tệp sao lưu không có hồ sơ nào đọc được. Dữ liệu hiện tại giữ nguyên.');
          return;
        }
        const soHoSo = hoSoDoc.length;
        const soNhanSu = Array.isArray(goi.staff) ? goi.staff.length : 0;
        // GHI ĐÈ toàn bộ — đúng nghĩa "khôi phục nguyên trạng", nên phải hỏi trước khi làm.
        const dongY = window.confirm(
          `KHÔI PHỤC TOÀN BỘ DỮ LIỆU\n\n`
          + `Tệp sao lưu ngày ${(goi.ngayXuat || '').split('T')[0]} — ${soHoSo} hồ sơ, ${soNhanSu} nhân sự.\n\n`
          + `Toàn bộ dữ liệu HIỆN TẠI (${projects.length} hồ sơ) sẽ bị GHI ĐÈ và không lấy lại được.\n\n`
          + `Bấm OK để khôi phục.`
        );
        if (!dongY) return;
        setProjects(hoSoDoc);
        localStorage.setItem('erp_projects', JSON.stringify(hoSoDoc));
        if (soNhanSu > 0) {
          // Giữ nguyên mật khẩu đang có trên máy — tệp sao lưu cố ý không chứa mật khẩu
          const ghepMatKhau = goi.staff.map((s: Staff) => {
            const cu = staff.find(x => x.id === s.id);
            return cu?.password ? { ...s, password: cu.password } : s;
          });
          setStaff(ghepMatKhau);
          localStorage.setItem('erp_staff', JSON.stringify(ghepMatKhau));
        }
        setShowImportPanel(false);
        triggerToast(
          `Đã khôi phục ${soHoSo} hồ sơ và ${soNhanSu} nhân sự từ tệp sao lưu.`
          + (soBoQua > 0 ? ` (Bỏ qua ${soBoQua} bản ghi lỗi trong tệp.)` : '')
        );
        logAction('Khôi phục sao lưu', `Khôi phục toàn bộ dữ liệu từ tệp ${file.name} (${soHoSo} hồ sơ, ${soNhanSu} nhân sự)`);
      } catch (e: any) {
        triggerToast(`Không đọc được tệp sao lưu: ${e.message}. Dữ liệu hiện tại giữ nguyên.`);
      }
    };
    reader.onerror = () => triggerToast('Lỗi đọc tệp sao lưu.');
    reader.readAsText(file);
  };

  // Export to Excel (chronological by Project_ID, with strict RBAC limits to prevent data leaks)
  // ===== XUẤT BẢNG THỐNG KÊ DỰ ÁN ĐẤU THẦU (hồ sơ ISO) — chị Trâm, góp ý #13 =====
  // Đúng mẫu sheet 3 của file mục tiêu ISO: 3 tầng tiêu đề, mỗi tháng của kỳ 6 cột con, nhóm
  // "Phân tích thầu", dòng TỔNG HỢP. Chi tiết cách dựng ở utils/bangThongKeISO.ts.
  // Phạm vi: TOÀN BỘ hồ sơ trong quyền xem của người xuất (không theo bộ lọc đang bật trên màn hình,
  // vì đây là hồ sơ ISO của cả kỳ — lọc màn hình chỉ để xem nhanh).
  const handleXuatBangThongKeISO = () => {
    const ky = kyISO;
    const nam = parseInt(namISO, 10) || Number(namHienTaiVN());
    const { html, soHoSo, soDong } = dungBangThongKeISO(workItems, ky, nam, currentUser?.name);
    if (soHoSo === 0) {
      triggerToast('Không có hồ sơ nào vào bảng thống kê (đã loại hạng mục Cải tạo / Báo giá phát sinh).');
      return;
    }
    // Tải về dạng HTML-Excel để GIỮ ĐƯỢC ĐỊNH DẠNG (viền, nền tiêu đề, gộp ô, Times New Roman) —
    // cùng cách với "Xuất Excel" và "Báo cáo Chiến lược" của app. Xem ghi chú ở utils/bangThongKeISO.ts.
    const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = tenTepBangISO(ky, nam);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast(`Đã xuất bảng thống kê dự án — Kỳ ${ky}/${nam}: ${soHoSo} hồ sơ, ${soDong} dòng.`);
    logAction('Xuất bảng thống kê dự án',
      `Bảng thống kê dự án đấu thầu Kỳ ${ky} năm ${nam} (${soHoSo} hồ sơ, ${soDong} dòng) — loại hạng mục Cải tạo / Báo giá phát sinh`);
  };

  const handleExportExcel = () => {
    const exportData = [...filteredProjects];
    // Sort chronologically by Project_ID
    exportData.sort((a, b) => a.projectId.localeCompare(b.projectId));

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          /* Arial cho toàn bộ file kết xuất (chị Trâm chốt 29/07/2026) */
          body, table, td, th, div { font-family: Arial, Helvetica, sans-serif; }
          body { margin: 20px; }
          table { border-collapse: collapse; width: 100%; font-size: 13px; }
          th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; border: 1px solid #94a3b8; padding: 12px 10px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 10px 8px; text-align: left; vertical-align: top; }
          tr:nth-child(even) td { background-color: #f8fafc; }
          .title { font-size: 22px; font-weight: bold; color: #1e3a8a; text-align: center; padding: 20px 0 5px 0; text-transform: uppercase; }
          .subtitle { font-size: 13px; font-weight: bold; color: #475569; text-align: center; padding-bottom: 20px; }
          /* Khối thông tin phải là BẢNG, không phải div nhiều <br/>: Excel dồn div vào ô cột A rồi
             bọc chữ, ra một ô cao lêu nghêu đọc không nổi (chị Trâm báo 29/07/2026). */
          .meta { width: auto; font-size: 11px; margin-bottom: 20px; }
          .meta td { border: 1px solid #e2e8f0; padding: 6px 10px; background-color: #f8fafc; vertical-align: middle; white-space: nowrap; }
          .meta .k { font-weight: bold; color: #334155; }
          .meta .v { color: #475569; }
          .percentage { text-align: right; font-weight: bold; }
          .numeric { text-align: right; font-weight: bold; }
          .bold-text { font-weight: bold; color: #0f172a; }
          .status-badge { font-weight: bold; padding: 4px 8px; border-radius: 4px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="title">Bảng thống kê dự án đấu thầu</div>
        <div class="subtitle">Báo cáo tổng hợp quy mô, tiến độ và kết quả đấu thầu phòng dự án</div>
        <table class="meta">
          <tr><td class="k">Hệ thống phần mềm</td><td class="v">HP Cons BPM ERP Enterprise v1.5</td></tr>
          <tr><td class="k">Ngày giờ trích xuất</td><td class="v">${fmtDateTimeVN(new Date())} (Giờ địa phương GMT+7)</td></tr>
          <tr><td class="k">Nhân sự xuất báo cáo</td><td class="v">${currentUser?.name || 'Hệ thống'}</td></tr>
          <tr><td class="k">Phân quyền bảo mật</td><td class="v">Level ${currentUser?.role === 'BOOD' ? '1 (Trưởng phòng / Phó phòng)' : currentUser?.role === 'MANAGER' ? '2 (Quản lý)' : currentUser?.role === 'VIEWER' ? '4 (Ban giám đốc - chỉ xem)' : '3 (Nhân viên)'}</td></tr>
          <tr><td class="k">Kiểm soát dữ liệu</td><td class="v" style="white-space: normal;">Tự động che dấu / thu gọn thông số phòng duyệt nhạy cảm theo quyền tài khoản đang đăng nhập.</td></tr>
        </table>
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
              <th style="background-color: #1e3a8a; color: #ffffff;">Chi Tiết Theo Vòng (Số Lần Gửi CĐT)</th>
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
      // KPI đang xây dựng trọng số → để trống điểm (chị Trâm chốt 27/07/2026)
      const kpiScore = isStaff ? '🔒 Bảo mật' : '—';

      // 7. Chi tiết theo vòng — mỗi lần gửi CĐT là 1 vòng, đo riêng khoảng thời gian & tiến độ.
      const vongList = chiTietTheoVong(p);
      const vongHtml = vongList.length <= 1 && (p.guiCDTLogs?.length || 0) === 0
        ? '1 vòng (chưa gửi lại CĐT)'
        : vongList.map(v => {
            const tdText = isStaff ? '🔒' : `${v.tienDo}%`;
            const guiText = v.ngayGui ? `gửi CĐT ${fmtDateVN(v.ngayGui)}` : 'chưa gửi CĐT';
            const ngayText = v.soNgay ? `${v.batDau}→${v.ketThuc} (${v.soNgay} ngày)` : 'chưa đặt lịch';
            return `<b>Vòng ${v.vong}:</b> ${ngayText} · ${guiText} · TĐ ${tdText}`;
          }).join('<br/>');

      html += `
        <tr>
          <td class="bold-text" style="text-align: center;">${p.projectId}</td>
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
          <td style="font-size: 11px; line-height: 1.5;">${vongHtml}</td>
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

  // ===== BẢN THỬ / THỬ-CLOUD: màn chọn vai trò (thay cho đăng nhập SSO) =====
  // Chỉ chạy khi DEV_SANDBOX hoặc DEV_CLOUD_TEST bật; bản production không bao giờ vào nhánh này.
  if (DEV_CHON_VAI_TRO && !currentUser) {
    // Dùng chung với thanh L1/L2/L3/L4 trong app: tài khoản mẫu (Khách Level 4) chưa có trong
    // danh sách đang chạy sẽ được bổ sung vào staff trước khi vào.
    const enterAs = (s: Staff) => doiVaiTroBanThu(s);
    // BỎ "Nạp dữ liệu mẫu" (chị Trâm chốt 27/07/2026): Bản thử không còn hồ sơ giả lập nào —
    // chị tự tạo hồ sơ thật để nghiệm thu, tránh số liệu ảo lẫn vào lúc kiểm tra.
    // Chỉ còn nút nạp lại DANH SÁCH NHÂN SỰ (không kèm hồ sơ) phòng khi lỡ xoá mất tài khoản.
    const napNhanSu = () => {
      const st = sandboxStaff();
      localStorage.setItem('erp_staff', JSON.stringify(st));
      setStaff(st);
    };
    // 9 hồ sơ NHÁP đi HẾT 7 bước quy trình (chị Trâm chốt 17/08/2026 — bộ 3 hồ sơ cũ "rất nháp,
    // không có logic": cả 3 đều nằm đầu quy trình nên Kanban gần như trống, không thử được luồng).
    // Nội dung từng trạng thái xem `duAnNhap()` trong src/data/sandboxData.ts.
    // Thêm vào danh sách đang có, KHÔNG ghi đè hồ sơ thật đang thử dở.
    const napDuAnNhap = () => {
      const nhap = duAnNhap();
      setProjects(prev => {
        const conLai = prev.filter(p => !nhap.some(n => n.id === p.id));
        const ds = [...conLai, ...nhap];
        localStorage.setItem('erp_projects', JSON.stringify(ds));
        return ds;
      });
      // Nhân sự phải có sẵn thì hồ sơ nháp mới tra được tên người phụ trách
      if (staff.length === 0) napNhanSu();
    };
    const xoaDuLieuThu = () => {
      ['erp_projects', 'erp_staff', 'erp_notifs', 'erp_activity_logs', 'erp_personal_tasks'].forEach(k => localStorage.removeItem(k));
      setProjects([]);
      setStaff(sandboxStaff());
      setNotifs([]);
    };
    // Thang Level chị Trâm chốt 17/08/2026 — giữ khớp với app/api/roles/route.ts và AppLauncher.
    const nhomVaiTro: { key: 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER'; nhan: string }[] = [
      { key: 'BOOD', nhan: 'Trưởng phòng / Phó phòng (Level 1)' },
      { key: 'MANAGER', nhan: 'Quản lý (Level 2)' },
      { key: 'STAFF', nhan: 'Nhân viên (Level 3)' },
      { key: 'VIEWER', nhan: 'Ban giám đốc — chỉ xem (Level 4)' },
    ];
    return (
      <div className="min-h-screen bg-dark-bg text-slate-100 font-sans p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {loiCloud && <BannerLoiCloud noiDung={loiCloud} onDong={() => setLoiCloud(null)} />}
          <div className="flex items-center gap-3">
            <HpConsLogo className="h-9" light />
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${
              DEV_CLOUD_TEST ? 'bg-brand-danger text-white' : 'bg-brand-warning text-slate-900'
            }`}>{DEV_CLOUD_TEST ? NHAN_CHE_DO_CLOUD : 'Bản thử'}</span>
          </div>
          {/* Hai chế độ nói HAI chuyện khác nhau: Bản thử chỉ lưu trong máy, còn Thử-cloud GHI THẬT
              lên Firestore của project thử. Không được để nhầm — nên chữ đổi theo chế độ. */}
          <div className={`bg-dark-card border rounded-xl p-4 space-y-1 ${
            DEV_CLOUD_TEST ? 'border-brand-danger/50' : 'border-brand-warning/40'
          }`}>
            <h1 className="text-lg font-black">Chọn vai trò để vào thử</h1>
            {DEMO_WEB_DUOC_YEU_CAU && DEV_CLOUD_TEST ? (
              <p className="text-xs text-slate-400 leading-relaxed">
                Đây là <strong className="text-brand-danger">BẢN DEMO</strong> để xem thử giao diện & quy trình:
                không đăng nhập App Tổng, <strong className="text-brand-danger">ai có link cũng vào được</strong> và
                dữ liệu ở đây có thể bị người khác sửa. Dữ liệu ghi vào project thử
                <span className="font-bold"> {projectIdDangChay()}</span>. Dữ liệu thật của Phòng nằm ở project
                <span className="font-bold"> {PROJECT_THAT}</span> và <strong>không</strong> truy cập được từ bản demo này.
              </p>
            ) : DEV_CLOUD_TEST ? (
              <p className="text-xs text-slate-400 leading-relaxed">
                Đây là <strong className="text-brand-danger">chế độ thử-cloud</strong>: không đăng nhập App Tổng, nhưng
                <strong className="text-brand-danger"> GHI THẬT lên Firestore</strong> của project
                <span className="font-bold"> {projectIdDangChay()}</span> (đăng nhập ẩn danh). Dùng để nghiệm thu Sao lưu /
                Khôi phục và đồng bộ nhiều máy. Dữ liệu thật của Phòng nằm ở project
                <span className="font-bold"> {PROJECT_THAT}</span> — chế độ này tự chặn nếu trỏ vào đó.
              </p>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Đây là <strong className="text-brand-warning">bản thử trên máy này</strong>: không đăng nhập App Tổng, không kết nối
                dữ liệu cloud. Mọi thao tác chỉ lưu trong trình duyệt — thử phá thoải mái, dữ liệu thật trên
                <span className="font-bold"> dauthau.hpcore.vn</span> không bị ảnh hưởng.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={napNhanSu} className="text-[11px] font-black bg-brand-accent hover:bg-brand-accent-700 text-white px-3 py-2 rounded-lg cursor-pointer">
              👥 Nạp lại danh sách nhân sự (không kèm hồ sơ)
            </button>
            <button type="button" onClick={napDuAnNhap} className="text-[11px] font-black bg-brand-warning hover:bg-brand-warning/80 text-slate-900 px-3 py-2 rounded-lg cursor-pointer">
              🧪 Nạp 9 hồ sơ NHÁP (đủ 7 bước quy trình)
            </button>
            <button type="button" onClick={xoaDuLieuThu} className="text-[11px] font-black bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg cursor-pointer">
              🧹 Xoá sạch dữ liệu bản thử
            </button>
          </div>

          {nhomVaiTro.map(nhom => {
            const list = staff.filter(s => (s.role || chucVuToRole(s.chucVu)) === nhom.key && !s.daNghi);
            // Level nào chưa có ai trong dữ liệu đang chạy (thường là Khách - Level 4) thì hiện tài
            // khoản mẫu để vẫn bấm thử được ngay.
            const mauBoSung = list.length
              ? []
              : sandboxStaff().filter(s => (s.role || chucVuToRole(s.chucVu)) === nhom.key);
            const hienThi = list.length ? list : mauBoSung;
            if (!hienThi.length) return null;
            return (
              <div key={nhom.key} className="bg-dark-card border border-slate-700 rounded-xl p-3">
                <div className="text-[10px] font-black uppercase tracking-wider text-brand-accent-300 mb-2">
                  {nhom.nhan}
                  {!list.length && <span className="ml-1.5 normal-case tracking-normal text-slate-500">(tài khoản mẫu — vào là tự thêm vào danh sách)</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {hienThi.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => enterAs(s)}
                      className="text-[11px] font-bold bg-dark-elevated hover:bg-brand-accent hover:text-white text-slate-200 border border-slate-700 px-3 py-2 rounded-lg cursor-pointer"
                    >
                      {s.hoTen} <span className="text-slate-400">· {s.chucVu}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <p className="text-[10px] text-slate-500">
            Chưa thấy nhân sự nào? Bấm <strong>Nạp lại danh sách nhân sự</strong> ở trên. Bản thử khởi đầu KHÔNG có hồ sơ nào — hãy tự tạo hồ sơ thật để nghiệm thu.
          </p>
        </div>
      </div>
    );
  }

  // If not logged in — hoặc CHƯA đối chiếu xong quyền với App Tổng lần này (tránh lọt hình
  // app chính bằng currentUser cache cũ trước khi kịp bị khóa) — render màn xác thực/chặn.
  if (!currentUser || !sessionVerified) {
    return (
      <div className="min-h-screen bg-dark-bg text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
        {/* Ambient radial blur backdrops */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-brand-accent/15 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] bg-brand-warning/10 rounded-full blur-[150px] pointer-events-none" />

        {/* Global tiny grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(color-mix(in_srgb,white_2%,transparent)_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        {/* Header containing HP CONS Logo with empty logo slot */}
        <header className="p-6 shrink-0 z-20">
          {/* Bỏ max-w-7xl (chặn theo rem, co lại khi zoom chữ) — xem ghi chú ở thẻ <main> */}
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HpConsLogo className="h-10" light={true} />
            </div>

            {/* Đồng hồ chạy realtime — GIỜ VIỆT NAM (GMT+7), không phải giờ UTC và cũng không phải
                giờ máy. Ghi rõ "GMT+7" để người xem biết chắc đang đọc giờ nào. */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-dark-card border border-slate-800 rounded-full text-xs font-mono font-bold tracking-wider text-slate-300">
              <span className="w-2 h-2 rounded-full bg-brand-danger animate-pulse" />
              <span>{vnTime || "00:00:00"} GMT+7</span>
            </div>
          </div>
        </header>

        {/* Bố cục 2 cột: Bảng thương hiệu vs Biểu mẫu đăng nhập */}
        <main className="flex-grow flex items-center justify-center p-6 z-10">
          <div className="w-full max-w-5xl grid grid-cols-1 xl:grid-cols-12 gap-8 items-center">

            {/* LEFT SIDE: Bảng thương hiệu HP-CONS / Phòng Đấu Thầu */}
            <div className="xl:col-span-6 hidden xl:flex flex-col space-y-7">
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
            <div className="xl:col-span-6 flex flex-col justify-center">
              <div className="w-full max-w-md mx-auto bg-dark-card border border-slate-800 shadow-2xl rounded-2xl p-6 md:p-8 space-y-6 relative">
                
                {/* Yellow tactical border accent line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-warning via-brand-warning to-brand-accent rounded-t-2xl" />

                <div className="text-center space-y-2">
                  <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center border ${ssoUnauthorized ? 'bg-brand-warning/10 text-brand-warning border-brand-warning/20' : ssoError ? 'bg-brand-danger/10 text-brand-danger border-brand-danger/20' : 'bg-brand-warning/10 text-brand-warning border-brand-warning/20 animate-pulse'}`}>
                    <Lock className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-black text-white uppercase tracking-wider">
                    {ssoUnauthorized ? 'Không Có Quyền Truy Cập' : ssoError ? 'Không Thể Xác Thực' : 'Đang Xác Thực...'}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wide">
                    Phòng Đấu Thầu - HP CONS BPM
                  </p>
                </div>

                {ssoUnauthorized ? (
                  <>
                    <div className="bg-brand-warning/10 border border-brand-warning/20 rounded-xl p-3 text-xs text-brand-warning font-bold flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-warning shrink-0" />
                      <span>Bạn không thuộc quyền xem trang này.</span>
                    </div>
                    <p className="text-[10px] text-slate-500 text-center font-medium leading-relaxed">
                      Liên hệ Ban Giám đốc / Trưởng phòng để được cấp quyền tại{' '}
                      <a href="https://account.hpcore.vn/dashboard/apps/dauthau" className="text-brand-warning underline">account.hpcore.vn</a>.
                    </p>
                    <button
                      type="button"
                      onClick={() => { window.location.href = 'https://account.hpcore.vn'; }}
                      className="w-full py-3 bg-brand-warning hover:bg-brand-warning/85 text-black font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-md hover:shadow-lg cursor-pointer"
                    >
                      Quay Lại App Tổng
                    </button>
                  </>
                ) : ssoError ? (
                  <>
                    <div className="bg-brand-danger/10 border border-brand-danger/20 rounded-xl p-3 text-xs text-brand-danger font-bold flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-danger shrink-0" />
                      <span>{ssoError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSsoRetryTick(t => t + 1)}
                      className="w-full py-3 bg-brand-warning hover:bg-brand-warning/85 text-black font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-md hover:shadow-lg cursor-pointer"
                    >
                      Thử lại
                    </button>
                  </>
                ) : (
                  <div className="relative border-t border-slate-800 pt-4">
                    <p className="text-[10px] text-slate-500 text-center font-medium leading-relaxed">
                      Đang kiểm tra phiên đăng nhập từ App Tổng (hpcore.vn)...
                      <br />Nếu không tự chuyển trang, Sếp vui lòng đăng nhập tại{' '}
                      <a href="https://account.hpcore.vn/login" className="text-brand-warning underline">account.hpcore.vn</a>.
                    </p>
                  </div>
                )}
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

      {/* Không đọc được Firestore: app vẫn chạy bằng dữ liệu cục bộ nên PHẢI có dải cảnh báo
          giữ nguyên trên màn hình, không thì cả phòng ngồi làm trên dữ liệu không đồng bộ. */}
      {loiCloud && (
        <div className="px-4 pt-3">
          <BannerLoiCloud noiDung={loiCloud} onDong={() => setLoiCloud(null)} />
        </div>
      )}

      {/* BẢN THỬ: dải nhắc luôn hiện để không lẫn với bản thật + thanh xem review 4 level.
          Bấm L1/L2/L3/L4 là nhảy ngay sang xem app bằng con mắt của level đó (không phải đăng
          xuất rồi chọn lại) — để soát nhanh mỗi level thấy gì / làm được gì. */}
      {DEV_CHON_VAI_TRO && (
        <div className={`fixed bottom-3 left-3 z-[60] flex items-center gap-2 border border-slate-900/20 rounded-lg px-2.5 py-1.5 shadow-xl ${
          DEV_CLOUD_TEST ? 'bg-brand-danger text-white' : 'bg-brand-warning text-slate-900'
        }`}>
          {/* Thử-cloud dùng màu ĐỎ + tên project: phải nhìn là biết đang ghi thật lên Firestore
              nào, không được lẫn với Bản thử (chỉ lưu trong máy). */}
          <span className="text-[10px] font-black uppercase tracking-wider">
            {DEV_CLOUD_TEST ? `${NHAN_CHE_DO_CLOUD} · ${projectIdDangChay()}` : 'Bản thử'} · {currentUser.name}
          </span>
          <div className="flex items-center gap-1" role="group" aria-label="Xem thử theo cấp quyền">
            {([
              { key: 'BOOD', nhan: 'L1', moTa: 'Trưởng phòng / Phó phòng' },
              { key: 'MANAGER', nhan: 'L2', moTa: 'Quản lý' },
              { key: 'STAFF', nhan: 'L3', moTa: 'Nhân viên' },
              { key: 'VIEWER', nhan: 'L4', moTa: 'Ban giám đốc — chỉ xem' },
            ] as const).map(muc => {
              // Lấy người ĐẦU TIÊN còn làm việc ở level đó làm đại diện để vào xem
              // (chưa có ai thì lấy tài khoản mẫu — xem daiDienLevelBanThu)
              const nguoi = daiDienLevelBanThu(muc.key);
              const dangXem = currentUser.role === muc.key;
              return (
                <button
                  key={muc.key}
                  type="button"
                  disabled={!nguoi}
                  aria-pressed={dangXem}
                  title={nguoi
                    ? `Xem bằng vai trò ${muc.moTa} — ${nguoi.hoTen}`
                    : `Bản thử chưa có tài khoản ${muc.moTa}.`}
                  onClick={() => { if (nguoi) doiVaiTroBanThu(nguoi); }}
                  className={`text-[10px] font-black px-1.5 py-0.5 rounded border transition-colors ${
                    dangXem
                      ? 'bg-slate-900 text-brand-warning border-slate-900'
                      : 'bg-white/70 border-slate-900/30 hover:bg-white'
                  } ${nguoi ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                >
                  {muc.nhan}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => { localStorage.removeItem('erp_current_user'); setCurrentUser(null); }}
            className="text-[10px] font-black underline cursor-pointer"
          >
            Chọn người khác
          </button>
        </div>
      )}

      {/* Toast alert banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            // Nhích xuống DƯỚI header (60px desktop, cao hơn ở mobile 2 hàng) — trước để top-5 là đè
            // thẳng lên chuông thông báo & các nút góc phải header (chị Trâm báo 28/07/2026).
            className="fixed top-28 md:top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-dark-elevated text-white px-5 py-3 rounded-xl shadow-lg border border-slate-800 dark:border-slate-700 flex items-center gap-2.5 text-xs font-bold"
          >
            <CheckCircle className="w-4 h-4 text-brand-success-400" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar tràn full chiều cao + cột phải (Header/Main/Footer) */}
      <div className="flex-grow flex flex-col md:flex-row min-h-0">
        {/* Left Sidebar / Thanh tác vụ bên trái */}
        <aside className={`w-full ${sidebarCollapsed ? 'md:w-18 sidebar-collapsed' : 'md:w-[260px]'} bg-nav-base text-slate-100 border-r border-white/10 p-4 shrink-0 hidden md:flex flex-col justify-between transition-all duration-200`} id="app-sidebar">
          <div className="space-y-6">
            {/* Logo + tên app — bấm để mở lưới ứng dụng HPCons App Tổng (giống pkd_crm-next/Task Manager) */}
            <button
              type="button"
              onClick={() => setAppLauncherOpen(true)}
              title="Mở danh sách ứng dụng"
              className="hidden md:flex w-full items-center gap-2.5 rounded-lg border-b border-white/10 pb-4 text-left transition-colors hover:bg-white/10"
              id="sidebar-brand"
            >
              <HpConsLogo iconSize="w-9 h-9" className="shrink-0" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-bold text-white">HPCons</span>
                <span className="block truncate text-xs text-slate-400">Construction</span>
              </span>
            </button>

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
                className={`w-full h-11 px-4 font-bold transition-all rounded-lg flex items-center gap-3 text-left ${
                  activeTab === 'DEPTLINKS' && !showForm
                    ? 'bg-brand-accent text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
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
                className={`w-full h-11 px-4 font-bold transition-all rounded-lg flex items-center gap-3 text-left ${
                  activeTab === 'DASHBOARD' && !showForm
                    ? 'bg-brand-accent text-white font-semibold shadow-sm' 
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
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
                    className={`w-full h-11 px-4 font-bold transition-all rounded-lg flex items-center gap-3 text-left ${
                      activeTab === 'PROJECTS' || showForm
                        ? 'bg-brand-accent text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
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
                    className={`w-full h-11 px-4 font-bold transition-all rounded-lg flex items-center gap-3 text-left ${
                      activeTab === 'KANBAN' && !showForm
                        ? 'bg-brand-accent text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4 shrink-0" />
                    <span className="text-xs">Bảng Kanban</span>
                  </button>

                  {/* Level 4 (Ban giám đốc) XEM HẾT (chị Trâm chốt 17/08/2026) — mục nào có trong
                      VIEWER_TABS thì hiện. Bám theo VIEWER_TABS để sidebar và bộ chặn tab ở
                      useEffect không bao giờ lệch nhau. */}
                  {(currentUser.role !== 'VIEWER' || VIEWER_TABS.includes('GANTT')) && (<button
                    id="btn-nav-gantt"
                    onClick={() => { setActiveTab('GANTT'); setShowForm(false); }}
                    className={`w-full h-11 px-4 font-bold transition-all rounded-lg flex items-center gap-3 text-left ${
                      activeTab === 'GANTT' && !showForm
                        ? 'bg-brand-accent text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span className="text-xs">Biểu Đồ Gantt</span>
                  </button>)}
                </>
              )}

              {/* Tab: Lịch cá nhân + Nhật ký — mọi vai trò. Level 4 (Ban giám đốc) cũng xem được
                  (chị Trâm chốt 17/08/2026: "cho xem hết, chỉ là không cho thao tác"). */}
              {(currentUser.role !== 'VIEWER' || VIEWER_TABS.includes('CALENDAR')) && (<>
              {/* THÔNG BÁO - TEMPLATE — ĐỨNG TRƯỚC LỊCH CÁ NHÂN (chị Trâm chốt 18/08/2026:
                  "Template mẫu lên trc lịch cá nhân" + "nút này thay thành Thông báo - Template").
                  Một mục gộp 2 việc dùng chung cả phòng: phát thông báo nội bộ và danh mục biểu mẫu.
                  Mọi cấp đều vào được; biểu mẫu / thông báo nào chỉ dành cấp nào thì lọc bên trong. */}
              <button
                id="btn-nav-templates"
                onClick={() => { setActiveTab('TEMPLATES'); setShowForm(false); }}
                className={`w-full h-11 px-4 font-bold transition-all rounded-lg flex items-center gap-3 text-left ${
                  activeTab === 'TEMPLATES' && !showForm
                    ? 'bg-brand-accent text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Megaphone className="w-4 h-4 shrink-0" />
                <span className="text-xs">Thông báo - Template</span>
              </button>

              <button
                id="btn-nav-calendar"
                onClick={() => { setActiveTab('CALENDAR'); setShowForm(false); }}
                className={`w-full h-11 px-4 font-bold transition-all rounded-lg flex items-center gap-3 text-left ${
                  activeTab === 'CALENDAR' && !showForm
                    ? 'bg-brand-accent text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
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
                // (nút này nằm trong cùng nhánh ẩn với Lịch cá nhân — xem điều kiện VIEWER phía trên)
                className={`w-full h-11 px-4 font-bold transition-all rounded-lg flex items-center gap-3 text-left ${
                  activeTab === 'HISTORY' && !showForm
                    ? 'bg-brand-accent text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <History className="w-4 h-4 shrink-0" />
                <span className="text-xs">Nhật Ký Hoạt Động</span>
              </button>
              </>)}
              {/* Tab: Đội Ngũ — BOOD (đầy đủ), MANAGER (tạo tài khoản Nhân viên),
                  và Level 4 Ban giám đốc CHỈ XEM (mọi nút thêm/sửa/xóa đã bị tắt qua laKhachChiXem). */}
              {(currentUser.role === 'BOOD' || currentUser.role === 'MANAGER'
                || (currentUser.role === 'VIEWER' && VIEWER_TABS.includes('STAFF'))) && (
                <button
                  id="btn-nav-staff"
                  onClick={() => { setActiveTab('STAFF'); setShowForm(false); }}
                  className={`w-full h-11 px-4 font-bold transition-all rounded-lg flex items-center gap-3 text-left ${
                    activeTab === 'STAFF' && !showForm
                      ? 'bg-brand-accent text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
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
                  className={`w-full h-11 px-4 font-bold transition-all rounded-lg flex items-center gap-3 text-left ${
                    activeTab === 'SYSTEM' && !showForm
                      ? 'bg-brand-accent text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Database className="w-4 h-4 shrink-0" />
                  <span className="text-xs">Hệ thống</span>
                </button>
              )}

            </nav>
          </div>

          {/* Footer: thống kê nhanh + nút thu/mở sidebar (dồn xuống cuối trang) */}
          <div className="space-y-3">
            <div className="hidden md:block border-t border-white/10 pt-4 space-y-3" id="sidebar-footer">
              <div className="bg-black/15 p-3 rounded-xl border border-white/10">
                <div className="text-[10px] text-slate-300 uppercase font-black tracking-wider mb-1">Dự án thầu</div>
                <div className="text-xl font-black text-brand-primary">{filteredProjects.length} <span className="text-xs text-slate-300 font-medium">hồ sơ</span></div>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[9px] text-slate-400 font-medium">
                <span>HP-CONS ERP • 2026</span>
                <span className="bg-brand-warning/20 text-brand-warning dark:text-brand-warning px-1.5 py-0.5 rounded font-black border border-brand-warning/30 uppercase tracking-wider">
                  v1.4
                </span>
              </div>
            </div>

            {/* Nút thu/mở sidebar (chỉ md+; mobile giữ dải nav ngang) */}
            <button
              type="button"
              onClick={toggleSidebar}
              title={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              aria-label={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              className="hidden md:flex items-center justify-center w-full py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all border-t border-white/10 pt-3"
              id="sidebar-toggle"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </aside>

        {appLauncherOpen && (
          <AppLauncher
            displayName={currentUser?.name}
            email={currentUser?.email}
            role={currentUser?.role}
            onClose={() => setAppLauncherOpen(false)}
          />
        )}

        {/* ===== Bottom Navigation mobile <768px (06-mobile/layout.md + 08-navigation/bottom-navigation.md):
              tối đa 5 mục = 4 tab chính + "Thêm" (bottom sheet chứa tab còn lại); vùng chạm ≥44px (luật 10) ===== */}
        {(() => {
          type NavKey = typeof activeTab;
          const laKhach = currentUser.role === 'VIEWER';
          const items: { key: NavKey; label: string; icon: typeof Briefcase; badge?: number }[] = laKhach ? [
            // Level 4 (Khách): chỉ 4 mục xem, không có Gantt / Lịch / Nhật ký / Đội ngũ / Hệ thống
            { key: 'DEPTLINKS' as NavKey, label: 'Liên kết phòng ban', icon: Building2 },
            { key: 'DASHBOARD' as NavKey, label: 'Dashboard', icon: Briefcase },
            { key: 'PROJECTS' as NavKey, label: 'Tiến Độ', icon: ListTodo, badge: filteredProjects.length },
            { key: 'KANBAN' as NavKey, label: 'Kanban', icon: LayoutGrid },
          ] : [
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
                        className={`w-full h-12 min-h-[44px] px-4 rounded-lg flex items-center gap-3 text-left font-bold text-xs transition-colors ${isActive(it.key) ? 'text-white bg-brand-accent font-semibold shadow-sm' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
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
        <div className="px-4 sm:px-6 lg:px-8 py-3 md:py-0 md:h-[60px] md:flex md:items-center">
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
              {/* Ngày giờ hệ thống — header chỉ chứa thông tin phụ (08-navigation/header.md) */}
              <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 dark:bg-dark-elevated/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-xl shrink-0 text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5 text-brand-accent dark:text-brand-accent-300 shrink-0" />
                <span>{['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][localNow.getDay()]}, {fmtDateVN(localNow)}</span>
                <span className="text-slate-400 dark:text-slate-500">•</span>
                <span className="font-black text-slate-700 dark:text-slate-200">{String(localNow.getHours()).padStart(2, '0')}:{String(localNow.getMinutes()).padStart(2, '0')}</span>
              </div>

              {/* Tìm kiếm nhanh dự án/công việc — Enter để nhảy sang Báo Cáo Tiến Độ với bộ lọc điền sẵn (giống cấu trúc header pkd_crm-next/Task Manager) */}
              <form
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = new FormData(e.currentTarget).get('q');
                  setSearchQuery(String(q ?? ''));
                  setActiveTab('PROJECTS');
                  setShowForm(false);
                }}
                className="hidden lg:block lg:w-48 xl:w-64 shrink-0"
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    name="q"
                    defaultValue={searchQuery}
                    placeholder="Tìm dự án, gói thầu..."
                    aria-label="Tìm kiếm dự án, công việc"
                    className="h-8 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-dark-elevated pl-8 pr-3 text-[11px] font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-medium outline-none focus:ring-2 focus:ring-brand-accent"
                  />
                </div>
              </form>

              {/* Chuông thông báo: TP thấy hàng chờ duyệt; Quản lý & Nhân viên thấy thông báo của mình */}
              {(
                <div className="relative shrink-0">
                  <button
                    onClick={() => {
                      setShowNotif(v => {
                        // Mở chuông để xem = đánh dấu đã đọc → số đếm tắt (tin vẫn giữ trong danh sách).
                        // Áp cho MỌI vai, kể cả Trưởng phòng — từ 30/07/2026 chuông của TP cũng có
                        // danh sách thông báo nên phải đánh dấu đã đọc, không thì số đếm treo mãi.
                        if (!v) markMyNotifsRead();
                        return !v;
                      });
                    }}
                    title={currentUser.role === 'BOOD' ? 'Thông báo: công việc chờ Trưởng phòng duyệt tiến độ Phòng' : 'Thông báo của bạn'}
                    className="relative p-2 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-brand-warning dark:hover:text-brand-warning bg-slate-100 dark:bg-dark-elevated/80 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    <Bell className="w-4 h-4" />
                    {/* Trưởng phòng: đếm cả việc cần xử lý LẪN tin chưa đọc (trước đây bỏ sót tin
                        chưa đọc vì chuông TP không có danh sách thông báo). */}
                    {(() => {
                      const soDem = currentUser.role === 'BOOD'
                        ? tpPendingItems.length + tpSetupItems.length + myUnreadCount
                        : myUnreadCount;
                      if (soDem <= 0) return null;
                      return (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-black text-white bg-brand-danger rounded-full animate-pulse">
                          {soDem}
                        </span>
                      );
                    })()}
                  </button>
                  {showNotif && currentUser.role !== 'BOOD' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
                      {/* Khung thông báo RỘNG GẤP ĐÔI (20rem → 40rem, chị Trâm chốt 30/07/2026):
                          tin dài bị bó trong 320px nên ngắt 5-6 dòng, đọc rất mệt.
                          Mobile thì lấy trọn bề rộng màn hình trừ lề, không để tràn ra ngoài. */}
                      <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[40rem] max-h-[32rem] overflow-y-auto bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 text-left">
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 sticky top-0 bg-white dark:bg-dark-card">
                          <Bell className="w-4 h-4 text-brand-warning" />
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Thông báo của bạn</span>
                          {myNotifs.length > 0 && (
                            <button onClick={clearMyNotifs} className="ml-auto text-[10px] font-black text-brand-danger hover:underline cursor-pointer">Xóa tất cả</button>
                          )}
                        </div>
                        {/* Chưa cấp quyền popup → mời bật ngay tại đây (nút cũ nằm sâu trong tab Lịch cá nhân,
                            nhân viên hầu như không thấy nên bỏ lỡ thông báo khi không mở app). */}
                        {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
                          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-brand-accent/5 dark:bg-brand-accent/10">
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-snug">
                              Bật thông báo trình duyệt để nhận popup ngay khi Trưởng phòng duyệt kế hoạch, không cần mở app xem chuông.
                            </p>
                            <button
                              type="button"
                              onClick={requestNotifPerm}
                              className="mt-2 text-[10px] font-black bg-brand-accent hover:bg-brand-accent-700 text-white px-3 py-1.5 rounded-lg cursor-pointer"
                            >
                              🔔 Bật thông báo trình duyệt
                            </button>
                          </div>
                        )}
                        <NotificationFeed
                          notifs={myNotifs}
                          staff={staff}
                          onOpen={(n) => {
                            setShowNotif(false);
                            // Nhân viên (L3) không có tab Hồ sơ → đưa về "KPI Cá Nhân" (tab DASHBOARD)
                            // nơi liệt kê tác vụ đang phụ trách, thay vì bấm vào tin mà không đi đâu.
                            if (currentUser.role === 'STAFF') { setActiveTab('DASHBOARD'); setShowForm(false); return; }
                            // ===== TIN "ĐƯỢC CHỌN LÀM QUẢN LÝ CHO DỰ ÁN" → VÀO THẲNG FORM CÔNG VIỆC MỚI =====
                            // (chị Trâm chốt 18/08/2026 — góp ý #87). Chỉ áp khi tin gắn với một bản ghi
                            // DỰ ÁN: được giao quản lý một dự án thì việc tiếp theo là lập công việc cho
                            // dự án đó, nên mở sẵn form và chọn sẵn đúng dự án. Tin gắn với CÔNG VIỆC thì
                            // vẫn mở hồ sơ như cũ. Nút "CÔNG VIỆC MỚI" bấm tay không đổi gì.
                            const hoSoCuaTin = n.projId ? projects.find(p => p.id === n.projId) : undefined;
                            const laTinGiaoQuanLy = /được chọn làm Quản lý/i.test(n.text || '');
                            if (laTinGiaoQuanLy && hoSoCuaTin?.loaiBanGhi === 'DU_AN'
                                && (currentUser.role === 'MANAGER' || currentUser.role === 'BOOD')) {
                              setDuAnChonSanChoCVMoi(hoSoCuaTin.id);
                              setFormMode('ADD_WORK');
                              setEditingProject(undefined);
                              setShowForm(true);
                              triggerToast(`Mở form Công việc mới — đã chọn sẵn dự án "${hoSoCuaTin.tenDuAn}".`);
                              return;
                            }
                            // Còn lại (Quản lý L2, Ban giám đốc L4) đều có tab Hồ sơ → mở hồ sơ.
                            // TRƯỚC ĐÂY chỉ xét đúng 'MANAGER', nên Ban giám đốc (L4) bấm thông báo
                            // là không đi đâu cả — giờ L4 đã xem được tab Hồ sơ (chị Trâm chốt 17/08/2026).
                            if (n.projId) moHoSo(n.projId);
                          }}
                        />
                      </div>
                    </>
                  )}
                  {showNotif && currentUser.role === 'BOOD' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
                      {/* Khung thông báo RỘNG GẤP ĐÔI (20rem → 40rem, chị Trâm chốt 30/07/2026):
                          tin dài bị bó trong 320px nên ngắt 5-6 dòng, đọc rất mệt.
                          Mobile thì lấy trọn bề rộng màn hình trừ lề, không để tràn ra ngoài. */}
                      <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[40rem] max-h-[32rem] overflow-y-auto bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 text-left">
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
                                    <div className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 break-words" title={(p.duAnChaId && parentNameById[p.duAnChaId]) || p.tenDuAn}>📁 {(p.duAnChaId && parentNameById[p.duAnChaId]) || p.tenDuAn}</div>
                                    <div className="flex items-center gap-2 mt-1 text-[10px]">
                                      <span className="text-brand-accent dark:text-brand-accent-300 font-bold">Bộ phận: {p.tienDoBoPhan}%</span>
                                      {/* NÓI RÕ CÓ PHẢI DELAY KHÔNG (chị Trâm chốt 29/07/2026): trước đây mọi
                                          hồ sơ chờ duyệt lại đều bị gắn chữ "DELAY" đỏ chót, kể cả khi Quản lý
                                          chỉ chia lại việc con mà hạn nộp không hề đổi — nhìn chuông tưởng
                                          gói thầu trễ, phải mở từng hồ sơ ra mới biết. */}
                                      {(() => {
                                        if (!p.choDuyetLai) {
                                          return <span className="font-bold text-brand-accent dark:text-brand-accent-300">📝 Chờ Trưởng phòng duyệt</span>;
                                        }
                                        const chiPhanBo = p.lyDoChoDuyetLai === 'PHAN_BO';
                                        return (
                                          <span className={`font-bold ${chiPhanBo ? 'text-brand-success dark:text-brand-success-300' : 'text-brand-danger dark:text-brand-danger'}`}>
                                            {chiPhanBo
                                              ? '🔄 Đổi phân bổ việc con — KHÔNG đổi thời gian gói thầu'
                                              : '⚠ Kế hoạch bị DELAY — chờ duyệt lại'}
                                          </span>
                                        );
                                      })()}
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
                              // So theo NGÀY (xem giải thích ở khối "Hạn Phòng" phía trên).
                              const overdue = ymdOf(deadline) < todayISO();
                              return (
                                <li key={p.id}>
                                  <button
                                    onClick={() => { setShowNotif(false); moHoSo(p.id); }}
                                    className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-dark-elevated/60 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-mono font-black bg-slate-100 dark:bg-dark-elevated text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded">{p.projectId}</span>
                                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{p.hangMuc}</span>
                                    </div>
                                    <div className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5 break-words" title={(p.duAnChaId && parentNameById[p.duAnChaId]) || p.tenDuAn}>📁 {(p.duAnChaId && parentNameById[p.duAnChaId]) || p.tenDuAn}</div>
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
                        {/* TRƯỞNG PHÒNG CŨNG PHẢI XEM ĐƯỢC TIN THÔNG BÁO (phát hiện 30/07/2026).
                            Chuông của TP trước đây CHỈ có 2 mục "cần xử lý", nên mọi tin pushNotify
                            gửi cho TP (Quản lý xin dời hạn, hồ sơ trúng/rớt thầu, nhắc hạn việc con...)
                            bắn vào rồi không có chỗ nào hiện ra — TP không hề biết. Nay ghép danh sách
                            thông báo xuống dưới, dùng đúng khung như các vai khác. */}
                        {myNotifs.length > 0 && (
                          <>
                            <div className="px-3 py-1.5 bg-slate-100 dark:bg-dark-elevated text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
                              🔔 Thông báo của bạn ({myNotifs.length})
                              <button onClick={clearMyNotifs} className="ml-auto text-[9px] font-black text-brand-danger hover:underline cursor-pointer">Xóa tất cả</button>
                            </div>
                            <NotificationFeed
                              notifs={myNotifs}
                              staff={staff}
                              onOpen={(n) => { setShowNotif(false); if (n.projId) moHoSo(n.projId); }}
                            />
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Quà của tôi — mở tab mới sang app UrBox điểm thưởng (quacuatoi.hpcore.vn) */}
              <div className="relative shrink-0">
                <a
                  href="https://quacuatoi.hpcore.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Quà của tôi"
                  aria-label="Quà của tôi"
                  className="relative p-2 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-brand-warning dark:hover:text-brand-warning bg-slate-100 dark:bg-dark-elevated/80 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  <Gift className="w-4 h-4" />
                  {/* Số điểm tạm để 0 — chưa nối UrBox thật, xem hpcons-quacuatoi/openspec */}
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-black text-white bg-brand-danger rounded-full">
                    0
                  </span>
                </a>
              </div>

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
                  className="text-[11px] bg-brand-success hover:bg-brand-success-hover text-white font-black px-2 md:px-3 py-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-lg flex items-center justify-center gap-1 transition-all shadow-md hover:shadow-lg cursor-pointer whitespace-nowrap shrink-0 active:scale-95"
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
                  className="text-[11px] bg-brand-accent hover:bg-brand-accent-700 text-white font-black px-2 md:px-3 py-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 rounded-lg flex items-center justify-center gap-1 transition-all shadow-md hover:shadow-lg cursor-pointer whitespace-nowrap shrink-0 active:scale-95"
                  title="Thêm một CÔNG VIỆC (báo giá chi tiết, khái toán, VE...) vào một Dự án — công việc này sẽ lên Kanban"
                  aria-label="Thêm công việc mới"
                >
                  <Plus className="w-4 h-4 shrink-0 md:hidden" />
                  <CheckSquare className="hidden md:block w-4 h-4 shrink-0" />
                  <span className="hidden md:inline">CÔNG VIỆC MỚI</span>
                </button>
              )}
              </div>

              {/* User Avatar & Session block */}
              <div className="flex items-center gap-1 md:gap-2 bg-slate-100 dark:bg-dark-elevated/80 px-1.5 py-1 md:p-1 md:pr-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 w-full md:w-auto">
                {/* Mobile: ảnh đại diện + tên tắt người đăng nhập (md+ hiện khối đầy đủ bên dưới) */}
                {(() => {
                  const myAvatar = staff.find(s => s.id === currentUser.staffId)?.avatar;
                  return (
                    <div className="flex md:hidden items-center gap-2 pl-1">
                      {isAvatarUrl(myAvatar) ? (
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
                  <span className="block text-[9px] text-slate-500 uppercase tracking-wider whitespace-nowrap">Quyền: Level {currentUser.role === 'BOOD' ? '1 (Trưởng phòng)' : currentUser.role === 'MANAGER' ? '2 (Quản lý)' : currentUser.role === 'VIEWER' ? '4 (Ban giám đốc)' : '3 (Nhân viên)'}</span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Đăng xuất khỏi hệ thống"
                  aria-label="Đăng xuất khỏi hệ thống"
                  className="p-1 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-brand-danger dark:hover:text-brand-danger rounded transition-colors ml-auto md:ml-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

        {/* VÙNG LÀM VIỆC TRẢI HẾT BỀ RỘNG (chị Trâm báo 17/08/2026 — góp ý #10).
            TRƯỚC ĐÂY có `max-w-7xl` = 80rem. Nút zoom chữ (A- / A+) đổi cỡ rem của trang, nên
            80rem co lại theo: ở 85% chỉ còn ~1088px trong khi màn hình vẫn 1600px+ → càng zoom
            nhỏ hai biên càng trống. Bỏ hẳn chặn theo rem, để vùng làm việc chiếm trọn bề rộng
            còn lại sau sidebar; bảng Kanban/Gantt nhờ vậy cũng rộng thêm. */}
        <main className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6 overflow-y-auto" id="app-main-content">
        
        {/* Render Form Drawer / Screen if visible */}
        {showForm ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-2"
          >
            <ProjectForm
              /* ===== KHÔNG CÒN "KẸT" Ở HỒ SƠ TRƯỚC (chị Trâm báo 17/08/2026) =====
                 Bấm hồ sơ 1 trong "Chờ Trưởng phòng xử lý" rồi bấm sang hồ sơ 2 thì form vẫn hiện
                 dữ liệu hồ sơ 1: ProjectForm nạp toàn bộ ô nhập bằng useState(project?...) — chỉ
                 chạy đúng MỘT LẦN lúc gắn vào cây. Đặt key theo id hồ sơ để React dựng lại form
                 mới khi đổi hồ sơ, nạp lại đúng dữ liệu. */
              key={editingProject?.id || formMode}
              project={editingProject}
              staffList={staff}
              nextProjectId={nextProjectId}
              onSave={handleSaveProject}
              onCancel={() => { setShowForm(false); setEditingProject(undefined); setDuAnChonSanChoCVMoi(undefined); }}
              currentUserRole={currentUser?.role}
              formMode={formMode}
              projectsListForSelect={parentProjects}
              thongTinMauTheoDuAn={mauThongTinTheoDuAn}
              thuVienTenViecCon={thuVienTenViecCon}
              duAnChonSan={duAnChonSanChoCVMoi}
              duAnChaInfo={duAnChaInfoById}
              // MÃ DỰ ÁN LÀ DUY NHẤT trong môi trường Phòng Đấu Thầu (chị Trâm chốt 26/07/2026):
              // đăng ký dự án mà mã đã tồn tại thì form báo lỗi, không cho lưu. Chỉ so mã của các
              // bản ghi DỰ ÁN (công việc con dùng chung mã của dự án cha nên không tính vào đây).
              maDuAnDaDung={projects.filter(p => p.loaiBanGhi === 'DU_AN' && p.id !== editingProject?.id).map(p => (p.projectId || '').trim().toUpperCase())}
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
                  staff={nhanSuTheoDoi}
                  currentUserRole={currentUser?.role}
                  currentUserId={currentUser?.staffId}
                />

                {currentUser.role === 'STAFF' ? (
                  /* STAFF PERSONAL WORKSPACE VIEW */
                  <div className="animate-fade-in">
                    {/* Bỏ khối "Hướng dẫn dành cho chuyên viên" (chị Trâm chốt 26/07/2026) — danh sách tác vụ rộng hết khổ */}
                    <div className="space-y-4">
                      <MyTasksPanel
                        projects={rbacProjects}
                        currentUserId={currentUser.staffId}
                        personalOnly={true}
                        title="Danh sách tác vụ đấu thầu đang phụ trách"
                        currentUserName={currentUser.name}
                        // Chỉ là bản đồ id → họ tên, để khối "ℹ️ Hồ sơ" hiện Quản lý phụ trách /
                        // Quản lý kế thừa cho nhân viên biết báo cáo với ai (chị Trâm chốt 27/07/2026).
                        staffNames={staffNameById}
                        duAnChaInfo={duAnChaInfoById}
                        onUpdateTasks={handleUpdateTasks}
                        onToggleTask={handleToggleSubtask}
                        onExported={handleMyWorkExported}
                      />
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
                        currentUserName={currentUser.name}
                        managedProjects={managedWorkItems}
                        staffNames={staffNameById}
                        duAnChaInfo={duAnChaInfoById}
                        onUpdateTasks={handleUpdateTasks}
                        onToggleTask={handleToggleSubtask}
                        onExported={handleMyWorkExported}
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
                            const delayDays = tongNgayDoiHan(p.delayLogs);
                            return (
                              <div
                                key={p.id}
                                onClick={() => moHoSo(p.id)}
                                title="Bấm để xem chi tiết gói thầu, tiến độ và KPI công việc con"
                                // Lưới 3 cột CỐ ĐỊNH từ md trở lên: tên hồ sơ (co giãn) · tiến độ 240px · trạng thái.
                                // Nhờ vậy thanh tiến độ và cột hạn thầu của mọi dòng luôn thẳng hàng, kể cả khi
                                // tên hồ sơ dài ngắn khác nhau (chị Trâm lưu ý 25/07/2026).
                                // Cả 2 cột bên phải đều CỐ ĐỊNH (300px + 15rem) — nếu để cột trạng thái tự giãn
                                // theo nội dung thì mỗi dòng có độ dài badge khác nhau sẽ đẩy cột tiến độ lệch nhau.
                                // Thanh chỉ chiếm 240px căn về bên trái cột 300px → dịch trái ~60px (≈1,5cm) cho cân mắt.
                                className="py-3 px-2 -mx-2 flex items-start justify-between gap-4 md:grid md:grid-cols-[minmax(0,1fr)_300px_15rem] md:items-center md:gap-4 cursor-pointer rounded-lg hover:bg-brand-accent/10 dark:hover:bg-brand-accent/5 transition-colors"
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
                                    {/* Tên gói thầu HIỆN ĐỦ (tự xuống dòng) — trước đây cắt 1 dòng nên tên dài
                                        bị mất đoạn sau, không đọc được hồ sơ nào (chị Trâm báo 25/07/2026). */}
                                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 break-words min-w-0">{p.tenDuAn}</h4>
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
                                {/* Tiến độ Bộ phận + Phòng duyệt — cùng kiểu với tab Báo cáo tiến độ
                                    (chị Trâm chốt 25/07/2026: thêm tiến độ Bộ phận, canh giữa dòng).
                                    Nhân viên (Level 3) không được xem tiến độ → giữ nguyên quy tắc bảo mật. */}
                                <div className="hidden md:flex flex-col justify-center w-[240px] gap-1.5 self-center">
                                  {currentUser?.role === 'STAFF' ? (
                                    <div className="text-center py-2 px-3 bg-slate-50 dark:bg-dark-card/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                      <Lock className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
                                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">🔒 Bảo mật</span>
                                    </div>
                                  ) : (
                                    <>
                                      <div>
                                        <div className="flex items-center justify-between text-[10px] mb-0.5 whitespace-nowrap gap-2">
                                          <span className="text-brand-accent dark:text-brand-accent-300 font-bold">Bộ phận:</span>
                                          <span className="font-extrabold text-brand-accent dark:text-brand-accent-300">{p.tienDoBoPhan || 0}%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-dark-elevated h-1.5 rounded-full overflow-hidden">
                                          <div style={{ width: `${p.tienDoBoPhan || 0}%` }} className="h-full bg-brand-accent rounded-full transition-all" />
                                        </div>
                                      </div>
                                      <div>
                                        <div className="flex items-center justify-between text-[10px] mb-0.5 whitespace-nowrap gap-2">
                                          <span className="text-brand-success dark:text-brand-success-300 font-bold">Phòng duyệt:</span>
                                          <span className="font-extrabold text-brand-success dark:text-brand-success-300">{p.tienDoPhong || 0}%</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-dark-elevated h-1.5 rounded-full overflow-hidden">
                                          <div style={{ width: `${p.tienDoPhong || 0}%` }} className="h-full bg-brand-success rounded-full transition-all" />
                                        </div>
                                      </div>
                                      {/* Hồ sơ làm lại nhiều vòng: nói rõ % đang đọc theo vòng nào + lũy kế mọi vòng */}
                                      {(() => {
                                        const soVong = Math.max(1, p.vongHienTai || 1, soVongCoViec(p.tasks));
                                        if (soVong <= 1) return null;
                                        return (
                                          <span className="text-[9px] font-bold text-brand-warning" title="Tiến độ Bộ phận tính riêng cho vòng đang làm; mỗi vòng phân bổ đủ 100%">
                                            Vòng {Math.max(1, p.vongHienTai || 1)}/{soVong} · lũy kế {weightSumAllRounds(p.tasks)}/{soVong * 100}%
                                          </span>
                                        );
                                      })()}
                                    </>
                                  )}
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-1.5 md:justify-self-end">
                                  {getStatusBadge(p.trangThai)}
                                  {/* HẠN THẦU — thông tin trọng yếu, hiển thị nổi bật (đỏ khi đã quá hạn) */}
                                  {(() => {
                                    // So theo NGÀY (xem giải thích ở khối "Hạn Phòng" phía trên).
                                    const qua = p.trangThai === 'DANG_THUC_HIEN' && ymdOf(getTenderDeadline(p)) < todayISO();
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
                          Danh Sách Nhân Sự Đấu Thầu ({nhanSuTheoDoi.length} Nhân sự) · KPI đang xây dựng
                        </h3>
                        {currentUser?.role === 'BOOD' && (
                          <span className="text-xs text-brand-accent dark:text-brand-accent-300 font-bold hover:underline cursor-pointer" onClick={() => setActiveTab('STAFF')}>Xem chi tiết</span>
                        )}
                      </div>

                      {/* Mobile <768px: hiện ~3 người, còn lại trượt xuống (chị chốt 15/07); md+: lưới đầy đủ */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 max-h-60 overflow-y-auto md:max-h-none md:overflow-visible pr-1 md:pr-0">
                        {/* Sắp theo TÊN (không xếp hạng theo điểm) khi KPI chưa chấm */}
                        {[...nhanSuTheoDoi].sort((a,b) => a.hoTen.localeCompare(b.hoTen, 'vi')).map((member, index) => (
                          <div key={member.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-dark-bg/40 rounded-xl border border-slate-200/40 dark:border-slate-800/60">
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                {isAvatarUrl(member.avatar) ? (
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
                                {/* Số thứ tự THƯỜNG, bỏ màu huy chương vàng/bạc/đồng — KPI chưa chấm
                                    thì không được ngụ ý ai hạng nhất (chị Trâm chốt 27/07/2026) */}
                                <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center border shadow-sm bg-slate-100 text-slate-600 border-slate-200 dark:bg-dark-elevated dark:text-slate-400">
                                  {index + 1}
                                </span>
                              </div>
                              <div className="truncate max-w-[120px]">
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{member.hoTen}</h4>
                                <span className="text-[9px] text-slate-400 block truncate">{member.chucVu}</span>
                              </div>
                            </div>
                            {/* Điểm KPI để TRỐNG — đang xây dựng trọng số. Ban giám đốc KHÔNG chấm KPI
                                nên không hiện ô điểm (chị Trâm chốt 27/07/2026) */}
                            {!CHUC_VU_KHONG_TINH_NHAN_SU.includes(member.chucVu) && (
                              <span className="text-xs font-black px-2 py-1 rounded-lg shrink-0 bg-slate-100 text-slate-400 dark:bg-dark-elevated dark:text-slate-500"
                                title="KPI đang xây dựng trọng số — chưa chấm điểm">
                                —
                              </span>
                            )}
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
                        <button
                          onClick={handleExportExcel}
                          className="px-3 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Xuất file Excel bảo mật theo phân quyền người dùng"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Xuất Excel
                        </button>

                        {/* ĐÃ BỎ nút "📑 Báo cáo Chiến lược" (chị Trâm chốt 17/08/2026): bảng thống kê
                            dự án bên dưới làm đúng mẫu của Phòng và thay hẳn báo cáo cũ, để hai nút
                            cùng lúc thì người dùng không biết bấm cái nào. Hàm sinh báo cáo cũ cũng
                            đã xoá — cần lấy lại thì xem `handleExportStrategicReport` trong commit 14eef6d. */}

                        {/* BẢNG THỐNG KÊ DỰ ÁN ĐẤU THẦU (dùng làm hồ sơ ISO) — góp ý #13. Chọn kỳ + năm
                            rồi xuất đúng mẫu sheet 3 của Phòng. Trưởng phòng xuất toàn phòng; Quản lý
                            xuất được phần hồ sơ mình phụ trách (chị Trâm chốt 17/08/2026 — "quản lý
                            được xuất báo cáo như TP"). */}
                        {(currentUser?.role === 'BOOD' || currentUser?.role === 'MANAGER') && (
                          <div className="flex items-center gap-1 border border-brand-success/40 rounded-lg px-1.5 py-1 bg-brand-success/5">
                            <select
                              value={kyISO}
                              onChange={(e) => setKyISO(Number(e.target.value) as KyBaoCao)}
                              title="Kỳ báo cáo ISO: Kỳ 1 = tháng 4-7 · Kỳ 2 = tháng 8-11 · Kỳ 3 = tháng 12,1,2,3"
                              className="text-[11px] font-black bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                            >
                              {/* Ô chọn của trình duyệt tự vẽ danh sách bằng nền TRẮNG, mà app đang
                                  ở nền tối nên chữ trắng trên nền trắng = không đọc được (chị Trâm
                                  báo 18/08/2026). Đặt màu chữ + nền thẳng vào từng <option>. */}
                              <option value={1} className="bg-white text-slate-700 dark:bg-dark-card dark:text-slate-200">Kỳ 1</option>
                              <option value={2} className="bg-white text-slate-700 dark:bg-dark-card dark:text-slate-200">Kỳ 2</option>
                              <option value={3} className="bg-white text-slate-700 dark:bg-dark-card dark:text-slate-200">Kỳ 3</option>
                            </select>
                            <select
                              value={namISO}
                              onChange={(e) => setNamISO(e.target.value)}
                              title="Năm báo cáo"
                              className="text-[11px] font-black bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                            >
                              {dsNamISO.map(n => (
                                <option key={n} value={String(n)}>{n}</option>
                              ))}
                            </select>
                            <button
                              onClick={handleXuatBangThongKeISO}
                              className="px-2.5 py-1.5 bg-brand-success hover:bg-brand-success-hover text-white rounded-md text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                              title="Xuất BẢNG THỐNG KÊ DỰ ÁN ĐẤU THẦU theo đúng mẫu của Phòng (dùng làm hồ sơ ISO — mục tiêu 1 & 3)"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Bảng thống kê dự án
                            </button>
                          </div>
                        )}

                        {/* SAO LƯU / KHÔI PHỤC nguyên trạng — chỉ Trưởng phòng. Khác "Xuất Excel"
                            và "Báo cáo Chiến lược" (đều là báo cáo, không giữ đủ dữ liệu). */}
                        {currentUser?.role === 'BOOD' && (
                          <>
                            <button
                              onClick={handleXuatSaoLuu}
                              className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                              title="Xuất tệp sao lưu TOÀN BỘ dữ liệu (gồm cả công việc con, tiến độ, vòng làm việc, nhật ký gửi CĐT) — nạp lại là khôi phục nguyên trạng"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Sao lưu
                            </button>
                            <button
                              onClick={() => saoLuuInputRef.current?.click()}
                              className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                              title="Khôi phục toàn bộ dữ liệu từ tệp sao lưu (.json) — sẽ GHI ĐÈ dữ liệu hiện tại"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              Khôi phục
                            </button>
                            <input
                              ref={saoLuuInputRef}
                              type="file"
                              accept=".json,application/json"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleKhoiPhucSaoLuu(f);
                                e.target.value = ''; // cho phép chọn lại đúng tệp đó lần nữa
                              }}
                            />
                          </>
                        )}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
                          Phục hồi dữ liệu từ tệp sao lưu (.xlsx / .csv)
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
                            Kéo thả tệp sao lưu vào đây hoặc <span className="text-brand-accent dark:text-brand-accent-300 hover:underline">nhấp để chọn tệp</span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Dùng khi mất dữ liệu (server sập): nạp lại tệp sao lưu hàng ngày để dựng lại hồ sơ của Phòng Đấu Thầu. Cột giá trị tiền luôn bị bỏ qua để bảo mật.
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

                        <div className="border border-brand-danger/20 dark:border-brand-danger/20 rounded-lg max-h-48 overflow-y-auto">
                          {/* Mobile <768px: Card List thay bảng 4 cột (luật 9) */}
                          <div className="md:hidden divide-y divide-brand-danger/15 dark:divide-brand-danger/10 bg-white dark:bg-dark-card/50">
                            {validationErrors.map((err, idx) => (
                              <div key={idx} className="p-2.5 space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-brand-danger dark:text-brand-danger">Dòng {err.row}</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{err.col}</span>
                                </div>
                                <div className="font-mono text-slate-500 dark:text-slate-400 truncate">{String(err.val !== undefined ? err.val : '')}</div>
                                <p className="text-brand-danger dark:text-brand-danger font-medium">{err.msg}</p>
                              </div>
                            ))}
                          </div>
                          <div className="hidden md:block md:overflow-x-auto">
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
                    <div ref={setKhungCuonBang} className="md:overflow-x-auto">
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
                            {/* Hai cột này GHIM vào mép phải khi bảng cuộn ngang — xem ghi chú nenOGhim
                                ở phần thân bảng. Nền bg-slate-900 trùng nền hàng tiêu đề để không hở. */}
                            <th className="p-3 font-bold text-center w-[1%] whitespace-nowrap md:sticky md:right-24 md:z-20 bg-slate-900">Tình Hình Dự Án</th>
                            <th className="p-3 font-bold text-center w-24 md:sticky md:right-0 md:z-20 bg-slate-900">Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody className="block md:table-row-group divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-600 dark:text-slate-300">
                          {applyStatusFilter(filteredProjects, isWorkDone).map((p) => {
                            const isExpanded = expandedProjectId === p.id;
                            // ===== GHIM 2 CỘT PHẢI KHI BẢNG PHẢI CUỘN NGANG =====
                            // Chị Trâm báo 17/08/2026: zoom vào là cột "Tình hình dự án" và "Thao tác"
                            // bị đẩy ra ngoài khung, phải cuộn mới thấy nên tưởng mất thông tin.
                            // Theo đúng chuẩn của Phòng: docs/design-system/10-data-display/tables.md
                            // — "Cuộn ngang. CỐ ĐỊNH CỘT CHÍNH."
                            // Ô ghim BẮT BUỘC có nền ĐỤC, nếu không nội dung các cột khác chạy xuyên qua
                            // khi cuộn. Nền phải đổi theo trạng thái dòng, nếu không dòng đang mở rộng
                            // sẽ bị hở 2 ô trắng ở mép phải.
                            const nenOGhim = isExpanded
                              ? 'md:bg-slate-50 dark:md:bg-dark-elevated'
                              : 'md:bg-white dark:md:bg-dark-card';
                            const manager = staff.find(s => s.id === p.quanLyId);
                            const implementer = staff.find(s => s.id === p.thucHienId);
                            const totalOffsets = tongNgayDoiHan(p.delayLogs);

                            // Collect all personnel involved
                            const otherPersonnel = staff.filter(s => p.thucHienIds?.includes(s.id) && s.id !== p.thucHienId);

                            return (
                              <React.Fragment key={p.id}>
                                <tr
                                  /* id để mở hồ sơ từ chuông/Kanban/Dashboard rồi CUỘN tới đúng hàng
                                     — xem hoSoCanCuonToi trong moHoSo (chị Trâm báo góp ý #1). */
                                  id={`hang-ho-so-${p.id}`}
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
                                      const start = getRoundStart(p); // vòng ≥2 tính từ ngày bắt đầu vòng đó
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
                                    <div className="inline-flex flex-col items-center gap-1">
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
                                      {/* Số lần Chủ đầu tư yêu cầu điều chỉnh — chi tiết xem ở ngăn hồ sơ bên dưới */}
                                      {(p.cdtDieuChinh?.length ?? 0) > 0 && (
                                        <span className="bg-brand-danger/10 dark:bg-brand-danger/10 text-brand-danger dark:text-brand-danger text-[10px] px-2 py-0.5 rounded font-extrabold border border-brand-danger/25 dark:border-brand-danger/40 whitespace-nowrap">
                                          {p.cdtDieuChinh!.length} lần CĐT chỉnh
                                        </span>
                                      )}
                                    </div>
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
                                  <td className={`col-start-2 row-start-2 block md:table-cell px-4 py-1.5 md:p-3 text-right self-center md:text-center md:self-auto md:w-[1%] whitespace-nowrap md:sticky md:right-24 md:z-10 ${nenOGhim}`}>
                                    <div className="inline-flex flex-col items-end md:items-center gap-1">
                                      {getStatusBadge(p.trangThai)}
                                      {/* HỒ SƠ ĐANG VƯỚNG GÌ — nói thẳng trên dòng, không bắt ai phải đoán.
                                          Thẻ vẫn nằm trên Kanban ở Bước 1, chỉ chưa được đẩy tiến lên. */}
                                      {p.loaiBanGhi !== 'DU_AN' && (p.soNgayDuKien || 0) <= 0 && (
                                        <Badge variant="neutral" title="Hồ sơ chưa khai thời hạn (số ngày dự kiến = 0) nên chưa vẽ được lên sơ đồ Gantt.">
                                          ⏳ Chưa có thời hạn
                                        </Badge>
                                      )}
                                      {/* Nhãn chờ duyệt CHỈ hiện ở Bước 1 (chị Trâm chốt 30/07/2026) —
                                          cả chờ duyệt lần đầu lẫn chờ duyệt lại. */}
                                      {p.loaiBanGhi !== 'DU_AN' && deriveKanbanStep(p) === 1 &&
                                        (p.tpDaDuyet === false || p.choDuyetLai === true) && (
                                        <Badge
                                          variant={p.choDuyetLai && p.lyDoChoDuyetLai === 'PHAN_BO' ? 'success' : 'warning'}
                                          title={
                                            !p.choDuyetLai
                                              ? 'Quản lý vừa lập kế hoạch, Trưởng phòng chưa duyệt. Thẻ đứng ở Bước 1 trên Kanban và chưa đẩy tiến lên được. Trưởng phòng mở chuông → mục "Công việc chờ duyệt", kiểm tra rồi bấm "Lưu Hồ Sơ" là hồ sơ tự sang Bước 2.'
                                              : p.lyDoChoDuyetLai === 'PHAN_BO'
                                                ? 'Quản lý chia lại tỉ trọng / thêm việc con — HẠN NỘP KHÔNG ĐỔI, thời gian gói thầu giữ nguyên. Trưởng phòng chỉ cần mở ra duyệt lại phân bổ.'
                                                : 'Kế hoạch bị dời hạn — đang chờ Trưởng phòng duyệt lại. Thẻ vẫn nằm trên Kanban nhưng chưa đẩy tiến lên được.'
                                          }
                                        >
                                          {!p.choDuyetLai
                                            ? '📝 Chờ TP duyệt'
                                            : p.lyDoChoDuyetLai === 'PHAN_BO'
                                              ? '🔄 Đổi phân bổ — giữ nguyên hạn'
                                              : '⚠ Chờ TP duyệt lại (dời hạn)'}
                                        </Badge>
                                      )}
                                    </div>
                                  </td>

                                  {/* Action Buttons — mobile: nổi góc phải trên (gọn thẻ); desktop: ô bảng bình thường */}
                                  <td className={`absolute top-1.5 right-2 z-20 md:sticky md:top-auto md:right-0 md:z-10 block md:table-cell px-0 py-0 md:p-3 text-left md:text-center ${nenOGhim}`}>
                                    <div className="flex items-center justify-end md:justify-center gap-1">
                                      {p.loaiBanGhi !== 'DU_AN' && currentUser.role !== 'STAFF' && currentUser.role !== 'VIEWER' && (
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
                                        title={currentUser.role === 'VIEWER' ? 'Chế độ Khách (Level 4) chỉ được xem' : currentUser.role === 'STAFF' ? 'Nhân viên không có quyền chỉnh sửa hồ sơ thầu' : 'Chỉnh sửa hồ sơ'}
                                        disabled={currentUser.role === 'STAFF' || currentUser.role === 'VIEWER'}
                                        className={`p-1.5 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 inline-flex items-center justify-center rounded-lg transition-colors border border-slate-100 dark:border-slate-800 ${(currentUser.role === 'STAFF' || currentUser.role === 'VIEWER') ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-brand-accent hover:bg-brand-accent/10 dark:text-brand-accent-300 dark:hover:bg-brand-accent/20'}`}
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
                                    <td colSpan={9} className="block md:table-cell p-0">
                                      {/* Ghim khay theo VÙNG ĐANG THẤY của bảng (xem rongVungXemBang):
                                          sticky left-0 giữ khay ở mép trái khi cuộn ngang, width bằng
                                          bề rộng vùng thấy để không thông tin nào lọt ra ngoài khung
                                          lúc phóng to chữ. Mobile (<768px) không áp — td là block. */}
                                      <div
                                        className="drawer-vung-xem p-4 md:p-6"
                                        style={rongVungXemBang ? ({ ['--rong-vung-xem' as string]: `${rongVungXemBang}px` } as React.CSSProperties) : undefined}
                                      >
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
                                              startDate={ymdOf(getRoundStart(p))}
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
                                              <TextWithLinks text={p.moTa || 'Không có ghi chú mô tả cụ thể.'} />
                                            </div>
                                            {/* Mô tả chung của DỰ ÁN CHA — chỉ xem, khai tại hồ sơ Dự án */}
                                            {p.duAnChaId && duAnChaInfoById[p.duAnChaId]?.moTa && (
                                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Mô tả dự án</span>
                                                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                  <TextWithLinks text={duAnChaInfoById[p.duAnChaId]!.moTa!} />
                                                </div>
                                              </div>
                                            )}
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
                                              <div className="bg-white dark:bg-dark-card border border-slate-200/60 dark:border-slate-800 rounded-xl overflow-hidden">
                                                {/* Mobile <768px: Card List thay bảng 4 cột (luật 9) */}
                                                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                                                  {p.delayLogs.map(log => (
                                                    <div key={log.id} className="p-3 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                                                      <div className="flex items-center justify-between gap-2">
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">{fmtDateVN(log.ngayThayDoi)}</span>
                                                        <span className="font-black text-brand-warning">+{Math.max(0, Math.round((new Date(log.ngayMoi).getTime() - new Date(log.ngayCu).getTime()) / 86400000))}d</span>
                                                      </div>
                                                      <div>Mốc mới: <span className="font-bold text-brand-accent dark:text-brand-accent-300">{fmtDateVN(log.ngayMoi)}</span></div>
                                                      <p className="italic truncate" title={log.lyDo}>{log.lyDo}</p>
                                                    </div>
                                                  ))}
                                                </div>
                                                <div className="hidden md:block md:overflow-x-auto">
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
                                              </div>
                                            )}
                                          </div>

                                          {/* Nhật ký CĐT yêu cầu điều chỉnh — mỗi lần dùng nút 🔁 "CĐT điều chỉnh"
                                              ghi lại 1 dòng. Số LẦN lấy theo thứ tự trong danh sách (bản ghi không
                                              lưu sẵn số lần). Chỉ xem, không sửa. */}
                                          <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nhật ký CĐT yêu cầu điều chỉnh</span>
                                            {(p.cdtDieuChinh || []).length === 0 ? (
                                              <p className="text-[11px] text-slate-400 italic bg-white dark:bg-dark-card p-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                                                Chủ đầu tư chưa yêu cầu điều chỉnh hồ sơ này.
                                              </p>
                                            ) : (
                                              <div className="bg-white dark:bg-dark-card border border-slate-200/60 dark:border-slate-800 rounded-xl overflow-hidden">
                                                {/* Mobile <768px: Card List thay bảng 4 cột (luật 9) */}
                                                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                                                  {(p.cdtDieuChinh || []).map((rev, i) => (
                                                    <div key={`${rev.ngay}-${i}`} className="p-3 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                                                      <div className="flex items-center justify-between gap-2">
                                                        <span className="font-black text-brand-warning">Lần {i + 1}</span>
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">{fmtDateVN(rev.ngay)}</span>
                                                      </div>
                                                      <div>Kéo về: <span className="font-bold text-brand-accent dark:text-brand-accent-300">Bước {rev.buocVe} — {KANBAN_STEPS.find(s => s.id === rev.buocVe)?.title || ''}</span></div>
                                                      <p className="italic" title={rev.noiDung}>{rev.noiDung}</p>
                                                    </div>
                                                  ))}
                                                </div>
                                                <div className="hidden md:block md:overflow-x-auto">
                                                  <table className="w-full text-left text-[11px]">
                                                    <thead>
                                                      <tr className="bg-slate-50 dark:bg-dark-elevated/50 text-slate-500 border-b border-slate-200/50 dark:border-slate-800 text-[9px] uppercase font-bold">
                                                        <th className="p-2">Lần</th>
                                                        <th className="p-2">Ngày</th>
                                                        <th className="p-2">Nội dung yêu cầu</th>
                                                        <th className="p-2">Kéo về bước</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                                                      {(p.cdtDieuChinh || []).map((rev, i) => (
                                                        <tr key={`${rev.ngay}-${i}`}>
                                                          <td className="p-2 font-black text-brand-warning">Lần {i + 1}</td>
                                                          <td className="p-2">{fmtDateVN(rev.ngay)}</td>
                                                          <td className="p-2 italic max-w-xs truncate" title={rev.noiDung}>{rev.noiDung}</td>
                                                          <td className="p-2 font-bold text-brand-accent dark:text-brand-accent-300">Bước {rev.buocVe} — {KANBAN_STEPS.find(s => s.id === rev.buocVe)?.title || ''}</td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
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
                                          vongHienTai={Math.max(1, p.vongHienTai || 1)}
                                          onChange={(updatedTasks) => handleUpdateTasks(p.id, updatedTasks)}
                                        />
                                      </div>
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
                projects={kanbanWorkItems}
                staff={staff}
                parentNameById={parentNameById}
                currentUserRole={currentUser?.role}
                onMove={handleKanbanMove}
                onDenied={(msg) => triggerToast(msg)}
                onOpenProject={moHoSo}
                // Trưởng phòng: kéo thẳng về Bước 1 (giữ hạn), không hỏi gì — muốn dời hạn thì sửa trong hồ sơ.
                // Quản lý: vẫn hỏi có ảnh hưởng hạn nộp không, vì Quản lý phải khai lý do dời hạn để TP duyệt.
                onPullBackToStart={(pid) => {
                  const p = projects.find(x => x.id === pid);
                  if (!p) return;
                  if (currentUser?.role !== 'BOOD') { setPullBackProject(p); return; }
                  // Hồ sơ ĐÃ gửi CĐT ít nhất 1 lần → hỏi TP có mở vòng mới hay chỉ sửa nhỏ.
                  if ((p.guiCDTLogs || []).length > 0) setVongMoiAsk(p);
                  else handlePullBackKeepDeadline(p);
                }}
              />
            )}

            {/* 3. GANTT CHART VIEW */}
            {activeTab === 'GANTT' && (
              <GanttChart projects={scheduledWorkItems} staff={staff} currentUserRole={currentUser?.role} />
            )}

            {/* 4. STAFF KPI & LIST VIEW */}
            {activeTab === 'STAFF' && (
              <div className="space-y-6">
                {/* 2 mục con trong cùng một tab */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-dark-elevated/60 p-1 rounded-xl w-fit">
                  {([['DOI_NGU', 'Đội ngũ'], ['KPI', 'KPI']] as const).map(([key, nhan]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStaffSubTab(key)}
                      className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-colors cursor-pointer ${
                        staffSubTab === key
                          ? 'bg-white dark:bg-dark-card text-brand-accent dark:text-brand-accent-300 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {nhan}
                    </button>
                  ))}
                </div>

                
                {/* Gọn giao diện (chị Trâm chốt 26/07/2026): bỏ khối giới thiệu "Cơ chế kiểm toán KPI"
                    và dòng mô tả dài — giữ tiêu đề + nút thêm nhân sự là đủ dùng. */}

                {/* ===== MỤC CON 1: ĐỘI NGŨ — tài khoản & phân quyền ===== */}
                {staffSubTab === 'DOI_NGU' && (<>
                {/* Staff list controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-dark-card p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Danh sách tài khoản &amp; KPI ({kpiStaff.length} nhân sự)
                    </h3>
                  </div>
                  {(quanLyDuocNhanSu(currentUser?.role) || currentUser?.role === 'MANAGER') ? (
                    <button
                      onClick={() => setIsAddingStaff(true)}
                      className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-md hover:scale-102 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      {currentUser?.role === 'MANAGER' ? 'THÊM CHUYÊN VIÊN' : 'THÊM TÀI KHOẢN MỚI'}
                    </button>
                  ) : (
                    /* Câu nhắc KHÔNG được đổ cho Trưởng phòng (chị Trâm 18/08/2026: "ghi vậy level1 bị
                       chửi chết"). Nay chỉ còn cấp Nhân viên là không khởi tạo/xoá tài khoản, nên nói
                       đúng cấp đang xem, không nêu tên cấp nào khác. */
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 italic font-medium max-w-xs text-right bg-slate-100 dark:bg-dark-elevated px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      Cấp của bạn xem danh sách và KPI; việc khởi tạo &amp; xoá tài khoản do cấp quản lý thực hiện.
                    </div>
                  )}
                </div>

                {/* Staff Cards Grid — dùng kpiStaff (theo đội ngũ):
                    Trưởng phòng (L1) thấy tất cả; Quản lý (L2) chỉ thấy bản thân + nhân viên được gán
                    "Quản lý phụ trách" = mình; nhân viên chưa gán quản lý thì chỉ Trưởng phòng thấy. */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" id="staff-grid">
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
                                className={`relative group shrink-0 ${quanLyDuocNhanSu(currentUser?.role) ? 'cursor-pointer' : ''}`}
                                onClick={() => { if (quanLyDuocNhanSu(currentUser?.role)) setEditingStaff(member); }}
                                title={quanLyDuocNhanSu(currentUser?.role) ? 'Nhấp để thay đổi ảnh đại diện' : undefined}
                              >
                                {isAvatarUrl(member.avatar) ? (
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
                                {quanLyDuocNhanSu(currentUser?.role) && (
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
                              {/* Ban giám đốc / Quản trị hệ thống / Khách KHÔNG chấm KPI — không hiện ô điểm */}
                              {CHUC_VU_KHONG_TINH_NHAN_SU.includes(member.chucVu) ? null : (
                              currentUser?.role === 'MANAGER' && member.id !== currentUser.staffId && memberProjects.length === 0 ? (
                                <span className="inline-block text-xs font-black px-2 py-1 rounded-lg bg-slate-100 text-slate-400 border border-slate-200 dark:bg-dark-elevated dark:text-slate-500 dark:border-slate-700"
                                  title="Chỉ xem được KPI của nhân sự tham gia dự án bạn quản lý">
                                  🔒 KPI
                                </span>
                              ) : (
                              /* Điểm KPI để TRỐNG — đang xây dựng trọng số (chị Trâm chốt 27/07/2026) */
                              <span className="inline-block text-xs font-black px-2 py-1 rounded-lg bg-slate-100 text-slate-400 border border-slate-200 dark:bg-dark-elevated dark:text-slate-500 dark:border-slate-700"
                                title="KPI đang xây dựng trọng số — chưa chấm điểm">
                                —
                              </span>
                              ))}
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
                            {quanLyDuocNhanSu(currentUser?.role) && currentUser?.staffId !== member.id && (
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
                          {quanLyDuocNhanSu(currentUser?.role) && (
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
                </>)}

                {/* ===== MỤC CON 2: KPI — chị Trâm sẽ gửi cách tính, mục này sẽ được thiết lập lại ===== */}
                {staffSubTab === 'KPI' && (
                  <div className="space-y-4">
                    <div className="bg-brand-warning/10 border border-brand-warning/25 rounded-xl p-4 text-[11px] font-bold text-brand-warning">
                      ⏳ KPI đang trong quá trình xây dựng trọng số — tạm thời chưa chấm điểm để tránh hiểu nhầm.
                      Cột điểm để trống, sẽ thiết lập lại khi có công thức chính thức.
                      Bảng này không tính Ban giám đốc, tài khoản Quản trị hệ thống và Khách mời.
                    </div>
                    <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-dark-elevated/50 text-[9px] uppercase font-black text-slate-500 dark:text-slate-400">
                          <tr>
                            <th className="p-3 w-12 text-center">#</th>
                            <th className="p-3">Nhân sự</th>
                            <th className="p-3">Chức danh</th>
                            <th className="p-3 text-center">Hồ sơ phụ trách</th>
                            <th className="p-3 text-center">Đúng hạn</th>
                            <th className="p-3 text-center">Điểm KPI</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {/* Sắp xếp theo TÊN (không xếp theo điểm) để không ngụ ý thứ hạng khi KPI chưa chấm.
                              LOẠI Ban giám đốc khỏi bảng chấm KPI (chị Trâm chốt 27/07/2026). */}
                          {[...nhanSuTheoDoi].sort((a, b) => a.hoTen.localeCompare(b.hoTen, 'vi')).map((m, i) => (
                            <tr key={m.id} className="text-slate-600 dark:text-slate-300">
                              <td className="p-3 text-center font-black text-slate-400">{i + 1}</td>
                              <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{m.hoTen}</td>
                              <td className="p-3">{m.chucVu}</td>
                              <td className="p-3 text-center font-bold">{m.soDuAnDangLam || 0}</td>
                              <td className="p-3 text-center font-bold">{m.tiLeDungHan ?? 100}%</td>
                              {/* Điểm KPI để TRỐNG — đang xây dựng trọng số (chị Trâm chốt 27/07/2026) */}
                              <td className="p-3 text-center font-black text-slate-300 dark:text-slate-600" title="KPI đang xây dựng trọng số — chưa chấm điểm">—</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
            {/* ===== THÔNG BÁO - TEMPLATE — mục riêng (chị Trâm chốt 18/08/2026) =====
                Gộp 2 việc dùng chung cả phòng vào một chỗ: (1) phát thông báo nội bộ — chọn được
                TOÀN PHÒNG, TỪNG NGƯỜI, hoặc THEO CẤP (L1/L2/L3/L4); (2) danh mục biểu mẫu mẫu. */}
            {activeTab === 'TEMPLATES' && (
              <div className="space-y-4">
                {/* Ai cũng vào được khung này: L1/L2 GỬI được, các cấp khác ĐỌC LẠI tin đã nhận.
                    Tin gửi đi được lưu vào `thongBaoNoiBo` (đồng bộ cloud) chứ không chỉ nằm trên
                    chuông — chuông chỉ giữ 30 tin/người nên tin cũ sẽ trôi mất (chị Trâm 18/08). */}
                <ThongBaoNoiBoPanel
                  nhanSu={staff.filter(s => !s.daNghi && s.id !== currentUser.staffId)}
                  vaiTroCua={(s) => vaiTroCuaNhanSu(s.id)}
                  danhSach={thongBaoNoiBo}
                  coQuyenGui={currentUser.role === 'BOOD' || currentUser.role === 'MANAGER'}
                  staffIdDangXem={currentUser.staffId}
                  onGui={(ids, noiDung, kieuNhan, capNhan) => {
                    // luonBao = true: tin nội bộ không bị bộ lọc "hồ sơ từ bước 3 trở đi" chặn.
                    pushNotify(ids, `📣 Thông báo nội bộ: ${noiDung}`, undefined, true);
                    setThongBaoNoiBo(prev => [{
                      id: `TB${Date.now()}`,
                      noiDung,
                      nguoiGui: currentUser?.name,
                      nguoiGuiId: currentUser?.staffId,
                      ngay: new Date().toISOString(),
                      targetIds: ids,
                      kieuNhan,
                      capNhan: kieuNhan === 'theoCap' && capNhan.length > 0 ? capNhan : undefined,
                    }, ...prev]);
                    triggerToast(`Đã gửi thông báo nội bộ tới ${ids.length} người — tin đã được lưu lại.`);
                    logAction('Gửi thông báo nội bộ', `${ids.length} người nhận · nội dung: ${noiDung}`);
                  }}
                  onXoa={(id) => {
                    const bi = thongBaoNoiBo.find(t => t.id === id);
                    if (!bi) return;
                    if (!window.confirm('Xoá thông báo này khỏi danh sách đã lưu? Tin đã nằm trên chuông của người nhận thì không thu hồi được.')) return;
                    setThongBaoNoiBo(prev => prev.filter(t => t.id !== id));
                    logAction('Xoá thông báo nội bộ đã lưu', bi.noiDung.slice(0, 120));
                  }}
                />
                <TemplateMauPanel
                  templates={templates}
                  vaiTro={currentUser.role}
                  canEdit={currentUser.role === 'BOOD' || currentUser.role === 'MANAGER'}
                  onAdd={(ten, link, ghiChu, levels) => {
                    const moi: TenderTemplate = {
                      id: `TPL${Date.now()}`,
                      ten,
                      link,
                      ghiChu: ghiChu || undefined,
                      levels: levels.length > 0 ? levels : undefined,
                      nguoiThem: currentUser?.name,
                      ngay: new Date().toISOString(),
                    };
                    setTemplates(prev => [moi, ...prev]);
                    // ===== BÁO CHO ĐÚNG CẤP ĐƯỢC CHỌN (chị Trâm chốt 18/08/2026) =====
                    // "khi thêm template mới thì báo cho những người đc chọn thông báo nhé e."
                    // Không tick cấp nào = mọi cấp đều thấy → báo cho cả phòng. Tick cấp nào thì chỉ
                    // người thuộc cấp đó nhận tin, khớp đúng luật "cấp được thấy" của biểu mẫu.
                    // luonBao = true: tin biểu mẫu không liên quan bước hồ sơ nên không để bộ lọc
                    // "hồ sơ từ bước 3 trở đi chỉ Trưởng phòng" chặn (xem pushNotify).
                    const nguoiNhanMau = staff
                      .filter(s => !s.daNghi && (levels.length === 0 || levels.includes(vaiTroCuaNhanSu(s.id) as typeof levels[number])))
                      .map(s => s.id);
                    if (nguoiNhanMau.length > 0) {
                      pushNotify(nguoiNhanMau, `📄 Biểu mẫu mới: "${ten}" — xem ở mục "Thông báo - Template".`, undefined, true);
                    }
                    triggerToast(`Đã thêm biểu mẫu "${ten}" vào danh mục dùng chung${nguoiNhanMau.length ? ` và báo cho ${nguoiNhanMau.length} người` : ''}.`);
                    logAction('Thêm template mẫu', `${ten} · ${link}${levels.length ? ` · chỉ ${levels.join(', ')}` : ' · mọi cấp'} · đã báo ${nguoiNhanMau.length} người`);
                  }}
                  onUpdate={(id, thayDoi) => {
                    const bi = templates.find(t => t.id === id);
                    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...thayDoi } : t));
                    // Chỉ còn MỘT nút xoá → chỉ còn một loại thông báo: phục hồi từ thùng rác
                    // (chị Trâm chốt 18/08/2026: "2 cái này có khác nhau j đâu, làm 1 nút thôi").
                    if (bi && thayDoi.daXoa === false) {
                      triggerToast(`Đã phục hồi biểu mẫu "${bi.ten}" từ thùng rác.`);
                      logAction('Phục hồi biểu mẫu', `${bi.ten} · ${bi.link}`);
                    }
                  }}
                  /* Nút 🗑 nay chỉ BỎ VÀO THÙNG RÁC — chị Trâm lỡ xoá 2 biểu mẫu và không lấy lại
                     được (18/08/2026). Dữ liệu vẫn còn, phục hồi bằng nút ↩ trong thùng rác. */
                  onDelete={(id) => {
                    const bi = templates.find(t => t.id === id);
                    setTemplates(prev => prev.map(t => t.id === id
                      ? { ...t, daXoa: true, ngayXoa: new Date().toISOString(), nguoiXoa: currentUser?.name }
                      : t));
                    if (bi) {
                      triggerToast(`Đã bỏ "${bi.ten}" vào thùng rác — mở mục Thùng rác biểu mẫu để phục hồi.`);
                      logAction('Bỏ biểu mẫu vào thùng rác', `${bi.ten} · ${bi.link}`);
                    }
                  }}
                  onXoaVinhVien={(id) => {
                    const bi = templates.find(t => t.id === id);
                    setTemplates(prev => prev.filter(t => t.id !== id));
                    if (bi) {
                      triggerToast(`Đã xoá vĩnh viễn biểu mẫu "${bi.ten}".`);
                      logAction('Xoá vĩnh viễn biểu mẫu', `${bi.ten} · ${bi.link}`);
                    }
                  }}
                />
              </div>
            )}

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
                {/* Khung "Thông báo nội bộ" và "Template mẫu" ĐÃ CHUYỂN sang mục riêng
                    "Thông báo - Template" trên thanh tác vụ (chị Trâm chốt 18/08/2026) — để trong
                    Lịch cá nhân thì không ai tìm thấy. Xem khối activeTab === 'TEMPLATES'. */}


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
                                    return isAvatarUrl(member.avatar) ? (
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
        {/* Bỏ max-w-7xl (chặn theo rem, co lại khi zoom chữ) — xem ghi chú ở thẻ <main> */}
        <div className="w-full px-4 flex flex-col sm:flex-row items-center justify-center gap-2">
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
            {/* BA LỰA CHỌN (chị Trâm chốt 29/07/2026). Bản 28/07 chỉ có 2 nút và mặc định "kéo về =
                có đổi tiến độ", nên tình huống CÓ THẬT sau đây bị kẹt: giữa chừng có người mới vào
                hỗ trợ, Quản lý cần chia lại tỉ trọng / thêm việc con để lưu bằng chứng phân công,
                nhưng hạn nộp không đổi → bảng dời hạn đòi "số ngày dời > 0" nên bấm không được. */}
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
              Kéo hồ sơ về Bước 1 để <b>lập lại kế hoạch việc con</b>. Chọn giúp trường hợp của bạn:
            </p>
            <div className="flex flex-col gap-2 pt-1">
              {/* 2 — GIỮ NGUYÊN HẠN: chỉ chia lại tỉ trọng / thêm việc con (có người mới tham gia
                  giữa chừng), hạn nộp không đổi và không ghi nhật ký dời hạn. */}
              <button
                type="button"
                onClick={() => handlePullBackImpact(pullBackProject, false)}
                className="w-full px-4 py-3 rounded-xl text-left border border-brand-success/40 bg-brand-success/10 hover:bg-brand-success/15 transition-colors cursor-pointer"
              >
                <span className="block text-xs font-black text-slate-800 dark:text-slate-100">Không thay đổi tiến độ — chỉ phân bổ / thêm công việc con</span>
                <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Có người mới tham gia giữa chừng, chia lại tỉ trọng để lưu bằng chứng. Hạn nộp <b>giữ nguyên</b>.
                </span>
              </button>
              {/* 3 — CÓ ĐỔI TIẾN ĐỘ: hệ thống tự tính số ngày dời theo việc con, ghi Delay Log. */}
              <button
                type="button"
                onClick={() => handlePullBackImpact(pullBackProject, true)}
                className="w-full px-4 py-3 rounded-xl text-left border border-brand-warning/40 bg-brand-warning/15 hover:bg-brand-warning/25 transition-colors cursor-pointer"
              >
                <span className="block text-xs font-black text-slate-800 dark:text-slate-100">Có thay đổi tiến độ</span>
                <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Việc con kéo dài thêm nên phải dời hạn nộp. Hệ thống tự tính số ngày dời và <b>ghi nhật ký dời hạn</b>.
                </span>
              </button>
              {/* 1 — HUỶ: bấm nhầm, không kéo nữa. */}
              <button
                type="button"
                onClick={() => setPullBackProject(null)}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors cursor-pointer"
              >
                Huỷ — kéo nhầm
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
          doiTienDo={pullBackDoiTienDo}
          thuVienTenViecCon={thuVienTenViecCon}
          onCancel={() => setPullBackDelayProject(null)}
          onApply={(tasks, delayDays, reason) => handlePullBackApply(pullBackDelayProject.id, tasks, delayDays, reason)}
        />
      )}

      {/* Bảng nhập tiến độ & kết quả cấp Phòng — tự mở khi hồ sơ sang bước 4 (hoặc khi TP kéo
          sang bước 5 mà chưa đủ 100%). Đóng mà chưa đủ 100% thì gửi 1 tin lên chuông để TP nhớ. */}
      {/* ===== HỘP XÁC NHẬN TRÌNH BƯỚC 3 (chị Trâm chốt 18/08/2026) =====
          Thay cho window.confirm — hộp của trình duyệt hiện cả tên miền "…vercel.app cho biết",
          chữ và nút không theo app nên đọc lên như trang lạ ("thông báo này của e ngộ quá").
          Hộp này vuông, nằm giữa màn hình, cùng kiểu với hộp "kéo về Bước 1 — có đổi tiến độ không".
          Đây là LẦN XÁC NHẬN THỨ 2 (lần 1 là bấm "Lưu Hồ Sơ") — chị Trâm yêu cầu xác nhận 2 lần.
          Hồ sơ ĐÃ ĐƯỢC LƯU trước khi hộp này mở, nên bấm "Để sau" không mất công nhập liệu. */}
      {xacNhanQuaB3 && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-card w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-accent shrink-0" />
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">
                Trình hồ sơ sang Bước 3?
              </h3>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Đã lưu chỉnh sửa của hồ sơ{' '}
                <strong className="text-slate-800 dark:text-slate-100">
                  “{xacNhanQuaB3.hangMuc} — {xacNhanQuaB3.tenDuAn}”
                </strong>. Xác nhận trình sang <strong>Bước 3 — Duyệt hồ sơ thầu cấp phòng</strong> để
                Trưởng phòng nhận hồ sơ và duyệt?
              </p>

              <div className="rounded-lg bg-slate-50 dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 px-3 py-2 space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Tiến độ Bộ phận</span>
                  <strong className="text-brand-success">{xacNhanQuaB3.tienDoBoPhan || 0}%</strong>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Ảnh báo cáo đã gửi báo giá</span>
                  {(xacNhanQuaB3.anhBaoCaoGuiBaoGia || '').trim() ? (
                    <strong className="text-brand-success">Đã có</strong>
                  ) : (
                    <strong className="text-brand-warning">Chưa có</strong>
                  )}
                </div>
              </div>

              {/* CẢNH BÁO THIẾU ẢNH — chị Trâm 18/08/2026: "c ko thấy e cảnh báo là chưa có ảnh báo cáo".
                  Ảnh nay chỉ NHẮC chứ không chặn (xem ANH_BAO_CAO_BAT_BUOC), nên phải nói rõ ở đây. */}
              {!(xacNhanQuaB3.anhBaoCaoGuiBaoGia || '').trim() && (
                <p className="text-[11px] font-bold text-brand-warning bg-brand-warning/10 border border-brand-warning/25 rounded-lg px-3 py-2">
                  ⚠ Hồ sơ chưa có <strong>ảnh báo cáo đã gửi báo giá</strong>. Vẫn trình được, nhưng nên
                  bổ sung ảnh ở mục “Tiến độ Bộ phận” trong hồ sơ để có bằng chứng đã gửi Chủ đầu tư.
                </p>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const ten = xacNhanQuaB3.tenDuAn;
                  setXacNhanQuaB3(null);
                  setChoQuaBuoc3(null);
                  triggerToast(`Đã lưu chỉnh sửa. Hồ sơ “${ten}” giữ ở Bước 2 — muốn trình duyệt thì kéo thẻ sang Bước 3 lần nữa.`);
                }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-black text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors"
              >
                Để sau
              </button>
              <button
                type="button"
                onClick={() => {
                  const hoSo = xacNhanQuaB3;
                  setProjects(prev => prev.map(p => (p.id === hoSo.id ? { ...p, kanbanStep: 3 } : p)));
                  setXacNhanQuaB3(null);
                  setChoQuaBuoc3(null);
                  triggerToast(`Hồ sơ “${hoSo.tenDuAn}” đã sang Bước 3 — Trưởng phòng nhận được để duyệt.`);
                  logAction('Chuyển bước Kanban', `Trình hồ sơ ${hoSo.projectId} - ${hoSo.tenDuAn} sang Bước 3 sau khi lưu chỉnh sửa (xác nhận 2 lần)`, undefined, getProjectParticipants(hoSo));
                }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-black text-white bg-brand-accent hover:bg-brand-accent-hover transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Đồng ý — trình Bước 3
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hộp đính kèm ẢNH BÁO CÁO ĐÃ GỬI BÁO GIÁ ở cửa Bước 2 → 3 (góp ý #12) */}
      {anhBaoCaoProject && (
        <AnhBaoCaoModal
          project={anhBaoCaoProject}
          currentUserRole={currentUser?.role}
          onClose={() => setAnhBaoCaoProject(null)}
          onSave={(tepAnh, ghiChu) => {
            const hoSo = anhBaoCaoProject;
            setProjects(prev => prev.map(p => p.id === hoSo.id
              ? { ...p, anhBaoCaoGuiBaoGia: tepAnh, ghiChuGuiBaoGia: ghiChu || undefined }
              : p));
            logAction('Đính kèm ảnh đã gửi báo giá',
              `Hồ sơ "${hoSo.hangMuc} — ${hoSo.tenDuAn}": ${parseAttachments(tepAnh).length} ảnh báo cáo đã gửi báo giá${ghiChu ? ` · ${ghiChu}` : ''}`);
            setAnhBaoCaoProject(null);
            // Ảnh đã có → đưa thẻ sang Bước 3 luôn, không bắt người dùng kéo lại.
            handleKanbanMove(hoSo.id, 2, 3);
          }}
        />
      )}

      {phongInputProject && (
        <PhongProgressModal
          project={phongInputProject}
          currentUserRole={currentUser?.role}
          onClose={() => {
            const p = phongInputProject;
            const hienTai = projects.find(x => x.id === p.id) || p;
            if ((hienTai.tienDoPhong || 0) < 100) {
              const buocDang = hienTai.kanbanStep || 1;
              const buocKe = phongInputChuyenBuoc || buocDang + 1;
              const tenBuocKe = KANBAN_STEPS.find(s => s.id === buocKe)?.title || `bước ${buocKe}`;
              notifySelf(`Hồ sơ "${p.hangMuc} — ${p.tenDuAn}" đang ở bước ${buocDang}: tiến độ Phòng hiện đạt ${hienTai.tienDoPhong || 0}%. Cần duyệt đủ 100% để chuyển sang bước ${buocKe} (${tenBuocKe}).`);
            }
            setPhongInputProject(null);
            setPhongInputChuyenBuoc(null);
          }}
          onSave={(tienDo, ketQua, tep) => {
            handleUpdatePhongResult(phongInputProject.id, tienDo, ketQua, tep, phongInputChuyenBuoc);
            setPhongInputProject(null);
            setPhongInputChuyenBuoc(null);
          }}
        />
      )}

      {/* Hộp hỏi MỞ VÒNG MỚI khi TP kéo hồ sơ đã gửi CĐT về Bước 1 */}
      {vongMoiAsk && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setVongMoiAsk(null)}>
          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-warning/15 text-lg">🔁</span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Kéo về Bước 1 — mở vòng mới?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Hồ sơ <b className="text-slate-700 dark:text-slate-200">"{vongMoiAsk.hangMuc} — {vongMoiAsk.tenDuAn}"</b> đã gửi CĐT{' '}
                  <b>{tongSoLanGuiCDT(vongMoiAsk)} lần</b>, đang ở <b>vòng {Math.max(1, vongMoiAsk.vongHienTai || 1)}</b>.
                  Mở vòng mới thì việc con vòng cũ được <b>giữ nguyên (chỉ xem)</b> và Quản lý phải lập bộ việc con mới
                  chia đủ <b>100%</b> cho vòng này — tiến độ Bộ phận bắt đầu lại từ 0%.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => { const p = vongMoiAsk; setVongMoiAsk(null); handlePullBackKeepDeadline(p, true); }}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-black bg-brand-warning hover:bg-brand-warning/85 text-black transition-colors cursor-pointer"
              >
                Mở vòng {Math.max(1, vongMoiAsk.vongHienTai || 1) + 1} — lập lại công việc con
              </button>
              <button
                type="button"
                onClick={() => { const p = vongMoiAsk; setVongMoiAsk(null); handlePullBackKeepDeadline(p, false); }}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors cursor-pointer"
              >
                Chỉ sửa nhỏ — giữ vòng {Math.max(1, vongMoiAsk.vongHienTai || 1)}
              </button>
              <button
                type="button"
                onClick={() => setVongMoiAsk(null)}
                className="w-full px-4 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors cursor-pointer"
              >
                Hủy, không kéo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hộp xác nhận GHI NHẬN GỬI CĐT (kéo bước 4 → 5) — chặn đếm sai khi TP lỡ tay kéo qua kéo lại */}
      {guiCDTConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setGuiCDTConfirm(null)}>
          <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/10 text-lg">📤</span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Ghi nhận gửi CĐT lần {guiCDTConfirm.lan}?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Hồ sơ <b className="text-slate-700 dark:text-slate-200">"{guiCDTConfirm.project.hangMuc} — {guiCDTConfirm.project.tenDuAn}"</b> sẽ
                  sang <b>bước 5 (đã gửi CĐT)</b> và hệ thống ghi <b className="text-brand-accent dark:text-brand-accent-300">lần gửi thứ {guiCDTConfirm.lan}</b>,
                  kèm tiến độ Phòng {guiCDTConfirm.project.tienDoPhong || 0}% và kết quả công việc hiện tại.
                  {guiCDTConfirm.lan > 1 && ' Chỉ chọn "Đúng" nếu đây thật sự là một lần gửi mới cho Chủ đầu tư.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setGuiCDTConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors cursor-pointer"
              >
                Chưa gửi — để sau
              </button>
              <button
                type="button"
                onClick={() => {
                  const { project } = guiCDTConfirm;
                  setGuiCDTConfirm(null);
                  handleKanbanMove(project.id, 4, 5, true);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-xs font-black bg-brand-accent hover:bg-brand-accent-700 text-white transition-colors cursor-pointer"
              >
                Đúng, ghi nhận lần {guiCDTConfirm.lan}
              </button>
            </div>
          </div>
        </div>
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

    </div>
  );
}
