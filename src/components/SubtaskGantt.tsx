import { useState } from 'react';
import { ProjectTask, Staff } from '../types';
import { getInitials, getInitialsColor, chucVuToRole } from '../App';
import { updateTaskInTree, removeTaskFromTree } from '../utils/taskTree';
import { CheckSquare, Square, Plus, Trash2, CalendarClock } from 'lucide-react';
import DateInput from './DateInput';

interface SubtaskGanttProps {
  tasks: ProjectTask[];
  staff: Staff[];
  projectStartDate: string; // mốc bắt đầu dự án, dùng làm fallback
  canEdit: boolean;
  isBOOD?: boolean; // Trưởng phòng: được nhập cột "TP duyệt" (chiếm 30% trọng số)
  hideFooter?: boolean; // Ẩn dòng chú thích "Tiến độ mỗi việc = 70%+30% · Σ Tỉ trọng" (chế độ xem nhanh cho gọn)
  /** Vòng làm việc đang chạy của hồ sơ (mặc định 1). Việc thêm mới được gắn đúng vòng này;
   *  việc của vòng TRƯỚC bị khoá với Quản lý (Trưởng phòng vẫn sửa được — chị Trâm chốt 25/07/2026). */
  vongHienTai?: number;
  onChange: (updatedTasks: ProjectTask[]) => void;
}

// Tiến độ 1 việc con: Bộ phận thực hiện 70% + Trưởng phòng duyệt 30% (mặc định luôn là vậy)
const combinedProgress = (t: { staffProgress?: number; managerProgress?: number; isCompleted?: boolean }) => {
  const sp = t.staffProgress ?? (t.isCompleted ? 100 : 0);
  const mp = t.managerProgress ?? (t.isCompleted ? 100 : 0);
  return Math.round(sp * 0.7 + mp * 0.3);
};

const DAY_MS = 24 * 60 * 60 * 1000;
// Số ngày mặc định cho việc con chưa nhập — dùng CHUNG với planRange bên ProjectForm để không lệch nhau
export const DEFAULT_TASK_DAYS = 3;
const parseDate = (s?: string): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const shortDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

