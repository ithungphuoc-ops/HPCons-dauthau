import { useState, useMemo } from 'react';
import { Project, ProjectTask, Staff } from '../types';
import { fmtDateVN } from '../utils/dateVN';
import { Clock, Info, X } from 'lucide-react';
import SubtaskGantt, { DEFAULT_TASK_DAYS } from './SubtaskGantt';

const DAY = 24 * 60 * 60 * 1000;

interface PullBackDelayModalProps {
  project: Project;
  /** Danh sách nhân sự — để bảng phân rã đổi người thực hiện việc con. */
  staff: Staff[];
  /** L1 (BOOD) tự áp dụng ngay; L2 (MANAGER) gửi yêu cầu → chờ TP duyệt lại tiến độ Phòng. */
  isBOOD: boolean;
  onCancel: () => void;
  /** Áp dụng: danh sách việc con đã chỉnh, số ngày dời THỰC (theo việc con), lý do. */
  onApply: (tasks: ProjectTask[], delayDays: number, reason: string) => void;
}

const taskDays = (t: ProjectTask) => (t.soNgay && t.soNgay > 0 ? t.soNgay : DEFAULT_TASK_DAYS);
const parseDay = (s?: string): number | null => { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d.getTime(); };
// Mốc KẾT THÚC việc con muộn nhất — cùng cách xếp lịch với SubtaskGantt (việc chưa đặt ngày thì
// xếp nối tiếp từ ngày bắt đầu dự án). Trả về thời điểm kết thúc xa nhất (ms).
const execEndMs = (list: ProjectTask[], projectStart: string): number => {
  let cursor = parseDay(projectStart) ?? Date.now();
  let maxEnd = cursor;
  for (const t of list) {
    const start = parseDay(t.ngayBatDau) ?? cursor;
    const end = start + taskDays(t) * DAY;
    cursor = end;
    if (end > maxEnd) maxEnd = end;
  }
  return maxEnd;
};

export default function PullBackDelayModal({ project, staff, isBOOD, onCancel, onApply }: PullBackDelayModalProps) {
  // Quản lý chỉnh việc con (ngày · người · thêm/xóa) — offset TỰ ĐỘNG tính, không nhập tay.
  const [tasks, setTasks] = useState<ProjectTask[]>(() => (project.tasks || []).map(t => ({ ...t })));
  const [reason, setReason] = useState('');

  const newDays = useMemo(() => tasks.reduce((s, t) => s + taskDays(t), 0), [tasks]);
  // Offset dời = số ngày LỊCH mà mốc kết thúc việc con muộn nhất bị đẩy ra (KHÔNG phải tổng ngày,
  // KHÔNG nhập tay) → hạn luôn khớp sơ đồ Gantt, hết lệch. Trưởng phòng tự thêm ngày kiểm tra khi duyệt.
  const actualDelay = useMemo(() => {
    const orig = execEndMs(project.tasks || [], project.ngayBatDau);
    const now = execEndMs(tasks, project.ngayBatDau);
    return Math.max(0, Math.round((now - orig) / DAY));
  }, [tasks, project.tasks, project.ngayBatDau]);

  const curDeadline = project.ngayHoanThanhDuKienHienTai;
  const newDeadlineDate = new Date(new Date(curDeadline).getTime() + actualDelay * DAY);
  const newDeadline = newDeadlineDate.toISOString().split('T')[0];

  const canApply = actualDelay > 0 && reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-warning/15 text-brand-warning">
              <Clock className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Dời hạn & sửa việc con</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate">{project.projectId} — {project.hangMuc}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-elevated cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hạn hiện tại → hạn mới */}
        <div className="flex items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-xl px-3 py-2.5">
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400">Hạn nộp hiện tại</span>
            <span className="font-black text-slate-700 dark:text-slate-200">{fmtDateVN(curDeadline)}</span>
          </div>
          <span className="text-slate-300 dark:text-slate-600">→</span>
          <div className="text-right">
            <span className="block text-[10px] uppercase font-bold text-slate-400">Hạn mới (theo việc con)</span>
            <span className="font-black text-brand-warning">{fmtDateVN(newDeadline)}{actualDelay > 0 ? ` (+${actualDelay} ngày)` : ''}</span>
          </div>
        </div>

        {/* Offset TỰ ĐỘNG — Quản lý không nhập tay */}
        <div className="flex items-start gap-2 text-[11px] bg-brand-accent/5 dark:bg-brand-accent/10 border border-brand-accent/20 rounded-lg px-3 py-2 text-slate-600 dark:text-slate-300">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-brand-accent dark:text-brand-accent-300" />
          <span>Bạn chỉ cần chỉnh việc con bên dưới — hệ thống <b>tự tính số ngày dời</b> theo mốc kết thúc việc con muộn nhất (hiện <b className="text-brand-warning">+{actualDelay} ngày</b>). Trưởng phòng sẽ tự thêm ngày kiểm tra của Phòng khi duyệt.</span>
        </div>

        {/* Sửa việc con — dùng CHÍNH bảng phân rã như lúc tạo/sửa công việc:
            đổi người thực hiện · tiến độ BP (TP nếu là Trưởng phòng) · số ngày · thêm/xóa việc con.
            Khi dự án delay kéo nhân sự đi, có thể dồn việc cho 1-2 người chủ đạo. */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Việc con — đổi người thực hiện · tiến độ · số ngày · thêm/xóa việc (tổng {newDays} ngày · dời +{actualDelay} ngày)
          </label>
          <SubtaskGantt
            tasks={tasks}
            staff={staff}
            projectStartDate={project.ngayBatDau}
            canEdit
            isBOOD={isBOOD}
            hideFooter
            onChange={setTasks}
          />
        </div>

        {/* Lý do */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Lý do dời hạn <span className="text-brand-danger">*</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: CĐT điều chỉnh thiết kế, bổ sung hạng mục — cần thêm thời gian bóc tách..."
            className="w-full h-16 p-2.5 text-xs bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-warning"
          />
        </div>

        {/* Định tuyến duyệt */}
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-lg px-3 py-2">
          {isBOOD
            ? '👑 Trưởng phòng (Level 1) tự dời — áp dụng ngay, không cần duyệt.'
            : '📨 Quản lý (Level 2) dời hạn — hệ thống sẽ gửi Trưởng phòng phê duyệt lại tiến độ Phòng.'}
        </p>

        {/* Nút */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl text-xs font-black border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors cursor-pointer">
            Hủy
          </button>
          <button
            type="button"
            disabled={!canApply}
            onClick={() => onApply(tasks, actualDelay, reason.trim())}
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-black bg-brand-warning hover:bg-brand-warning/85 text-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={actualDelay === 0 ? 'Chỉnh việc con (tăng ngày / thêm việc) để phát sinh số ngày dời' : (!reason.trim() ? 'Nhập lý do dời hạn' : '')}
          >
            {isBOOD ? `Dời +${actualDelay} ngày & kéo về Bước 1` : `Gửi TP duyệt (+${actualDelay} ngày)`}
          </button>
        </div>
      </div>
    </div>
  );
}
