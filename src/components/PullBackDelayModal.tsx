import { useState, useMemo } from 'react';
import { Project, ProjectTask, Staff } from '../types';
import { fmtDateVN } from '../utils/dateVN';
import { Clock, Info, X, AlertTriangle } from 'lucide-react';
import SubtaskGantt, { DEFAULT_TASK_DAYS } from './SubtaskGantt';
import { khoangKeHoachViecCon } from '../utils/keHoachViecCon';
import { TenViecConThuongDung } from '../utils/thuVienViecCon';
import { AutoGrowTextarea } from './ui';
import { weightIssue } from '../utils/taskTree';
import { maHoSo } from '../lib/utils';

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
  /**
   * Áp dụng. `delayDays` = số ngày dời, suy từ lịch việc con (xem ghi chú "CHỈ MỘT ĐƯỜNG" bên dưới).
   * bằng phiếu, tức phần KHÔNG nằm trong kế hoạch việc con — đây mới là số ghi vào `soNgayLech`
   * của phiếu và được getExecEnd cộng thêm. Phần do việc con dài ra thì công thức tự thấy, ghi
   * vào phiếu nữa là cộng trùng (chị Trâm chốt 12/09/2026).
   */
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

  // ===== HẠN CÓ BỊ ĐẨY RA KHÔNG — ĐO BẰNG MỐC KẾT THÚC, KHÔNG PHẢI TỔNG NGÀY (14/09/2026) =====
  // Chị Trâm hỏi: "Bấm giữ nguyên hạn thầu nhưng cố tình tăng số ngày lên thì vẫn cho lưu phải không?"
  // Đúng là vẫn cho lưu — và đó là lỗi: hạn Phòng suy từ MỐC KẾT THÚC MUỘN NHẤT của việc con
  // (getExecEnd bên App.tsx), nên kéo dài một việc là hạn tự dịch ra, trong khi bảng vẫn hứa
  // "giữ nguyên". App nói một đằng, số liệu ngoài kia một nẻo.
  //
  // `soNgayTangThem` ở trên đo bằng TỔNG NGÀY nên không dùng để trả lời câu "hạn có dịch không":
  //   · Thêm việc CHẠY SONG SONG → tổng ngày tăng nhưng mốc cuối không đổi ⇒ hạn GIỮ NGUYÊN thật.
  //   · Dời ngày bắt đầu ra xa mà giữ số ngày → tổng không đổi nhưng mốc cuối đẩy ra ⇒ hạn TĂNG.
  // Nên tính riêng mốc kết thúc, đúng cách getExecEnd làm, để biết hạn có thật sự dịch hay không.
  // ⚠ DÙNG CHUNG `khoangKeHoachViecCon` — KHÔNG tự duyệt việc con ở đây (chị Trâm 15/09/2026:
  // "tại sao không bao giờ khớp em nhỉ"). Trước đây chỗ này có bản tính riêng, chỉ xét việc cấp 1
  // và đơn vị ngày tròn, nên hồ sơ có việc con cấp 2 hoặc nửa ngày thì modal nói hạn không dịch
  // trong khi Dashboard/Gantt lại thấy dịch.
  const mocKetThuc = (list: ProjectTask[]): number => {
    const k = khoangKeHoachViecCon(list, Math.max(1, project.vongHienTai || 1), project.ngayBatDau);
    return k ? new Date(k.maxDate).getTime() : new Date(project.ngayBatDau).getTime();
  };
  // Hạn dịch bao nhiêu ngày do sửa việc con. GIỮ DẤU: dương = đẩy ra, ÂM = rút vào (kế hoạch mới
  // xong sớm hơn), 0 = vẫn kết thúc đúng ngày cũ.
  const soNgayHanDich = useMemo(() => {
    const cu = mocKetThuc(project.tasks || []);
    const moi = mocKetThuc(tasks);
    return Math.round((moi - cu) / DAY);
  }, [tasks, project.tasks, project.ngayBatDau, project.vongHienTai]);
  const soNgayHanBiDay = Math.max(0, soNgayHanDich);
  /** Kế hoạch mới xong SỚM hơn kế hoạch cũ bao nhiêu ngày (0 = không sớm hơn). */
  const soNgayHanRutVao = Math.max(0, -soNgayHanDich);

  // ===== CHỈ MỘT ĐƯỜNG DỜI TIẾN ĐỘ: SỬA VIỆC CON (chị Trâm chốt 19/09/2026) =====
  // "Bỏ cơ chế này đi, bị lỗi logic."
  //
  // Bản 12/09 có thêm ô "Xin gia hạn thêm cho tiến độ Bộ phận" để Quản lý khai thẳng N ngày mà
  // không phải nhét ngày vào việc con của nhân viên. Nhưng hai nguồn số ngày cùng đẩy một cái hạn
  // thì hạn nộp hiện trên bảng không còn suy được từ lịch việc con: sơ đồ Gantt vẽ tới ngày A,
  // phiếu lại ghi hạn A+N, và mọi phép so "đúng hạn / trễ hạn" sau đó đọc hai con số khác nhau.
  //
  // Nay chỉ còn MỘT đường: số ngày dời = số ngày lịch việc con dài thêm. Phần việc của riêng Quản
  // lý kẹt thì kéo dài chính việc con của mình trong bảng bên dưới — vừa ra đúng số ngày, vừa thấy
  // được trên Gantt là ai đang giữ hồ sơ.
  const daSuaViecCon = soNgayTangThem > 0;
  // Chế độ "giữ nguyên hạn": dù việc con có tăng ngày thì hạn nộp vẫn không đổi — Quản lý đã
  // khẳng định tiến độ không đổi, tự thu xếp trong khoảng thời gian cũ.
  //
  // ⚠ SỬA 21/09/2026 (CodeRabbit rà PR #11) — actualDelay PHẢI đo bằng MỐC KẾT THÚC bị đẩy ra
  // (soNgayHanBiDay), KHÔNG PHẢI tổng ngày việc con tăng thêm (soNgayTangThem). Trước đây dùng
  // soNgayTangThem nên thêm 1 việc con CHẠY SONG SONG (tổng ngày tăng nhưng mốc cuối không đổi)
  // vẫn báo "dời +N ngày" và ghi delayDays > 0 cho handlePullBackApply — dù dòng chữ ngay dưới
  // (soNgayHanBiDay === 0 && soNgayTangThem > 0) đã nói đúng là "hạn nộp giữ nguyên — lưu bình
  // thường". Giao diện nói một đằng, số ghi vào phiếu một nẻo.
  const actualDelay = doiTienDo ? soNgayHanBiDay : 0;

  const curDeadline = project.ngayHoanThanhDuKienHienTai;
  const newDeadlineDate = new Date(new Date(curDeadline).getTime() + actualDelay * DAY);
  const newDeadline = newDeadlineDate.toISOString().split('T')[0];

  // TỈ TRỌNG PHẢI ĐỦ 100% CHO VÒNG ĐANG CHẠY mới lưu được (chị Trâm chốt 29/07/2026) — cùng luật
  // với form hồ sơ, dùng chung hàm weightIssue nên câu chữ báo lỗi không lệch nhau.
  // Lưu ý: luật là 100% MỖI VÒNG, không phải lũy kế. Hồ sơ sang vòng 2 thì vòng 2 tự tính lại
  // từ 100% của riêng nó; con số "lũy kế 200%" chỉ là cách hiển thị cộng dồn, không phải mức khoá.
  const vong = Math.max(1, project.vongHienTai || 1);
  const loiTiTrong = useMemo(() => weightIssue(tasks, vong), [tasks, vong]);

  // ===== "GIỮ NGUYÊN HẠN" PHẢI ĐÚNG LÀ GIỮ NGUYÊN — CẢ HAI CHIỀU (chị Trâm báo lỗi 19/09/2026) =====
  // "Khi LV2 kéo từ 2 về 1, bấm không thay đổi tiến độ, nhưng chị cố tình giảm đi 1 ngày, thì tự
  //  động đưa về Bước 1 là sao nhỉ? Đáng nhẽ phải báo là chọn có thay đổi tiến độ và không cho lưu
  //  khi chọn trường không làm thay đổi tiến độ chứ?"
  //
  // Luật cũ chỉ chặn chiều ĐẨY RA. Rút vào thì lọt: người dùng chọn "không thay đổi tiến độ" mà
  // hạn vẫn đổi — app đành kéo hồ sơ về Bước 1 (vì hạn đổi là phải trình lại), nên màn hình làm
  // một đằng, ô vừa chọn nói một nẻo.
  // Nay chặn cả hai chiều: đã chọn "giữ nguyên hạn" thì hạn phải y nguyên, lệch ngày nào cũng
  // không cho lưu — và chỉ thẳng sang đường đúng là chọn "Có thay đổi tiến độ".
  const viPhamGiuNguyenHan = !doiTienDo && soNgayHanDich !== 0;
  // ===== RÚT NGẮN TIẾN ĐỘ VẪN PHẢI LƯU ĐƯỢC (chị Trâm hỏi 19/09/2026) =====
  // "Kiểm tra bước này, nếu làm tiến độ ngắn hơn thì có cần Trưởng phòng duyệt lại không."
  // Luật cũ đòi `actualDelay > 0` mới cho lưu ở nhánh "Có thay đổi tiến độ", nên Quản lý rút ngắn
  // lịch xong là nút Lưu khoá cứng, mà dòng nhắc chỉ nói "tăng ngày / thêm việc" — đang rút ngắn
  // đọc câu đó thì không hiểu app muốn gì.
  // Rút ngắn KHÔNG cần Trưởng phòng duyệt lại: hạn không bị đẩy ra, không ai phải gác thêm gì —
  // cùng lẽ với luật "đổi phân bổ giữ nguyên hạn thì hồ sơ đứng nguyên" chị Trâm chốt 15/09/2026.
  // handlePullBackApply đã xử đúng (delayDays = 0 → giữ nguyên bước, không gắn cờ chờ duyệt);
  // chỗ duy nhất sai là cửa chặn ở đây.
  const canApply = reason.trim().length > 0 && !loiTiTrong && !viPhamGiuNguyenHan;

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
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate">{maHoSo(project)} — {project.hangMuc}</p>
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
            <span>Chỉnh việc con bên dưới — hệ thống <b>tự tính số ngày dời</b> theo tổng số ngày việc con tăng thêm. Phần việc của riêng bạn còn kẹt thì <b>kéo dài chính việc con đó</b>, đừng cộng ngày ở chỗ khác. Hiện dời <b className="text-brand-warning">+{actualDelay} ngày</b>. Trưởng phòng sẽ tự thêm ngày kiểm tra của Phòng khi duyệt — việc đó <b>không đụng</b> tới số ngày này.</span>
          ) : (
            <span>Chế độ <b>giữ nguyên hạn nộp</b>: chia lại tỉ trọng, đổi người, thêm/xoá việc con thoải mái — miễn là kế hoạch mới vẫn <b>kết thúc đúng ngày cũ</b> thì hạn nộp <b className="text-brand-success">không đổi</b> và <b>không ghi nhật ký dời hạn</b>.
              {/* Đo bằng MỐC KẾT THÚC chứ không phải tổng ngày: thêm việc chạy song song thì tổng
                  ngày tăng nhưng hạn vẫn giữ nguyên thật — báo động ở đó chỉ làm người dùng hoang
                  mang rồi bỏ cuộc (xem soNgayHanBiDay ở đầu file). */}
              {soNgayHanBiDay > 0 && (
                <> <b className="text-brand-danger">Nhưng kế hoạch mới đang kết thúc muộn hơn {soNgayHanBiDay} ngày</b>, nên hạn nộp <b>không thể giữ nguyên</b> — hạn suy ra từ chính lịch việc con. Muốn giữ đúng hạn thì rút lịch việc con lại; còn thật sự cần dời thì quay lại chọn <b>“Có thay đổi tiến độ”</b> để hệ thống ghi nhật ký dời hạn cho đúng.</>
              )}
              {soNgayHanRutVao > 0 && (
                <> <b className="text-brand-danger">Nhưng kế hoạch mới đang kết thúc sớm hơn {soNgayHanRutVao} ngày</b>, nên hạn nộp <b>không còn giữ nguyên</b>. Làm nhanh hơn cũng là đổi kế hoạch Phòng — Trưởng phòng đã sắp lịch kiểm theo mốc cũ. Muốn giữ đúng hạn thì để lại lịch việc con như cũ; còn thật sự làm sớm hơn thì quay lại chọn <b>“Có thay đổi tiến độ”</b> để ghi vào lịch sử dời tiến độ.</>
              )}
              {soNgayHanBiDay === 0 && soNgayTangThem > 0 && (
                <> Việc con cộng lại nhiều hơn kế hoạch cũ <b>{soNgayTangThem} ngày</b> nhưng vẫn kết thúc đúng ngày cũ (chạy song song), nên hạn nộp giữ nguyên — lưu bình thường.</>
              )}
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

        {/* Nút lưu bị khoá vì "giữ nguyên hạn" không thực hiện được — phải nói rõ lý do ngay tại chỗ,
            bằng không người dùng bấm mãi mà không hiểu vì sao không ăn (đúng kiểu lỗi đã gặp ở form
            hồ sơ hôm 12/09: chặn im lặng). */}
        {viPhamGiuNguyenHan && (
          <div className="flex items-start gap-2 text-[11px] bg-brand-danger/10 border border-brand-danger/30 rounded-lg px-3 py-2 text-brand-danger font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Chưa lưu được: bạn đang chọn <b>giữ nguyên hạn</b> nhưng kế hoạch việc con mới lại kết
              thúc{' '}
              {soNgayHanRutVao > 0
                ? <><b>sớm hơn {soNgayHanRutVao} ngày</b></>
                : <><b>muộn hơn {soNgayHanBiDay} ngày</b></>}. Hạn nộp được suy ra từ chính lịch việc
              con nên không thể vừa đổi lịch vừa giữ hạn. Hãy sửa lịch việc con về đúng mốc cũ, hoặc
              bấm Huỷ rồi chọn <b>“Có thay đổi tiến độ”</b> để hệ thống ghi vào lịch sử dời tiến độ.
            </span>
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
              : viPhamGiuNguyenHan
                ? `Đang chọn "Không thay đổi tiến độ" nhưng kế hoạch mới làm hạn ${soNgayHanRutVao > 0 ? `SỚM hơn ${soNgayHanRutVao}` : `MUỘN hơn ${soNgayHanBiDay}`} ngày. Quay lại chọn "Có thay đổi tiến độ", hoặc sửa lịch việc con về đúng mốc cũ.`
                : (!reason.trim() ? (doiTienDo ? 'Nhập lý do dời hạn' : 'Nhập lý do phân bổ lại') : '')}
          >
            {/* Giữ nguyên hạn thì hồ sơ đứng yên tại chỗ và KHÔNG phải trình duyệt lại (chị Trâm
                chốt 15/09/2026) — nút phải nói đúng việc nó sắp làm, không thì Quản lý ngần ngại
                bấm vì tưởng sắp bị kéo hồ sơ về đầu quy trình. */}
            {doiTienDo
              ? (isBOOD ? `Dời +${actualDelay} ngày & kéo về Bước 1` : `Gửi TP duyệt (+${actualDelay} ngày)`)
              : 'Lưu phân bổ — giữ nguyên hạn, không đổi bước'}
          </button>
        </div>
      </div>
    </div>
  );
}
