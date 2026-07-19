import { useState } from 'react';
import { Project, ProjectTask } from '../types';
import { ListTodo, CheckCircle, Search } from 'lucide-react';
import StaffTaskResultPanel from './StaffTaskResultPanel';
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
  onUpdateTasks: (projectId: string, tasks: ProjectTask[]) => void;
  onToggleTask: (projectId: string, taskId: string) => void;
}

export default function MyTasksPanel({ projects, currentUserId, personalOnly, title, subtitle, onUpdateTasks, onToggleTask }: MyTasksPanelProps) {
  const [expandedTaskKey, setExpandedTaskKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Lọc theo trạng thái: mặc định chỉ hiện việc CẦN LÀM (ẩn việc đã xong cho gọn)
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'DONE' | 'ALL'>('ACTIVE');

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
        </div>
      </div>

      <div className="max-h-[450px] overflow-y-auto pr-1">
        {displayRows.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-10 h-10 text-brand-success mx-auto mb-2" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
              {viewMode === 'DONE' ? 'Chưa có công việc nào đã hoàn thành.'
                : viewMode === 'ACTIVE' ? 'Tuyệt vời! Bạn không còn công việc nào cần làm.'
                  : 'Bạn không có tác vụ nào lúc này.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayRows.map(({ project, task }) => {
              const rowKey = `${project.id}-${task.id}`;
              const isEditorOpen = expandedTaskKey === rowKey;
              const donePct = task.staffProgress ?? (task.isCompleted ? 100 : 0); // % thực hiện của người dùng
              const blockReason = task.isCompleted ? null : getCompletionBlockReason(task);
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
                      {/* Mở khung cập nhật kết quả công việc */}
                      <button
                        onClick={() => setExpandedTaskKey(isEditorOpen ? null : rowKey)}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[10px] font-black ${
                          isEditorOpen
                            ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary-700 dark:bg-brand-primary/15 dark:border-brand-primary-800 dark:text-brand-primary-300'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-brand-primary/10 hover:border-brand-primary/25 hover:text-brand-primary dark:bg-dark-bg dark:border-slate-800 dark:text-slate-300 dark:hover:bg-dark-card'
                        }`}
                        title="Cập nhật kết quả công việc, % tiến độ, ghi chú dời hạn"
                      >
                        ✍️ CẬP NHẬT KQ
                      </button>

                      {/* Nút đánh dấu hoàn thành: chỉ mở khóa khi đã có kết quả + tiến độ 100% */}
                      <button
                        onClick={() => onToggleTask(project.id, task.id)}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[10px] font-black shrink-0 ${
                          task.isCompleted
                            ? 'bg-brand-success/10 border-brand-success/25 text-brand-success dark:bg-brand-success/10 dark:border-brand-success/30 dark:text-brand-success-300'
                            : blockReason
                              ? 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-dark-bg dark:border-slate-800 dark:text-slate-600'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-brand-accent/10 hover:border-brand-accent/25 hover:text-brand-accent dark:bg-dark-bg dark:border-slate-800 dark:text-slate-300 dark:hover:bg-dark-card'
                        }`}
                        title={blockReason || (task.isCompleted ? 'Bấm để mở lại công việc' : 'Đánh dấu hoàn thành')}
                      >
                        {task.isCompleted ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-brand-success" />
                            ĐÃ XONG
                          </>
                        ) : (
                          <>
                            <span className="w-3 h-3 border border-slate-400 dark:border-slate-600 rounded-sm" />
                            {blockReason ? '🔒 ĐÁNH DẤU XONG' : 'ĐÁNH DẤU XONG'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Khung cập nhật kết quả nội tuyến */}
                  {isEditorOpen && (
                    <StaffTaskResultPanel
                      task={task}
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
