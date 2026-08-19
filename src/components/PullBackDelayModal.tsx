import { useState, useMemo } from 'react';
import { Project, ProjectTask, Staff } from '../types';
import { fmtDateVN } from '../utils/dateVN';
import { Clock, Info, X, AlertTriangle } from 'lucide-react';
import SubtaskGantt, { DEFAULT_TASK_DAYS } from './SubtaskGantt';
import { TenViecConThuongDung } from '../utils/thuVienViecCon';
import { AutoGrowTextarea } from './ui';
import { weightIssue } from '../utils/taskTree';

const DAY = 24 * 60 * 60 * 1000;

interface PullBackDelayModalProps {
  project: Project;
  /** Danh sách nhân sự — để bảng phân rã đổi người thực hiện việc con. */
  staff: Staff[];
  /** L1 (BOOD) tự áp dụng ngay; L2 (MANAGER) gửi yêu cầu → chờ TP duyệt lại tiến độ Phòng. */
  isBOOD: boolean;
  /**
   * false = CHỈ PHÂN BỔ LẠI, GIỮ NGUYÊN HẠN NỘP (chị Trâm chốt 29/07/2026).
   * Có thật tình huống việc con đổi mà hạn không đổi: giữa chừng có người mới tham gia nên phải
   * chia lại tỉ trọng, hoặc thêm một việc chạy song song trong khoảng ngày cũ. Trước đây bảng này
   * bắt buộc "số ngày dời > 0" mới bấm được nút, nên mấy ca đó KẸT CỨNG — Quản lý sửa xong không
   * lưu được, mất luôn bằng chứng phân công.
   */
  doiTienDo: boolean;
  /** Thư viện tên việc con (đếm từ mọi hồ sơ) — gợi ý ở thanh "Thêm việc con" (góp ý #62). */
  thuVienTenViecCon?: TenViecConThuongDung[];
  onCancel: () => void;
  /** Áp dụng: danh sách việc con đã chỉnh, số ngày dời THỰC (0 khi giữ nguyên hạn), lý do. */
  onApply: (tasks: ProjectTask[], delayDays: number, reason: string) => void;
}

const taskDays = (t: ProjectTask) => (t.soNgay && t.soNgay > 0 ? t.soNgay : DEFAULT_TASK_DAYS);

