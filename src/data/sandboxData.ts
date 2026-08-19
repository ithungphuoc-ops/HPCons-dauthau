import { Project, ProjectTask, Staff } from '../types';
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


// ===== 9 HỒ SƠ NHÁP — ĐI HẾT 7 BƯỚC QUY TRÌNH (chị Trâm chốt 17/08/2026) =====
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
  duAnChaNhap('NHAP-DA-01', '2026.81', '[NHÁP] Nhà máy dệt Bình Dương', 'Công ty TNHH Dệt Bình Dương', '2026-08-10', 'KCN Sóng Thần, Bình Dương'),
  duAnChaNhap('NHAP-DA-02', '2026.82', '[NHÁP] Kho vận Long Thành', 'Công ty CP Logistics Long Thành', '2026-08-05', 'KCN Long Thành, Đồng Nai'),
  duAnChaNhap('NHAP-DA-03', '2026.83', '[NHÁP] Nhà xưởng Sunfiber GĐ2', 'Công ty TNHH Sunfiber Việt Nam', '2026-07-28', 'KCN Bàu Bàng, TP HCM'),
  duAnChaNhap('NHAP-DA-04', '2026.84', '[NHÁP] Trung tâm chế biến Phúc Sinh', 'Công ty CP Phúc Sinh Đắk Nông', '2026-07-20', 'Xã Thuận Hạnh, Lâm Đồng'),
  duAnChaNhap('NHAP-DA-05', '2026.85', '[NHÁP] Nhà máy Texlot GĐ1', 'Công ty TNHH Texlot Textile', '2026-07-15', 'KCN Phú An Thạnh, Tây Ninh'),

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
    ngayBatDau: '2026-08-18', ngayHoanThanhDuKienGoc: '2026-08-24',
    tpDaDuyet: false, kanbanStep: 1,
    thucHienId: 'S004', thucHienIds: ['S004', 'S005'],
    tasks: [
      viecNhap('NHAP-01-T1', 'Bóc tách khối lượng phần thô', 60, 'S004', '2026-08-18', 3),
      viecNhap('NHAP-01-T2', 'Áp giá vật tư & nhân công', 40, 'S005', '2026-08-21', 2),
    ],
  }),

  // ================= 2. BƯỚC 2 — ĐÃ DUYỆT, BỘ PHẬN ĐANG LÀM =================
  congViecNhap({
    id: 'NHAP-02', duAnChaId: 'NHAP-DA-01', projectId: '2026.81',
    tenDuAn: '[NHÁP] Nhà máy dệt Bình Dương — gói M&E', chuDauTu: 'Công ty TNHH Dệt Bình Dương',
    diaChi: 'KCN Sóng Thần, Bình Dương',
    hangMuc: 'Khái toán',
    moTa: 'Trạng thái 2/9 — Trưởng phòng đã duyệt kế hoạch, Bộ phận đang triển khai (Bước 2).',
    ngayBatDau: '2026-08-12', ngayHoanThanhDuKienGoc: '2026-08-19',
    kanbanStep: 2, tienDoBoPhan: 45,
    thucHienId: 'S006', thucHienIds: ['S006'],
    tasks: [
      viecNhap('NHAP-02-T1', 'Khảo sát hiện trạng & bóc khối lượng M&E', 50, 'S006', '2026-08-12', 3, true),
      viecDangLam('NHAP-02-T2', 'Lập bảng khái toán theo suất đầu tư', 50, 'S006', '2026-08-15', 3, 40),
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
    ngayBatDau: '2026-08-05', ngayHoanThanhDuKienGoc: '2026-08-13',
    kanbanStep: 3, tienDoBoPhan: 100, tienDoPhong: 0,
    hanHenCDT: '2026-08-15',
    anhBaoCaoGuiBaoGia: 'anh-da-gui-bao-gia-20260813-1615.png | mail-xac-nhan-CDT.png',
    ghiChuGuiBaoGia: 'Đã gửi mail cho Mr. Chen lúc 16:15 ngày 13-08-2026, kèm bảng giá ver01.',
    thucHienId: 'S007', thucHienIds: ['S007', 'S008'],
    tasks: [
      viecNhap('NHAP-03-T1', 'Bóc tách kết cấu & nền móng', 45, 'S007', '2026-08-05', 3, true),
      viecNhap('NHAP-03-T2', 'Bóc tách kiến trúc & hoàn thiện', 30, 'S008', '2026-08-08', 2, true),
      viecNhap('NHAP-03-T3', 'Tổng hợp giá & đóng gói hồ sơ', 25, 'S007', '2026-08-10', 2, true),
    ],
  }),

  // ============ 4. BƯỚC 4 — PHÒNG ĐÃ DUYỆT 100%, TRÌNH BAN GIÁM ĐỐC ============
  congViecNhap({
    id: 'NHAP-04', duAnChaId: 'NHAP-DA-03', projectId: '2026.83',
    tenDuAn: '[NHÁP] Nhà xưởng Sunfiber GĐ2', chuDauTu: 'Công ty TNHH Sunfiber Việt Nam',
    diaChi: 'KCN Bàu Bàng, TP HCM',
    hangMuc: 'Khái toán',
    moTa: 'Trạng thái 4/9 — Trưởng phòng đã kiểm tra & duyệt tiến độ Phòng 100%, hồ sơ trình Ban giám đốc (Bước 4).',
    ngayBatDau: '2026-07-28', ngayHoanThanhDuKienGoc: '2026-08-06',
    kanbanStep: 4, tienDoBoPhan: 100, tienDoPhong: 100,
    hanHenCDT: '2026-08-10',
    ketQuaPhong: 'Đã rà soát toàn bộ đơn giá và khối lượng BOQ; hồ sơ đạt yêu cầu, trình Ban giám đốc ký.',
    taiLieuKetQuaPhong: 'BANG-TONG-HOP-GIA-ver02.xlsx',
    anhBaoCaoGuiBaoGia: 'anh-da-gui-bao-gia-20260806-1030.png',
    thucHienId: 'S005', thucHienIds: ['S005'],
    tasks: [
      viecNhap('NHAP-04-T1', 'Khái toán suất đầu tư nhà xưởng', 60, 'S005', '2026-07-28', 4, true),
      viecNhap('NHAP-04-T2', 'Soát xét & trình bày hồ sơ khái toán', 40, 'S005', '2026-08-03', 2, true),
    ],
  }),

  // ============ 5. BƯỚC 5 — BGĐ THÔNG QUA, ĐÃ GỬI CHỦ ĐẦU TƯ ============
  congViecNhap({
    id: 'NHAP-05', duAnChaId: 'NHAP-DA-04', projectId: '2026.84',
    tenDuAn: '[NHÁP] Trung tâm chế biến Phúc Sinh', chuDauTu: 'Công ty CP Phúc Sinh Đắk Nông',
    diaChi: 'Xã Thuận Hạnh, Lâm Đồng',
    hangMuc: 'Báo giá chi tiết',
    moTa: 'Trạng thái 5/9 — Ban giám đốc đã thông qua, hồ sơ ĐÃ GỬI Chủ đầu tư (Bước 5), đang chờ kết quả.',
    ngayBatDau: '2026-07-20', ngayHoanThanhDuKienGoc: '2026-07-31',
    kanbanStep: 5, tienDoBoPhan: 100, tienDoPhong: 100,
    hanHenCDT: '2026-08-01', ngayHoanThanhThucTe: '2026-07-31',
    trangThai: 'HOAN_THANH_DUNG_HAN',
    ketQuaPhong: 'Hồ sơ đã duyệt và gửi CĐT đúng hạn cam kết.',
    anhBaoCaoGuiBaoGia: 'anh-da-gui-bao-gia-20260731-1720.png',
    guiCDTLogs: [{ lan: 1, ngay: '2026-07-31', tienDoPhong: 100, ketQuaPhong: 'Gửi bản chào giá lần 1.', nguoiGui: 'Ngô Nữ Quỳnh Trâm' }],
    thucHienId: 'S004', thucHienIds: ['S004', 'S006'],
    tasks: [
      viecNhap('NHAP-05-T1', 'Bóc tách khối lượng nhà máy chế biến', 55, 'S004', '2026-07-20', 4, true),
      viecNhap('NHAP-05-T2', 'Áp giá & tổng hợp bảng chào', 45, 'S006', '2026-07-25', 4, true),
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
    ngayBatDau: '2026-07-15', ngayHoanThanhDuKienGoc: '2026-07-24',
    kanbanStep: 6, tienDoBoPhan: 100, tienDoPhong: 100,
    hanHenCDT: '2026-07-25', ngayHoanThanhThucTe: '2026-07-24',
    trangThai: 'HOAN_THANH_DUNG_HAN', tinhTrangDuAn: 'Đã trúng thầu',
    ketQuaPhong: 'Giá chốt sau đàm phán, CĐT đã phát thư trúng thầu.',
    anhBaoCaoGuiBaoGia: 'anh-da-gui-bao-gia-20260724-0915.png',
    guiCDTLogs: [{ lan: 1, ngay: '2026-07-24', tienDoPhong: 100, ketQuaPhong: 'Gửi bản chào giá chính thức.', nguoiGui: 'Ngô Nữ Quỳnh Trâm' }],
    thucHienId: 'S008', thucHienIds: ['S008'],
    tasks: [
      viecNhap('NHAP-06-T1', 'Bóc tách & áp giá toàn bộ gói thầu', 100, 'S008', '2026-07-15', 6, true),
    ],
  }),

  // ============ 7. BƯỚC 7 — RỚT THẦU ============
  congViecNhap({
    id: 'NHAP-07', duAnChaId: 'NHAP-DA-05', projectId: '2026.85',
    tenDuAn: '[NHÁP] Nhà máy Texlot GĐ1 — gói ME', chuDauTu: 'Công ty TNHH Texlot Textile',
    diaChi: 'KCN Phú An Thạnh, Tây Ninh',
    hangMuc: 'Khái toán',
    moTa: 'Trạng thái 7/9 — Gói thầu RỚT (Bước 7), giữ lại để đối chiếu giá cho lần sau.',
    ngayBatDau: '2026-07-10', ngayHoanThanhDuKienGoc: '2026-07-18',
    kanbanStep: 7, tienDoBoPhan: 100, tienDoPhong: 100,
    hanHenCDT: '2026-07-20', ngayHoanThanhThucTe: '2026-07-21',
    trangThai: 'HOAN_THANH_TRE_HAN', tinhTrangDuAn: 'Rớt thầu',
    nguyenNhanTreHan: 'CĐT rút ngắn hạn nộp 2 ngày so với thỏa thuận ban đầu.',
    ketQuaPhong: 'Giá cao hơn đối thủ khoảng 6%, CĐT chọn nhà thầu khác.',
    anhBaoCaoGuiBaoGia: 'anh-da-gui-bao-gia-20260721-1105.png',
    guiCDTLogs: [{ lan: 1, ngay: '2026-07-21', tienDoPhong: 100, ketQuaPhong: 'Gửi khái toán gói ME.', nguoiGui: 'Ngô Nữ Quỳnh Trâm' }],
    thucHienId: 'S007', thucHienIds: ['S007'],
    tasks: [
      viecNhap('NHAP-07-T1', 'Khái toán hệ thống cơ điện', 100, 'S007', '2026-07-10', 6, true),
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
    ngayBatDau: '2026-08-14', ngayHoanThanhDuKienGoc: '2026-08-22',
    kanbanStep: 1, tienDoBoPhan: 0, tienDoPhong: 0,
    vongHienTai: 2, tpDaDuyet: false,
    hanHenCDT: '2026-08-25',
    cdtDieuChinh: [{ ngay: '2026-08-13', noiDung: 'CĐT yêu cầu bỏ hạng mục kho lạnh, tách riêng phần PCCC.', buocVe: 1 }],
    guiCDTLogs: [{ lan: 1, ngay: '2026-08-08', tienDoPhong: 100, ketQuaPhong: 'Bản chào giá lần 1 (vòng 1).', nguoiGui: 'Ngô Nữ Quỳnh Trâm' }],
    thucHienId: 'S005', thucHienIds: ['S005'],
    tasks: [
      // Vòng 1 — đã xong, giữ lại để lũy kế tỉ trọng 100% × số vòng
      viecNhap('NHAP-08-T1', 'Bóc tách & áp giá phương án ban đầu', 100, 'S005', '2026-08-01', 5, true, 1),
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
    ngayBatDau: '2026-08-06', ngayHoanThanhDuKienGoc: '2026-08-14',
    ngayHoanThanhDuKienHienTai: '2026-08-21',
    kanbanStep: 1, tienDoBoPhan: 30, tienDoPhong: 0,
    tpDaDuyet: false, choDuyetLai: true, lyDoChoDuyetLai: 'DOI_HAN',
    trangThai: 'TRE_TIEN_DO',
    nguyenNhanTreHan: 'Thiếu bản vẽ kỹ thuật từ CĐT, nhân sự phải chờ 4 ngày.',
    delayLogs: [{
      id: 'NHAP-09-D1', ngayThayDoi: '2026-08-14', ngayCu: '2026-08-14', ngayMoi: '2026-08-21',
      soNgayLech: 7, lyDo: 'CĐT giao bản vẽ trễ, phải dời hạn nộp 7 ngày.', nguoiDuyet: 'Ngô Nữ Quỳnh Trâm',
    }],
    thucHienId: 'S006', thucHienIds: ['S006', 'S007'],
    tasks: [
      viecDangLam('NHAP-09-T1', 'Lập hồ sơ năng lực & pháp lý', 40, 'S006', '2026-08-06', 3, 60),
      viecDangLam('NHAP-09-T2', 'Bóc tách khối lượng phần mở rộng', 60, 'S007', '2026-08-10', 4, 10),
    ],
  }),
];
