import { Project, ProjectTask, Staff } from '../types';
import type { DuAnThietKe } from '../lib/tienDoThietKeTypes';
import type { DuAnTong } from '../lib/duAnTongTypes';
import { mockStaff } from './mockData';

// ===== DANH SÁCH NHÂN SỰ CHO "BẢN THỬ" (chỉ dùng khi chạy máy cá nhân) =====
// KHÔNG dùng ở production: file này chỉ được gọi từ màn đăng nhập Bản thử, và Bản thử
// bị tắt cứng khi build production (xem DEV_SANDBOX trong App.tsx).
//
// ĐÃ BỎ TOÀN BỘ HỒ SƠ GIẢ LẬP (chị Trâm chốt 27/07/2026): trước đây file này còn kèm các hồ sơ
// mẫu "[BẢN THỬ] Kho lạnh Long An / Cao ốc Phú Mỹ Hưng / Nhà máy Sợi Bình Dương / TTTM Thủ Đức..."
// nạp qua nút "Nạp dữ liệu mẫu". Khi nghiệm thu, số liệu ảo đó lẫn vào dữ liệu thật gây khó đọc
// và dễ hiểu nhầm là lỗi phần mềm. Nay Bản thử khởi đầu TRỐNG hồ sơ — tự tạo hồ sơ thật để test.

/**
 * Nhân sự mẫu — dùng lại danh sách của mockData, cộng thêm 1 tài khoản Ban giám đốc (Level 4)
 * để bản thử đủ cả 4 level cho thanh chuyển vai trò L1/L2/L3/L4.
 * Tài khoản này CHỈ có ở bản thử — mockData (dữ liệu gốc production) không đụng tới.
 */
export const sandboxStaff = (): Staff[] => [
  ...mockStaff.map(s => ({ ...s })),
  {
    id: 'S009',
    // L4 = Ban giám đốc (chị Trâm chốt 17/08/2026, thay cho "Khách mời"): xem hết, không thao tác
    hoTen: 'Ban giám đốc (tài khoản thử)',
    chucVu: 'Ban giám đốc',
    avatar: '',
    kpiDiem: 0,
    soDuAnDangLam: 0,
    tiLeDungHan: 100,
    username: 'khachmoi',
    email: '',
    role: 'VIEWER',
    mustChangePassword: false,
  },
];


// ===== 10 HỒ SƠ NHÁP — ĐI HẾT 7 BƯỚC QUY TRÌNH (chị Trâm chốt 17/08/2026) =====
// Hồ sơ thứ 10 thêm 19/09/2026: đã qua 3 VÒNG, dùng để thử bảng Lịch sử các vòng và file xuất.
// Bộ nháp cũ chỉ có 3 hồ sơ cùng nằm ở đầu quy trình nên mở app lên Kanban gần như trống, không
// thấy được luồng chạy. Nay dựng đúng 9 tình huống chị Trâm liệt kê, mỗi hồ sơ một trạng thái thật:
//
//   1. Bước 1 — Quản lý vừa lập kế hoạch, CHỜ Trưởng phòng duyệt (chưa lên Kanban để kéo).
//   2. Bước 2 — TP đã duyệt, Bộ phận đang làm dở.
//   3. Bước 3 — Bộ phận xong 100% + đã đính kèm ẢNH báo cáo đã gửi báo giá (cửa 2 → 3).
//   4. Bước 4 — Trưởng phòng đã duyệt tiến độ Phòng 100%, hồ sơ trình Ban giám đốc.
//   5. Bước 5 — BGĐ thông qua, đã GỬI CĐT (có nhật ký gửi lần 1).
//   6. Bước 6 — TRÚNG THẦU.
//   7. Bước 7 — RỚT THẦU.
//   8. Bước 1 — CĐT yêu cầu sửa, hồ sơ bị kéo về Bước 1, đang chờ phân rã VÒNG 2.
//   9. Bước 1 — làm không đạt tiến độ, Quản lý tự kéo về, ĐÃ DỜI HẠN và chờ phân rã lại.
//
// Ngày để CỐ ĐỊNH (không dùng Date.now) để lần nào nạp cũng ra cùng số liệu, dễ đối chiếu
// trước/sau khi Xuất Excel → Phục hồi. Tên có tiền tố NHÁP để không lẫn với hồ sơ thật.

const viecNhap = (
  id: string,
  name: string,
  weight: number,
  assignedTo: string,
  ngayBatDau: string,
  soNgay: number,
  xong = false,
  vong = 1,
): ProjectTask => ({
  id,
  name,
  weight,
  isCompleted: xong,
  assignedTo,
  assignedStaffIds: [assignedTo],
  ngayBatDau,
  soNgay,
  staffProgress: xong ? 100 : 0,
  managerProgress: xong ? 100 : 0,
  ketQuaCongViec: xong ? 'Đã hoàn thành và bàn giao cho Quản lý kiểm tra.' : undefined,
  completedAt: xong ? ngayBatDau : undefined,
  vong,
});

/** Việc con đang làm DỞ (nhân viên báo x%, quản lý chưa duyệt) — cho hồ sơ ở Bước 2. */
const viecDangLam = (
  id: string, name: string, weight: number, assignedTo: string,
  ngayBatDau: string, soNgay: number, phanTram: number, vong = 1,
): ProjectTask => ({
  id, name, weight, isCompleted: false, assignedTo, assignedStaffIds: [assignedTo],
  ngayBatDau, soNgay, staffProgress: phanTram, managerProgress: 0, vong,
});

