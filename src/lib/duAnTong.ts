import "server-only";
import { chuanHoaChu, chuanHoaMa, chuanHoaNgayLa, idAnToanTuMa } from "./chuanHoaChu";

/**
 * DANH MỤC DỰ ÁN TỪ "APP THÔNG TIN DỰ ÁN" (chị Trâm chốt 15/09/2026)
 *
 * Thứ tự liên kết chị Trâm chốt:
 *   App Thông tin dự án  →  đổ MÃ DỰ ÁN + các thông tin dự án (chủ đầu tư, địa chỉ, quốc tịch,
 *                            hình thức xây dựng, hồ sơ phát thầu, diện tích đất)
 *   → bấm vào mã đó      →  lấy TIẾN ĐỘ THIẾT KẾ bên App Thiết kế (xem src/lib/tienDoThietKe.ts)
 *
 * Hai app ghép với nhau BẰNG MÃ DỰ ÁN. Vì vậy bản ghi không có mã thì bỏ, tuyệt đối không tự chế
 * mã — chế ra là ghép nhầm hồ sơ của hai dự án khác nhau.
 *
 * File này gom kiểu dữ liệu + ánh xạ tên trường vào MỘT chỗ, dùng chung cho:
 *   - webhook nhận đẩy  : app/api/webhook/du-an-tong/route.ts
 *   - API cho giao diện : app/api/du-an-tong/route.ts
 * App bên kia đổi tên khoá thì chỉ sửa `chuanHoaDuAnTong()` bên dưới.
 */

export const COLLECTION_DU_AN_TONG = "du_an_tong";

// Kiểu dữ liệu nằm ở file KHÔNG có "server-only" để giao diện dùng chung được.
export type { DuAnTong } from "./duAnTongTypes";
import type { DuAnTong } from "./duAnTongTypes";


export const chuanHoaDuAnTong = (r: Record<string, unknown>): DuAnTong | null => {
  const lay = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = r[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
    return undefined;
  };
  const laySo = (...keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = r[k];
      // CỐ Ý nhận cả số 0 (CodeRabbit phát hiện lúc rà PR #11, 21/09/2026 — trước đây `n > 0` làm
      // dự án mới khởi tạo, tiến độ 0%, hiện ô trống thay vì "0%"; tienDoThietKe.ts đã làm đúng,
      // hai bộ chuẩn hoá lệch luật nhau). Chuỗi chỉ có khoảng trắng (" ", "\t") cũng phải coi là
      // THIẾU dữ liệu như chuỗi rỗng — không thì Number(" ") = 0 biến trường thiếu thành "0" thật
      // (CodeRabbit phát hiện cùng đợt rà).
      if (v === null || v === undefined || (typeof v === "string" && !v.trim())) continue;
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return undefined;
  };

  const maDuAn = chuanHoaMa(lay("maDuAn", "projectId", "projectCode", "code", "ma"));
  if (!maDuAn) return null;
  // Mọi trường chữ tự do đi qua chuanHoaChu() — xem ba quy tắc ở src/lib/chuanHoaChu.ts
  // (chị Trâm chốt 19/09/2026: "không được kiểu chữ thì HOA, chữ thì thường, chữ thì chấm phẩy loạn lên").
  const chu = (...keys: string[]) => chuanHoaChu(lay(...keys));

  /** Ngày về yyyy-mm-dd; nhận cả dd/mm/yyyy và chuỗi ISO. */
  const layNgay = (...keys: string[]): string | undefined => {
    const raw = lay(...keys);
    if (!raw) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    return chuanHoaNgayLa(raw);
  };

  return {
    maDuAn,
    tenDuAn: chu("tenDuAn", "name", "ten", "projectName") || "",
    chuDauTu: chu("chuDauTu", "investor", "cdt"),
    diaChi: chu("diaChi", "address", "diaDiem"),
    quocTich: chu("quocTich", "nationality"),
    khuCongNghiep: chu("khuCongNghiep", "industrialZone", "kcn"),
    tinhThanh: chu("tinhThanh", "province", "city", "tinh"),
    loaiCongTrinh: chu("loaiCongTrinh", "buildingType", "loaiHinh"),
    hinhThucXayDung: chu("hinhThucXayDung", "constructionType"),
    giaiDoanDuAn: chu("giaiDoanDuAn", "projectStage", "giaiDoan"),
    hoSoPhatThau: chu("hoSoPhatThau", "designedBy"),
    dienTichDat: laySo("dienTichDat", "landArea", "dienTich"),
    tinhTrangDuAn: chu("tinhTrangDuAn", "projectStatus", "trangThai", "status"),
    ngayKhoiTao: layNgay("ngayKhoiTao", "createdDate", "ngayTao", "createdAt"),
    nguoiTao: chu("nguoiTao", "createdBy", "nguoiPhuTrach", "owner"),
    tienDoThietKe: laySo("tienDoThietKe", "designProgress"),
    giaiDoanThietKe: chu("giaiDoanThietKe", "designPhase"),
  };
};

/** Id document Firestore an toàn (không trùng) suy ra từ mã dự án — xem idAnToanTuMa(). */
export const docIdTuMaDuAn = (maDuAn: string): string => idAnToanTuMa(maDuAn);
