// ===== LUẬT PHÂN QUYỀN LEVEL — HÀM THUẦN (Sếp duyệt demo 28/09/2026) =====
// Demo: tong-quan-demo/HPCons-DauThau/phan-quyen-theo-app-tong-2026-09-28/index.html
//
// App Tổng (`app_permissions/{uid}.dauthau`, project hpcons-portal) là NGUỒN DUY NHẤT của level.
// Trưởng phòng (Level 1) vẫn nâng/hạ được người khác trong Level 2/3/4 ngay trong "Đội ngũ & KPI",
// nhưng thay đổi được ghi thẳng về App Tổng qua route máy chủ `app/api/phan-quyen/level`.
//
// File này KHÔNG import gì của máy chủ (firebase-admin, server-only) để:
//   · route máy chủ dùng làm luật quyết định chính thức,
//   · giao diện dùng cùng luật để khoá ô chọn kèm lý do,
//   · script kiểm thử chạy được bằng Node thuần, không đụng Firestore thật.

export type Role = 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER';

export const ROLES: Role[] = ['BOOD', 'MANAGER', 'STAFF', 'VIEWER'];

/** Level Trưởng phòng được đặt cho người khác trong app. Level 1 chỉ đổi ở App Tổng. */
export const LEVEL_DUOC_DAT_TRONG_APP: Role[] = ['MANAGER', 'STAFF', 'VIEWER'];

export const laRole = (v: unknown): v is Role => typeof v === 'string' && (ROLES as string[]).includes(v);

// Chức vụ MẶC ĐỊNH theo level (chị Trâm chốt thang 17/08/2026):
//   L1 = Trưởng phòng / Phó phòng · L2 = Quản lý · L3 = Nhân viên · L4 = Ban giám đốc.
export const CHUC_VU_BY_ROLE: Record<Role, string> = {
  BOOD: 'Trưởng phòng',
  MANAGER: 'Quản lý',
  STAFF: 'Chuyên viên đấu thầu',
  VIEWER: 'Ban giám đốc',
};

export const NHAN_LEVEL: Record<Role, string> = {
  BOOD: 'Level 1 · Trưởng phòng',
  MANAGER: 'Level 2 · Quản lý',
  STAFF: 'Level 3 · Chuyên viên',
  VIEWER: 'Level 4 · Ban giám đốc',
};

/**
 * Chức vụ sau khi level đổi (dùng chung cho route SSO và route đổi level):
 *   · Chức vụ cũ TRỐNG hoặc ĐÚNG BẰNG mặc định của level cũ → đổi sang mặc định của level mới.
 *   · Chức vụ cũ là chữ Trưởng phòng tự gõ/chọn khác mặc định (vd "Phó phòng") → GIỮ NGUYÊN.
 */
export function tinhChucVuMoi(roleCu: string | null | undefined, chucVuCu: string | null | undefined, roleMoi: Role): string {
  const cv = (chucVuCu ?? '').trim();
  if (!cv) return CHUC_VU_BY_ROLE[roleMoi];
  if (laRole(roleCu)) return cv === CHUC_VU_BY_ROLE[roleCu] ? CHUC_VU_BY_ROLE[roleMoi] : cv;
  // Hồ sơ rất cũ chưa có trường `role` (level suy từ chức vụ): chức vụ đúng bằng MỘT mặc định
  // nào đó thì coi là mặc định, đổi theo level mới; còn lại là chữ tự đặt → giữ.
  return (Object.values(CHUC_VU_BY_ROLE) as string[]).includes(cv) ? CHUC_VU_BY_ROLE[roleMoi] : cv;
}

export interface DauVaoDoiLevel {
  nguoiGoiUid: string;
  /** Level SỐNG của người gọi ở App Tổng (app_permissions/{uid}.dauthau), null nếu chưa có quyền. */
  nguoiGoiLevel: string | null;
  /** users/{uid}.role === 'owner' ở App Tổng. */
  nguoiGoiLaOwner: boolean;
  nguoiDichUid: string;
  /** Level SỐNG của người đích ở App Tổng, null nếu chưa được cấp quyền app Đấu thầu. */
  nguoiDichLevel: string | null;
  nguoiDichLaOwner: boolean;
  levelMoi: unknown;
}

