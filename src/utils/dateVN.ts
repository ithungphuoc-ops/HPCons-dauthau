// Định dạng ngày giờ kiểu Việt Nam cho MỌI chỗ HIỂN THỊ trong app.
// Dữ liệu LƯU TRỮ vẫn giữ nguyên ISO YYYY-MM-DD — tuyệt đối không dùng các hàm này khi ghi dữ liệu.

const pad = (n: number) => String(n).padStart(2, '0');

// ===== GIỜ VIỆT NAM =====
// Cố định múi giờ Asia/Ho_Chi_Minh, KHÔNG lấy giờ máy. Lý do: máy cài sai múi giờ (hoặc nhân sự
// mở app từ nước ngoài) là đồng hồ và ngày hiện sai, mà hạn thầu thì tính theo NGÀY Việt Nam.
export const MUI_GIO_VN = 'Asia/Ho_Chi_Minh';

/**
 * Trả về Date mang đúng GIỜ TREO TƯỜNG của Việt Nam — CHỈ dùng để HIỂN THỊ / lấy ngày-tháng-năm.
 * getDate()/getDay()/getHours()/getFullYear() trên kết quả ra đúng số của giờ Việt Nam, nên
 * dùng chung được với fmtDateVN (hàm đó đọc theo getter giờ máy).
 *
 * ⚠️ KHÔNG dùng làm mốc để so sánh với thời gian thật (getTime()) — giá trị đã bị dịch múi giờ.
 */
