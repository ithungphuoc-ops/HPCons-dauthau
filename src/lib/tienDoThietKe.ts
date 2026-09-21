import "server-only";
import { chuanHoaChu, chuanHoaMa, chuanHoaNgayLa } from "./chuanHoaChu";

/**
 * TIẾN ĐỘ THIẾT KẾ — DỮ LIỆU LẤY TỪ APP THIẾT KẾ (chị Trâm chốt 15/09/2026)
 *
 * "Đây là giao diện của app thiết kế, em thiết kế lại chỗ liên kết phòng ban đưa tiến độ này qua,
 *  bỏ đi vị trí lưu file, chỗ dự án phía trước thêm cột mã dự án."
 * IT (15/09/2026): App Thiết kế sẽ ĐẨY dữ liệu sang bằng webhook, không để bên này đi kéo.
 *
 * File này gom TOÀN BỘ việc hiểu dữ liệu bên App Thiết kế vào MỘT chỗ:
 *   - kiểu dữ liệu (DuAnThietKe / HangMucThietKe)
 *   - hàm ánh xạ tên trường (chuanHoaDuAn)
 * Webhook nhận vào và API đọc ra đều xài chung, nên khi App Thiết kế đổi tên trường thì CHỈ sửa
 * hàm `chuanHoaDuAn()` bên dưới — không phải lần theo khắp giao diện.
 *
 * ===== IT CẦN LÀM GÌ =====
 *   THIET_KE_WEBHOOK_SECRET  — chuỗi bí mật dùng chung. App Thiết kế gửi kèm mỗi lần đẩy, ở
 *                              header `Authorization: Bearer <secret>` (hoặc `X-Webhook-Secret`).
 *                              CHƯA khai biến này thì webhook TỪ CHỐI mọi request (503) — cố ý,
 *                              để không ai đẩy rác vào khi chưa cấu hình xong.
 *   THIET_KE_API_URL         — (tuỳ chọn) địa chỉ endpoint App Thiết kế, để bên này KÉO bù khi
 *   THIET_KE_API_KEY           webhook chưa từng đẩy lần nào. Không khai cũng chạy bình thường.
 *
 * Đẩy vào đâu: POST https://<app-dau-thau>/api/webhook/tien-do-thiet-ke
 * Xem mẫu payload ngay trong route đó.
 */

export const COLLECTION_TIEN_DO_THIET_KE = "tien_do_thiet_ke";

// Kiểu dữ liệu nằm ở file KHÔNG có "server-only" để giao diện dùng chung được.
export type { HangMucThietKe, DuAnThietKe } from "./tienDoThietKeTypes";
import type { HangMucThietKe, DuAnThietKe } from "./tienDoThietKeTypes";

/* ------------------------------------------------------------------ */
/* Ánh xạ tên trường — SỬA Ở ĐÂY khi App Thiết kế đổi tên khoá          */
/* ------------------------------------------------------------------ */

const layChu = (r: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
};

const laySo = (r: Record<string, unknown>, ...keys: string[]): number | undefined => {
  for (const k of keys) {
    const v = r[k];
    const n = typeof v === "number" ? v : Number(v);
    // CỐ Ý nhận cả số 0: "0 task" và "trễ 0 ngày" là thông tin thật, không phải thiếu dữ liệu.
    if (v !== null && v !== undefined && v !== "" && Number.isFinite(n)) return n;
  }
  return undefined;
};

/** Chuẩn hoá ngày về yyyy-mm-dd. Nhận yyyy-mm-dd, dd/mm/yyyy và chuỗi ISO. */
const layNgay = (r: Record<string, unknown>, ...keys: string[]): string | undefined => {
  const raw = layChu(r, ...keys);
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return chuanHoaNgayLa(raw);
};

const chuanHoaHangMuc = (r: Record<string, unknown>, i: number): HangMucThietKe | null => {
  // Mọi trường chữ đi qua chuanHoaChu() — xem ba quy tắc ở src/lib/chuanHoaChu.ts
  const ten = chuanHoaChu(layChu(r, "ten", "tenHangMuc", "hangMuc", "name", "title"));
  if (!ten) return null;
  return {
    id: layChu(r, "id", "maHangMuc", "code") || `hm-${i + 1}`,
    ten,
    loaiDuAn: chuanHoaChu(layChu(r, "loaiDuAn", "loai", "projectType", "type")),
    tinhTrang: chuanHoaChu(layChu(r, "tinhTrang", "trangThai", "status")),
    ngayLap: layNgay(r, "ngayLap", "ngayBatDau", "startDate", "createdDate"),
    ngayHoanThanh: layNgay(r, "ngayHoanThanh", "ngayKetThuc", "endDate", "completedDate"),
    soTask: laySo(r, "soTask", "tongTask", "taskCount", "totalTasks"),
    soTaskXong: laySo(r, "soTaskXong", "taskHoanThanh", "doneTasks", "completedTasks"),
    nguoiThucHien: chuanHoaChu(layChu(r, "nguoiThucHien", "phuTrach", "assignee", "owner")),
    treHan: laySo(r, "treHan", "soNgayTre", "delayDays", "overdueDays"),
  };
};

/** Ánh xạ một bản ghi thô của App Thiết kế về dòng dự án + các hạng mục con. */
export const chuanHoaDuAn = (r: Record<string, unknown>): DuAnThietKe | null => {
  const maDuAn = chuanHoaMa(layChu(r, "maDuAn", "projectCode", "projectId", "code", "ma"));
  const tenDuAn = chuanHoaChu(layChu(r, "tenDuAn", "duAn", "name", "projectName", "ten"));
  // Không có mã thì không ghép được với hồ sơ đấu thầu — bỏ qua, đừng bịa mã.
  if (!maDuAn) return null;

  const rawHm = r["hangMuc"] ?? r["hangMucs"] ?? r["items"] ?? r["children"] ?? r["chiTiet"];
  const hangMuc = (Array.isArray(rawHm) ? rawHm : [])
    .map((x, i) => (x && typeof x === "object" ? chuanHoaHangMuc(x as Record<string, unknown>, i) : null))
    .filter((x): x is HangMucThietKe => !!x);

  return {
    maDuAn,
    tenDuAn: tenDuAn || maDuAn,
    namTaiChinh: chuanHoaChu(layChu(r, "namTaiChinh", "nienDo", "fiscalYear")),
    loaiDuAn: chuanHoaChu(layChu(r, "loaiDuAn", "loai", "projectType", "type")),
    tinhTrang: chuanHoaChu(layChu(r, "tinhTrang", "trangThai", "status")),
    ngayLap: layNgay(r, "ngayLap", "ngayBatDau", "startDate", "createdDate"),
    ngayHoanThanh: layNgay(r, "ngayHoanThanh", "ngayKetThuc", "endDate", "completedDate"),
    soTask: laySo(r, "soTask", "tongTask", "taskCount", "totalTasks"),
    nguoiThucHien: chuanHoaChu(layChu(r, "nguoiThucHien", "phuTrach", "assignee", "owner")),
    treHan: laySo(r, "treHan", "soNgayTre", "delayDays", "overdueDays"),
    hangMuc,
  };
};

/** Id document Firestore an toàn suy ra từ mã dự án (mã có dấu "/" sẽ làm vỡ đường dẫn). */
export const docIdTuMa = (maDuAn: string): string =>
  maDuAn.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 200) || "khong-ma";