export type KetQuaDoiLevel =
  | { duoc: true; levelCu: Role; levelMoi: Role }
  | { duoc: false; status: 400 | 403 | 404; ma: string; loi: string };

/** Luật "được đổi hay không" — route máy chủ gọi hàm này với dữ liệu đọc SỐNG từ App Tổng. */
export function quyetDinhDoiLevel(v: DauVaoDoiLevel): KetQuaDoiLevel {
  if (!v.nguoiDichUid || typeof v.nguoiDichUid !== 'string') {
    return { duoc: false, status: 400, ma: 'THIEU_NGUOI_DICH', loi: 'Thiếu nhân sự cần đổi level.' };
  }
  if (!laRole(v.levelMoi)) {
    return { duoc: false, status: 400, ma: 'LEVEL_KHONG_HOP_LE', loi: 'Level không hợp lệ.' };
  }
  const nguoiGoiLaBood = v.nguoiGoiLevel === 'BOOD';
  if (!nguoiGoiLaBood && !v.nguoiGoiLaOwner) {
    return { duoc: false, status: 403, ma: 'KHONG_PHAI_TRUONG_PHONG', loi: 'Chỉ Trưởng phòng (Level 1) được đổi level nhân sự.' };
  }
  if (v.nguoiGoiUid === v.nguoiDichUid) {
    return { duoc: false, status: 403, ma: 'TU_SUA_MINH', loi: 'Không tự sửa level của chính mình. Nhờ owner đổi ở App Tổng.' };
  }
  if (!laRole(v.nguoiDichLevel)) {
    return { duoc: false, status: 404, ma: 'DICH_CHUA_CO_QUYEN', loi: 'Người này chưa được cấp quyền app Đấu thầu ở App Tổng. Cấp quyền mới làm ở account.hpcore.vn.' };
  }
  if (v.nguoiDichLaOwner) {
    return { duoc: false, status: 403, ma: 'DICH_LA_OWNER', loi: 'Tài khoản owner: chỉ đổi ở App Tổng.' };
  }
  if (v.nguoiDichLevel === 'BOOD') {
    return { duoc: false, status: 403, ma: 'DICH_LA_LEVEL_1', loi: 'Người này đang là Level 1: chỉ đổi ở App Tổng.' };
  }
  if (!LEVEL_DUOC_DAT_TRONG_APP.includes(v.levelMoi)) {
    return { duoc: false, status: 400, ma: 'KHONG_DAT_LEVEL_1', loi: 'Trong app chỉ đặt được Level 2, 3 hoặc 4. Phong Level 1 làm ở App Tổng.' };
  }
  return { duoc: true, levelCu: v.nguoiDichLevel, levelMoi: v.levelMoi };
}

/**
 * Lý do KHOÁ ô chọn level trên giao diện (chuỗi rỗng = được sửa). Chỉ để hiển thị — máy chủ
 * vẫn kiểm lại bằng `quyetDinhDoiLevel` với dữ liệu sống.
 */
export function lyDoKhoaLevel(v: {
  nguoiXemRole: string | null | undefined;
  nguoiXemLaOwner: boolean;
  nguoiXemUid: string | null | undefined;
  nguoiDichUid: string;
  nguoiDichRole: string | null | undefined;
  nguoiDichLaOwner: boolean;
}): string {
  if (v.nguoiXemRole !== 'BOOD' && !v.nguoiXemLaOwner) return 'Chỉ Trưởng phòng được đổi level';
  if (v.nguoiXemUid && v.nguoiXemUid === v.nguoiDichUid) return 'Không tự sửa level của mình';
  if (v.nguoiDichLaOwner) return 'Tài khoản owner: chỉ đổi ở App Tổng';
  if (v.nguoiDichRole === 'BOOD') return 'Đang là Level 1: chỉ đổi ở App Tổng';
  return '';
}