export const nowVN = (): Date => {
  const phan = new Intl.DateTimeFormat('en-CA', {
    timeZone: MUI_GIO_VN,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const lay = (loai: string) => phan.find((p) => p.type === loai)?.value ?? '00';
  // hourCycle h23 ở một số máy trả '24' vào lúc nửa đêm — chuẩn hoá về '00'
  const gio = lay('hour') === '24' ? '00' : lay('hour');
  // Chuỗi KHÔNG có hậu tố Z → JS hiểu là giờ địa phương, nên Date tạo ra mang đúng số giờ VN
  return new Date(`${lay('year')}-${lay('month')}-${lay('day')}T${gio}:${lay('minute')}:${lay('second')}`);
};

/** Năm hiện tại theo lịch Việt Nam, dạng chuỗi ("2026"). Tự đổi sang "2027" khi qua năm. */
export const namHienTaiVN = (): string => String(nowVN().getFullYear());

// ===== HẠN TÍNH TỚI HẾT NGÀY (chị Trâm báo 17/08/2026 — góp ý #3) =====
// Chuỗi "2026-07-25" được đọc thành 00:00 của ngày 25/7. Nếu lấy đúng mốc đó làm điểm KẾT THÚC
// khi vẽ Gantt/timeline thì thanh dừng ở ĐẦU ngày 25/7 — tức chỉ phủ hết ngày 24/7, đúng lỗi
// chị Trâm chụp lại: "Hạn 25-07-2026" mà thanh chỉ tới 24/7.
//
// Hạn của Phòng là HẾT ngày đó, nên mốc vẽ phải là 00:00 của NGÀY KẾ TIẾP để thanh phủ trọn ô
// ngày hạn trên lưới. Quy ước này khớp với phần cảnh báo trễ hạn (đã chốt ở commit ea3d3f6).
const MOT_NGAY_MS = 24 * 60 * 60 * 1000;

/**
 * Mốc thời gian (ms) của HẾT ngày hạn — dùng làm điểm kết thúc khi VẼ thanh tiến độ.
 * Trả về NaN nếu ngày không hợp lệ (chỗ gọi tự quyết định xử lý).
 */
export const mocHetNgay = (d?: string | Date | null): number => {
  if (!d) return NaN;
  const t = (d instanceof Date ? d : new Date(d)).getTime();
  return isNaN(t) ? NaN : t + MOT_NGAY_MS;
};

// ===== GIỜ CỦA VIỆC CON (chị Trâm chốt 17/08/2026 — góp ý #20) =====
// Việc con nhập được giờ bắt đầu & giờ hết hạn. Bỏ trống giờ = TRỌN NGÀY:
//   bắt đầu 00:00:00 · hạn 23:59:59 (đúng quy ước "hạn tính tới hết ngày" đang dùng).
// Chỉ áp cho VIỆC CON — hạn Phòng và hạn nộp CĐT của hồ sơ vẫn tính theo ngày.

/**
 * Chuẩn hoá chuỗi giờ người dùng gõ về 'HH:MM' (24 giờ). Nhận "14:00", "1400", "14h", "14",
 * "9:5", "8.30". Không hợp lệ / rỗng → undefined (nghĩa là "không nhập giờ").
 */
export const chuanHoaGio = (s?: string | null): string | undefined => {
  const raw = (s || '').trim();
  if (!raw) return undefined;
  let gio: number, phut: number;
  const coDau = /^(\d{1,2})\s*[:h.,]\s*(\d{1,2})?$/i.exec(raw);   // "14:00" · "14h" · "8.30"
  const chiGio = /^(\d{1,2})\s*h?$/i.exec(raw);                    // "14" · "8h"
  const gonLien = /^(\d{3,4})$/.exec(raw);                         // "1400" · "830"
  if (coDau) { gio = parseInt(coDau[1], 10); phut = coDau[2] ? parseInt(coDau[2], 10) : 0; }
  else if (chiGio) { gio = parseInt(chiGio[1], 10); phut = 0; }
  else if (gonLien) {
    const bon = gonLien[1].padStart(4, '0');
    gio = parseInt(bon.slice(0, 2), 10); phut = parseInt(bon.slice(2), 10);
  } else return undefined;
  if (gio < 0 || gio > 23 || phut < 0 || phut > 59) return undefined;
  return `${pad(gio)}:${pad(phut)}`;
};

/** 'HH:MM' → số milisecond tính từ 00:00 của ngày đó. Giờ không hợp lệ → 0 (đầu ngày). */
const msTrongNgay = (gio?: string): number => {
  const g = chuanHoaGio(gio);
  if (!g) return 0;
  const [h, m] = g.split(':').map(Number);
  return (h * 60 + m) * 60000;
};

/** Mốc BẮT ĐẦU của việc con (ms). Không nhập giờ → 00:00:00 của ngày bắt đầu. */
export const mocBatDauViec = (ngay?: string | null, gio?: string): number => {
  if (!ngay) return NaN;
  const t = new Date(`${String(ngay).slice(0, 10)}T00:00:00`).getTime();
  return isNaN(t) ? NaN : t + msTrongNgay(gio);
};

/**
 * Mốc HẠN của việc con (ms) — thời điểm cuối cùng còn được coi là đúng hạn.
 * Có giờ hạn → đúng giờ:phút đó. Không nhập giờ → 23:59:59 của ngày hạn (trọn ngày).
 */
export const mocHanViec = (ngayHan?: string | null, gioHan?: string): number => {
  if (!ngayHan) return NaN;
  const dau = new Date(`${String(ngayHan).slice(0, 10)}T00:00:00`).getTime();
  if (isNaN(dau)) return NaN;
  const g = chuanHoaGio(gioHan);
  return g ? dau + msTrongNgay(g) : dau + MOT_NGAY_MS - 1000; // 23:59:59
};

/** Hạn việc con để HIỂN THỊ: "19-08-2026 14:00" nếu có giờ, "19-08-2026" nếu trọn ngày. */
export const fmtHanViecVN = (ngayHan?: string | null, gioHan?: string): string => {
  if (!ngayHan) return '';
  const ngay = fmtDateVN(String(ngayHan).slice(0, 10));
  const g = chuanHoaGio(gioHan);
  return g ? `${ngay} ${g}` : ngay;
};

/** Nhãn khoảng giờ của việc con để hiện trên tooltip/bảng: "08:00 → 14:00" · "trọn ngày". */
export const nhanKhoangGioViec = (gioBatDau?: string, gioHan?: string): string => {
  const bd = chuanHoaGio(gioBatDau);
  const han = chuanHoaGio(gioHan);
  if (!bd && !han) return 'trọn ngày (00:00 → 23:59)';
  return `${bd || '00:00'} → ${han || '23:59'}`;
};

/** "2026-07-10" | Date → "10-07-2026". Chuỗi rỗng/không hợp lệ → trả về nguyên văn (hoặc ''). */
export const fmtDateVN = (d?: string | Date | null): string => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return typeof d === 'string' ? d : '';
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
};

/** ISO datetime | "YYYY-MM-DD HH:mm:ss" | Date → "10-07-2026 14:30". */
export const fmtDateTimeVN = (d?: string | Date | null): string => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return typeof d === 'string' ? d : '';
  return `${fmtDateVN(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// ===== SỐ NGÀY ĐÃ DỜI HẠN (chị Trâm báo lỗi cộng trùng 29/07/2026) =====
// Đọc từ CẶP hạn cũ → hạn mới của mỗi lần dời, KHÔNG cộng trường `soNgayLech`.
// Lý do: `soNgayLech` chỉ mang phần ngày CHƯA nằm trong kế hoạch việc con (log dời phát sinh từ
// việc con để 0 để hạn khỏi bị cộng hai lần) — nên nó KHÔNG phải số ngày đã dời thực tế.
// Muốn biết hồ sơ đã dời tổng cộng bao nhiêu ngày để báo cáo thì dùng hàm này.
const MOT_NGAY = 24 * 60 * 60 * 1000;

/** Số ngày dời thực tế của MỘT lần dời hạn (hạn cũ → hạn mới). */
export const soNgayDoiCuaLog = (log: { ngayCu: string; ngayMoi: string }): number => {
  const cu = new Date(log.ngayCu).getTime();
  const moi = new Date(log.ngayMoi).getTime();
  if (isNaN(cu) || isNaN(moi)) return 0;
  return Math.max(0, Math.round((moi - cu) / MOT_NGAY));
};

/** Tổng số ngày hồ sơ đã bị dời hạn qua mọi lần. */
export const tongNgayDoiHan = (logs?: { ngayCu: string; ngayMoi: string }[]): number =>
  (logs || []).reduce((s, l) => s + soNgayDoiCuaLog(l), 0);