// DỰ ÁN CHA nháp. BẮT BUỘC phải có: khối "Danh sách Dự án" ở màn Báo cáo tiến độ chỉ hiện khi
// có ít nhất một bản ghi loaiBanGhi = 'DU_AN' (chị Trâm báo 28/07/2026).
const duAnChaNhap = (
  id: string,
  projectId: string,
  tenDuAn: string,
  chuDauTu: string,
  ngayBatDau: string,
  diaChi = '',
): Project => ({
  id,
  loaiBanGhi: 'DU_AN',
  projectId,
  tenDuAn,
  chuDauTu,
  diaChi,
  quanLyId: 'S003',
  thucHienId: '',
  thucHienIds: [],
  hangMuc: 'Báo giá chi tiết',
  moTa: 'Dự án cha (nháp) — dùng để thử quy trình, xuất Excel và phục hồi.',
  ngayBatDau,
  soNgayDuKien: 0,
  ngayHoanThanhDuKienGoc: ngayBatDau,
  ngayHoanThanhDuKienHienTai: ngayBatDau,
  tienDoBoPhan: 0,
  tienDoPhong: 0,
  delayLogs: [],
  trangThai: 'DANG_THUC_HIEN',
  tinhTrangDuAn: 'Đang triển khai',
  tasks: [],
});

/** Khung chung của một CÔNG VIỆC nháp — mỗi hồ sơ bên dưới chỉ khai phần khác nhau. */
type KhungViec = Partial<Project> & {
  id: string; duAnChaId: string; projectId: string; tenDuAn: string; chuDauTu: string;
  moTa: string; ngayBatDau: string; ngayHoanThanhDuKienGoc: string;
};
const congViecNhap = (k: KhungViec): Project => ({
  loaiBanGhi: 'CONG_VIEC',
  diaChi: '',
  quanLyId: 'S003',
  thucHienId: 'S004',
  thucHienIds: ['S004'],
  hangMuc: 'Báo giá chi tiết',
  // Khai đủ các trường THÔNG TIN CHUNG để thử tính năng "Lấy thông tin từ dự án cũ" (mục 42):
  // bộ nháp cũ bỏ trống mấy ô này nên chọn dự án mẫu xong vẫn thấy trống, không kiểm được.
  quocTich: 'Đài Loan',
  loaiCongTrinh: 'Nhà máy / nhà xưởng công nghiệp',
  hinhThucXayDung: 'Xây mới',
  giaiDoanDuAn: 'Thiết kế & Báo giá',
  hoSoPhatThau: 'CĐT phát thầu',
  dienTichDat: 12000,
  mucUuTien: 1,
  soNgayDuKien: 6,
  soNgayThucHien: 4,
  soNgayDuyetTP: 1,
  soNgayDuyetBLD: 1,
  ngayHoanThanhDuKienHienTai: k.ngayHoanThanhDuKienGoc,
  tienDoBoPhan: 0,
  tienDoPhong: 0,
  delayLogs: [],
  trangThai: 'DANG_THUC_HIEN',
  tinhTrangDuAn: 'Đang triển khai',
  hinhThucDauThau: 'Đấu thầu cạnh tranh',
  tpDaDuyet: true,
  kanbanStep: 1,
  vongHienTai: 1,
  tasks: [],
  ...k,
} as Project);

