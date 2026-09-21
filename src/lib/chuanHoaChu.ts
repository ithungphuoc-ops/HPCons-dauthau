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
  if (khongOffset) {
    // Regex trên chỉ khớp ĐÚNG HÌNH DẠNG yyyy-mm-dd — chưa chắc là ngày lịch có thật (CodeRabbit
    // phát hiện lúc rà PR #11, 21/09/2026: "2026-02-30" khớp hình dạng nhưng tháng 2 không có ngày
    // 30). Dựng lại bằng Date.UTC rồi so ngược 3 phần — round-trip không khớp thì coi như ngày lạ,
    // trả nguyên văn thay vì nhét ngày không tồn tại vào dữ liệu đã "chuẩn hoá".
    const [y, m, d] = khongOffset[1].split("-").map(Number);
    const kiemTra = new Date(Date.UTC(y, m - 1, d));
    if (kiemTra.getUTCFullYear() === y && kiemTra.getUTCMonth() === m - 1 && kiemTra.getUTCDate() === d) {
      return khongOffset[1];
    }
    return raw;
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? raw : new Date(t).toISOString().slice(0, 10);
};

/**
 * Mã dự án → id document Firestore AN TOÀN VÀ KHÔNG TRÙNG (CodeRabbit phát hiện lúc rà PR #11,
 * 21/09/2026 — `chuanHoaMa` chỉ xoá khoảng trắng + viết hoa, không giới hạn ký tự; trước đây
 * `docIdTuMaDuAn`/`docIdTuMa` tự làm riêng `replace(/[^a-zA-Z0-9_.-]/g, "_")` — GỘP MỌI ký tự lạ
 * về CÙNG MỘT "_", nên "A/B" và "A?B" ra cùng 1 document ID, GHI ĐÈ dữ liệu dự án khác nhau lên
 * nhau mà không ai biết).
 *
 * ⚠ SỬA LẦN 2 (21/09/2026) — bản đầu tự dựng escape tay (`_<mã 36>_`) TƯỞNG là 1-1 nhưng KHÔNG tự
 * đồng bộ (self-delimiting): ký tự phân cách "_" lại nằm trong chính tập ký tự ĐƯỢC PHÉP, nên chuỗi
 * thoát của 1 ký tự lạ có thể trùng y hệt 1 đoạn ký tự thường ở mã khác — agent review độc lập tự
 * chạy Node xác nhận va chạm thật: "PRJ/01" và "PRJ_1b_01" ra cùng 1 chuỗi. Đổi sang
 * `encodeURIComponent()` — phép mã hoá 1-1 CHUẨN.
 *
 * ⚠ SỬA LẦN 3 (21/09/2026) — lần 2 dùng `encodeURIComponent()` đúng là 1-1, nhưng 2 chuỗi THAY THẾ
 * cho ca biên "." / ".." / "__...__" (`dau-cham-1`, `id-__x__`...) lại VÔ TÌNH toàn ký tự
 * "unreserved" — nên bản thân CHÚNG cũng là ảnh (output) hợp lệ của encodeURIComponent cho MỘT mã
 * dự án literal khác (vd mã dự án `"dau-cham-1"` y hệt chuỗi thay thế cho mã `"."`) — agent review
 * độc lập tự chạy Node xác nhận đúng 3 cặp va chạm này. Sửa triệt để: mọi chuỗi thay thế đều có tiền
 * tố `"%!"` — `encodeURIComponent` CHỈ phát ký tự "%" khi đi kèm ĐÚNG 2 chữ số hex ngay sau (dạng
 * `%XX`), không bao giờ phát "%!" — nên bất kỳ chuỗi bắt đầu bằng "%!" chắc chắn KHÔNG THỂ là output
 * tự nhiên của encodeURIComponent cho bất kỳ input nào khác, đảm bảo 2 "vùng ảnh" tách biệt hoàn
 * toàn. Bỏ giới hạn cắt 200 ký tự — mã dự án thật rất ngắn, cắt bớt mới chính là nguồn va chạm ban
 * đầu.
 *
 * ⚠ THỬ THÊM RỒI BỎ (21/09/2026) — từng thêm bước thay "sửa" surrogate đơn lẻ (UTF-16 lỗi, JSON có
 * thể tạo ra) bằng U+FFFD trước khi mã hoá, để tránh encodeURIComponent ném URIError. Agent review
 * độc lập tự chạy Node xác nhận CHÍNH bước "sửa" đó lại phá tính 1-1: nhiều surrogate lẻ KHÁC GIÁ
 * TRỊ (`"A\uD800B"`, `"A\uD801B"`) và cả 1 mã hợp lệ ĐÃ SẴN chứa U+FFFD thật (`"A�B"`) đều bị
 * gộp về CÙNG một chuỗi rồi ra cùng 1 document ID — đúng loại lỗi đang cố sửa. Quyết định: KHÔNG cố
 * "sửa" chuỗi lỗi — để encodeURIComponent tự ném URIError, 2 route webhook đã có try/catch bọc
 * ngoài (trả lỗi 500 sạch cho đúng bản ghi đó), thà báo lỗi rõ ràng còn hơn âm thầm trùng ID với dự
 * án khác.
 */
export const idAnToanTuMa = (maDuAn: string): string => {
  // KHÔNG .trim() ở đây — mã dự án đã qua chuanHoaMa() (xoá hết khoảng trắng) trước khi tới hàm
  // này; .trim() thêm ở đây chỉ làm mất tính 1-1 (fuzz test tự kiểm chứng: " 0" và "0" sẽ ra cùng
  // 1 id nếu trim, dù về mặt hàm này KHÔNG nên tự coi 2 chuỗi khác nhau là một).
  const id = encodeURIComponent(maDuAn);
  if (id === ".") return "%!dot1";
  if (id === "..") return "%!dot2";
  if (/^__.*__$/.test(id)) return `%!reserved_${id}`;
  return id || "%!rong";
};