// Bảng phân rã công việc con GỘP với sơ đồ Gantt: mỗi dòng là 1 việc con
// (tick xong · tên · tỉ trọng · người giao · ngày bắt đầu · số ngày · thanh Gantt).
// Chọn/sửa bên trái thì thanh Gantt bên phải chạy theo ngay. Không dùng thanh kéo ngang.
export default function SubtaskGantt({ tasks, staff, projectStartDate, canEdit, isBOOD = false, hideFooter = false, vongHienTai = 1, onChange }: SubtaskGanttProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState(20);

  // Nhân sự giao việc được: bỏ người đã nghỉ và bỏ tài khoản Khách - chỉ xem (Level 4) — khách mời
  // không phải nhân sự phòng, không nhận việc được (chị Trâm chốt 27/07/2026).
  const activeStaff = staff.filter(s => !s.daNghi && (s.role || chucVuToRole(s.chucVu)) !== 'VIEWER');
  const baseStart = parseDate(projectStartDate) || new Date();

  const patch = (taskId: string, p: Partial<ProjectTask>) => onChange(updateTaskInTree(tasks, taskId, () => p));
  const remove = (taskId: string) => onChange(removeTaskFromTree(tasks, taskId));
  const addTask = () => {
    const name = newName.trim();
    if (!name) return;
    // Việc mới luôn thuộc VÒNG ĐANG CHẠY để tính tỉ trọng 100% theo từng vòng.
    const newTask: ProjectTask = { id: `T-${Date.now()}`, name, weight: Math.max(0, newWeight), isCompleted: false, staffProgress: 0, managerProgress: 0, subtasks: [], assignedStaffIds: [], soNgay: DEFAULT_TASK_DAYS, vong: vongHienTai };
    onChange([...tasks, newTask]);
    // Gợi ý tỉ trọng cho lần thêm kế tiếp = phần còn thiếu cho đủ 100% của vòng này
    const conThieu = Math.max(0, 100 - (totalWeight + newTask.weight));
    setNewName(''); setNewWeight(conThieu > 0 ? conThieu : 0); setShowAdd(false);
  };

  // TỰ CHIA % ĐÓNG GÓP (chị Trâm chốt 26/07/2026): phần % còn thiếu cho đủ 100% được chia ĐỀU cho
  // những việc con CHƯA ĐẶT tỉ trọng (đang để 0). Việc nào Quản lý đã tự gõ số thì GIỮ NGUYÊN,
  // không đụng tới. Nếu mọi việc đều đã có số thì chia đều lại toàn bộ cho đủ 100%.
  // Chia phần dư cho việc đầu tiên để tổng khớp đúng 100%, không lẻ ra 99% hay 101%.
  const chiaDeuTiTrong = () => {
    const cungVong = tasks.filter(t => vongCua(t) === vongHienTai);
    if (cungVong.length === 0) return;
    const chuaDat = cungVong.filter(t => !t.weight);
    const nhomChia = chuaDat.length > 0 ? chuaDat : cungVong;
    const daDat = chuaDat.length > 0
      ? cungVong.filter(t => !!t.weight).reduce((s, t) => s + (t.weight || 0), 0)
      : 0;
    const conLai = Math.max(0, 100 - daDat);
    const moiViec = Math.floor(conLai / nhomChia.length);
    const du = conLai - moiViec * nhomChia.length;
    const idNhan: Record<string, number> = {};
    nhomChia.forEach((t, i) => { idNhan[t.id] = moiViec + (i === 0 ? du : 0); });
    onChange(tasks.map(t => (idNhan[t.id] !== undefined ? { ...t, weight: idNhan[t.id] } : t)));
  };

  // Tính mốc bắt đầu/kết thúc từng việc: ưu tiên ngày đã đặt; trống thì xếp nối tiếp.
  let cursor = baseStart;
  const rows = tasks.map(t => {
    const explicitStart = parseDate(t.ngayBatDau);
    const start = explicitStart || cursor;
    const days = t.soNgay && t.soNgay > 0 ? t.soNgay : DEFAULT_TASK_DAYS;
    const end = addDays(start, days);
    cursor = end;
    return { task: t, start, days, end };
  });
  const minStart = rows.reduce((m, r) => (r.start < m ? r.start : m), rows[0]?.start || baseStart);
  const maxEnd = rows.reduce((m, r) => (r.end > m ? r.end : m), rows[0]?.end || addDays(baseStart, 1));
  const totalDays = Math.max(1, Math.round((maxEnd.getTime() - minStart.getTime()) / DAY_MS));
  // Tổng tỉ trọng — phải đủ 100% TRONG TỪNG VÒNG. Lũy kế = 100% × số vòng (2 lần báo giá → 200%).
  const vongCua = (t: ProjectTask) => (t.vong && t.vong > 0 ? t.vong : 1);
  const soVong = Math.max(vongHienTai, tasks.reduce((m, t) => Math.max(m, vongCua(t)), 0));
  const totalWeight = tasks.filter(t => vongCua(t) === vongHienTai).reduce((s, t) => s + (t.weight || 0), 0);
  const luyKeWeight = tasks.reduce((s, t) => s + (t.weight || 0), 0);
  // Việc của vòng trước: Quản lý chỉ xem, Trưởng phòng vẫn sửa được.
  const khoaViec = (t: ProjectTask) => vongCua(t) < vongHienTai && !isBOOD;
  // Mốc ngày trên trục Gantt (4 mốc: đầu → cuối) để dễ hình dung lịch.
  // Hiển thị NGÀY CUỐI LÀM VIỆC (bắt đầu 15, 3 ngày → xong 17), không phải ngày kế tiếp.
  const lastWorkDay = addDays(maxEnd, -1);
  const axisTicks = [0, 1 / 3, 2 / 3, 1].map(f => shortDate(addDays(minStart, Math.round(Math.max(0, totalDays - 1) * f))));

  return (
    <div className="bg-white dark:bg-dark-card border border-slate-200/60 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Header + nút thêm việc */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <span className="text-[11px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4 text-brand-accent" />
          Phân rã công việc &amp; Sơ đồ Gantt · {shortDate(minStart)} → {shortDate(lastWorkDay)}
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowAdd(v => !v)}
            className="text-[10px] font-black bg-brand-accent/10 dark:bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300 hover:bg-brand-accent/15 dark:hover:bg-brand-accent/20 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors shrink-0"
          >
            <Plus className="w-3 h-3" /> Thêm việc con
          </button>
        )}
      </div>

      {canEdit && showAdd && (
        <div className="flex items-center gap-2 px-3 py-2 bg-brand-accent/5 dark:bg-brand-accent/15 border-b border-slate-100 dark:border-slate-800">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
            placeholder="Tên công việc con mới..."
            className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-brand-accent focus:outline-none"
          />
          <input
            type="number" min={1} value={newWeight}
            onChange={(e) => setNewWeight(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 px-1 py-1 text-[11px] text-center bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-brand-accent focus:outline-none"
            title="Tỉ trọng %"
          />
          <button type="button" onClick={addTask} className="text-[10px] font-black bg-brand-primary hover:bg-brand-primary-hover text-white px-2.5 py-1 rounded-lg shrink-0">Thêm</button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-[11px] text-slate-400 italic p-4 text-center">Chưa có công việc con nào. {canEdit ? 'Bấm "Thêm việc con" để bắt đầu.' : ''}</div>
      ) : (
        /* Mobile: biểu đồ Gantt giữ dạng lưới, cuộn ngang trong khung riêng (ngoại lệ chart — như tab Gantt lớn) */
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] md:min-w-0 text-left text-[11px] table-fixed">
          <thead>
            <tr className="bg-slate-50 dark:bg-dark-elevated/50 text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-800 text-[9px] uppercase font-black">
              <th className="p-2 w-7"></th>
              <th className="p-2 w-[24%]">Công việc con</th>
              <th className="p-2 w-12 text-center">Tỉ trọng</th>
              <th className="p-2 w-[15%]">Người giao</th>
              <th className="p-2 w-28">Bắt đầu</th>
              <th className="p-2 w-12 text-center">Ngày</th>
              <th className="p-2 w-12 text-center" title="Bộ phận thực hiện — chiếm 70% trọng số">BP 70%</th>
              {isBOOD && <th className="p-2 w-12 text-center" title="Trưởng phòng duyệt — chiếm 30% trọng số">TP 30%</th>}
              <th className="p-2">
                <div className="flex items-center justify-between gap-1 normal-case">
                  {axisTicks.map((t, i) => (
                    <span key={i} className="text-[8px] font-black text-slate-400 dark:text-slate-500 font-mono">{t}</span>
                  ))}
                </div>
              </th>
              {canEdit && <th className="p-2 w-8"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map(({ task, start, days }) => {
              const assigneeId = task.assignedTo || (task.assignedStaffIds || [])[0] || '';
              const assignee = staff.find(s => s.id === assigneeId);
              const offsetDays = Math.round((start.getTime() - minStart.getTime()) / DAY_MS);
              const leftPct = (offsetDays / totalDays) * 100;
              const widthPct = Math.max(4, (days / totalDays) * 100);
              const progress = combinedProgress(task);
              const barColor = progress >= 100 ? 'bg-brand-success' : progress > 0 ? 'bg-brand-accent' : 'bg-slate-300 dark:bg-slate-700';
              // Việc thuộc vòng TRƯỚC: Quản lý chỉ xem (giữ nguyên số liệu vòng đã gửi CĐT), TP vẫn sửa được.
              const rowEdit = canEdit && !khoaViec(task);
              const vongCuaDong = vongCua(task);
              return (
                <tr key={task.id} className={`text-slate-600 dark:text-slate-300 align-middle ${vongCuaDong < vongHienTai ? 'bg-slate-50/60 dark:bg-dark-bg/40' : ''}`}>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => rowEdit && patch(task.id, { isCompleted: !task.isCompleted, staffProgress: !task.isCompleted ? 100 : 0, managerProgress: !task.isCompleted ? 100 : 0, completedAt: !task.isCompleted ? fmt(new Date()) : undefined })}
                      disabled={!rowEdit}
                      className="text-slate-400 hover:text-brand-accent disabled:cursor-default"
                      title={task.isCompleted ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
                    >
                      {task.isCompleted ? <CheckSquare className="w-4 h-4 text-brand-accent dark:text-brand-accent-300" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-0.5 min-w-0">
                    {/* Việc của vòng trước có nhãn vòng để không lẫn với việc vòng đang làm */}
                    {soVong > 1 && (
                      <span className={`text-[8px] font-black px-1 py-0.5 rounded mr-1 ${
                        vongCuaDong === vongHienTai
                          ? 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300'
                          : 'bg-slate-200/70 dark:bg-dark-elevated text-slate-500 dark:text-slate-400'
                      }`} title={vongCuaDong === vongHienTai ? `Việc của vòng ${vongCuaDong} (đang làm)` : `Việc của vòng ${vongCuaDong} — đã gửi CĐT${khoaViec(task) ? ', chỉ Trưởng phòng sửa được' : ''}`}>
                        V{vongCuaDong}
                      </span>
                    )}
                    <input
                      value={task.name}
                      disabled={!rowEdit}
                      onChange={(e) => patch(task.id, { name: e.target.value })}
                      className={`w-full min-w-0 bg-transparent px-1 py-0.5 text-[11px] font-bold rounded focus:bg-slate-50 dark:focus:bg-dark-elevated focus:outline-none disabled:cursor-default ${task.isCompleted ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}
                      title={task.name}
                    />
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="number" min={0} max={100} value={task.weight}
                      disabled={!rowEdit}
                      onChange={(e) => patch(task.id, { weight: parseInt(e.target.value) || 0 })}
                      className="w-11 px-1 py-1 text-[10px] font-black text-center bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 disabled:opacity-70 focus:ring-1 focus:ring-brand-accent focus:outline-none"
                    />
                  </td>
                  <td className="p-2">
                    {rowEdit ? (
                      <div className="flex items-center gap-1 min-w-0">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[7px] font-black uppercase shrink-0 ${getInitialsColor(assignee?.hoTen || '')}`}>
                          {getInitials(assignee?.hoTen || '?')}
                        </div>
                        <select
                          value={assigneeId}
                          onChange={(e) => patch(task.id, { assignedTo: e.target.value || undefined, assignedStaffIds: e.target.value ? [e.target.value] : [] })}
                          className="flex-1 min-w-0 text-[10px] font-bold bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded px-1 py-1 text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-brand-accent focus:outline-none"
                        >
                          <option value="">Chưa gán</option>
                          {activeStaff.map(s => <option key={s.id} value={s.id}>{s.hoTen}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 min-w-0">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[7px] font-black uppercase shrink-0 ${getInitialsColor(assignee?.hoTen || '')}`}>
                          {getInitials(assignee?.hoTen || '?')}
                        </div>
                        <span className="text-[9px] font-bold truncate">{assignee ? assignee.hoTen.split(' ').slice(-1)[0] : 'Chưa gán'}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    <DateInput
                      value={parseDate(task.ngayBatDau) ? fmt(start) : ''}
                      disabled={!rowEdit}
                      onChange={(v) => patch(task.id, { ngayBatDau: v })}
                      className="w-full px-1.5 py-1 text-[10px] font-semibold bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 disabled:opacity-70 focus:ring-1 focus:ring-brand-accent focus:outline-none"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="number" min={1} value={days}
                      disabled={!rowEdit}
                      onChange={(e) => patch(task.id, { soNgay: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-11 px-1 py-1 text-[10px] font-black text-center bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200 disabled:opacity-70 focus:ring-1 focus:ring-brand-accent focus:outline-none"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <span className="text-[10px] font-black text-brand-accent dark:text-brand-accent-300">{task.staffProgress ?? (task.isCompleted ? 100 : 0)}%</span>
                  </td>
                  {isBOOD && (
                    <td className="p-2 text-center">
                      <input
                        type="number" min={0} max={100} value={task.managerProgress ?? (task.isCompleted ? 100 : 0)}
                        onChange={(e) => patch(task.id, { managerProgress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                        className="w-11 px-1 py-1 text-[10px] font-black text-center bg-brand-warning/10 dark:bg-brand-warning/10 border border-brand-warning/25 dark:border-brand-warning/40 rounded text-brand-warning dark:text-brand-warning focus:ring-1 focus:ring-brand-warning focus:outline-none"
                        title="Trưởng phòng duyệt (30% trọng số)"
                      />
                    </td>
                  )}
                  <td className="p-2">
                    <div className="relative h-5 bg-slate-100/70 dark:bg-dark-elevated/40 rounded-md overflow-hidden">
                      <div
                        className={`absolute top-0.5 bottom-0.5 ${barColor} rounded shadow-sm flex items-center justify-between px-1`}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        title={`${String(start.getDate()).padStart(2, '0')}-${String(start.getMonth() + 1).padStart(2, '0')}-${start.getFullYear()} · ${days} ngày · ${progress}%`}
                      >
                        <span className="text-[8px] font-black text-white/90 truncate">{widthPct >= 18 ? `${shortDate(start)} · ${days}d` : `${days}d`}</span>
                        <span className="text-[8px] font-black text-white/90 truncate">{progress}%</span>
                      </div>
                    </div>
                  </td>
                  {rowEdit && (
                    <td className="p-2 text-center">
                      <button type="button" onClick={() => remove(task.id)} className="text-slate-300 hover:text-brand-danger transition-colors" title="Xóa việc con">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {!hideFooter && (
      <div className="px-3 py-1.5 bg-slate-50/60 dark:bg-dark-bg/40 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[9px] text-slate-400 font-medium">
          Tiến độ mỗi việc = Bộ phận thực hiện <b className="text-brand-accent">70%</b> + Trưởng phòng duyệt <b className="text-brand-warning">30%</b> (mặc định). Việc chưa đặt ngày tự xếp nối tiếp từ mốc bắt đầu dự án.
        </span>
        {rows.length > 0 && (
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              totalWeight === 100
                ? 'bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/10 dark:text-brand-primary-300'
                : 'bg-brand-danger/10 text-brand-danger dark:bg-brand-danger/10 dark:text-brand-danger'
            }`} title={totalWeight === 100 ? 'Tỉ trọng đã đủ 100%' : 'Tổng tỉ trọng việc con của vòng này phải đủ 100% mới lưu được hồ sơ'}>
              Σ Tỉ trọng{soVong > 1 ? ` vòng ${vongHienTai}` : ''}: {totalWeight}%
              {totalWeight === 100 ? ' ✓' : totalWeight < 100 ? ` — thiếu ${100 - totalWeight}%` : ` — vượt ${totalWeight - 100}%`}
            </span>
            {/* Tự chia % đóng góp: giữ nguyên việc Quản lý đã gõ, chia đều phần thiếu cho việc để trống */}
            {canEdit && totalWeight !== 100 && (
              <button
                type="button"
                onClick={chiaDeuTiTrong}
                className="text-[10px] font-black px-2 py-0.5 rounded-full bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300 border border-brand-accent/30 hover:bg-brand-accent/20 transition-colors cursor-pointer whitespace-nowrap"
                title="Chia đều phần % còn thiếu cho các việc chưa đặt tỉ trọng (việc đã đặt giữ nguyên)"
              >
                ⚖ Tự chia đủ 100%
              </button>
            )}
            {/* Lũy kế mọi vòng: 2 lần báo giá đủ chuẩn = 200% */}
            {soVong > 1 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-brand-warning/10 text-brand-warning" title={`Hồ sơ đã qua ${soVong} vòng — mỗi vòng 100%`}>
                Lũy kế {soVong} vòng: {luyKeWeight}/{soVong * 100}%
              </span>
            )}
          </span>
        )}
      </div>
      )}
    </div>
  );
}