export const duAnNhap = (): Project[] => [
  // ---------- DỰ ÁN CHA (hiện ở khối "Danh sách Dự án", KHÔNG lên Kanban) ----------
  duAnChaNhap('NHAP-DA-01', '2026.81', '[NHÁP] Nhà máy dệt Bình Dương', 'Công ty TNHH Dệt Bình Dương', '2026-09-12', 'KCN Sóng Thần, Bình Dương'),
  duAnChaNhap('NHAP-DA-02', '2026.82', '[NHÁP] Kho vận Long Thành', 'Công ty CP Logistics Long Thành', '2026-09-07', 'KCN Long Thành, Đồng Nai'),
  duAnChaNhap('NHAP-DA-03', '2026.83', '[NHÁP] Nhà xưởng Sunfiber GĐ2', 'Công ty TNHH Sunfiber Việt Nam', '2026-08-30', 'KCN Bàu Bàng, TP HCM'),
  duAnChaNhap('NHAP-DA-04', '2026.84', '[NHÁP] Trung tâm chế biến Phúc Sinh', 'Công ty CP Phúc Sinh Đắk Nông', '2026-08-22', 'Xã Thuận Hạnh, Lâm Đồng'),
  duAnChaNhap('NHAP-DA-05', '2026.85', '[NHÁP] Nhà máy Texlot GĐ1', 'Công ty TNHH Texlot Textile', '2026-08-17', 'KCN Phú An Thạnh, Tây Ninh'),

  // ================= 1. BƯỚC 1 — CHỜ TRƯỞNG PHÒNG DUYỆT KẾ HOẠCH =================
  // Quản lý vừa lập xong kế hoạch việc con (đủ 100% tỉ trọng) và bấm Lưu → tpDaDuyet = false.
  // Hồ sơ đứng ở Bước 1, hiện trong chuông "Chờ Trưởng phòng xử lý", chưa ai làm được gì.
  congViecNhap({
    id: 'NHAP-01', duAnChaId: 'NHAP-DA-01', projectId: '2026.81',
    tenDuAn: '[NHÁP] Nhà máy dệt Bình Dương', chuDauTu: 'Công ty TNHH Dệt Bình Dương',
    diaChi: 'KCN Sóng Thần, Bình Dương',
    khuCongNghiep: 'KCN Sóng Thần', tinhThanh: 'Bình Dương', dienTichDat: 18000,
    hangMuc: 'Báo giá chi tiết',
    moTa: 'Trạng thái 1/9 — Quản lý vừa lập kế hoạch, ĐANG CHỜ Trưởng phòng duyệt để lên Bước 2.',
    ngayBatDau: '2026-09-13', ngayHoanThanhDuKienGoc: '2026-09-19',
    tpDaDuyet: false, kanbanStep: 1,
    thucHienId: 'S004', thucHienIds: ['S004', 'S005'],
    tasks: [
      viecNhap('NHAP-01-T1', 'Bóc tách khối lượng phần thô', 60, 'S004', '2026-09-13', 3),
      viecNhap('NHAP-01-T2', 'Áp giá vật tư & nhân công', 40, 'S005', '2026-09-16', 2),
    ],
  }),

  // ================= 2. BƯỚC 2 — ĐÃ DUYỆT, BỘ PHẬN ĐANG LÀM =================
  congViecNhap({
    id: 'NHAP-02', duAnChaId: 'NHAP-DA-01', projectId: '2026.81',
    tenDuAn: '[NHÁP] Nhà máy dệt Bình Dương — gói M&E', chuDauTu: 'Công ty TNHH Dệt Bình Dương',
    diaChi: 'KCN Sóng Thần, Bình Dương',
    hangMuc: 'Khái toán',
    moTa: 'Trạng thái 2/9 — Trưởng phòng đã duyệt kế hoạch, Bộ phận đang triển khai (Bước 2).',
    ngayBatDau: '2026-09-09', ngayHoanThanhDuKienGoc: '2026-09-16',
    kanbanStep: 2, tienDoBoPhan: 45,
    thucHienId: 'S006', thucHienIds: ['S006'],
    tasks: [
      viecNhap('NHAP-02-T1', 'Khảo sát hiện trạng & bóc khối lượng M&E', 50, 'S006', '2026-09-09', 3, true),
      viecDangLam('NHAP-02-T2', 'Lập bảng khái toán theo suất đầu tư', 50, 'S006', '2026-09-12', 3, 40),
    ],
  }),

  // ============ 3. BƯỚC 3 — BỘ PHẬN XONG 100% + ĐÃ ĐÍNH KÈM ẢNH ĐÃ GỬI BÁO GIÁ ============
  // Đi qua đúng cửa 2 → 3: phải có ảnh báo cáo đã gửi báo giá mới cho kéo (góp ý #12).
  congViecNhap({
    id: 'NHAP-03', duAnChaId: 'NHAP-DA-02', projectId: '2026.82',
    tenDuAn: '[NHÁP] Kho vận Long Thành', chuDauTu: 'Công ty CP Logistics Long Thành',
    diaChi: 'KCN Long Thành, Đồng Nai',
    khuCongNghiep: 'KCN Long Thành', tinhThanh: 'Đồng Nai', dienTichDat: 24500, quocTich: 'Singapore',
    hangMuc: 'Báo giá chi tiết',
    moTa: 'Trạng thái 3/9 — Bộ phận xong 100%, đã đính kèm ảnh báo cáo đã gửi báo giá, chờ Phòng duyệt (Bước 3).',
    ngayBatDau: '2026-09-07', ngayHoanThanhDuKienGoc: '2026-09-15',
    kanbanStep: 3, tienDoBoPhan: 100, tienDoPhong: 0,
    hanHenCDT: '2026-09-17',
    anhBaoCaoGuiBaoGia: 'anh-da-gui-bao-gia-20260813-1615.png | mail-xac-nhan-CDT.png',
    ghiChuGuiBaoGia: 'Đã gửi mail cho Mr. Chen lúc 16:15 ngày 13/08/2026, kèm bảng giá ver01.',
    thucHienId: 'S007', thucHienIds: ['S007', 'S008'],
    tasks: [
      viecNhap('NHAP-03-T1', 'Bóc tách kết cấu & nền móng', 45, 'S007', '2026-09-07', 3, true),
      viecNhap('NHAP-03-T2', 'Bóc tách kiến trúc & hoàn thiện', 30, 'S008', '2026-09-10', 2, true),
      viecNhap('NHAP-03-T3', 'Tổng hợp giá & đóng gói hồ sơ', 25, 'S007', '2026-09-12', 2, true),
    ],
  }),

  // ============ 4. BƯỚC 4 — PHÒNG ĐÃ DUYỆT 100%, TRÌNH BAN GIÁM ĐỐC ============
  congViecNhap({
    id: 'NHAP-04', duAnChaId: 'NHAP-DA-03', projectId: '2026.83',
    tenDuAn: '[NHÁP] Nhà xưởng Sunfiber GĐ2', chuDauTu: 'Công ty TNHH Sunfiber Việt Nam',
    diaChi: 'KCN Bàu Bàng, TP HCM',
    hangMuc: 'Khái toán',
    moTa: 'Trạng thái 4/9 — Trưởng phòng đã kiểm tra & duyệt tiến độ Phòng 100%, hồ sơ trình Ban giám đốc (Bước 4).',
    ngayBatDau: '2026-09-06', ngayHoanThanhDuKienGoc: '2026-09-15',
    kanbanStep: 4, tienDoBoPhan: 100, tienDoPhong: 100,
    hanHenCDT: '2026-09-19',
    ketQuaPhong: 'Đã rà soát toàn bộ đơn giá và khối lượng BOQ; hồ sơ đạt yêu cầu, trình Ban giám đốc ký.',
    taiLieuKetQuaPhong: 'BANG-TONG-HOP-GIA-ver02.xlsx',
    anhBaoCaoGuiBaoGia: 'anh-da-gui-bao-gia-20260806-1030.png',
    thucHienId: 'S005', thucHienIds: ['S005'],
    tasks: [
      viecNhap('NHAP-04-T1', 'Khái toán suất đầu tư nhà xưởng', 60, 'S005', '2026-09-06', 4, true),
      viecNhap('NHAP-04-T2', 'Soát xét & trình bày hồ sơ khái toán', 40, 'S005', '2026-09-12', 2, true),
    ],
  }),

  // ============ 5. BƯỚC 5 — BGĐ THÔNG QUA, ĐÃ GỬI CHỦ ĐẦU TƯ ============
  congViecNhap({
    id: 'NHAP-05', duAnChaId: 'NHAP-DA-04', projectId: '2026.84',
    tenDuAn: '[NHÁP] Trung tâm chế biến Phúc Sinh', chuDauTu: 'Công ty CP Phúc Sinh Đắk Nông',
    diaChi: 'Xã Thuận Hạnh, Lâm Đồng',
    hangMuc: 'Báo giá chi tiết',
    moTa: 'Trạng thái 5/9 — Ban giám đốc đã thông qua, hồ sơ ĐÃ GỬI Chủ đầu tư (Bước 5), đang chờ kết quả.',
    ngayBatDau: '2026-08-22', ngayHoanThanhDuKienGoc: '2026-09-02',
    kanbanStep: 5, tienDoBoPhan: 100, tienDoPhong: 100,
    hanHenCDT: '2026-09-03', ngayHoanThanhThucTe: '2026-09-02',
    trangThai: 'HOAN_THANH_DUNG_HAN',
    ketQuaPhong: 'Hồ sơ đã duyệt và gửi CĐT đúng hạn cam kết.',
    anhBaoCaoGuiBaoGia: 'anh-da-gui-bao-gia-20260731-1720.png',
    guiCDTLogs: [{ lan: 1, ngay: '2026-09-02', tienDoPhong: 100, ketQuaPhong: 'Gửi bản chào giá lần 1.', nguoiGui: 'Ngô Nữ Quỳnh Trâm' }],
    thucHienId: 'S004', thucHienIds: ['S004', 'S006'],
    tasks: [
      viecNhap('NHAP-05-T1', 'Bóc tách khối lượng nhà máy chế biến', 55, 'S004', '2026-08-22', 4, true),
      viecNhap('NHAP-05-T2', 'Áp giá & tổng hợp bảng chào', 45, 'S006', '2026-08-27', 4, true),
    ],
  }),

  // ============ 6. BƯỚC 6 — TRÚNG THẦU ============
  congViecNhap({
    id: 'NHAP-06', duAnChaId: 'NHAP-DA-05', projectId: '2026.85',
    tenDuAn: '[NHÁP] Nhà máy Texlot GĐ1', chuDauTu: 'Công ty TNHH Texlot Textile',
    diaChi: 'KCN Phú An Thạnh, Tây Ninh',
    khuCongNghiep: 'KCN Phú An Thạnh', tinhThanh: 'Tây Ninh', dienTichDat: 32000,
    hangMuc: 'Báo giá chi tiết',
    moTa: 'Trạng thái 6/9 — Gói thầu đã TRÚNG (Bước 6).',
    ngayBatDau: '2026-08-17', ngayHoanThanhDuKienGoc: '2026-08-26',
    kanbanStep: 6, tienDoBoPhan: 100, tienDoPhong: 100,
    hanHenCDT: '2026-08-27', ngayHoanThanhThucTe: '2026-08-26',
    trangThai: 'HOAN_THANH_DUNG_HAN', tinhTrangDuAn: 'Đã trúng thầu',
    ketQuaPhong: 'Giá chốt sau đàm phán, CĐT đã phát thư trúng thầu.',
    anhBaoCaoGuiBaoGia: 'anh-da-gui-bao-gia-20260724-0915.png',
    guiCDTLogs: [{ lan: 1, ngay: '2026-08-26', tienDoPhong: 100, ketQuaPhong: 'Gửi bản chào giá chính thức.', nguoiGui: 'Ngô Nữ Quỳnh Trâm' }],
    thucHienId: 'S008', thucHienIds: ['S008'],
    tasks: [
      viecNhap('NHAP-06-T1', 'Bóc tách & áp giá toàn bộ gói thầu', 100, 'S008', '2026-08-17', 6, true),
    ],
  }),

  // ============ 7. BƯỚC 7 — RỚT THẦU ============
  congViecNhap({
    id: 'NHAP-07', duAnChaId: 'NHAP-DA-05', projectId: '2026.85',
    tenDuAn: '[NHÁP] Nhà máy Texlot GĐ1 — gói ME', chuDauTu: 'Công ty TNHH Texlot Textile',
    diaChi: 'KCN Phú An Thạnh, Tây Ninh',
    hangMuc: 'Khái toán',
    moTa: 'Trạng thái 7/9 — Gói thầu RỚT (Bước 7), giữ lại để đối chiếu giá cho lần sau.',
    ngayBatDau: '2026-08-12', ngayHoanThanhDuKienGoc: '2026-08-20',
    kanbanStep: 7, tienDoBoPhan: 100, tienDoPhong: 100,
    hanHenCDT: '2026-08-22', ngayHoanThanhThucTe: '2026-08-23',
    trangThai: 'HOAN_THANH_TRE_HAN', tinhTrangDuAn: 'Rớt thầu',
    nguyenNhanTreHan: 'CĐT rút ngắn hạn nộp 2 ngày so với thỏa thuận ban đầu.',
    ketQuaPhong: 'Giá cao hơn đối thủ khoảng 6%, CĐT chọn nhà thầu khác.',
    anhBaoCaoGuiBaoGia: 'anh-da-gui-bao-gia-20260721-1105.png',
    guiCDTLogs: [{ lan: 1, ngay: '2026-08-23', tienDoPhong: 100, ketQuaPhong: 'Gửi khái toán gói ME.', nguoiGui: 'Ngô Nữ Quỳnh Trâm' }],
    thucHienId: 'S007', thucHienIds: ['S007'],
    tasks: [
      viecNhap('NHAP-07-T1', 'Khái toán hệ thống cơ điện', 100, 'S007', '2026-08-12', 6, true),
    ],
  }),

  // ====== 8. BƯỚC 1 — CĐT YÊU CẦU SỬA, KÉO VỀ BƯỚC 1, CHỜ PHÂN RÃ VÒNG 2 ======
  // Việc con của VÒNG 1 giữ nguyên (đã đủ 100% và đã xong); vòng 2 chưa có việc nào →
  // Quản lý phải phân bổ lại đủ 100% cho vòng 2 rồi Trưởng phòng duyệt thì hồ sơ mới chạy tiếp.
  congViecNhap({
    id: 'NHAP-08', duAnChaId: 'NHAP-DA-04', projectId: '2026.84',
    tenDuAn: '[NHÁP] Trung tâm chế biến Phúc Sinh — điều chỉnh', chuDauTu: 'Công ty CP Phúc Sinh Đắk Nông',
    diaChi: 'Xã Thuận Hạnh, Lâm Đồng',
    hangMuc: 'Báo giá chi tiết',
    moTa: 'Trạng thái 8/9 — CĐT yêu cầu chỉnh phương án, hồ sơ vừa bị kéo về Bước 1, ĐANG CHỜ phân rã VÒNG 2.',
    ngayBatDau: '2026-09-11', ngayHoanThanhDuKienGoc: '2026-09-19',
    kanbanStep: 1, tienDoBoPhan: 0, tienDoPhong: 0,
    vongHienTai: 2, tpDaDuyet: false,
    hanHenCDT: '2026-09-22',
    cdtDieuChinh: [{ ngay: '2026-09-10', noiDung: 'CĐT yêu cầu bỏ hạng mục kho lạnh, tách riêng phần PCCC.', buocVe: 1 }],
    guiCDTLogs: [{ lan: 1, ngay: '2026-09-05', tienDoPhong: 100, ketQuaPhong: 'Bản chào giá lần 1 (vòng 1).', nguoiGui: 'Ngô Nữ Quỳnh Trâm' }],
    thucHienId: 'S005', thucHienIds: ['S005'],
    tasks: [
      // Vòng 1 — đã xong, giữ lại để lũy kế tỉ trọng 100% × số vòng
      viecNhap('NHAP-08-T1', 'Bóc tách & áp giá phương án ban đầu', 100, 'S005', '2026-08-29', 5, true, 1),
      // Vòng 2 — CHƯA có việc nào: đây chính là phần Quản lý phải phân rã lại
    ],
  }),

  // ====== 9. BƯỚC 1 — LÀM KHÔNG ĐẠT TIẾN ĐỘ, QUẢN LÝ TỰ KÉO VỀ, ĐÃ DỜI HẠN ======
  congViecNhap({
    id: 'NHAP-09', duAnChaId: 'NHAP-DA-02', projectId: '2026.82',
    tenDuAn: '[NHÁP] Kho vận Long Thành — mở rộng', chuDauTu: 'Công ty CP Logistics Long Thành',
    diaChi: 'KCN Long Thành, Đồng Nai',
    hangMuc: 'Lập hồ sơ thầu',
    moTa: 'Trạng thái 9/9 — Bộ phận làm không kịp tiến độ, Quản lý kéo hồ sơ về Bước 1, ĐÃ DỜI HẠN và chờ phân rã lại.',
    ngayBatDau: '2026-09-01', ngayHoanThanhDuKienGoc: '2026-09-09',
    ngayHoanThanhDuKienHienTai: '2026-09-16',
    kanbanStep: 1, tienDoBoPhan: 30, tienDoPhong: 0,
    tpDaDuyet: false, choDuyetLai: true, lyDoChoDuyetLai: 'DOI_HAN',
    trangThai: 'TRE_TIEN_DO',
    nguyenNhanTreHan: 'Thiếu bản vẽ kỹ thuật từ CĐT, nhân sự phải chờ 4 ngày.',
    delayLogs: [{
      id: 'NHAP-09-D1', ngayThayDoi: '2026-09-09', ngayCu: '2026-09-09', ngayMoi: '2026-09-16',
      soNgayLech: 7, lyDo: 'CĐT giao bản vẽ trễ, phải dời hạn nộp 7 ngày.', nguoiDuyet: 'Ngô Nữ Quỳnh Trâm',
    }],
    thucHienId: 'S006', thucHienIds: ['S006', 'S007'],
    tasks: [
      viecDangLam('NHAP-09-T1', 'Lập hồ sơ năng lực & pháp lý', 40, 'S006', '2026-09-01', 3, 60),
      viecDangLam('NHAP-09-T2', 'Bóc tách khối lượng phần mở rộng', 60, 'S007', '2026-09-05', 4, 10),
    ],
  }),

  // ====== 10. HỒ SƠ ĐÃ QUA 3 VÒNG — ĐỦ LỘ TRÌNH & MỐC THỜI GIAN (chị Trâm chốt 19/09/2026) ======
  // "Làm cho chị 1 dự án nháp đã gửi đi cho CĐT tổng 3 vòng, lưu ý tạo đủ lộ trình và tạo đủ mốc
  //  thời gian, chị xuất báo cáo ra xem thử."
  //
  // Dựng đúng một ca thật: CĐT trả hồ sơ về sửa hai lần, mỗi lần mở một vòng mới.
  //   VÒNG 1: 03/08 → gửi CĐT 12/08. CĐT đổi thiết kế móng, trả về.
  //   VÒNG 2: 17/08 → gửi CĐT 28/08. CĐT bổ sung hạng mục PCCC, trả về.
  //   VÒNG 3: 02/09 → gửi CĐT 15/09 (lần gửi thứ 3, đang chờ kết quả).
  // Mỗi vòng có bộ việc con RIÊNG mang đúng số `vong`, và mỗi lần dời hạn đều có phiếu ghi lại —
  // để bảng "Lịch sử các vòng" và file xuất Excel có đủ dữ liệu mà đọc.
  congViecNhap({
    id: 'NHAP-10', duAnChaId: 'NHAP-DA-03', projectId: '2026.83',
    tenDuAn: '[NHÁP] Nhà xưởng Sunfiber GĐ2 — gói kết cấu',
    chuDauTu: 'Công ty TNHH Sunfiber Việt Nam',
    diaChi: 'KCN Phú An Thạnh, Tây Ninh',
    khuCongNghiep: 'KCN Phú An Thạnh', tinhThanh: 'Tây Ninh', dienTichDat: 24000,
    quocTich: 'Singapore',
    hangMuc: 'Báo giá chi tiết',
    moTa: 'Hồ sơ đã qua 3 VÒNG — CĐT trả về sửa 2 lần. Dùng để thử bảng Lịch sử các vòng và file xuất báo cáo.',
    ngayBatDau: '2026-09-02',          // mốc bắt đầu của VÒNG ĐANG CHẠY (vòng 3)
    ngayHoanThanhDuKienGoc: '2026-09-14',
    ngayHoanThanhDuKienHienTai: '2026-09-17',
    soNgayThucHien: 11, soNgayDuyetTP: 2,
    kanbanStep: 5, vongHienTai: 3,
    tienDoBoPhan: 100, tienDoPhong: 100,
    hanHenCDT: '2026-09-18', ngayHoanThanhThucTe: '2026-09-15',
    trangThai: 'HOAN_THANH_DUNG_HAN', tinhTrangDuAn: 'Đang triển khai',
    ketQuaPhong: 'Vòng 3: đã cập nhật phần móng theo thiết kế mới và bổ sung hạng mục PCCC. Giá chốt gửi CĐT 15/09.',
    anhBaoCaoGuiBaoGia: 'anh-da-gui-bao-gia-20260915-1420.png',
    quanLyId: 'S003',
    thucHienId: 'S004', thucHienIds: ['S004', 'S005', 'S006'],
    // BA LẦN GỬI CĐT — mỗi vòng một lần, ngày tăng dần đúng lộ trình.
    guiCDTLogs: [
      { lan: 1, ngay: '2026-08-12', tienDoPhong: 100, ketQuaPhong: 'Vòng 1: bản chào giá đầu tiên theo thiết kế cơ sở.', nguoiGui: 'Ngô Nữ Quỳnh Trâm' },
      { lan: 2, ngay: '2026-08-28', tienDoPhong: 100, ketQuaPhong: 'Vòng 2: cập nhật phần móng theo thiết kế CĐT sửa.', nguoiGui: 'Ngô Nữ Quỳnh Trâm' },
      { lan: 3, ngay: '2026-09-15', tienDoPhong: 100, ketQuaPhong: 'Vòng 3: bổ sung hạng mục PCCC, chốt giá cuối.', nguoiGui: 'Ngô Nữ Quỳnh Trâm' },
    ],
    // PHIẾU DỜI HẠN qua các vòng — có cả phiếu Bộ phận lẫn phiếu Phòng để thử đủ hai khâu.
    delayLogs: [
      {
        id: 'NHAP-10-D1', ngayThayDoi: '2026-08-07', ngayCu: '2026-08-08', ngayMoi: '2026-08-11',
        soNgayLech: 3, lyDo: 'Vòng 1: CĐT giao bản vẽ kết cấu trễ 3 ngày.', nguoiDuyet: '',
        vong: 1, khau: 'BO_PHAN', khauTre: 'BO_PHAN',
      },
      {
        id: 'NHAP-10-D2', ngayThayDoi: '2026-08-24', ngayCu: '2026-08-25', ngayMoi: '2026-08-27',
        soNgayLech: 2, lyDo: 'Vòng 2: chờ nhà thầu phụ báo giá cọc khoan nhồi.', nguoiDuyet: '',
        vong: 2, khau: 'BO_PHAN', khauTre: 'BO_PHAN',
      },
      {
        id: 'NHAP-10-D3', ngayThayDoi: '2026-09-10', ngayCu: '2026-09-14', ngayMoi: '2026-09-17',
        soNgayLech: 3, lyDo: 'Vòng 3: hạng mục PCCC phát sinh, cần thêm 3 ngày bóc tách.', nguoiDuyet: '',
        vong: 3, khau: 'BO_PHAN', khauTre: 'BO_PHAN',
      },
      {
        id: 'NHAP-10-D4', ngayThayDoi: '2026-09-12', ngayCu: '2026-09-15', ngayMoi: '2026-09-16',
        soNgayLech: 1, lyDo: 'Vòng 3: Trưởng phòng cần thêm 1 ngày soát lại bảng giá PCCC.', nguoiDuyet: '',
        vong: 3, khau: 'PHONG', khauTre: 'PHONG',
      },
    ],
    // VIỆC CON CỦA CẢ BA VÒNG — mỗi vòng đủ 100% tỉ trọng của riêng nó.
    tasks: [
      // --- Vòng 1: chào giá theo thiết kế cơ sở (đã xong) ---
      viecNhap('NHAP-10-V1T1', 'Bóc tách khối lượng kết cấu thân', 50, 'S004', '2026-08-03', 5, true, 1),
      viecNhap('NHAP-10-V1T2', 'Áp giá vật tư & nhân công', 30, 'S005', '2026-08-06', 4, true, 1),
      viecNhap('NHAP-10-V1T3', 'Tổng hợp & đóng gói hồ sơ chào giá', 20, 'S006', '2026-08-10', 2, true, 1),
      // --- Vòng 2: CĐT đổi thiết kế móng (đã xong) ---
      viecNhap('NHAP-10-V2T1', 'Bóc tách lại phần móng theo thiết kế mới', 45, 'S004', '2026-08-17', 6, true, 2),
      viecNhap('NHAP-10-V2T2', 'Cập nhật đơn giá cọc khoan nhồi', 35, 'S005', '2026-08-21', 4, true, 2),
      viecNhap('NHAP-10-V2T3', 'Soát lại tổng giá & gửi CĐT', 20, 'S006', '2026-08-26', 2, true, 2),
      // --- Vòng 3: bổ sung PCCC (đã xong, đang chờ kết quả thầu) ---
      viecNhap('NHAP-10-V3T1', 'Bóc tách hạng mục PCCC bổ sung', 40, 'S004', '2026-09-02', 5, true, 3),
      viecNhap('NHAP-10-V3T2', 'Cập nhật giá phần kết cấu theo bản vẽ mới', 35, 'S005', '2026-09-07', 4, true, 3),
      viecNhap('NHAP-10-V3T3', 'Tổng hợp giá cuối & trình Trưởng phòng', 25, 'S006', '2026-09-11', 3, true, 3),
    ],
  }),
];


