import { useState, useMemo } from 'react';
import { Project, Staff } from '../types';
import { ChevronLeft, ChevronRight, Calendar, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { fmtDateVN } from '../utils/dateVN';
import DateInput from './DateInput';

interface GanttChartProps {
  projects: Project[];
  staff: Staff[];
  currentUserRole?: 'BOOD' | 'MANAGER' | 'STAFF';
}

export default function GanttChart({ projects: allProjects, staff, currentUserRole }: GanttChartProps) {
  const [scale, setScale] = useState<'day' | 'week'>('day');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Mặc định: chỉ hiện hồ sơ ĐANG CHẠY & ĐANG TRỄ (ẩn hồ sơ đã xong trong quá khứ).
  // Khi đặt khoảng ngày (từ / đến) thì hiện MỌI hồ sơ có lịch giao với khoảng đó — kể cả đã xong.
  const projects = useMemo(() => {
    const hasRange = !!(fromDate || toDate);
    if (!hasRange) {
      return allProjects.filter(p => p.trangThai === 'DANG_THUC_HIEN' || p.trangThai === 'TRE_TIEN_DO');
    }
    const from = fromDate ? new Date(fromDate).getTime() : -Infinity;
    const to = toDate ? new Date(toDate).getTime() : Infinity;
    return allProjects.filter(p => {
      const s = new Date(p.ngayBatDau).getTime();
      const e = new Date(p.ngayHoanThanhThucTe || p.ngayHoanThanhDuKienHienTai || p.ngayHoanThanhDuKienGoc).getTime();
      return s <= to && e >= from; // lịch dự án giao với khoảng lọc
    });
  }, [allProjects, fromDate, toDate]);

  // Find the overall date range of all projects
  const dateBounds = useMemo(() => {
    if (projects.length === 0) {
      return {
        start: new Date('2026-06-01'),
        end: new Date('2026-07-15'),
        totalDays: 45
      };
    }

    const startDates = projects.map(p => new Date(p.ngayBatDau));
    const endDates = projects.map(p => {
      const dates = [
        new Date(p.ngayHoanThanhDuKienGoc),
        new Date(p.ngayHoanThanhDuKienHienTai)
      ];
      if (p.ngayHoanThanhThucTe) {
        dates.push(new Date(p.ngayHoanThanhThucTe));
      }
      return new Date(Math.max(...dates.map(d => d.getTime())));
    });

    // Earliest start minus 2 days, latest end plus 5 days for buffer
    const minStart = new Date(Math.min(...startDates.map(d => d.getTime())));
    minStart.setDate(minStart.getDate() - 2);

    const maxEnd = new Date(Math.max(...endDates.map(d => d.getTime())));
    maxEnd.setDate(maxEnd.getDate() + 5);

    const diffTime = Math.abs(maxEnd.getTime() - minStart.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      start: minStart,
      end: maxEnd,
      totalDays: diffDays > 100 ? 100 : diffDays
    };
  }, [projects]);

  // Generate date array for headers
  const dateList = useMemo(() => {
    const list: Date[] = [];
    const curr = new Date(dateBounds.start);
    for (let i = 0; i < dateBounds.totalDays; i++) {
      list.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return list;
  }, [dateBounds]);

  // Format date labels helper
  const formatDateLabel = (date: Date) => {
    const d = date.getDate();
    const m = date.getMonth() + 1;
    return `${d}/${m}`;
  };

  const getDayName = (date: Date) => {
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[date.getDay()];
  };

  // Helper to calculate percentage positions
  const getPercentagePositions = (p: Project) => {
    const startOfAll = dateBounds.start.getTime();
    const totalDuration = dateBounds.totalDays * 24 * 60 * 60 * 1000;

    const projStart = new Date(p.ngayBatDau).getTime();
    const projEndGoc = new Date(p.ngayHoanThanhDuKienGoc).getTime();
    const projEndHienTai = new Date(p.ngayHoanThanhDuKienHienTai).getTime();

    const left = ((projStart - startOfAll) / totalDuration) * 100;
    
    // Width of original scheduled duration
    const widthGoc = ((projEndGoc - projStart) / totalDuration) * 100;

    // Width of current scheduled duration (includes offsets)
    const widthHienTai = ((projEndHienTai - projStart) / totalDuration) * 100;

    // Shift offset block (from Goc to HienTai)
    const shiftLeft = left + widthGoc;
    const shiftWidth = ((projEndHienTai - projEndGoc) / totalDuration) * 100;

    // Actual completion position if available
    let actualWidth = 0;
    if (p.ngayHoanThanhThucTe) {
      const actualEnd = new Date(p.ngayHoanThanhThucTe).getTime();
      actualWidth = ((actualEnd - projStart) / totalDuration) * 100;
    }

    return {
      left: Math.max(0, left),
      widthGoc: Math.max(1, widthGoc),
      widthHienTai: Math.max(1, widthHienTai),
      shiftLeft: Math.max(0, shiftLeft),
      shiftWidth: Math.max(0, shiftWidth),
      actualWidth: Math.max(0, actualWidth)
    };
  };

  const isCriticalPath = (p: Project) => {
    // Critical path in bidding: projects that are currently delayed and require immediate action to avoid missing bid deadline
    return p.trangThai === 'TRE_TIEN_DO';
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden" id="gantt-chart-container">
      {/* Gantt Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-dark-card/40">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-accent dark:text-brand-accent-300" />
            Biểu Đồ Gantt Tiến Độ Đường Găng (Critical Path)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Màu đỏ nhấp nháy viền <span className="inline-block w-2 h-2 rounded-full bg-brand-danger animate-pulse"></span> biểu thị <strong className="text-brand-danger uppercase">Đường Găng (Gói thầu đang bị trễ hạn nộp hồ sơ thầu)</strong>
          </p>
        </div>
        
        {/* Scale buttons + bộ lọc ngày */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white dark:bg-dark-bg/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-brand-accent dark:text-brand-accent-300 shrink-0" />
            <DateInput
              value={fromDate}
              onChange={setFromDate}
              className="text-[11px] font-semibold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none w-24"
              title="Từ ngày"
            />
            <span className="text-slate-400 text-[11px]">→</span>
            <DateInput
              value={toDate}
              onChange={setToDate}
              className="text-[11px] font-semibold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none w-24"
              title="Đến ngày"
            />
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="text-[10px] font-bold text-brand-danger hover:opacity-75 px-1 shrink-0"
                title="Xóa lọc ngày (về mặc định: đang chạy & trễ)"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex bg-slate-100 dark:bg-dark-elevated p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setScale('day')}
              className={`px-3 py-1.5 rounded-md transition-all ${scale === 'day' ? 'bg-white dark:bg-dark-card text-brand-accent dark:text-brand-accent-300 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Xem theo Ngày
            </button>
            <button
              onClick={() => setScale('week')}
              className={`px-3 py-1.5 rounded-md transition-all ${scale === 'week' ? 'bg-white dark:bg-dark-card text-brand-accent dark:text-brand-accent-300 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Xem theo Tuần
            </button>
          </div>
        </div>
      </div>

      {/* Trạng thái bộ lọc */}
      <div className="px-5 py-1.5 bg-brand-accent/10 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400">
        {(fromDate || toDate)
          ? <>Đang lọc theo khoảng ngày{fromDate ? ` từ ${fmtDateVN(fromDate)}` : ''}{toDate ? ` đến ${fmtDateVN(toDate)}` : ''} — hiện mọi hồ sơ (kể cả đã hoàn thành).</>
          : <>Mặc định chỉ hiện hồ sơ <span className="text-brand-accent dark:text-brand-accent-300">đang chạy &amp; đang trễ</span>. Chọn khoảng ngày để xem cả hồ sơ đã hoàn thành trong quá khứ.</>}
      </div>

      {/* Legends info */}
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 text-[11px] bg-white dark:bg-dark-card text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 bg-brand-success rounded border border-brand-success-600"></div>
          <span>Đã hoàn thành (Xanh lá)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 bg-brand-accent rounded border border-brand-accent-600"></div>
          <span>Đang thực hiện (Xanh dương)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 bg-brand-warning rounded border border-brand-warning animate-pulse"></div>
          <span>Cận hạn thầu &lt;= 5 ngày (Cam)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 bg-brand-danger rounded border border-brand-danger"></div>
          <span>Quá hạn thầu (Đỏ)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-1.5 bg-brand-success rounded"></div>
          <span>Phòng duyệt (% Dept)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-danger/10 text-brand-danger border border-brand-danger/25">
            ĐƯỜNG GĂNG
          </span>
          <span>Cần đặc biệt kiểm soát sát sao</span>
        </div>
      </div>

      {/* Gantt Main Area with scrolling — khung cuộn riêng (cả dọc + ngang) để GHIM thanh ngày
          giờ ở trên (sticky top) và cột thông tin dự án bên trái (sticky left) khi trượt. */}
      <div className="overflow-auto max-h-[calc(100dvh-16rem)]">
        <div className="min-w-[1000px] flex flex-col">
          {/* Gantt Timeline Header Grid — GHIM trên đỉnh khi cuộn dọc */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-dark-surface sticky top-0 z-40">
            {/* Left side labels padding — góc trên-trái, ghim cả 2 chiều */}
            <div className="w-40 sm:w-72 flex-shrink-0 p-3 text-xs font-bold text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 sticky left-0 bg-slate-50 dark:bg-dark-surface z-50 shadow-xs">
              Danh mục gói thầu thầu ({projects.length} gói thầu)
            </div>
            
            {/* Timeline header right side */}
            <div className="flex-1 relative flex">
              {scale === 'day' ? (
                dateList.map((date, idx) => {
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <div 
                      key={idx} 
                      style={{ width: `${100 / dateBounds.totalDays}%` }}
                      className={`text-center py-2 text-[10px] flex-shrink-0 border-r border-slate-100/50 flex flex-col justify-center ${isWeekend ? 'bg-brand-warning/10 text-brand-warning font-semibold' : 'text-slate-500'}`}
                    >
                      <span className="scale-90">{getDayName(date)}</span>
                      <span className="font-semibold text-slate-700">{formatDateLabel(date)}</span>
                    </div>
                  );
                })
              ) : (
                // Weekly scale
                Array.from({ length: Math.ceil(dateBounds.totalDays / 7) }).map((_, idx) => {
                  const weekStart = new Date(dateBounds.start);
                  weekStart.setDate(weekStart.getDate() + idx * 7);
                  return (
                    <div 
                      key={idx} 
                      style={{ width: `${100 / (dateBounds.totalDays / 7)}%` }}
                      className="text-center py-3 text-xs text-slate-500 border-r border-slate-100 flex-shrink-0 font-medium"
                    >
                      Tuần {idx + 1} ({formatDateLabel(weekStart)})
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Gantt Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {projects.map((p) => {
              const { left, widthGoc, widthHienTai, shiftLeft, shiftWidth, actualWidth } = getPercentagePositions(p);
              const isCrit = isCriticalPath(p);
              const manager = staff.find(s => s.id === p.quanLyId);
              const implementerNames = staff.filter(s => p.thucHienIds?.includes(s.id)).map(s => s.hoTen.split(' ').pop()).join(', ') || 'Chưa gán';
              const fullImplementerNames = staff.filter(s => p.thucHienIds?.includes(s.id)).map(s => s.hoTen).join(', ') || 'Chưa gán';

              return (
                <div 
                  key={p.id} 
                  className={`flex items-stretch hover:bg-slate-50/50 dark:hover:bg-dark-card/10 transition-colors ${isCrit ? 'bg-brand-danger/5' : ''}`}
                >
                  {/* Left Column: Project Details */}
                  <div className={`w-40 sm:w-72 flex-shrink-0 p-3 sm:p-4 border-r border-slate-100 dark:border-slate-800 flex flex-col justify-between sticky left-0 bg-white dark:bg-dark-card z-30 shadow-xs ${isCrit ? 'border-l-4 border-l-brand-danger' : ''}`}>
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                          Mã: {p.projectId} • {p.hangMuc}
                        </span>
                        {isCrit && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-brand-danger/10 text-brand-danger border border-brand-danger/25 animate-pulse">
                            <ShieldAlert className="w-2.5 h-2.5" />
                            ĐƯỜNG GĂNG
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 mt-1" title={p.tenDuAn}>
                        {p.tenDuAn}
                      </h4>
                    </div>

                    {/* Staff assigned & Progress levels */}
                    <div className="mt-3 pt-3 border-t border-slate-100/75 dark:border-slate-800 flex flex-col gap-1.5">
                      {/* Quản lý / Thực hiện: ẩn ở mobile (cột hẹp 1/3) — chỉ hiện từ sm trở lên */}
                      <div className="hidden sm:flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span>Quản lý: <strong className="dark:text-slate-300">{manager?.hoTen || 'N/A'}</strong>{(p.quanLyIdsPhu || []).length > 0 && <span className="text-brand-primary dark:text-brand-primary-300 font-bold"> +{(p.quanLyIdsPhu || []).length}</span>}</span>
                        <span>Thực hiện: <strong className="dark:text-slate-300" title={fullImplementerNames}>{implementerNames}</strong></span>
                      </div>
                      
                      {/* Hierarchical progress values */}
                      <div className="flex gap-2">
                        <div className="flex-1 bg-slate-100 dark:bg-dark-elevated rounded p-1 text-[10px]">
                          <span className="text-slate-400 block text-[8px] uppercase font-bold">Bộ phận (Team)</span>
                          <strong className="text-brand-accent dark:text-brand-accent-300 text-xs">{p.tienDoBoPhan}%</strong>
                        </div>
                        <div className="flex-1 bg-slate-100 dark:bg-dark-elevated rounded p-1 text-[10px]">
                          <span className="text-slate-400 block text-[8px] uppercase font-bold">Phòng (Dept)</span>
                          <strong className="text-brand-success text-xs">{p.tienDoPhong}%</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Interactive Gantt Timelines */}
                  <div className="flex-1 relative flex items-center bg-slate-50/10 py-5">
                    {/* Background grid lines */}
                    <div className="absolute inset-0 pointer-events-none flex">
                      {dateList.map((_, idx) => (
                        <div 
                          key={idx} 
                          style={{ width: `${100 / dateBounds.totalDays}%` }}
                          className="h-full border-r border-slate-100/50 flex-shrink-0"
                        />
                      ))}
                    </div>

                    {/* Bars Container */}
                    <div className="w-full relative h-14">
                      
                      {/* 1. Bar Gốc (Original Schedule Bar in light gray-blue) */}
                      <div 
                        style={{ left: `${left}%`, width: `${widthGoc}%` }}
                        className="absolute top-0 h-4 bg-slate-200/60 border border-slate-300 rounded text-[9px] text-slate-500 flex items-center px-1 overflow-hidden select-none whitespace-nowrap"
                        title={`Hạn gốc: ${fmtDateVN(p.ngayBatDau)} đến ${fmtDateVN(p.ngayHoanThanhDuKienGoc)}`}
                      >
                        Hạn gốc
                      </div>

                      {/* 2. Bar Dời (Offset shift block shown in amber) */}
                      {p.delayLogs.length > 0 && shiftWidth > 0 && (
                        <div 
                          style={{ left: `${shiftLeft}%`, width: `${shiftWidth}%` }}
                          className="absolute top-0 h-4 bg-brand-warning/15 border border-brand-warning/40 border-dashed rounded text-[9px] text-brand-warning flex items-center justify-center font-semibold overflow-hidden whitespace-nowrap"
                          title={`Dời hạn thêm ${p.delayLogs.reduce((acc, curr) => acc + curr.soNgayLech, 0)} ngày`}
                        >
                          +{p.delayLogs.reduce((acc, curr) => acc + curr.soNgayLech, 0)} ngày dời
                        </div>
                      )}

                      {/* 3. Bar Tiến độ hiện tại (Current Schedule and Progress filled) */}
                      {(() => {
                        const isNear = (() => {
                          if (p.trangThai !== 'DANG_THUC_HIEN') return false;
                          const today = new Date();
                          const deadline = new Date(p.ngayHoanThanhDuKienHienTai);
                          const diffTime = deadline.getTime() - today.getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          return diffDays >= 0 && diffDays <= 5; // within 5 days
                        })();

                        let borderClass = "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-dark-card";
                        let progressFillClass = "bg-brand-accent/20";
                        let textClass = "text-slate-700 dark:text-slate-200";

                        if (p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN') {
                          borderClass = "border-brand-success bg-brand-success/10";
                          progressFillClass = "bg-brand-success/25";
                          textClass = "text-brand-success-900 dark:text-brand-success-100 font-extrabold";
                        } else if (p.trangThai === 'TRE_TIEN_DO') {
                          borderClass = "border-brand-danger bg-brand-danger/10";
                          progressFillClass = "bg-brand-danger/25";
                          textClass = "text-brand-danger font-extrabold";
                        } else if (isNear) {
                          borderClass = "border-brand-warning bg-brand-warning/10";
                          progressFillClass = "bg-brand-warning/30";
                          textClass = "text-brand-warning font-extrabold";
                        } else {
                          borderClass = "border-brand-accent bg-brand-accent/10";
                          progressFillClass = "bg-brand-accent/20";
                          textClass = "text-brand-accent-950 dark:text-brand-accent-100 font-bold";
                        }

                        return (
                          <div 
                            style={{ left: `${left}%`, width: `${widthHienTai}%` }}
                            className={`absolute top-5 h-8 border rounded-lg overflow-hidden flex flex-col justify-center p-1 ${borderClass} ${isCrit ? 'ring-1 ring-brand-danger/30' : ''}`}
                          >
                            {/* Team Progress fill bar */}
                            <div 
                              style={{ width: `${p.tienDoBoPhan}%` }}
                              className={`absolute left-0 top-0 bottom-0 ${progressFillClass} transition-all`}
                            />

                            {/* Visual labels on Gantt bar */}
                            <div className="relative z-10 flex items-center justify-between px-1 text-[10px] font-semibold">
                              <span className={`truncate max-w-[150px] ${textClass}`}>{p.tenDuAn}</span>
                              <span className={textClass}>Hạn: {fmtDateVN(p.ngayHoanThanhDuKienHienTai)}</span>
                            </div>

                            {/* Hierarchical overlay line for Dept Level progress (Green line in the middle) */}
                            <div className="absolute bottom-1 left-1 right-1 h-1 bg-slate-200 dark:bg-dark-elevated rounded-full overflow-hidden">
                              <div
                                style={{ width: `${p.tienDoPhong}%` }}
                                className="h-full bg-brand-success transition-all"
                              />
                            </div>
                          </div>
                        );
                      })()}

                      {/* 4. Mốc Ngày Hoàn Thành Thực Tế (nếu có) */}
                      {p.ngayHoanThanhThucTe && (
                        <div 
                          style={{ left: `${actualWidth}%` }}
                          className="absolute top-1/2 -translate-y-1/2 -ml-2.5 z-20 flex flex-col items-center"
                        >
                          <div className="w-5 h-5 bg-white border-2 border-brand-success rounded-full flex items-center justify-center text-brand-success shadow-md" title={`Hoàn thành thực tế: ${fmtDateVN(p.ngayHoanThanhThucTe)}`}>
                            <CheckCircle2 className="w-4 h-4 fill-brand-success-50" />
                          </div>
                          <span className="text-[8px] bg-brand-success-600 text-white font-bold rounded px-1 py-0.5 mt-0.5 whitespace-nowrap">
                            Đóng hồ sơ
                          </span>
                        </div>
                      )}

                      {/* 5. Warning indicator for Overdue projects (without actual completion) */}
                      {p.trangThai === 'TRE_TIEN_DO' && (
                        <div 
                          style={{ left: `${widthHienTai + left}%` }}
                          className="absolute top-1/2 -translate-y-1/2 -ml-2 z-20 flex flex-col items-center animate-bounce"
                        >
                          <div className="w-5 h-5 bg-brand-warning text-white rounded-full flex items-center justify-center shadow-lg" title="TRỄ HẠN THẦU!">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                          <span className="text-[8px] bg-brand-danger text-white font-extrabold rounded px-1 py-0.5 mt-0.5 whitespace-nowrap uppercase">
                            QUÁ HẠN!
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