export default function PullBackDelayModal({ project, staff, isBOOD, doiTienDo, thuVienTenViecCon = [], onCancel, onApply }: PullBackDelayModalProps) {
  // Quản lý chỉnh việc con (ngày · người · thêm/xóa) — offset TỰ ĐỘNG tính, không nhập tay.
  const [tasks, setTasks] = useState<ProjectTask[]>(() => (project.tasks || []).map(t => ({ ...t })));
  const [reason, setReason] = useState('');

  const newDays = useMemo(() => tasks.reduce((s, t) => s + taskDays(t), 0), [tasks]);
  const origDays = useMemo(() => (project.tasks || []).reduce((s, t) => s + taskDays(t), 0), [project.tasks]);
  // Offset dời = TỔNG SỐ NGÀY việc con TĂNG THÊM so với bản gốc (KHÔNG nhập tay) — chị Trâm chốt
  // 28/07/2026: trước đây tính theo mốc kết thúc XA NHẤT trên lịch, nên thêm 1 việc con chạy SONG
  // SONG (nằm lọt trong khoảng ngày của việc khác, khác người làm) không đẩy mốc cuối cùng ra, hệ
  // thống hiểu nhầm là "dời +0 ngày" dù khối lượng việc rõ ràng tăng thêm. Giờ cứ tăng ngày việc con
  // là tính dời — không xét chồng lấn lịch. Ngày Trưởng phòng duyệt (soNgayDuyetTP) không nằm trong
  // tasks[] nên không lẫn vào phép tính này.
  const soNgayTangThem = useMemo(() => Math.max(0, newDays - origDays), [newDays, origDays]);
  // Chế độ "giữ nguyên hạn": dù việc con có tăng ngày thì hạn nộp vẫn không đổi — Quản lý đã
  // khẳng định tiến độ không đổi, tự thu xếp trong khoảng thời gian cũ.
  const actualDelay = doiTienDo ? soNgayTangThem : 0;

  const curDeadline = project.ngayHoanThanhDuKienHienTai;
  const newDeadlineDate = new Date(new Date(curDeadline).getTime() + actualDelay * DAY);
  const newDeadline = newDeadlineDate.toISOString().split('T')[0];

  // TỈ TRỌNG PHẢI ĐỦ 100% CHO VÒNG ĐANG CHẠY mới lưu được (chị Trâm chốt 29/07/2026) — cùng luật
  // với form hồ sơ, dùng chung hàm weightIssue nên câu chữ báo lỗi không lệch nhau.
  // Lưu ý: luật là 100% MỖI VÒNG, không phải lũy kế. Hồ sơ sang vòng 2 thì vòng 2 tự tính lại
  // từ 100% của riêng nó; con số "lũy kế 200%" chỉ là cách hiển thị cộng dồn, không phải mức khoá.
  const vong = Math.max(1, project.vongHienTai || 1);
  const loiTiTrong = useMemo(() => weightIssue(tasks, vong), [tasks, vong]);

  // Giữ nguyên hạn thì KHÔNG đòi số ngày dời — chỉ cần khai lý do làm bằng chứng phân công.
  const canApply = (doiTienDo ? actualDelay > 0 : true) && reason.trim().length > 0 && !loiTiTrong;

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
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                {doiTienDo ? 'Dời hạn & sửa việc con' : 'Phân bổ lại việc con — giữ nguyên hạn'}
              </h3>
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
            <span className="block text-[10px] uppercase font-bold text-slate-400">
              {doiTienDo ? 'Hạn mới (theo việc con)' : 'Hạn nộp sau khi lưu'}
            </span>
            <span className={`font-black ${doiTienDo ? 'text-brand-warning' : 'text-brand-success'}`}>
              {fmtDateVN(newDeadline)}{doiTienDo && actualDelay > 0 ? ` (+${actualDelay} ngày)` : ' (giữ nguyên)'}
            </span>
          </div>
        </div>

        {/* Offset TỰ ĐỘNG — Quản lý không nhập tay */}
        <div className="flex items-start gap-2 text-[11px] bg-brand-accent/5 dark:bg-brand-accent/10 border border-brand-accent/20 rounded-lg px-3 py-2 text-slate-600 dark:text-slate-300">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-brand-accent dark:text-brand-accent-300" />
          {doiTienDo ? (
            <span>Bạn chỉ cần chỉnh việc con bên dưới — hệ thống <b>tự tính số ngày dời</b> theo tổng số ngày việc con tăng thêm so với kế hoạch cũ (hiện <b className="text-brand-warning">+{actualDelay} ngày</b>). Trưởng phòng sẽ tự thêm ngày kiểm tra của Phòng khi duyệt.</span>
          ) : (
            <span>Chế độ <b>giữ nguyên hạn nộp</b>: chia lại tỉ trọng, đổi người, thêm/xoá việc con thoải mái — hạn nộp <b className="text-brand-success">không đổi</b> và <b>không ghi nhật ký dời hạn</b>.
              {soNgayTangThem > 0 && <> Việc con hiện nhiều hơn kế hoạch cũ <b className="text-brand-warning">{soNgayTangThem} ngày</b>, nhưng vẫn giữ hạn theo lựa chọn của bạn — cần dời hạn thì quay lại chọn <b>“Có thay đổi tiến độ”</b>.</>}
            </span>
          )}
        </div>

        {/* THIẾU vongHienTai LÀ HỎNG TỈ TRỌNG THEO VÒNG (phát hiện 29/07/2026): prop này mặc định
            là 1, nên hồ sơ đang ở vòng 2 mà mở bảng này thì việc con thêm mới bị gắn nhầm `vong: 1`,
            Σ tỉ trọng lại đọc của vòng 1, và việc vòng cũ không bị khoá với Quản lý. Hai chỗ dùng
            SubtaskGantt còn lại (form hồ sơ, xem nhanh ở danh sách) đều đã truyền sẵn.

            Sửa việc con — dùng CHÍNH bảng phân rã như lúc tạo/sửa công việc:
            đổi người thực hiện · tiến độ BP (TP nếu là Trưởng phòng) · số ngày · thêm/xóa việc con.
            Khi dự án delay kéo nhân sự đi, có thể dồn việc cho 1-2 người chủ đạo. */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Việc con — đổi người thực hiện · tiến độ · số ngày · thêm/xóa việc (tổng {newDays} ngày · {doiTienDo ? `dời +${actualDelay} ngày` : 'giữ nguyên hạn'})
          </label>
          <SubtaskGantt
            tasks={tasks}
            staff={staff}
            projectStartDate={project.ngayBatDau}
            canEdit
            isBOOD={isBOOD}
            hideFooter
            vongHienTai={vong}
            thuVienTen={thuVienTenViecCon}
            onChange={setTasks}
          />
        </div>

        {/* Kẹt tỉ trọng — nói rõ đang thiếu/vượt bao nhiêu để Quản lý biết sửa chỗ nào */}
        {loiTiTrong && (
          <div className="flex items-start gap-2 text-[11px] bg-brand-danger/10 border border-brand-danger/30 rounded-lg px-3 py-2 text-brand-danger font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{loiTiTrong.moTa} Chia đủ 100% mới lưu được.</span>
          </div>
        )}

        {/* Lý do */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {doiTienDo ? 'Lý do dời hạn' : 'Lý do phân bổ lại (lưu làm bằng chứng)'} <span className="text-brand-danger">*</span>
          </label>
          <AutoGrowTextarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={doiTienDo
              ? 'VD: CĐT điều chỉnh thiết kế, bổ sung hạng mục — cần thêm thời gian bóc tách...'
              : 'VD: Anh A tham gia hỗ trợ từ 28/07 — chia lại tỉ trọng việc con, hạn nộp giữ nguyên...'}
            className="w-full p-2.5 text-xs bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-warning"
          />
        </div>

        {/* Định tuyến duyệt */}
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-lg px-3 py-2">
          {isBOOD
            ? (doiTienDo
              ? '👑 Trưởng phòng (Level 1) tự dời — áp dụng ngay, không cần duyệt.'
              : '👑 Trưởng phòng (Level 1) tự phân bổ lại — áp dụng ngay, hạn nộp không đổi.')
            : (doiTienDo
              ? '📨 Quản lý (Level 2) dời hạn — hệ thống sẽ gửi Trưởng phòng phê duyệt lại tiến độ Phòng.'
              : '📨 Quản lý (Level 2) phân bổ lại — hạn nộp giữ nguyên, hệ thống vẫn gửi Trưởng phòng duyệt lại tiến độ vì tỉ trọng việc con đã đổi.')}
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
            title={loiTiTrong
              ? loiTiTrong.moTa
              : doiTienDo && actualDelay === 0
                ? 'Chỉnh việc con (tăng ngày / thêm việc) để phát sinh số ngày dời — hoặc quay lại chọn "Không thay đổi tiến độ"'
                : (!reason.trim() ? (doiTienDo ? 'Nhập lý do dời hạn' : 'Nhập lý do phân bổ lại') : '')}
          >
            {doiTienDo
              ? (isBOOD ? `Dời +${actualDelay} ngày & kéo về Bước 1` : `Gửi TP duyệt (+${actualDelay} ngày)`)
              : (isBOOD ? 'Lưu phân bổ & kéo về Bước 1 (giữ hạn)' : 'Gửi TP duyệt (giữ nguyên hạn)')}
          </button>
        </div>
      </div>
    </div>
  );
}