// ===== TIẾN ĐỘ THIẾT KẾ MẪU CHO "BẢN THỬ" (chị Trâm chốt 15/09/2026) =====
// "Đây là giao diện của app thiết kế, em thiết kế lại chỗ liên kết phòng ban đưa tiến độ này qua."
//
// Ở bản chạy thật, bảng này KHÔNG dùng dữ liệu dưới đây — nó đọc dữ liệu App Thiết kế đẩy sang
// qua /api/webhook/tien-do-thiet-ke. Bộ mẫu này CHỈ để Bản thử có cái mà xem khi chưa nối app
// (chị Trâm: "chứ không có để khơi khơi màn hình không như vậy được"), dựng đủ các tình huống:
// đang chạy / hoàn thành / trễ hạn / chưa có hạng mục.
//
// Mã dự án CỐ Ý trùng với mã hồ sơ đấu thầu mẫu (2026.81 / .82 / .84 / .85): hai app ghép nhau
// bằng mã dự án, mã không trùng thì Chuyên viên (Level 3) mở lên chỉ thấy bảng trống và tưởng
// tính năng hỏng, trong khi thật ra là dữ liệu mẫu không khớp nhau.
export const tienDoThietKeNhap = (): DuAnThietKe[] => [
  {
    maDuAn: '2026.81',
    tenDuAn: '[NHÁP] Nhà máy dệt Bình Dương',
    namTaiChinh: '2026-2027',
    loaiDuAn: 'Nhà máy',
    tinhTrang: 'Đang thực hiện',
    ngayLap: '2026-07-06',
    ngayHoanThanh: '2026-10-30',
    nguoiThucHien: 'Phạm Quân',
    hangMuc: [
      { id: 'hm1', ten: 'Kiến trúc', loaiDuAn: 'Nhà máy', tinhTrang: 'Hoàn thành', ngayLap: '2026-07-06', ngayHoanThanh: '2026-08-20', soTask: 12, soTaskXong: 12, nguoiThucHien: 'Trần Bảo', treHan: 0 },
      { id: 'hm2', ten: 'Kết cấu', loaiDuAn: 'Nhà máy', tinhTrang: 'Đang thực hiện', ngayLap: '2026-08-01', ngayHoanThanh: '2026-09-28', soTask: 10, soTaskXong: 6, nguoiThucHien: 'Lê Minh', treHan: 0 },
      { id: 'hm3', ten: 'Cơ điện (M&E)', loaiDuAn: 'Nhà máy', tinhTrang: 'Đang thực hiện', ngayLap: '2026-08-15', ngayHoanThanh: '2026-10-30', soTask: 14, soTaskXong: 4, nguoiThucHien: 'Võ Hải', treHan: 0 },
    ],
  },
  {
    maDuAn: '2026.82',
    tenDuAn: '[NHÁP] Kho vận Long Thành',
    namTaiChinh: '2026-2027',
    loaiDuAn: 'Kho lạnh',
    tinhTrang: 'Trễ hạn',
    ngayLap: '2026-06-15',
    ngayHoanThanh: '2026-09-05',
    nguoiThucHien: 'Nguyễn Duy',
    hangMuc: [
      { id: 'hm1', ten: 'Kiến trúc', loaiDuAn: 'Kho lạnh', tinhTrang: 'Hoàn thành', ngayLap: '2026-06-15', ngayHoanThanh: '2026-07-30', soTask: 9, soTaskXong: 9, nguoiThucHien: 'Trần Bảo', treHan: 0 },
      { id: 'hm2', ten: 'Kết cấu', loaiDuAn: 'Kho lạnh', tinhTrang: 'Trễ hạn', ngayLap: '2026-07-01', ngayHoanThanh: '2026-09-05', soTask: 11, soTaskXong: 7, nguoiThucHien: 'Lê Minh', treHan: 10 },
      { id: 'hm3', ten: 'Hệ thống lạnh', loaiDuAn: 'Kho lạnh', tinhTrang: 'Trễ hạn', ngayLap: '2026-07-10', ngayHoanThanh: '2026-09-01', soTask: 8, soTaskXong: 3, nguoiThucHien: 'Võ Hải', treHan: 14 },
    ],
  },
  {
    maDuAn: '2026.84',
    tenDuAn: '[NHÁP] Trung tâm chế biến Phúc Sinh',
    namTaiChinh: '2026-2027',
    loaiDuAn: 'Thương mại',
    tinhTrang: 'Hoàn thành',
    ngayLap: '2026-04-02',
    ngayHoanThanh: '2026-08-12',
    nguoiThucHien: 'Phạm Quân',
    hangMuc: [
      { id: 'hm1', ten: 'Kiến trúc', loaiDuAn: 'Thương mại', tinhTrang: 'Hoàn thành', ngayLap: '2026-04-02', ngayHoanThanh: '2026-06-18', soTask: 15, soTaskXong: 15, nguoiThucHien: 'Trần Bảo', treHan: 0 },
      { id: 'hm2', ten: 'Nội thất', loaiDuAn: 'Thương mại', tinhTrang: 'Hoàn thành', ngayLap: '2026-05-20', ngayHoanThanh: '2026-08-12', soTask: 13, soTaskXong: 13, nguoiThucHien: 'Đặng Thu', treHan: 3 },
    ],
  },
  {
    maDuAn: '2026.85',
    tenDuAn: '[NHÁP] Nhà máy Texlot GĐ1',
    namTaiChinh: '2026-2027',
    loaiDuAn: 'Nhà xưởng',
    tinhTrang: 'Chưa triển khai',
    // CỐ Ý để sang năm sau: nút lọc "Năm" lấy theo ngày lập dự án, mọi hồ sơ mẫu cùng một năm
    // thì mở ra chỉ thấy đúng một lựa chọn, không thử được nút.
    ngayLap: '2027-01-05',
    nguoiThucHien: 'Nguyễn Duy',
    hangMuc: [],
  },
];


