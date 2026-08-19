import { useState, useMemo } from 'react';
import { Project, Staff } from '../types';
import { ChevronLeft, ChevronRight, Calendar, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { fmtDateVN, tongNgayDoiHan, mocHetNgay, namHienTaiVN } from '../utils/dateVN';
import DateInput from './DateInput';

interface GanttChartProps {
  projects: Project[];
  staff: Staff[];
  currentUserRole?: 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER';
}

export default function GanttChart({ projects: allProjects, staff, currentUserRole }: GanttChartProps) {
  const [scale, setScale] = useState<'day' | 'week'>('day');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // ===== LỌC NĂM + LỌC TRẠNG THÁI NGAY TRÊN GANTT (chị Trâm chốt 18/08/2026) =====
  // "thêm nút sort năm và thêm nút sort dự án đã xong / đang làm / tất cả như ngoài báo cáo tiến độ."
  // Trước đây Gantt CỨNG một luật: không đặt khoảng ngày thì chỉ hiện hồ sơ đang chạy & đang trễ,
  // muốn xem hồ sơ đã xong phải đi đặt khoảng ngày — không có cách chọn trực tiếp.
  const [namLoc, setNamLoc] = useState<string>(() => namHienTaiVN());
  const [locTrangThai, setLocTrangThai] = useState<'ACTIVE' | 'DONE' | 'ALL'>('ACTIVE');

  // Năm của một hồ sơ — CÙNG cách đọc với bảng Kanban: ưu tiên tiền tố mã dạng `YYYY.`, không có thì
  // lấy năm của ngày bắt đầu; chặn năm vô lý (mã kiểu YYMMNN từng sinh ra "Năm 2600" — góp ý #14).
  const namHopLe = (n: number) => n >= 2000 && n <= 2100;
  const namCuaHoSo = (p: Project): string => {
    const tuMa = (p.projectId || '').match(/^(\d{4})\./)?.[1];
    if (tuMa && namHopLe(Number(tuMa))) return tuMa;
    const d = new Date(p.ngayBatDau);
    if (isNaN(d.getTime())) return '';
    return namHopLe(d.getFullYear()) ? String(d.getFullYear()) : '';
  };
  const cacNam = useMemo(
    () => [...new Set([namHienTaiVN(), ...allProjects.map(namCuaHoSo).filter(Boolean)])].sort().reverse(),
    [allProjects],
  );

  // ĐÃ XONG tính theo ĐÚNG cách Gantt đang tô màu (xem xongPhanCuaPhong ở phần vẽ thanh):
  // Bộ phận và Phòng đều 100% là xong phần của Phòng — chị Trâm chốt "tính đến tiến độ TP kiểm tra
  // thôi", nên bộ lọc phải khớp với cái mắt nhìn thấy trên biểu đồ (thanh xanh lá = Đã xong).
  const daXong = (p: Project): boolean =>
    p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN' ||
    p.tinhTrangDuAn === 'Đã trúng thầu' || p.tinhTrangDuAn === 'Rớt thầu' ||
    ((p.tienDoBoPhan || 0) >= 100 && (p.tienDoPhong || 0) >= 100);

  // Danh sách sau khi lọc NĂM (dùng để đếm số trên 3 nút trạng thái cho khớp năm đang chọn)
  const theoNam = useMemo(
    () => (namLoc === 'ALL' ? allProjects : allProjects.filter(p => namCuaHoSo(p) === namLoc)),
    [allProjects, namLoc],
  );
  const demTrangThai = useMemo(() => {
    const xong = theoNam.filter(daXong).length;
    return { active: theoNam.length - xong, done: xong, all: theoNam.length };
  }, [theoNam]);

  const projects = useMemo(() => {
    let ds = locTrangThai === 'ALL'
      ? theoNam
      : theoNam.filter(p => (locTrangThai === 'DONE' ? daXong(p) : !daXong(p)));
    const hasRange = !!(fromDate || toDate);
    if (!hasRange) return ds;
    const from = fromDate ? new Date(fromDate).getTime() : -Infinity;
    const to = toDate ? new Date(toDate).getTime() : Infinity;
    ds = ds.filter(p => {
      const s = new Date(p.ngayBatDau).getTime();
      const e = new Date(p.ngayHoanThanhThucTe || p.ngayHoanThanhDuKienHienTai || p.ngayHoanThanhDuKienGoc).getTime();
      return s <= to && e >= from; // lịch dự án giao với khoảng lọc
    });
    return ds;
  }, [theoNam, locTrangThai, fromDate, toDate]);

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
    // ===== LƯỚI BẮT ĐẦU TỪ THỨ HAI (chị Trâm chốt 18/08/2026) =====
    // Trước đây cột "Tuần 1" bắt đầu từ ngày dự án sớm nhất nên rơi vào giữa tuần, và số tuần đếm
    // từ 1 theo biểu đồ chứ không theo lịch năm. Nay kéo mốc đầu về THỨ HAI của tuần đó để cột tuần
    // trùng tuần lịch, và số tuần lấy theo TUẦN TRONG NĂM (xem soTuanTrongNam).
    minStart.setDate(minStart.getDate() - ((minStart.getDay() + 6) % 7));

    const maxEnd = new Date(Math.max(...endDates.map(d => d.getTime())));
    maxEnd.setDate(maxEnd.getDate() + 5);

    const diffTime = Math.abs(maxEnd.getTime() - minStart.getTime());
    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    diffDays = Math.ceil(diffDays / 7) * 7;   // tròn tuần để cột tuần cuối không bị cụt

    return {
      start: minStart,
      end: maxEnd,
      totalDays: diffDays > 105 ? 105 : diffDays
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

  /**
   * Tuần thứ mấy TRONG NĂM (chuẩn ISO — tuần bắt đầu từ Thứ Hai), chị Trâm chốt 18/08/2026:
   * "Tuần 1 thì tính từ đầu năm, chứ không phải tính từ tuần có dự án bắt đầu của app".
   */
  const soTuanTrongNam = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Đưa về Thứ Năm của tuần đó — mốc quyết định tuần thuộc năm nào theo ISO 8601
    d.setUTCDate(d.getUTCDate() + 4 - ((d.getUTCDay() + 6) % 7 + 1));
    const dauNam = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - dauNam.getTime()) / 86400000) + 1) / 7);
  };

  // Helper to calculate percentage positions
  const getPercentagePositions = (p: Project) => {
    const startOfAll = dateBounds.start.getTime();
    const totalDuration = dateBounds.totalDays * 24 * 60 * 60 * 1000;

    // HẠN TÍNH TỚI HẾT NGÀY: mốc kết thúc là 00:00 ngày KẾ TIẾP, nếu không thanh sẽ dừng ở
    // đầu ngày hạn và bỏ trống chính ô ngày đó (chị Trâm báo 17/08/2026 — xem mocHetNgay).
    const projStart = new Date(p.ngayBatDau).getTime();
    const projEndGoc = mocHetNgay(p.ngayHoanThanhDuKienGoc);
    const projEndHienTai = mocHetNgay(p.ngayHoanThanhDuKienHienTai);

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
      const actualEnd = mocHetNgay(p.ngayHoanThanhThucTe); // cũng tính tới hết ngày
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
        </div>
        
        {/* Scale buttons + bộ lọc ngày */}
        <div className="flex flex-wrap items-center gap-3">
          {/* LỌC NĂM — cùng cách làm với bảng Kanban; năm hiện tại luôn có trong danh sách */}
          <select
            value={namLoc}
            onChange={(e) => setNamLoc(e.target.value)}
            title="Lọc hồ sơ trên biểu đồ theo năm"
            className="text-[0.72rem] font-black bg-white dark:bg-dark-bg/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-accent cursor-pointer"
          >
            <option value="ALL">Tất cả năm</option>
            {cacNam.map(n => <option key={n} value={n}>Năm {n}</option>)}
          </select>

          {/* LỌC TRẠNG THÁI — cùng bộ nút với tab Báo Cáo Tiến Độ (Đang làm / Đã xong / Tất cả) */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-dark-elevated/60 p-0.5 rounded-lg">
            {([['ACTIVE', 'Đang làm', demTrangThai.active], ['DONE', 'Đã xong', demTrangThai.done], ['ALL', 'Tất cả', demTrangThai.all]] as const).map(([k, nhan, n]) => (
              <button
                key={k}
                type="button"
                onClick={() => setLocTrangThai(k)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-black transition-colors whitespace-nowrap ${locTrangThai === k ? 'bg-white dark:bg-dark-card text-brand-accent dark:text-brand-accent-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                {nhan} ({n})
              </button>
            ))}
          </div>
          {/* Không đặt biểu tượng lịch trang trí trong ô lọc: mỗi DateInput đã có nút lịch riêng
              (góp ý #6) — thêm nữa là dòng lọc có 3 cuốn lịch (chị Trâm báo 17/08/2026). */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-dark-bg/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1">
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

      {/* Legends info */}
      <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 text-[11px] bg-white dark:bg-dark-card text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 bg-brand-success rounded border border-brand-success-600"></div>
          <span>Đã hoàn thành — Bộ phận &amp; Trưởng phòng đều 100% (Xanh lá)</span>
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
        {/* Chú giải phải nói đúng cách tô mới: 70% Bộ phận + 30% Phòng (chị Trâm 18/08/2026) */}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-3 w-10 rounded border border-slate-300 dark:border-slate-600 overflow-hidden">
            <span className="h-full bg-brand-accent/70" style={{ width: '70%' }} />
            <span className="h-full bg-brand-success/70" style={{ width: '30%' }} />
          </span>
          <span>Thanh chia <strong>70% Bộ phận</strong> + <strong>30% Phòng duyệt</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-1.5 bg-slate-500 dark:bg-slate-300 rounded"></div>
          <span>Tổng tiến độ (70/30)</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-500">
          <span>· Bộ lọc <strong>Đã xong</strong> = Bộ phận và Phòng đều 100% (đúng thanh xanh lá)</span>
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
                  // CHỈ TÔ CHỦ NHẬT (chị Trâm chốt 18/08/2026: "thứ 7 công ty vẫn làm").
                  const laChuNhat = date.getDay() === 0;
                  return (
                    <div
                      key={idx}
                      style={{ width: `${100 / dateBounds.totalDays}%` }}
                      className={`text-center py-2 text-[10px] flex-shrink-0 border-r border-slate-100/50 dark:border-slate-800 flex flex-col justify-center ${
                        laChuNhat ? 'bg-brand-warning/10' : ''
                      }`}
                    >
                      {/* Chữ phải ĐỌC RÕ (chị Trâm báo 18/08/2026: mờ quá) — bỏ màu xám nhạt,
                          dùng màu chữ chính và in đậm cho cả tên thứ lẫn ngày. */}
                      <span className={`font-black ${laChuNhat ? 'text-brand-warning' : 'text-slate-600 dark:text-slate-300'}`}>
                        {getDayName(date)}
                      </span>
                      <span className={`font-black ${laChuNhat ? 'text-brand-warning' : 'text-slate-700 dark:text-slate-100'}`}>
                        {formatDateLabel(date)}
                      </span>
                    </div>
                  );
                })
              ) : (
                // Weekly scale
                Array.from({ length: Math.ceil(dateBounds.totalDays / 7) }).map((_, idx) => {
                  const weekStart = new Date(dateBounds.start);
                  weekStart.setDate(weekStart.getDate() + idx * 7);
                  // Ngày CUỐI của tuần (không vượt quá phạm vi biểu đồ)
                  const weekEnd = new Date(weekStart);
                  weekEnd.setDate(weekEnd.getDate() + 6);
                  const gioiHan = new Date(dateBounds.start);
                  gioiHan.setDate(gioiHan.getDate() + dateBounds.totalDays - 1);
                  const cuoi = weekEnd > gioiHan ? gioiHan : weekEnd;
                  return (
                    <div
                      key={idx}
                      style={{ width: `${100 / (dateBounds.totalDays / 7)}%` }}
                      className="text-center py-2 border-r border-slate-100 dark:border-slate-800 flex-shrink-0 flex flex-col justify-center"
                    >
                      {/* Xem theo TUẦN vẫn phải thấy NGÀY THÁNG, và số tuần đếm THEO NĂM
                          (chị Trâm chốt 18/08/2026). Bên dưới là từng ô ngày của tuần đó. */}
                      <span className="text-xs font-black text-slate-700 dark:text-slate-100">
                        Tuần {soTuanTrongNam(weekStart)}
                      </span>
                      <span className="text-[10px] font-black text-slate-600 dark:text-slate-300">
                        {formatDateLabel(weekStart)} → {formatDateLabel(cuoi)}
                      </span>
                      <div className="flex mt-1 border-t border-slate-100 dark:border-slate-800 pt-1">
                        {Array.from({ length: 7 }).map((_, i) => {
                          const ngay = new Date(weekStart);
                          ngay.setDate(ngay.getDate() + i);
                          if (ngay > gioiHan) return <span key={i} className="flex-1" />;
                          const laChuNhat = ngay.getDay() === 0;   // T7 công ty vẫn làm
                          return (
                            <span
                              key={i}
                              title={`${getDayName(ngay)} ${formatDateLabel(ngay)}`}
                              className={`flex-1 text-[9px] font-black leading-tight ${
                                laChuNhat ? 'text-brand-warning' : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {ngay.getDate()}
                            </span>
                          );
                        })}
                      </div>
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
                      {/* HẠN ĐƯA SANG ĐÂY (chị Trâm chốt 17/08/2026) — trước nằm trên thanh Gantt, gói
                          thầu hạn ngắn là chữ biến mất. Ở cột trái thì lúc nào cũng đọc được. */}
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        <span className="text-slate-400 dark:text-slate-500">Hạn:</span>
                        <span className={
                          p.trangThai === 'TRE_TIEN_DO' ? 'text-brand-danger'
                            : (p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN'
                              || ((p.tienDoBoPhan || 0) >= 100 && (p.tienDoPhong || 0) >= 100)) ? 'text-brand-success'
                              : 'text-slate-700 dark:text-slate-200'
                        }>
                          {fmtDateVN(p.ngayHoanThanhDuKienHienTai)}
                        </span>
                        {p.hanHenCDT && (
                          <span className="text-brand-primary dark:text-brand-primary-300" title="Thời hạn đã hẹn với Chủ đầu tư">
                            · Hẹn CĐT: {fmtDateVN(p.hanHenCDT)}
                          </span>
                        )}
                      </div>

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
                          title={`Dời hạn thêm ${tongNgayDoiHan(p.delayLogs)} ngày`}
                        >
                          +{tongNgayDoiHan(p.delayLogs)} ngày dời
                        </div>
                      )}

                      {/* 3. Bar Tiến độ hiện tại (Current Schedule and Progress filled) */}
                      {(() => {
                        const isNear = (() => {
                          if (p.trangThai !== 'DANG_THUC_HIEN') return false;
                          // Hạn tính tới HẾT ngày — dùng mocHetNgay cho khớp với cách vẽ thanh ở
                          // getPercentagePositions, nếu không thì đúng NGÀY hết hạn lại bị coi là đã trễ.
                          const deadline = mocHetNgay(p.ngayHoanThanhDuKienHienTai);
                          if (isNaN(deadline)) return false;
                          const diffTime = deadline - Date.now();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          return diffDays >= 0 && diffDays <= 5; // còn tối đa 5 ngày
                        })();

                        let borderClass = "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-dark-card";
                        // Dải Bộ phận tô ĐẬM để đọc được trên nền tối (bản cũ /20 gần như không thấy —
                        // chị Trâm gọi là "đen thui", 18/08/2026).
                        let fillBoPhan = "bg-brand-accent/70";
                        let textClass = "text-slate-700 dark:text-slate-200";

                        // ===== GANTT CHỈ TÍNH TỚI TIẾN ĐỘ TP KIỂM TRA (chị Trâm chốt 18/08/2026) =====
                        // "từ bước 4 qua 5 là chuyện của BGĐ, ko còn liên quan đến phòng ban nữa em, nên
                        //  em tô biểu đồ gant tính đến tiến độ TP ktra thôi nhé."
                        // Nên với BIỂU ĐỒ GANTT: Bộ phận 100% + Phòng duyệt 100% = XONG phần của Phòng →
                        // tô xanh lá, không chờ tới lúc gửi CĐT (bước 5) nữa.
                        // ⚠ CỐ Ý KHÔNG đổi `trangThai` của hồ sơ: KPI đội ngũ, thống kê "đã xong" và cột
                        // "gói thầu đã có kết quả" của bảng ISO đều đọc theo `trangThai`; đổi ở đó sẽ đếm
                        // cả hồ sơ chưa gửi CĐT là xong, làm lệch báo cáo. Đây chỉ là CÁCH TÔ trên Gantt.
                        const xongPhanCuaPhong = (p.tienDoBoPhan || 0) >= 100 && (p.tienDoPhong || 0) >= 100;

                        if (p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN' || xongPhanCuaPhong) {
                          borderClass = "border-brand-success bg-brand-success/10";
                          fillBoPhan = "bg-brand-success/70";
                          textClass = "text-brand-success-900 dark:text-brand-success-100 font-extrabold";
                        } else if (p.trangThai === 'TRE_TIEN_DO') {
                          borderClass = "border-brand-danger bg-brand-danger/10";
                          fillBoPhan = "bg-brand-danger/70";
                          textClass = "text-brand-danger font-extrabold";
                        } else if (isNear) {
                          borderClass = "border-brand-warning bg-brand-warning/10";
                          fillBoPhan = "bg-brand-warning/75";
                          textClass = "text-brand-warning font-extrabold";
                        } else {
                          borderClass = "border-brand-accent bg-brand-accent/10";
                          fillBoPhan = "bg-brand-accent/70";
                          textClass = "text-brand-accent-950 dark:text-brand-accent-100 font-bold";
                        }

                        return (
                          <div 
                            style={{ left: `${left}%`, width: `${widthHienTai}%` }}
                            className={`absolute top-5 h-8 border rounded-lg overflow-hidden flex flex-col justify-center p-1 ${borderClass} ${isCrit ? 'ring-1 ring-brand-danger/30' : ''}`}
                            title={`${p.tenDuAn} · Hạn: ${fmtDateVN(p.ngayHoanThanhDuKienHienTai)} · Bộ phận ${p.tienDoBoPhan}% · Phòng ${p.tienDoPhong}%`}
                          >
                            {/* ===== TÔ ĐÚNG TỈ LỆ 70% BỘ PHẬN + 30% PHÒNG (chị Trâm báo 18/08/2026) =====
                                "sao bộ phận đc 100% rồi mà cái này còn đen thui chưa kẻ 70% như c phân bổ,
                                 bộ phận 70% - phòng 30%".
                                BẢN CŨ SAI 2 CHỖ: (a) tô theo `tienDoBoPhan` chiếm HẾT bề rộng thanh nên
                                Bộ phận 100% mà Phòng chưa duyệt vẫn nhìn như xong cả gói, không thấy phần
                                70/30 nào; (b) màu chỉ 20% độ đậm nên trên nền tối gần như không thấy.
                                NAY tô đúng công thức app vẫn dùng để tính tiến độ:
                                  · dải 1 = Bộ phận, tối đa 70% bề rộng (Bộ phận 100% → tô 70%);
                                  · dải 2 = Phòng, bắt đầu từ mốc 70%, tối đa 30% còn lại;
                                  · vạch mờ ở mốc 70% cho thấy ranh giới hai phần. */}
                            <div
                              style={{ width: `${Math.max(0, Math.min(100, p.tienDoBoPhan || 0)) * 0.7}%` }}
                              className={`absolute left-0 top-0 bottom-0 ${fillBoPhan} transition-all`}
                              title={`Bộ phận thực hiện ${p.tienDoBoPhan || 0}% (chiếm 70% tiến độ)`}
                            />
                            <div
                              style={{ left: '70%', width: `${Math.max(0, Math.min(100, p.tienDoPhong || 0)) * 0.3}%` }}
                              className="absolute top-0 bottom-0 bg-brand-success/70 transition-all"
                              title={`Trưởng phòng duyệt ${p.tienDoPhong || 0}% (chiếm 30% tiến độ)`}
                            />
                            <div className="absolute top-0 bottom-0 w-px bg-slate-400/50 dark:bg-slate-300/30" style={{ left: '70%' }} />

                            {/* KHÔNG ĐẶT CHỮ TRÊN THANH (chị Trâm chốt 17/08/2026): gói thầu chỉ 1 ngày
                                hoặc hạn ngắn thì thanh hẹp, chữ bị cắt mất hoặc chồng lên nhau, nhìn rất
                                khó. Tên dự án và HẠN đã hiện ở cột trái; thanh chỉ còn 2 dải màu
                                (Bộ phận + Phòng) cho dễ đọc. Rê chuột vào thanh vẫn xem được chi tiết. */}

                            {/* Dải mỏng dưới đáy = TỔNG tiến độ (Bộ phận×70% + Phòng×30%) — đúng con số
                                app dùng để tính, đọc nhanh cả gói đi tới đâu. */}
                            <div className="absolute bottom-0.5 left-1 right-1 h-1 bg-slate-200/70 dark:bg-dark-elevated rounded-full overflow-hidden">
                              <div
                                style={{ width: `${(p.tienDoBoPhan || 0) * 0.7 + (p.tienDoPhong || 0) * 0.3}%` }}
                                className="h-full bg-slate-500 dark:bg-slate-300 transition-all"
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
