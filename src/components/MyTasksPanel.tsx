import { useState } from 'react';
import { Project, ProjectTask } from '../types';
import { ListTodo, CheckCircle, Search, Download } from 'lucide-react';
import StaffTaskResultPanel from './StaffTaskResultPanel';
import TextWithLinks from './TextWithLinks';
import { updateTaskInTree } from '../utils/taskTree';
import { fmtDateVN } from '../utils/dateVN';

// Hạn nộp của một tác vụ: ngày bắt đầu + số ngày − 1 (ngày làm việc cuối, khớp sơ đồ Gantt).
// Việc chưa đặt lịch riêng thì lấy hạn hiện tại của cả gói công việc (fallback).
const pad2 = (n: number) => String(n).padStart(2, '0');
export const taskDeadlineISO = (task: ProjectTask, projectDeadline?: string): string => {
  if (task.ngayBatDau && /^\d{4}-\d{2}-\d{2}/.test(task.ngayBatDau)) {
    const days = task.soNgay && task.soNgay > 0 ? task.soNgay : 3;
    const d = new Date(task.ngayBatDau);
    d.setDate(d.getDate() + days - 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return projectDeadline || '';
};
export const todayISO = (): string => {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
};

// Bộ tác vụ mặc định khi hồ sơ chưa được phân rã công việc (đồng bộ với App.tsx)
export const DEFAULT_PROJECT_TASKS: ProjectTask[] = [
  { id: 'T1', name: 'Nghiên cứu hồ sơ thầu & Thiết kế sơ bộ', weight: 25, isCompleted: false },
  { id: 'T2', name: 'Bóc tách khối lượng BOQ Kiến trúc & MEPF', weight: 40, isCompleted: false },
  { id: 'T3', name: 'Xây dựng đơn giá chi tiết & Áp giá vật tư', weight: 20, isCompleted: false },
  { id: 'T4', name: 'Phê duyệt tờ trình thầu & Đóng gói hồ sơ', weight: 15, isCompleted: false }
];

// Mọi nhân sự được giao việc trong cây công việc (quét cả việc con) — dùng cho cột
// "Nhân sự thực hiện" ở bảng hồ sơ Quản lý phụ trách, vì thucHienIds cấp hồ sơ có thể rỗng.
const assigneeIdsInTasks = (tasks?: ProjectTask[]): string[] => {
  const out = new Set<string>();
  const walk = (list?: ProjectTask[]) => (list || []).forEach(t => {
    [t.assignedTo, ...(t.assignedStaffIds || [])].forEach(id => { if (id) out.add(id); });
    walk(t.subtasks);
  });
  walk(tasks);
  return Array.from(out);
};

// Từ bước 3 (Duyệt hồ sơ thầu cấp Phòng) trở đi thì KHÓA cập nhật việc con — Bộ phận phải xong
// trước rồi Trưởng phòng mới duyệt (chị Trâm chốt 26/07/2026). Giữ đồng bộ với khoaCapNhatViecCon
// bên App.tsx; để riêng ở đây cho khỏi nhập vòng (App đã import component này).
const KHOA_TU_BUOC = 3;
export const hoSoDangKhoaViecCon = (p: { kanbanStep?: number }): boolean => (p.kanbanStep || 1) >= KHOA_TU_BUOC;

// Kế hoạch Quản lý vừa lập, TRƯỞNG PHÒNG CHƯA DUYỆT (chị Trâm chốt 27/07/2026):
// việc VẪN hiện trong danh sách để nhân sự biết trước mà thu xếp, nhưng khóa toàn bộ thao tác
// cập nhật và KHÔNG tính vào thống kê/KPI — vì TP có thể duyệt lại đổi người / đổi hạn / đổi tỉ trọng,
// làm sớm là công cốc. Duyệt xong nhân sự nhận thông báo "bắt đầu thực hiện" rồi mới mở khóa.
// HAI trường hợp đều là "chưa được duyệt", phải khóa như nhau:
//   · tpDaDuyet === false  — Quản lý vừa lập kế hoạch LẦN ĐẦU, TP chưa duyệt.
//   · choDuyetLai === true — hồ sơ đã chạy rồi bị kéo về Bước 1 / bị delay, Quản lý lập lại kế hoạch
//     cho VÒNG mới. Cờ tpDaDuyet vẫn còn true từ vòng trước nên chỉ xét mình nó là lọt lưới:
//     nhân viên thấy việc vòng mới và làm được ngay khi TP chưa duyệt (chị Trâm báo 27/07/2026).
export const hoSoChoTPDuyet = (p: { tpDaDuyet?: boolean; choDuyetLai?: boolean }): boolean =>
  p.tpDaDuyet === false || p.choDuyetLai === true;

// Điều kiện đánh dấu hoàn thành: đã cập nhật kết quả công việc VÀ tiến độ đạt 100%
export const getCompletionBlockReason = (task: ProjectTask): string | null => {
  if (!(task.ketQuaCongViec || '').trim()) {
    return 'Chưa thể đánh dấu hoàn thành: cần bấm "CẬP NHẬT KQ" để nhập kết quả công việc trước!';
  }
  if ((task.staffProgress ?? 0) < 100) {
    return 'Chưa thể đánh dấu hoàn thành: tiến độ thực hiện phải đạt 100% (hiện tại ' + (task.staffProgress ?? 0) + '%)!';
  }
  return null;
};

interface MyTasksPanelProps {
  projects: Project[];
  currentUserId: string;
  // true: chỉ hiện tác vụ được phân công đích danh (dành cho Quản lý L2);
  // false: hiện mọi tác vụ trong các hồ sơ user tham gia (dành cho Nhân viên L3)
  personalOnly: boolean;
  title: string;
  subtitle?: string;
  // Tên người đang đăng nhập — in lên đầu file kết xuất để biết báo cáo của ai
  currentUserName: string;
  // QUẢN LÝ (L2): các hồ sơ mình PHỤ TRÁCH (quản lý chính/phụ) — kể cả hồ sơ không có việc nào
  // giao đích danh cho mình. Đưa vào file kết xuất để Quản lý báo cáo được cả phần mình quản lý,
  // không chỉ việc mình tự làm. Nhân viên (L3) không truyền prop này.
  managedProjects?: Project[];
  // Tra tên nhân sự cho cột "Người thực hiện" ở bảng hồ sơ Quản lý phụ trách
  staffNames?: Record<string, string>;
  // Thông tin MÔ TẢ của dự án cha (tra theo duAnChaId) — cho khối "ℹ️ Hồ sơ" mà nhân sự thực hiện
  // xem được. CỐ Ý chỉ nhận 4 trường mô tả, không nhận nguyên bản ghi Project, để không lọt
  // tiến độ Bộ phận / Phòng duyệt / KPI sang màn nhân viên.
  duAnChaInfo?: Record<string, { tenDuAn: string; chuDauTu?: string; diaChi?: string; moTa?: string }>;
  onUpdateTasks: (projectId: string, tasks: ProjectTask[]) => void;
  onToggleTask: (projectId: string, taskId: string) => void;
  // Đã xuất xong file: App hiện toast + ghi Nhật ký hoạt động
  onExported?: (count: number, scope: string) => void;
}

export default function MyTasksPanel({ projects, currentUserId, personalOnly, title, subtitle, currentUserName, managedProjects, staffNames, duAnChaInfo, onUpdateTasks, onToggleTask, onExported }: MyTasksPanelProps) {
  const [expandedTaskKey, setExpandedTaskKey] = useState<string | null>(null);
  // Hồ sơ đang mở khối thông tin mô tả (nút ℹ️ HỒ SƠ)
  const [infoProjectId, setInfoProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Lọc theo trạng thái: mặc định chỉ hiện việc CẦN LÀM (ẩn việc đã xong cho gọn)
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'DONE' | 'ALL'>('ACTIVE');

  // Tra tên nhân sự theo id — dùng cho khối "ℹ️ Hồ sơ" (quản lý phụ trách / quản lý kế thừa).
  // Chỉ là bản đồ id → họ tên, KHÔNG kèm KPI hay tiến độ, giữ đúng quy tắc bảo mật với L3.
  const tenNhanSuTheoId = (id?: string) => (id && staffNames?.[id]) || '';

  // Gom tác vụ: đệ quy toàn cây để không bỏ sót việc con được giao đích danh
  const q = search.trim().toLowerCase();
  const rows: Array<{ project: Project; task: ProjectTask }> = [];
  projects.forEach(p => {
    // Lọc theo ô tìm kiếm dự án (mã, tên dự án)
    if (q && !(`${p.projectId} ${p.tenDuAn}`.toLowerCase().includes(q))) return;
    const pTasks = p.tasks && p.tasks.length > 0 ? p.tasks : DEFAULT_PROJECT_TASKS;
    const walk = (list: ProjectTask[]) => {
      list.forEach(t => {
        const isMine = t.assignedTo === currentUserId || (t.assignedStaffIds || []).includes(currentUserId);
        if (!personalOnly || isMine) {
          rows.push({ project: p, task: t });
        }
        if (t.subtasks && t.subtasks.length > 0) walk(t.subtasks);
      });
    };
    walk(pTasks);
  });

  // Đếm theo trạng thái cho nút lọc
  const activeCount = rows.filter(r => !r.task.isCompleted).length;
  const doneCount = rows.length - activeCount;

  // Sắp xếp: việc CẦN NỘP TRƯỚC (hạn sớm hơn) trôi lên trên; việc ĐÃ XONG tụt xuống dưới cùng.
  const sortKey = (r: { project: Project; task: ProjectTask }) =>
    taskDeadlineISO(r.task, r.project.ngayHoanThanhDuKienHienTai) || '9999-99-99';
  const displayRows = rows
    .filter(r => (viewMode === 'ALL' ? true : viewMode === 'DONE' ? r.task.isCompleted : !r.task.isCompleted))
    .sort((a, b) => {
      const ca = a.task.isCompleted ? 1 : 0, cb = b.task.isCompleted ? 1 : 0;
      if (ca !== cb) return ca - cb;               // đã xong xuống dưới
      return sortKey(a).localeCompare(sortKey(b)); // hạn sớm hơn lên trên
    });

  // ===== KẾT XUẤT BÁO CÁO CÔNG VIỆC (Quản lý L2 + Nhân viên L3) =====
  // Phần VIỆC CỦA TÔI xuất TRỌN (không theo nút lọc Cần làm/Đã xong/Tất cả trên màn hình) — cùng
  // quy tắc với 2 bảng hồ sơ Quản lý phụ trách. Trước đây xuất đúng theo nút lọc đang bật, nên ai
  // đứng ở tab "Cần làm" mà việc của họ đã xong hết là báo cáo trống trơn — rõ ràng có tham gia
  // việc mà xuất ra không thấy đâu (chị Trâm báo 28/07/2026). Vẫn tôn trọng ô tìm kiếm dự án nếu
  // có gõ, vì đó là người dùng chủ động thu hẹp phạm vi, khác với nút lọc trạng thái.
  const scopeLabel = viewMode === 'ACTIVE' ? 'Việc cần làm' : viewMode === 'DONE' ? 'Việc đã xong' : 'Tất cả công việc';
  const managed = managedProjects || [];
  const isManagerReport = managed.length > 0;

  const exportMyWork = () => {
    const esc = (v?: string | number) =>
      String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const myProgress = (t: ProjectTask) => (t.isCompleted ? 100 : t.staffProgress ?? 0);
    const dayDiff = (aISO: string, bISO: string) =>
      Math.round((new Date(`${aISO}T00:00:00`).getTime() - new Date(`${bISO}T00:00:00`).getTime()) / 86400000);
    const statusOf = (t: ProjectTask, deadline: string) => {
      // VIỆC ĐÃ XONG PHẢI NÓI RÕ XONG SỚM / ĐÚNG HẠN / TRỄ (chị Trâm chốt 30/07/2026).
      // Trước đây chỉ ghi "Đã hoàn thành" nên đọc báo cáo không biết ai làm kịp ai không —
      // trong khi cột hạn và cột ngày hoàn thành nằm ngay cạnh, tự trừ nhẩm rất mất công.
      // So theo NGÀY: xong đúng ngày hết hạn vẫn là ĐÚNG HẠN (hạn tính tới hết 23:59).
      if (t.isCompleted) {
        const xong = t.completedAt;
        if (!xong || !deadline) return { text: 'Đã hoàn thành', style: 'color:#16a34a;font-weight:bold;' };
        const lech = dayDiff(deadline, xong);   // >0 = xong trước hạn
        if (lech > 0) return { text: `Hoàn thành sớm ${lech} ngày`, style: 'color:#16a34a;font-weight:bold;' };
        if (lech === 0) return { text: 'Hoàn thành đúng hạn', style: 'color:#16a34a;font-weight:bold;' };
        return { text: `Hoàn thành trễ ${Math.abs(lech)} ngày`, style: 'color:#d97706;font-weight:bold;' };
      }
      if (!deadline) return { text: 'Chưa đặt hạn', style: 'color:#64748b;' };
      const d = dayDiff(deadline, todayISO());
      if (d < 0) return { text: `Quá hạn ${Math.abs(d)} ngày`, style: 'color:#dc2626;font-weight:bold;' };
      if (d === 0) return { text: 'Đến hạn hôm nay', style: 'color:#d97706;font-weight:bold;' };
      return { text: `Còn ${d} ngày`, style: 'color:#2563eb;' };
    };

    // Gom theo hồ sơ để dựng phần A (danh sách dự án đang tham gia) — lấy TRỌN (rows), không theo
    // nút lọc trạng thái trên màn hình, chỉ tôn trọng ô tìm kiếm (đã áp sẵn khi dựng `rows`).
    const byProject: Array<{ project: Project; tasks: ProjectTask[] }> = [];
    rows.forEach(({ project, task }) => {
      const found = byProject.find(g => g.project.id === project.id);
      if (found) found.tasks.push(task);
      else byProject.push({ project, tasks: [task] });
    });

    const now = new Date();
    const nowText = `${pad2(now.getDate())}-${pad2(now.getMonth() + 1)}-${now.getFullYear()} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

    // ===== QUẢN LÝ: 2 bảng về hồ sơ mình phụ trách (Phần A tổng hợp + Phần B chi tiết việc) =====
    const tenNhanSu = (id?: string) => (id && staffNames?.[id]) || '';
    const trangThaiHoSo = (p: Project) => {
      if (p.trangThai === 'HOAN_THANH_DUNG_HAN') return { text: 'Hoàn thành đúng hạn', style: 'color:#16a34a;font-weight:bold;' };
      if (p.trangThai === 'HOAN_THANH_TRE_HAN') return { text: 'Hoàn thành trễ hạn', style: 'color:#d97706;font-weight:bold;' };
      if (p.trangThai === 'TRE_TIEN_DO') return { text: 'Trễ tiến độ', style: 'color:#dc2626;font-weight:bold;' };
      const han = p.ngayHoanThanhDuKienHienTai;
      if (han) {
        const d = dayDiff(han, todayISO());
        if (d < 0) return { text: `Đang thực hiện — quá hạn ${Math.abs(d)} ngày`, style: 'color:#dc2626;font-weight:bold;' };
      }
      return { text: 'Đang thực hiện', style: 'color:#2563eb;' };
    };
    // Đếm việc lá (việc thực làm) trong cây công việc của hồ sơ
    const demViec = (p: Project) => {
      let tong = 0, xong = 0;
      const walk = (list?: ProjectTask[]) => (list || []).forEach(t => {
        if (t.subtasks?.length) { walk(t.subtasks); return; }
        tong += 1;
        if (t.isCompleted) xong += 1;
      });
      walk(p.tasks);
      return { tong, xong };
    };

    let managerSections = '';
    if (isManagerReport) {
      managerSections += `
        <div class="section">Phần A — Hồ sơ / gói thầu tôi phụ trách (${managed.length})</div>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Mã Hồ Sơ</th>
              <th>Tên Dự Án / Gói Thầu</th>
              <th>Hạng Mục</th>
              <th>Chủ Đầu Tư</th>
              <th>Hạn Nộp Hồ Sơ</th>
              <th>Tiến Độ Bộ Phận</th>
              <th>Phòng Duyệt</th>
              <th>Trạng Thái</th>
              <th>Bước Kanban</th>
              <th>Nhân Sự Thực Hiện</th>
              <th>Việc Đã Xong / Tổng</th>
            </tr>
          </thead>
          <tbody>
      `;
      managed.forEach((p, i) => {
        const st = trangThaiHoSo(p);
        const d = demViec(p);
        const nhanSu = Array.from(new Set([p.thucHienId, ...(p.thucHienIds || []), ...assigneeIdsInTasks(p.tasks)].filter(Boolean) as string[]))
          .map(tenNhanSu).filter(Boolean).join(', ');
        managerSections += `
          <tr>
            <td class="num">${i + 1}</td>
            <td class="num">${esc(p.projectId)}</td>
            <td style="font-weight: bold;">${esc(p.tenDuAn)}</td>
            <td>${esc(p.hangMuc)}</td>
            <td>${esc(p.chuDauTu || 'Chưa cập nhật')}</td>
            <td class="num">${fmtDateVN(p.ngayHoanThanhDuKienHienTai)}</td>
            <td class="num">${p.tienDoBoPhan || 0}%</td>
            <td class="num">${p.tienDoPhong || 0}%</td>
            <td style="${st.style}">${st.text}</td>
            <td class="num">${p.kanbanStep || 1}${p.tpDaDuyet === false ? ' (chờ TP duyệt)' : ''}</td>
            <td>${esc(nhanSu || 'Chưa gán')}</td>
            <td class="num">${d.xong} / ${d.tong}</td>
          </tr>
        `;
      });
      managerSections += `
          </tbody>
        </table>

        <div class="section">Phần B — Chi tiết công việc trong các hồ sơ tôi phụ trách</div>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Mã Hồ Sơ</th>
              <th>Tên Dự Án / Gói Thầu</th>
              <th>Công Việc</th>
              <th>Người Thực Hiện</th>
              <th>Vòng</th>
              <th>Tỉ Trọng</th>
              <th>Tiến Độ</th>
              <th>Hạn Hoàn Thành</th>
              <th>Trạng Thái</th>
              <th>Kết Quả Công Việc</th>
            </tr>
          </thead>
          <tbody>
      `;
      let stt = 0;
      managed.forEach(p => {
        const walk = (list?: ProjectTask[]) => (list || []).forEach(t => {
          if (t.subtasks?.length) { walk(t.subtasks); return; }   // chỉ liệt kê việc lá (việc thực làm)
          stt += 1;
          const deadline = taskDeadlineISO(t, p.ngayHoanThanhDuKienHienTai);
          const st = statusOf(t, deadline);
          const nguoiLam = Array.from(new Set([t.assignedTo, ...(t.assignedStaffIds || [])].filter(Boolean) as string[]))
            .map(tenNhanSu).filter(Boolean).join(', ');
          managerSections += `
            <tr>
              <td class="num">${stt}</td>
              <td class="num">${esc(p.projectId)}</td>
              <td>${esc(p.tenDuAn)}</td>
              <td style="font-weight: bold;">${esc(t.name)}</td>
              <td>${esc(nguoiLam || 'Chưa gán')}</td>
              <td class="num">${t.vong || 1}</td>
              <td class="num">${t.weight || 0}%</td>
              <td class="num">${myProgress(t)}%</td>
              <td class="num">${deadline ? fmtDateVN(deadline) : '—'}</td>
              <td style="${st.style}">${st.text}</td>
              <td>${esc(t.ketQuaCongViec || '')}</td>
            </tr>
          `;
        });
        walk(p.tasks);
      });
      managerSections += `
          </tbody>
        </table>
      `;
    }

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          /* Arial cho toàn bộ file kết xuất (chị Trâm chốt 29/07/2026) */
          body, table, td, th, div { font-family: Arial, Helvetica, sans-serif; }
          body { margin: 20px; }
          table { border-collapse: collapse; width: 100%; font-size: 13px; margin-bottom: 26px; }
          th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; border: 1px solid #94a3b8; padding: 10px 8px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
          tr:nth-child(even) td { background-color: #f8fafc; }
          .title { font-size: 22px; font-weight: bold; color: #1e3a8a; text-align: center; padding: 20px 0 5px 0; text-transform: uppercase; }
          .subtitle { font-size: 13px; font-weight: bold; color: #475569; text-align: center; padding-bottom: 20px; }
          /* KHỐI THÔNG TIN BÁO CÁO PHẢI LÀ BẢNG, KHÔNG PHẢI DIV.
             Trước đây là một div dài dùng <br/> ngắt dòng: Excel dồn hết vào ô cột A rồi bọc chữ,
             ra một ô cao lêu nghêu, chữ chồng lên nhau đọc không nổi (chị Trâm báo 29/07/2026).
             Tách thành bảng 2 cột thì mỗi mục là một dòng riêng, thẳng hàng và co giãn đúng. */
          .meta { width: auto; font-size: 11px; margin-bottom: 20px; }
          .meta td { border: 1px solid #e2e8f0; padding: 6px 10px; background-color: #f8fafc; vertical-align: middle; white-space: nowrap; }
          .meta .k { font-weight: bold; color: #334155; }
          .meta .v { color: #475569; }
          .section { font-size: 14px; font-weight: bold; color: #1e3a8a; padding: 10px 0 6px 0; text-transform: uppercase; }
          .num { text-align: center; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="title">${isManagerReport ? 'Báo cáo công việc quản lý' : 'Báo cáo công việc cá nhân'}</div>
        <div class="subtitle">Phòng Đấu Thầu — HP CONS • ${isManagerReport
          ? 'Tổng hợp hồ sơ phụ trách và phần việc được giao'
          : 'Tổng hợp phần việc được giao theo từng hồ sơ thầu'}</div>
        <table class="meta">
          <tr><td class="k">Nhân sự báo cáo</td><td class="v"><b>${esc(currentUserName)}</b>${isManagerReport ? ' — Quản lý' : ''}</td></tr>
          <tr><td class="k">Ngày giờ kết xuất</td><td class="v">${nowText} (Giờ địa phương GMT+7)</td></tr>
          ${isManagerReport ? `<tr><td class="k">Số hồ sơ tôi phụ trách</td><td class="v"><b>${managed.length}</b> (lấy trọn, không theo bộ lọc)</td></tr>` : ''}
          <tr><td class="k">Phạm vi "việc của tôi"</td><td class="v"><b>Trọn — Cần làm &amp; Đã xong</b>${search.trim() ? ` — lọc theo dự án: "${esc(search.trim())}"` : ''}</td></tr>
          <tr><td class="k">Số hồ sơ có việc của tôi</td><td class="v"><b>${byProject.length}</b></td></tr>
          <tr><td class="k">Số công việc của tôi</td><td class="v"><b>${rows.length}</b></td></tr>
          <tr><td class="k">Nguồn dữ liệu</td><td class="v">HP Cons BPM ERP — Hệ thống Quản trị Tiến độ Phòng Đấu Thầu</td></tr>
        </table>
        ${managerSections}

        <div class="section">${isManagerReport ? 'Phần C' : 'Phần A'} — Hồ sơ / gói thầu đang tham gia</div>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Mã Hồ Sơ</th>
              <th>Tên Dự Án / Gói Thầu</th>
              <th>Hạng Mục</th>
              <th>Chủ Đầu Tư</th>
              <th>Hạn Nộp Hồ Sơ</th>
              <th>Số Việc Của Tôi</th>
              <th>Đã Xong</th>
              <th>Tiến Độ Phần Việc Của Tôi</th>
            </tr>
          </thead>
          <tbody>
    `;

    byProject.forEach((g, i) => {
      const tongTiTrong = g.tasks.reduce((s, t) => s + (t.weight || 0), 0);
      // Tiến độ bình quân có trọng số theo tỉ trọng việc; tỉ trọng trống thì tính bình quân đều
      const tienDo = tongTiTrong > 0
        ? Math.round(g.tasks.reduce((s, t) => s + (t.weight || 0) * myProgress(t), 0) / tongTiTrong)
        : Math.round(g.tasks.reduce((s, t) => s + myProgress(t), 0) / (g.tasks.length || 1));
      html += `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="num">${esc(g.project.projectId)}</td>
          <td style="font-weight: bold;">${esc(g.project.tenDuAn)}</td>
          <td>${esc(g.project.hangMuc)}</td>
          <td>${esc(g.project.chuDauTu || 'Chưa cập nhật')}</td>
          <td class="num">${fmtDateVN(g.project.ngayHoanThanhDuKienHienTai)}</td>
          <td class="num">${g.tasks.length}</td>
          <td class="num">${g.tasks.filter(t => t.isCompleted).length}</td>
          <td class="num">${tienDo}%</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>

        <div class="section">${isManagerReport ? 'Phần D' : 'Phần B'} — Chi tiết công việc được giao cho tôi</div>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Mã Hồ Sơ</th>
              <th>Tên Dự Án / Gói Thầu</th>
              <th>Công Việc Được Giao</th>
              <th>Vòng</th>
              <th>Tỉ Trọng</th>
              <th>Tiến Độ Của Tôi</th>
              <th>Hạn Hoàn Thành</th>
              <th>Trạng Thái</th>
              <th>Ngày Hoàn Thành</th>
              <th>Kết Quả Công Việc</th>
              <th>Giải Trình Trễ Hạn</th>
            </tr>
          </thead>
          <tbody>
    `;

    rows.forEach(({ project, task }, i) => {
      const deadline = taskDeadlineISO(task, project.ngayHoanThanhDuKienHienTai);
      const st = statusOf(task, deadline);
      html += `
        <tr>
          <td class="num">${i + 1}</td>
          <td class="num">${esc(project.projectId)}</td>
          <td>${esc(project.tenDuAn)}</td>
          <td style="font-weight: bold;">${esc(task.name)}</td>
          <td class="num">${task.vong || 1}</td>
          <td class="num">${task.weight || 0}%</td>
          <td class="num">${myProgress(task)}%</td>
          <td class="num">${deadline ? fmtDateVN(deadline) : '—'}</td>
          <td style="${st.style}">${st.text}</td>
          <td class="num">${task.completedAt ? fmtDateVN(task.completedAt) : '—'}</td>
          <td>${esc(task.ketQuaCongViec || '')}</td>
          <td>${esc(task.overdueReason || '')}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Bỏ dấu tiếng Việt trong tên tệp để không bị lỗi ký tự khi gửi qua mail / máy khác
    const slug = currentUserName
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_Cao_Cong_Viec_${slug || 'Ca_Nhan'}_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onExported?.(rows.length, isManagerReport ? `Trọn công việc + ${managed.length} hồ sơ phụ trách` : 'Trọn công việc');
  };

  return (
    <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <ListTodo className="text-brand-accent w-4 h-4 animate-pulse" />
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Tìm dự án trong danh sách tác vụ"
              placeholder="Tìm dự án..."
              className="w-40 max-w-full pl-7 pr-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium bg-white dark:bg-dark-elevated text-slate-700 dark:text-slate-200 focus:ring-brand-accent focus:outline-none"
            />
          </div>
          {/* Nút lọc trạng thái công việc */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-dark-elevated/60 p-0.5 rounded-lg">
            {([['ACTIVE', 'Cần làm', activeCount], ['DONE', 'Đã xong', doneCount], ['ALL', 'Tất cả', rows.length]] as const).map(([k, label, n]) => (
              <button
                key={k}
                type="button"
                onClick={() => setViewMode(k)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-black transition-colors whitespace-nowrap ${
                  viewMode === k
                    ? 'bg-white dark:bg-dark-card text-brand-accent dark:text-brand-accent-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {label} ({n})
              </button>
            ))}
          </div>
          {/* Tự kết xuất báo cáo phần việc của mình (Quản lý L2 + Nhân viên L3) — xuất TRỌN (Cần
              làm + Đã xong), không phụ thuộc nút lọc trạng thái đang bật trên màn hình (chị Trâm
              báo 28/07/2026: trước đây đứng ở tab "Cần làm" mà việc đã xong hết là xuất ra trống). */}
          <button
            type="button"
            onClick={exportMyWork}
            disabled={rows.length === 0 && !isManagerReport}
            title={rows.length === 0 && !isManagerReport
              ? 'Chưa có công việc nào để xuất báo cáo'
              : isManagerReport
                ? `Xuất file Excel: ${managed.length} hồ sơ bạn phụ trách + ${rows.length} việc giao đích danh cho bạn (trọn Cần làm & Đã xong)`
                : `Xuất file Excel ${rows.length} công việc của bạn (trọn Cần làm & Đã xong) để làm báo cáo`}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-colors flex items-center gap-1 whitespace-nowrap bg-brand-primary hover:bg-brand-primary-hover text-white shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Xuất báo cáo
          </button>
        </div>
      </div>

      <div className="max-h-[450px] overflow-y-auto pr-1">
        {displayRows.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-10 h-10 text-brand-success mx-auto mb-2" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
              {viewMode === 'DONE' ? 'Chưa có công việc nào đã hoàn thành.'
                : viewMode === 'ACTIVE' ? 'Không có công việc nào cần làm.'
                  : 'Bạn không có tác vụ nào lúc này.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayRows.map(({ project, task }) => {
              const rowKey = `${project.id}-${task.id}`;
              const isEditorOpen = expandedTaskKey === rowKey;
              const isInfoOpen = infoProjectId === project.id;
              // Thông tin mô tả ưu tiên lấy từ hồ sơ Dự án cha; hồ sơ cũ chưa có dự án cha
              // (hoặc dự án cha chưa lưu lại) thì lùi về dữ liệu của chính công việc.
              const cha = project.duAnChaId ? duAnChaInfo?.[project.duAnChaId] : undefined;
              const donePct = task.staffProgress ?? (task.isCompleted ? 100 : 0); // % thực hiện của người dùng
              // Khóa cập nhật việc con ở 2 tình huống:
              //   • Kế hoạch chưa được Trưởng phòng duyệt (xem trước, chưa được làm)
              //   • Hồ sơ đã sang bước 3 trở đi (Trưởng phòng đang duyệt)
              const choDuyet = hoSoChoTPDuyet(project);
              const khoaBuoc = choDuyet || hoSoDangKhoaViecCon(project);
              const lyDoKhoaBuoc = choDuyet
                ? '⏳ Kế hoạch đang chờ Trưởng phòng duyệt — việc hiện sẵn để bạn thu xếp, chưa cập nhật được. Trưởng phòng duyệt xong bạn sẽ nhận thông báo "bắt đầu thực hiện".'
                : `🔒 Hồ sơ đã sang bước ${project.kanbanStep} — Trưởng phòng đang duyệt, không cập nhật công việc con được nữa. Cần sửa thì đề nghị Trưởng phòng kéo hồ sơ về bước trước.`;
              const blockReason = task.isCompleted ? null : (khoaBuoc ? lyDoKhoaBuoc : getCompletionBlockReason(task));
              // Hạn nộp tác vụ + cảnh báo: đỏ = quá hạn, vàng = còn ≤3 ngày
              const deadlineISO = taskDeadlineISO(task, project.ngayHoanThanhDuKienHienTai);
              const tISO = todayISO();
              const overdue = !!deadlineISO && !task.isCompleted && deadlineISO < tISO;
              const daysLeft = deadlineISO ? Math.round((new Date(deadlineISO).getTime() - new Date(tISO).getTime()) / 86400000) : Infinity;
              const dueSoon = !!deadlineISO && !task.isCompleted && !overdue && daysLeft <= 3;
              return (
                <div key={rowKey} className="py-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[8px] bg-slate-100 dark:bg-dark-elevated text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-black font-mono">
                          {project.projectId}
                        </span>
                        <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate max-w-[180px]" title={project.tenDuAn}>
                          {project.tenDuAn}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500">
                          Tỉ trọng: {task.weight}%
                        </span>
                        {/* Kế hoạch chưa được Trưởng phòng duyệt — báo rõ để nhân sự đừng bắt tay làm sớm */}
                        {choDuyet && (
                          <span
                            className="text-[10px] font-black px-1.5 py-0.5 rounded bg-brand-warning/15 text-brand-warning dark:bg-brand-warning/15 dark:text-brand-warning"
                            title={lyDoKhoaBuoc}
                          >
                            ⏳ Chờ TP duyệt
                          </span>
                        )}
                        {/* Mini thanh tiến độ (khiêm tốn) — nằm ngay hàng thông tin để dòng gọn */}
                        <span className="flex items-center gap-1 shrink-0" title={`Hoàn thành ${donePct}%`}>
                          <span className="w-12 h-1.5 bg-slate-100 dark:bg-dark-elevated rounded-full overflow-hidden inline-block">
                            <span
                              className={`block h-full rounded-full transition-all duration-500 ${donePct >= 100 ? 'bg-brand-success' : donePct > 0 ? 'bg-brand-accent' : 'bg-slate-300 dark:bg-slate-700'}`}
                              style={{ width: `${donePct}%` }}
                            />
                          </span>
                          <span className={`text-[10px] font-black tabular-nums ${donePct >= 100 ? 'text-brand-success dark:text-brand-success-300' : 'text-brand-accent dark:text-brand-accent-300'}`}>
                            {donePct}%
                          </span>
                        </span>
                        {deadlineISO && (
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 ${
                              task.isCompleted
                                ? 'bg-slate-100 text-slate-400 dark:bg-dark-elevated dark:text-slate-500'
                                : overdue
                                  ? 'bg-brand-danger/15 text-brand-danger dark:bg-brand-danger/15 dark:text-brand-danger'
                                  : dueSoon
                                    ? 'bg-brand-warning/15 text-brand-warning dark:bg-brand-warning/15 dark:text-brand-warning'
                                    : 'bg-brand-accent/10 text-brand-accent-700 dark:bg-brand-accent/10 dark:text-brand-accent-300'
                            }`}
                            title={
                              task.isCompleted ? 'Hạn nộp công việc'
                                : overdue ? `Đã QUÁ HẠN nộp ${Math.abs(daysLeft)} ngày`
                                  : dueSoon ? `Sắp đến hạn — còn ${daysLeft} ngày`
                                    : 'Hạn nộp công việc'
                            }
                          >
                            📅 Nộp trước: {fmtDateVN(deadlineISO)}
                            {overdue ? ' • QUÁ HẠN' : dueSoon ? ` • còn ${daysLeft}n` : ''}
                          </span>
                        )}
                        {task.overdueReason && (
                          <span className="text-[8px] font-bold text-brand-warning dark:text-brand-warning bg-brand-warning/10 dark:bg-brand-warning/10 px-1.5 py-0.5 rounded" title={task.overdueReason}>
                            ⚠ Có ghi chú dời hạn
                          </span>
                        )}
                      </div>
                      <p className={`text-xs font-semibold ${task.isCompleted ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                        {task.name}
                      </p>
                      {task.ketQuaCongViec && !isEditorOpen && (
                        <p className="text-[10px] text-brand-primary-700 dark:text-brand-primary-300 bg-brand-primary/5 dark:bg-brand-primary/15 border border-brand-primary/15 dark:border-brand-primary/30 rounded-lg px-2 py-1 line-clamp-2" title={task.ketQuaCongViec}>
                          📊 {task.ketQuaCongViec}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Xem thông tin mô tả hồ sơ (chỉ xem — không có tiến độ/KPI) */}
                      <button
                        onClick={() => setInfoProjectId(isInfoOpen ? null : project.id)}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[10px] font-black ${
                          isInfoOpen
                            ? 'bg-brand-accent/15 border-brand-accent/40 text-brand-accent-700 dark:bg-brand-accent/15 dark:border-brand-accent-800 dark:text-brand-accent-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-brand-accent/10 hover:border-brand-accent/25 hover:text-brand-accent dark:bg-dark-bg dark:border-slate-800 dark:text-slate-300 dark:hover:bg-dark-card'
                        }`}
                        title="Xem thông tin hồ sơ: chủ đầu tư, địa chỉ, hạng mục, mô tả nội dung, hạn nộp"
                      >
                        ℹ️ HỒ SƠ
                      </button>

                      {/* Mở khung cập nhật kết quả công việc — khóa khi hồ sơ đã sang bước Phòng duyệt */}
                      <button
                        onClick={() => setExpandedTaskKey(isEditorOpen ? null : rowKey)}
                        disabled={khoaBuoc}
                        className={`p-1.5 rounded-lg border transition-all flex items-center justify-center gap-1.5 text-[10px] font-black disabled:opacity-40 disabled:cursor-not-allowed ${
                          isEditorOpen
                            ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary-700 dark:bg-brand-primary/15 dark:border-brand-primary-800 dark:text-brand-primary-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-brand-primary/10 hover:border-brand-primary/25 hover:text-brand-primary dark:bg-dark-bg dark:border-slate-800 dark:text-slate-300 dark:hover:bg-dark-card cursor-pointer'
                        }`}
                        title={khoaBuoc ? lyDoKhoaBuoc : 'Cập nhật kết quả công việc, % tiến độ, ghi chú dời hạn'}
                      >
                        {khoaBuoc ? (choDuyet ? '⏳ CẬP NHẬT KQ' : '🔒 CẬP NHẬT KQ') : '✍️ CẬP NHẬT KQ'}
                      </button>

                      {/* Nút đánh dấu hoàn thành: chỉ mở khóa khi đã có kết quả + tiến độ 100% */}
                      <button
                        onClick={() => onToggleTask(project.id, task.id)}
                        disabled={khoaBuoc}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[10px] font-black shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                          task.isCompleted
                            ? 'bg-brand-success/10 border-brand-success/25 text-brand-success dark:bg-brand-success/10 dark:border-brand-success/30 dark:text-brand-success-300'
                            : blockReason
                              ? 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-dark-bg dark:border-slate-800 dark:text-slate-600'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-brand-accent/10 hover:border-brand-accent/25 hover:text-brand-accent dark:bg-dark-bg dark:border-slate-800 dark:text-slate-300 dark:hover:bg-dark-card'
                        }`}
                        title={khoaBuoc ? lyDoKhoaBuoc : (blockReason || (task.isCompleted ? 'Bấm để mở lại công việc' : 'Đánh dấu hoàn thành'))}
                      >
                        {task.isCompleted ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-brand-success" />
                            ĐÃ XONG
                          </>
                        ) : (
                          <>
                            <span className="w-3 h-3 border border-slate-400 dark:border-slate-600 rounded-sm" />
                            {blockReason ? (choDuyet ? '⏳ ĐÁNH DẤU XONG' : '🔒 ĐÁNH DẤU XONG') : 'ĐÁNH DẤU XONG'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Khối THÔNG TIN HỒ SƠ (chỉ xem) — mọi nhân sự thực hiện đều xem được.
                      CỐ Ý KHÔNG có: tiến độ Bộ phận, tiến độ Phòng duyệt, KPI, kết quả duyệt giá,
                      nhật ký dời hạn, nhật ký gửi CĐT, bước Kanban — giữ đúng quy tắc bảo mật với L3. */}
                  {isInfoOpen && (
                    <div className="mt-2 mb-3 bg-brand-accent/5 dark:bg-brand-accent/10 border border-brand-accent/40 dark:border-brand-accent/30 rounded-xl p-3.5 space-y-2.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-brand-accent-700 dark:text-brand-accent-300 uppercase tracking-wider">
                          Thông tin hồ sơ
                        </span>
                        <button
                          type="button"
                          onClick={() => setInfoProjectId(null)}
                          className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold uppercase"
                        >
                          Đóng ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                        {([
                          ['Mã hồ sơ', project.projectId],
                          ['Tên dự án', cha?.tenDuAn || project.tenDuAn],
                          ['Chủ đầu tư', cha?.chuDauTu || project.chuDauTu || 'Chưa cập nhật'],
                          ['Địa chỉ công trình', cha?.diaChi || project.diaChi || 'Chưa cập nhật'],
                          ['Hạng mục', project.hangMuc],
                          ['Hạn nộp hồ sơ', fmtDateVN(project.ngayHoanThanhDuKienHienTai)],
                          // Nhân sự cần biết hỏi ai khi vướng: quản lý chính, và quản lý kế thừa
                          // (quản lý phụ — cùng quyền thao tác) để lúc người chính bận thì báo cáo đúng chỗ.
                          ['Quản lý phụ trách', tenNhanSuTheoId(project.quanLyId) || 'Chưa gán'],
                          [
                            'Quản lý kế thừa',
                            (project.quanLyIdsPhu || []).map(tenNhanSuTheoId).filter(Boolean).join(', ') || 'Không có',
                          ],
                        ] as const).map(([nhan, giaTri]) => (
                          <div key={nhan}>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">{nhan}</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{giaTri}</span>
                          </div>
                        ))}
                      </div>

                      {/* Mô tả DỰ ÁN (Trưởng phòng khai) — ẩn nếu hồ sơ không thuộc dự án cha nào */}
                      {cha && (
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">Mô tả dự án</span>
                          <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                            <TextWithLinks text={cha.moTa || 'Trưởng phòng chưa nhập mô tả cho dự án này.'} />
                          </div>
                        </div>
                      )}

                      {/* Ghi chú riêng của CÔNG VIỆC (Quản lý ghi — lưu ý, link thư mục team...) */}
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">Ghi chú công việc</span>
                        <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                          <TextWithLinks text={project.moTa || 'Chưa có ghi chú.'} />
                        </div>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">Nhật ký CĐT yêu cầu điều chỉnh</span>
                        {(project.cdtDieuChinh || []).length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">Chủ đầu tư chưa yêu cầu điều chỉnh hồ sơ này.</p>
                        ) : (
                          <div className="space-y-1">
                            {(project.cdtDieuChinh || []).map((rev, i) => (
                              <div key={`${rev.ngay}-${i}`} className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5">
                                <span className="font-black text-brand-warning">Lần {i + 1}</span>
                                <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                                <span className="font-bold">{fmtDateVN(rev.ngay)}</span>
                                <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                                <span className="italic">{rev.noiDung}</span>
                                <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                                <span className="font-bold text-brand-accent dark:text-brand-accent-300">kéo về bước {rev.buocVe}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Khung cập nhật kết quả nội tuyến */}
                  {isEditorOpen && (
                    <StaffTaskResultPanel
                      task={task}
                      isOverdue={overdue}
                      deadlineText={deadlineISO ? fmtDateVN(deadlineISO) : undefined}
                      onClose={() => setExpandedTaskKey(null)}
                      onSave={(patch) => {
                        const currentTasks = project.tasks && project.tasks.length > 0 ? project.tasks : DEFAULT_PROJECT_TASKS;
                        onUpdateTasks(project.id, updateTaskInTree(currentTasks, task.id, () => patch));
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
