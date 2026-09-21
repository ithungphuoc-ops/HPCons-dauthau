import "server-only";

/**
 * CHUẨN HOÁ CHỮ CHO DỮ LIỆU ĐỔ TỪ APP KHÁC VỀ (chị Trâm chốt 19/09/2026)
 *
 * "Em tạo rule cho chị: khi app đổ thông tin dự án về app thì format lại cỡ chữ, chữ hoa chữ
 *  thường như mẫu chị em mình đã thống nhất, không được kiểu chữ thì HOA, chữ thì thường, chữ thì
 *  chấm phẩy loạn lên."
 *
 * Mỗi người bên App Thông tin dự án gõ một kiểu: người viết HOA HẾT, người viết thường hết, người
 * để dư dấu cách quanh dấu phẩy, người chấm câu ở cuối tên riêng. Đổ thẳng vào bảng thì mỗi dòng
 * một kiểu, đọc rất rối. Nên chuẩn hoá NGAY LÚC NHẬN, trước khi lưu.
 *
 * ===== BA QUY TẮC =====
 *
 *  1. DỌN KHOẢNG TRẮNG & DẤU CÂU
 *     · Cắt trắng đầu/cuối, gộp nhiều dấu cách liền nhau thành một.
 *     · Dấu phẩy / chấm phẩy: bỏ khoảng trắng phía trước, luôn có đúng một khoảng trắng phía sau.
 *     · Bỏ dấu chấm, phẩy, chấm phẩy, gạch nối thừa ở CUỐI chuỗi (tên riêng không kết bằng dấu câu).
 *
 *  2. CHỮ HOA / CHỮ THƯỜNG — CHỈ SỬA KHI CHẮC CHẮN SAI
 *     ⚠ CỐ Ý không đụng vào chuỗi đã viết hoa-thường xen kẽ hợp lý. Ép Title Case mọi thứ sẽ phá
 *     tên riêng người ta gõ đúng (vd "Kho vận Long Thành" → "Kho Vận Long Thành"). Chỉ can thiệp
 *     khi chuỗi TOÀN HOA hoặc TOÀN THƯỜNG — hai ca đó chắc chắn là gõ ẩu, không phải chủ ý.
 *     · TOÀN HOA  → viết hoa chữ đầu mỗi từ ("CÔNG TY TNHH DỆT" → "Công ty TNHH Dệt").
 *     · TOÀN THƯỜNG → viết hoa chữ đầu câu ("nhà máy dệt bình dương" → "Nhà máy dệt bình dương"
 *       — chỉ hoa chữ đầu, KHÔNG đoán đâu là tên riêng, vì đoán sai còn tệ hơn để nguyên).
 *
 *  3. TỪ VIẾT TẮT LUÔN GIỮ HOA
 *     TNHH, CP, KCN, CĐT, PCCC, M&E, HP, GĐ... — chuẩn hoá xong vẫn phải HOA, bằng không
 *     "Công ty TNHH" thành "Công ty Tnhh".
 *
 * Mã dự án đi đường riêng (chuanHoaMa) — mã luôn viết HOA.
 */

/** Từ viết tắt trong ngành, luôn giữ nguyên dạng HOA sau khi chuẩn hoá. */
const VIET_TAT = new Set([
  'TNHH', 'CP', 'CTCP', 'MTV', 'DNTN', 'HTX',
  'KCN', 'KCX', 'KKT', 'CCN',
  'CĐT', 'HP', 'HPCS', 'HPCONS',
  'M&E', 'PCCC', 'HVAC', 'MEP', 'PCC', 'ME',
  'TP', 'TX', 'Q1', 'Q2', 'Q3', 'Q7', 'Q9',
  'VN', 'USD', 'VND', 'BOQ', 'VE',
]);

/** Chuỗi có chữ cái nào viết thường không? (dùng để nhận ra "TOÀN HOA") */
const coChuThuong = (s: string) => s !== s.toUpperCase();
/** Chuỗi có chữ cái nào viết hoa không? (dùng để nhận ra "TOÀN THƯỜNG") */
const coChuHoa = (s: string) => s !== s.toLowerCase();

