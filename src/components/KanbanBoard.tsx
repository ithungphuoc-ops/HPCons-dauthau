import { useState, useMemo } from 'react';
import { Project, Staff } from '../types';
import { getInitials, getInitialsColor } from '../App';
import { ChevronLeft, ChevronRight, Lock, LayoutGrid, Calendar } from 'lucide-react';
import DateInput from './DateInput';

// 7 bước quy trình thầu trên bảng Kanban.
// Bước 1-2: Level 1 (Trưởng phòng) + Level 2 (Quản lý) đều được thao tác (bộ phận thực hiện).
// Từ bước 3 (Duyệt giá cấp phòng) trở đi: chỉ Level 1 (Trưởng phòng) được chuyển thẻ.
// Bước 6 (Trúng thầu) và 7 (Rớt thầu) là hai trạng thái kết thúc SONG SONG — đều đi ra từ bước 5 (gửi CĐT).
export const KANBAN_STEPS = [
  { id: 1, title: 'Tiếp nhận & Khai báo gói thầu', color: 'border-brand-muted', badge: 'bg-brand-muted/15 text-slate-600 dark:text-slate-300' },
  { id: 2, title: 'Triển khai hồ sơ thầu (TC-TM-KT)', color: 'border-brand-accent-400', badge: 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300' },
  { id: 3, title: 'Duyệt hồ sơ thầu cấp phòng', color: 'border-brand-accent-600', badge: 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300' },
  { id: 4, title: 'Hồ sơ trình BLĐ / Giám đốc', color: 'border-brand-warning', badge: 'bg-brand-warning/10 text-brand-warning' },
  { id: 5, title: 'Hồ sơ đã gửi CĐT', color: 'border-brand-accent', badge: 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300' },
  { id: 6, title: 'Trúng thầu', color: 'border-brand-success', badge: 'bg-brand-success/10 text-brand-success' },
  { id: 7, title: 'Rớt thầu', color: 'border-brand-danger', badge: 'bg-brand-danger/10 text-brand-danger' },
];

// Từ bước này trở đi chỉ Trưởng phòng (Level 1) thao tác — bước 3 Duyệt giá cấp phòng
export const KANBAN_L1_ONLY_FROM = 3;

// Chuyển bước có hợp lệ không (bước 6 & 7 song song, cùng ra/vào từ bước 5 gửi CĐT)
export const isValidKanbanTransition = (from: number, to: number): boolean => {
  if (from === to) return false;
  if (from >= 1 && from <= 4 && to === from + 1) return true; // tiến tuyến tính 1→...→5
  if (from >= 2 && from <= 5 && to === from - 1) return true; // lùi tuyến tính
  if (from === 5 && (to === 6 || to === 7)) return true;      // rẽ nhánh: gửi CĐT → trúng / rớt
  if ((from === 6 || from === 7) && to === 5) return true;    // quay lại từ trạng thái kết thúc
  return false;
};

// Suy ra bước Kanban mặc định cho hồ sơ chưa từng được xếp cột
export const deriveKanbanStep = (p: Project): number => {
  if (p.kanbanStep && p.kanbanStep >= 1 && p.kanbanStep <= 7) return p.kanbanStep;
  if (p.tinhTrangDuAn === 'Đã trúng thầu') return 6;
  if (p.tinhTrangDuAn === 'Rớt thầu') return 7;
  if (p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN') return 5;
  if (p.tienDoBoPhan > 0) return 2;
  return 1;
};

interface KanbanBoardProps {
  projects: Project[];
  staff: Staff[];
  parentNameById?: Record<string, string>;
  currentUserRole?: 'BOOD' | 'MANAGER' | 'STAFF';
  onMove: (projectId: string, fromStep: number, toStep: number) => void;
  onDenied: (message: string) => void;
  onOpenProject: (projectId: string) => void;
  /** Kéo hồ sơ VỀ BƯỚC 1 — mở hộp hỏi "có ảnh hưởng hạn nộp không?" (không chuyển ngay). */
  onPullBackToStart: (projectId: string, fromStep: number) => void;
}

export default function KanbanBoard({ projects, staff, parentNameById = {}, currentUserRole, onMove, onDenied, onOpenProject, onPullBackToStart }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStep, setDragOverStep] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('ALL');

  // Năm của hồ sơ: ưu tiên tiền tố mã dự án (YYYY.NN), thiếu thì lấy năm của ngày bắt đầu
  const projectYear = (p: Project): string => {
    const fromId = (p.projectId || '').match(/^(\d{4})/)?.[1];
    if (fromId) return fromId;
    const d = new Date(p.ngayBatDau);
    return isNaN(d.getTime()) ? '' : String(d.getFullYear());
  };
  const years = useMemo(
    () => [...new Set(projects.map(projectYear).filter(Boolean))].sort().reverse(),
    [projects]
  );

  // Lọc hồ sơ theo NĂM + khoảng ngày (từ - đến) để bảng không bị "ngộp" khi có hàng trăm dự án
  const filteredProjects = useMemo(() => {
    const byYear = yearFilter === 'ALL' ? projects : projects.filter(p => projectYear(p) === yearFilter);
    if (!fromDate && !toDate) return byYear;
    const from = fromDate ? new Date(fromDate).getTime() : -Infinity;
    const to = toDate ? new Date(toDate).getTime() : Infinity;
    return byYear.filter(p => {
      const s = new Date(p.ngayBatDau).getTime();
      const e = new Date(p.ngayHoanThanhThucTe || p.ngayHoanThanhDuKienHienTai || p.ngayHoanThanhDuKienGoc).getTime();
      return s <= to && e >= from; // lịch dự án giao với khoảng lọc
    });
  }, [projects, fromDate, toDate, yearFilter]);

  const canMove = (fromStep: number, toStep: number): boolean => {
    if (currentUserRole === 'BOOD') return true;
    if (currentUserRole !== 'MANAGER') return false;
    // Level 2 (Quản lý/bộ phận): thao tác trong bước 1-2 và được ĐẨY LÊN đến bước 3 (Duyệt giá cấp phòng)
    // để báo Trưởng phòng. Từ bước 3 trở đi do Trưởng phòng kiểm tra & chuyển tiếp.
    return fromStep <= 2 && toStep <= KANBAN_L1_ONLY_FROM;
  };

  const tryMove = (p: Project, toStep: number) => {
    const fromStep = deriveKanbanStep(p);
    if (toStep < 1 || toStep > 7 || toStep === fromStep) return;
    // KÉO VỀ BƯỚC 1 (từ bất kỳ bước nào): không chuyển ngay — mở hộp hỏi ảnh hưởng hạn nộp.
    // Quyền: L1 (BOOD) luôn được; L2 (Quản lý) chỉ khi hồ sơ CÒN ở bước 1-2. Bước 3+ chỉ L1 kéo.
    if (toStep === 1 && fromStep > 1) {
      if (currentUserRole === 'BOOD' || (currentUserRole === 'MANAGER' && fromStep <= 2)) {
        onPullBackToStart(p.id, fromStep);
      } else {
        onDenied('Hồ sơ đã lên từ bước 3 — chỉ Trưởng phòng (Level 1) được kéo về Bước 1. Quản lý chỉ kéo về Bước 1 khi hồ sơ còn ở bước 1-2.');
      }
      return;
    }
    if (!isValidKanbanTransition(fromStep, toStep)) {
      onDenied('Bước chuyển không hợp lệ! (Bước 6 Trúng thầu và 7 Rớt thầu là hai nhánh song song, đều đi ra từ bước 5 Gửi CĐT — không chuyển trực tiếp giữa hai bước này.)');
      return;
    }
    if (!canMove(fromStep, toStep)) {
      onDenied(`Quản lý (Level 2) chỉ được đẩy thẻ lên tối đa bước ${KANBAN_L1_ONLY_FROM} (Duyệt giá cấp phòng) để báo Trưởng phòng. Từ bước ${KANBAN_L1_ONLY_FROM} trở đi do Trưởng phòng thao tác!`);
      return;
    }
    onMove(p.id, fromStep, toStep);
  };

  return (
    <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div className="min-w-0">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <LayoutGrid className="text-brand-accent dark:text-brand-accent-300 w-4 h-4" />
            BẢNG KANBAN QUY TRÌNH THẦU (7 BƯỚC)
          </h3>
          <p className="text-[0.72rem] text-slate-500 dark:text-slate-400 mt-0.5">
            Bước 1-2: Trưởng phòng &amp; Quản lý; Quản lý đẩy được tối đa đến bước {KANBAN_L1_ONLY_FROM} (Duyệt giá cấp phòng) để báo Trưởng phòng, từ đó Trưởng phòng thao tác. Bước 5 rẽ nhánh <b className="text-brand-success">Trúng</b> / <b className="text-brand-danger">Rớt</b>; tình trạng tự cập nhật theo cột.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full xl:w-auto">
          {/* Lọc nhanh theo NĂM (lấy từ mã dự án YYYY.NN) */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="text-[0.72rem] font-black bg-slate-50 dark:bg-dark-bg/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-accent cursor-pointer"
            title="Lọc hồ sơ trên Kanban theo năm"
          >
            <option value="ALL">Tất cả năm</option>
            {years.map(y => <option key={y} value={y}>Năm {y}</option>)}
          </select>
          {/* Mobile: dòng lọc thời gian xuống hàng riêng bên dưới (chị chốt 14/07) */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-dark-bg/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 w-full sm:w-auto order-last sm:order-none">
            <Calendar className="w-3.5 h-3.5 text-brand-accent dark:text-brand-accent-300 shrink-0" />
            <DateInput
              value={fromDate}
              onChange={setFromDate}
              className="text-[0.78rem] font-semibold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none w-24"
              title="Từ ngày"
            />
            <span className="text-slate-400 text-[0.78rem]">→</span>
            <DateInput
              value={toDate}
              onChange={setToDate}
              className="text-[0.78rem] font-semibold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none w-24"
              title="Đến ngày"
            />
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(''); setToDate(''); }} className="text-[0.72rem] font-bold text-brand-danger hover:opacity-75 px-1 shrink-0" title="Xóa lọc ngày">✕</button>
            )}
          </div>
          <span className="text-[0.72rem] bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300 font-black px-2 py-1 rounded-lg whitespace-nowrap">
            {filteredProjects.length} hồ sơ
          </span>
        </div>
      </div>

      {/* Mobile <768px: cột giữ bề rộng đọc được + vuốt ngang xem tiến trình (chị chốt 14/07); md+ giữ lưới 7 cột */}
      <div className="flex overflow-x-auto md:grid md:grid-cols-7 md:overflow-x-visible gap-1 pb-1">
        {KANBAN_STEPS.map(col => {
          const colProjects = filteredProjects.filter(p => deriveKanbanStep(p) === col.id);
          const isL1Zone = col.id >= KANBAN_L1_ONLY_FROM;
          const isDragOver = dragOverStep === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverStep(col.id); }}
              onDragLeave={() => setDragOverStep(prev => (prev === col.id ? null : prev))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStep(null);
                const projId = e.dataTransfer.getData('text/kanban-project');
                const p = filteredProjects.find(x => x.id === projId);
                if (p) tryMove(p, col.id);
                setDraggingId(null);
              }}
              className={`w-40 shrink-0 md:w-auto md:min-w-0 rounded-lg border-t-[3px] ${col.color} bg-slate-50/70 dark:bg-dark-bg/40 border border-slate-200/60 dark:border-slate-800 flex flex-col transition-colors ${
                isDragOver ? 'ring-2 ring-brand-accent bg-brand-accent/10' : ''
              }`}
            >
              <div className="p-1.5 border-b border-slate-200/60 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[0.66rem] font-black px-1.5 py-0.5 rounded uppercase ${col.badge}`}>Bước {col.id}</span>
                  <div className="flex items-center gap-1">
                    {isL1Zone && (
                      <span title="Chỉ Trưởng phòng (Level 1) được thao tác" className="text-brand-warning">
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                    <span className="text-[0.66rem] font-black text-slate-400 bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-800 rounded-full px-1.5">
                      {colProjects.length}
                    </span>
                  </div>
                </div>
                <h4 className="text-[0.72rem] font-black text-slate-700 dark:text-slate-200 uppercase leading-tight">{col.title}</h4>
              </div>

              <div className="p-1 space-y-1.5 min-h-[120px] flex-1">
                {colProjects.length === 0 && (
                  <div className="text-center text-[0.62rem] text-slate-300 dark:text-slate-700 italic py-6 select-none">— Trống —</div>
                )}
                {colProjects.map(p => {
                  const step = deriveKanbanStep(p);
                  const implementer = staff.find(s => s.id === p.thucHienId);
                  const parentName = (p.duAnChaId && parentNameById[p.duAnChaId]) || p.tenDuAn;
                  // Bước lùi: 6/7 → 5, còn lại → step-1
                  const backStep = (step === 6 || step === 7) ? 5 : step - 1;
                  const backAllowed = isValidKanbanTransition(step, backStep) && canMove(step, backStep);
                  const nextAllowed = step <= 4 && canMove(step, step + 1);
                  const isBranchStep = step === 5; // rẽ nhánh Trúng / Rớt
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/kanban-project', p.id);
                        setDraggingId(p.id);
                      }}
                      onDragEnd={() => { setDraggingId(null); setDragOverStep(null); }}
                      className={`bg-white dark:bg-dark-card border border-slate-200/70 dark:border-slate-800 rounded-md p-1.5 space-y-1 shadow-2xs cursor-grab active:cursor-grabbing hover:border-brand-accent-300 dark:hover:border-brand-accent-700 transition-all ${
                        draggingId === p.id ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[0.58rem] font-black font-mono bg-slate-100 dark:bg-dark-elevated text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded truncate">
                          {p.projectId}
                        </span>
                        <span className={`text-[0.58rem] font-black px-1 py-0.5 rounded-full shrink-0 ${
                          p.trangThai === 'TRE_TIEN_DO'
                            ? 'bg-brand-danger/10 text-brand-danger'
                            : 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300'
                        }`}>
                          {p.tienDoBoPhan}%
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenProject(p.id)}
                        className="block w-full text-left cursor-pointer group/card"
                        title={`Dự án: ${parentName}\nCông việc: ${p.hangMuc}`}
                      >
                        <div className="text-[0.66rem] font-black text-slate-800 dark:text-slate-200 leading-tight line-clamp-2 group-hover/card:text-brand-accent dark:group-hover/card:text-brand-accent-300 transition-colors flex items-start gap-0.5">
                          <span className="shrink-0">📁</span>
                          <span>{parentName}</span>
                        </div>
                        <span className="inline-block mt-1 text-[0.58rem] font-black uppercase tracking-wide bg-slate-100 dark:bg-dark-elevated text-slate-500 dark:text-slate-400 px-1 py-0.5 rounded leading-none">
                          {p.hangMuc}
                        </span>
                      </button>
                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center text-[0.58rem] font-black uppercase shrink-0 ${getInitialsColor(implementer?.hoTen || '')}`}
                          title={implementer ? `${implementer.hoTen}${implementer.daNghi ? ' (đã nghỉ)' : ''}` : 'Chưa gán'}
                        >
                          {getInitials(implementer?.hoTen || '')}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => tryMove(p, backStep)}
                            disabled={step <= 1}
                            className={`p-0.5 rounded transition-colors ${
                              step > 1 && backAllowed
                                ? 'text-slate-400 hover:text-brand-accent hover:bg-brand-accent/10 cursor-pointer'
                                : 'text-slate-200 dark:text-slate-700 cursor-not-allowed'
                            }`}
                            title={step <= 1 ? '' : backAllowed ? `Lùi về bước ${backStep}` : 'Chỉ Trưởng phòng được thao tác vùng này'}
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          {isBranchStep ? (
                            <>
                              <button
                                type="button"
                                onClick={() => tryMove(p, 6)}
                                className="w-4 h-4 flex items-center justify-center rounded text-[0.66rem] font-black bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors"
                                title="Đánh dấu Trúng thầu (bước 6)"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => tryMove(p, 7)}
                                className="w-4 h-4 flex items-center justify-center rounded text-[0.66rem] font-black bg-brand-danger/10 text-brand-danger hover:bg-brand-danger/20 transition-colors"
                                title="Đánh dấu Rớt thầu (bước 7)"
                              >
                                ✗
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => tryMove(p, step + 1)}
                              disabled={step > 4}
                              className={`p-0.5 rounded transition-colors ${
                                nextAllowed
                                  ? 'text-slate-400 hover:text-brand-accent hover:bg-brand-accent/10 cursor-pointer'
                                  : 'text-slate-200 dark:text-slate-700 cursor-not-allowed'
                              }`}
                              title={step > 4 ? '' : nextAllowed ? `Chuyển sang bước ${step + 1}` : 'Chỉ Trưởng phòng được thao tác vùng này'}
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