// ===== DANH MỤC DỰ ÁN MẪU CHO "BẢN THỬ" (chị Trâm chốt 19/09/2026) =====
// "Ở mục liên kết phòng ban, trên Tiến độ thiết kế, làm cho chị 1 bảng đổ dữ liệu dự án từ App
//  Thông tin dự án về nữa nha em."
//
// Bản chạy thật KHÔNG dùng bộ này — bảng đọc dữ liệu App Thông tin dự án đẩy sang qua
// /api/webhook/du-an-tong. Đây chỉ để Bản thử có cái mà xem khi chưa nối app.
// Mã dự án CỐ Ý trùng với hồ sơ đấu thầu mẫu để thấy được phạm vi của Chuyên viên (Level 3).
export const danhMucDuAnNhap = (): DuAnTong[] => [
  {
    maDuAn: '2026.81',
    tenDuAn: '[NHÁP] Nhà máy dệt Bình Dương',
    chuDauTu: 'Công ty TNHH Dệt Bình Dương',
    quocTich: 'Đài Loan',
    diaChi: 'Lô C2, KCN Sóng Thần 3',
    khuCongNghiep: 'KCN Sóng Thần',
    tinhThanh: 'Bình Dương',
    loaiCongTrinh: 'Nhà máy',
    hinhThucXayDung: 'Xây mới',
    giaiDoanDuAn: 'Thiết kế & Báo giá',
    hoSoPhatThau: 'CĐT phát thầu',
    dienTichDat: 18000,
    tinhTrangDuAn: 'Đang triển khai',
    ngayKhoiTao: '2026-08-14',
    nguoiTao: 'Nguyễn Thị Hồng Nhung',
  },
  {
    maDuAn: '2026.82',
    tenDuAn: '[NHÁP] Kho vận Long Thành',
    chuDauTu: 'Công ty CP Logistics Long Thành',
    quocTich: 'Singapore',
    diaChi: 'Lô A7, KCN Long Thành',
    khuCongNghiep: 'KCN Long Thành',
    tinhThanh: 'Đồng Nai',
    loaiCongTrinh: 'Kho vận',
    hinhThucXayDung: 'Xây mới',
    giaiDoanDuAn: 'Thiết kế & Báo giá',
    hoSoPhatThau: 'HP thiết kế',
    dienTichDat: 24500,
    tinhTrangDuAn: 'Đang triển khai',
    ngayKhoiTao: '2026-07-29',
    nguoiTao: 'Nguyễn Thị Hồng Nhung',
  },
  {
    maDuAn: '2026.84',
    tenDuAn: '[NHÁP] Trung tâm chế biến Phúc Sinh',
    chuDauTu: 'Công ty CP Phúc Sinh Đắk Nông',
    quocTich: 'Việt Nam',
    diaChi: 'Xã Đắk R\'Lấp, huyện Đắk R\'Lấp',
    khuCongNghiep: 'KCN Phú An Thạnh',
    tinhThanh: 'Tây Ninh',
    loaiCongTrinh: 'Nhà máy chế biến',
    hinhThucXayDung: 'Mở rộng',
    giaiDoanDuAn: 'Thiết kế & Báo giá',
    hoSoPhatThau: 'Đơn vị khác thiết kế',
    dienTichDat: 32000,
    tinhTrangDuAn: 'Đang triển khai',
    ngayKhoiTao: '2026-06-11',
    nguoiTao: 'Trần Minh Khoa',
  },
  {
    maDuAn: '2026.85',
    tenDuAn: '[NHÁP] Nhà máy Texlot GĐ1',
    chuDauTu: 'Công ty TNHH Texlot Textile',
    quocTich: 'Hàn Quốc',
    diaChi: 'Lô D5, KCN Bàu Bàng',
    khuCongNghiep: 'KCN Bàu Bàng',
    tinhThanh: 'Bình Dương',
    loaiCongTrinh: 'Nhà máy',
    hinhThucXayDung: 'Xây mới',
    giaiDoanDuAn: 'Tiếp cận & Tiền khả thi',
    hoSoPhatThau: 'CĐT phát thầu',
    dienTichDat: 41000,
    tinhTrangDuAn: 'Đã đóng',
    ngayKhoiTao: '2026-05-06',
    nguoiTao: 'Trần Minh Khoa',
  },
  {
    // CỐ Ý là dự án Phòng Đấu thầu CHƯA mở hồ sơ — đúng tình huống thật: App Thông tin dự án khởi
    // tạo trước, Phòng mở hồ sơ sau. Mục này hiện trong ô "Chọn dự án cha" kèm nhãn TỪ DANH MỤC;
    // chọn nó là app tự dựng hồ sơ dự án rồi gắn công việc vào (chị Trâm chốt 19/09/2026).
    maDuAn: '2026.90',
    tenDuAn: '[NHÁP] Nhà máy bao bì Tân Uyên',
    chuDauTu: 'Công ty TNHH Bao bì Tân Uyên',
    quocTich: 'Trung Quốc',
    diaChi: 'Lô B3, KCN Nam Tân Uyên',
    khuCongNghiep: 'KCN Nam Tân Uyên',
    tinhThanh: 'Bình Dương',
    loaiCongTrinh: 'Nhà máy',
    hinhThucXayDung: 'Xây mới',
    giaiDoanDuAn: 'Tiếp cận & Tiền khả thi',
    hoSoPhatThau: 'CĐT phát thầu',
    dienTichDat: 15600,
    tinhTrangDuAn: 'Đang triển khai',
    ngayKhoiTao: '2026-09-02',
    nguoiTao: 'Nguyễn Thị Hồng Nhung',
  },
];