/** Viết hoa chữ cái đầu, phần còn lại giữ nguyên. */
const hoaChuDau = (tu: string) => (tu ? tu.charAt(0).toUpperCase() + tu.slice(1) : tu);

/** Trả lại dạng HOA cho từ viết tắt; các từ khác giữ nguyên. */
const giuVietTat = (tu: string) => {
  const chi = tu.replace(/[^\p{L}\p{N}&]/gu, '');
  return VIET_TAT.has(chi.toUpperCase()) ? tu.toUpperCase() : tu;
};

/** QUY TẮC 1 — dọn khoảng trắng và dấu câu. */
const donDauCau = (s: string): string =>
  s
    .replace(/\s+/g, ' ')                 // gộp mọi khoảng trắng (kể cả xuống dòng, tab) thành một
    .replace(/\s+([,;.])/g, '$1')         // bỏ khoảng trắng TRƯỚC dấu phẩy / chấm phẩy / chấm
    .replace(/([,;])(?!\s)/g, '$1 ')      // luôn có đúng một khoảng trắng SAU dấu phẩy / chấm phẩy
    .replace(/\s*-\s*/g, ' - ')           // gạch nối: một khoảng trắng mỗi bên, tránh "A-  B"
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s,;.\-]+$/u, '');         // bỏ dấu câu thừa ở CUỐI chuỗi

/**
 * Chuẩn hoá một trường chữ tự do (tên dự án, chủ đầu tư, địa chỉ, KCN, tỉnh/thành...).
 * Chuỗi rỗng / không phải chuỗi → trả undefined để bảng hiện "—" thay vì ô trống khó hiểu.
 */
export const chuanHoaChu = (v?: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const sach = donDauCau(v);
  if (!sach) return undefined;

  // QUY TẮC 2 — chỉ sửa hai ca chắc chắn gõ ẩu.
  let ketQua = sach;
  if (!coChuThuong(sach)) {
    // TOÀN HOA → hoa chữ đầu mỗi từ
    ketQua = sach.toLowerCase().split(' ').map(hoaChuDau).join(' ');
  } else if (!coChuHoa(sach)) {
    // TOÀN THƯỜNG → chỉ hoa chữ đầu chuỗi
    ketQua = hoaChuDau(sach);
  }

  // QUY TẮC 3 — trả lại dạng HOA cho từ viết tắt.
  return ketQua.split(' ').map(giuVietTat).join(' ');
};

/** Mã dự án: dọn khoảng trắng + viết HOA toàn bộ (mã có chữ cái thì luôn HOA). */
export const chuanHoaMa = (v?: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const sach = v.replace(/\s+/g, '').trim().toUpperCase();
  return sach || undefined;
};

/**
 * Ngày lạ (không khớp yyyy-mm-dd / dd-mm-yyyy) → yyyy-mm-dd, GIỮ ĐÚNG NGÀY LỊCH đã ghi trong
 * chuỗi (CodeRabbit phát hiện lúc rà PR #11, 21/09/2026 — dùng chung cho duAnTong.ts và
 * tienDoThietKe.ts, trước đó mỗi file tự làm một bản giống hệt nhau).
 *
 * ⚠ Chuỗi ISO ngày-giờ KHÔNG offset (vd "2026-08-03T00:00:00") không được đưa thẳng qua
 * Date.parse()+toISOString(): Date.parse hiểu chuỗi đó là GIỜ MÁY CHỦ chạy app, rồi toISOString()
 * quy đổi sang UTC — máy chủ chạy múi giờ khác UTC (vd dev chạy máy để múi Asia/Ho_Chi_Minh) có
 * thể làm ngày lùi một hôm. Cắt thẳng phần "yyyy-mm-dd" khỏi chuỗi loại này để giữ đúng ngày lịch,
 * không đi vòng qua giờ. Timestamp CÓ "Z" hoặc offset rõ ràng (+07:00...) là mốc UTC thật, quy đổi
 * bình thường qua Date.parse.
 */
export const chuanHoaNgayLa = (raw: string): string => {
  const khongOffset = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.exec(raw);
  if (khongOffset) return khongOffset[1];
  const t = Date.parse(raw);
  return Number.isNaN(t) ? raw : new Date(t).toISOString().slice(0, 10);
};
