/**
 * KIỂU DỮ LIỆU TIẾN ĐỘ THIẾT KẾ CHI TIẾT — từng dòng công việc trang Tiến độ bên App Thiết kế,
 * nhận qua /api/webhook/tien-do-thiet-ke-chi-tiet (OpenSpec change `lien-ket-thiet-ke-dau-thau`).
 *
 * Tách file KHÔNG có "server-only" để giao diện và route cùng nhìn MỘT định nghĩa (cùng lý do
 * tienDoThietKeTypes.ts tách riêng).
 *
 * CỐ Ý không có trường email người phụ trách: Phòng Đấu thầu chỉ cần tên để theo dõi (design.md,
 * quyết định 6). Route nhận lọc theo danh sách trắng nên email bên kia gửi kèm cũng không lọt vào.
 */

export type DongTienDoThietKe = {
  id: string;
  title: string;
  assigneeName: string;
  status: string;
  startDate: string;
  endDate: string;
  overdue: boolean;
  changeNote: string;
  source: 'planned' | 'actual';
};

export type TienDoThietKeChiTiet = {
  maDuAn: string;
  tenDuAn: string;
  viewMode: 'planned' | 'actual' | 'combined';
  sharedByName: string;
  sharedAt: string;   // ISO — lúc Thiết kế bấm Share
  rows: DongTienDoThietKe[];
  nhanLuc: string;    // ISO — bên này đóng dấu lúc nhận
};

/** Collection Firestore (project hpcons-dauthau) — chỉ Admin SDK ghi, qua cổng webhook chi tiết. */
export const COLLECTION_TIEN_DO_THIET_KE_CHI_TIET = 'tien_do_thiet_ke_chi_tiet';
