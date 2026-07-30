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
 * Nhân sự mẫu — dùng lại danh sách của mockData, cộng thêm 1 tài khoản Khách (Level 4)
 * để bản thử đủ cả 4 level cho thanh chuyển vai trò L1/L2/L3/L4.
 * Tài khoản Khách CHỈ có ở bản thử — mockData (dữ liệu gốc production) không đụng tới.
 */
export const sandboxStaff = (): Staff[] => [
  ...mockStaff.map(s => ({ ...s })),
  {
    id: 'S009',
    hoTen: 'Khách mời (Ban lãnh đạo)',
    chucVu: 'Khách (chỉ xem)',
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

// ===== 3 DỰ ÁN NHÁP ĐỂ THỬ XUẤT EXCEL → PHỤC HỒI (chị Trâm yêu cầu 28/07/2026) =====
// Chỉ dùng để nghiệm thu vòng "Xuất Excel → Phục hồi dữ liệu". Bấm "Xoá sạch dữ liệu bản thử"
// là hết. Tên có tiền tố NHÁP để không lẫn với hồ sơ thật.
// Ngày để cố định (không dùng Date.now) cho lần nào nạp cũng ra cùng số liệu, dễ đối chiếu
// trước/sau khi phục hồi.
const viecNhap = (
  id: string,
  name: string,
  weight: number,
  assignedTo: string,
  ngayBatDau: string,
  soNgay: number,
  xong = false
): ProjectTask => ({
  id,
  name,
  weight,
  isCompleted: xong,
  assignedTo,
  ngayBatDau,
  soNgay,
  staffProgress: xong ? 100 : 0,
  managerProgress: xong ? 100 : 0,
  vong: 1,
});

// DỰ ÁN CHA nháp. BẮT BUỘC phải có: khối "Danh sách Dự án" ở màn Báo cáo tiến độ chỉ hiện khi
// có ít nhất một bản ghi loaiBanGhi = 'DU_AN'. Bản nháp đầu tiên thiếu phần này nên chị Trâm mở
// lên thấy mất hẳn khối Danh sách dự án (28/07/2026).
const duAnChaNhap = (
  id: string,
  projectId: string,
  tenDuAn: string,
  chuDauTu: string,
  ngayBatDau: string
): Project => ({
  id,
  loaiBanGhi: 'DU_AN',
  projectId,
  tenDuAn,
  chuDauTu,
  quanLyId: 'S003',
  thucHienId: '',
  thucHienIds: [],
  hangMuc: 'Báo giá chi tiết',
  moTa: 'Dự án cha (nháp) — dùng để thử xuất Excel và phục hồi.',
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

export const duAnNhap = (): Project[] => [
  // --- Dự án cha (lên khối "Danh sách Dự án", KHÔNG lên Kanban) ---
  duAnChaNhap('NHAP-DA-01', '2026.81', '[NHÁP] Nhà máy dệt Bình Dương', 'Công ty TNHH Dệt Bình Dương', '2026-07-20'),
  duAnChaNhap('NHAP-DA-02', '2026.82', '[NHÁP] Kho vận Long Thành', 'Công ty CP Logistics Long Thành', '2026-07-15'),
  duAnChaNhap('NHAP-DA-03', '2026.83', '[NHÁP] Cải tạo văn phòng Quận 7', 'Công ty CP Địa ốc Phú Mỹ', '2026-07-27'),
  // --- Công việc con thuộc các dự án trên (lên Kanban) ---
  {
    id: 'NHAP-01',
    loaiBanGhi: 'CONG_VIEC',
    duAnChaId: 'NHAP-DA-01',
    projectId: '2026.81',
    tenDuAn: '[NHÁP] Nhà máy dệt Bình Dương',
    chuDauTu: 'Công ty TNHH Dệt Bình Dương',
    diaChi: 'KCN Sóng Thần, Bình Dương',
    tinhThanh: 'Bình Dương',
    quanLyId: 'S003',
    thucHienId: 'S004',
    thucHienIds: ['S004'],
    hangMuc: 'Báo giá chi tiết',
    moTa: 'Hồ sơ nháp số 1 — dùng để thử xuất Excel và phục hồi.',
    ngayBatDau: '2026-07-20',
    soNgayDuKien: 6,
    soNgayThucHien: 5,
    soNgayDuyetTP: 1,
    ngayHoanThanhDuKienGoc: '2026-07-25',
    ngayHoanThanhDuKienHienTai: '2026-07-25',
    tienDoBoPhan: 0,
    tienDoPhong: 0,
    delayLogs: [],
    trangThai: 'DANG_THUC_HIEN',
    tinhTrangDuAn: 'Đang triển khai',
    hinhThucDauThau: 'Đấu thầu cạnh tranh',
    tpDaDuyet: true,
    kanbanStep: 2,
    vongHienTai: 1,
    tasks: [
      viecNhap('NHAP-01-T1', 'Bóc tách khối lượng phần thô', 60, 'S004', '2026-07-20', 3),
      viecNhap('NHAP-01-T2', 'Áp giá vật tư & nhân công', 40, 'S005', '2026-07-23', 2),
    ],
  },
  {
    id: 'NHAP-02',
    loaiBanGhi: 'CONG_VIEC',
    duAnChaId: 'NHAP-DA-02',
    projectId: '2026.82',
    tenDuAn: '[NHÁP] Kho vận Long Thành',
    chuDauTu: 'Công ty CP Logistics Long Thành',
    diaChi: 'Long Thành, Đồng Nai',
    tinhThanh: 'Đồng Nai',
    quanLyId: 'S003',
    thucHienId: 'S006',
    thucHienIds: ['S006'],
    hangMuc: 'Khái toán',
    moTa: 'Hồ sơ nháp số 2 — đã xong phần Bộ phận, đang chờ Phòng duyệt.',
    ngayBatDau: '2026-07-15',
    soNgayDuKien: 5,
    soNgayThucHien: 4,
    soNgayDuyetTP: 1,
    ngayHoanThanhDuKienGoc: '2026-07-19',
    ngayHoanThanhDuKienHienTai: '2026-07-19',
    tienDoBoPhan: 100,
    tienDoPhong: 0,
    delayLogs: [],
    trangThai: 'DANG_THUC_HIEN',
    tinhTrangDuAn: 'Đang triển khai',
    hinhThucDauThau: 'Chỉ định thầu',
    tpDaDuyet: true,
    kanbanStep: 3,
    vongHienTai: 1,
    tasks: [
      viecNhap('NHAP-02-T1', 'Khái toán phần kết cấu', 50, 'S006', '2026-07-15', 2, true),
      viecNhap('NHAP-02-T2', 'Khái toán phần hoàn thiện', 50, 'S006', '2026-07-17', 2, true),
    ],
  },
  {
    id: 'NHAP-03',
    loaiBanGhi: 'CONG_VIEC',
    duAnChaId: 'NHAP-DA-03',
    projectId: '2026.83',
    tenDuAn: '[NHÁP] Cải tạo văn phòng Quận 7',
    chuDauTu: 'Công ty CP Địa ốc Phú Mỹ',
    diaChi: 'Quận 7, TP.HCM',
    tinhThanh: 'TP.HCM',
    quanLyId: 'S003',
    thucHienId: 'S007',
    thucHienIds: ['S007'],
    hangMuc: 'Cải tạo',
    moTa: 'Hồ sơ nháp số 3 — mới lập kế hoạch, chưa chạy.',
    ngayBatDau: '2026-07-27',
    soNgayDuKien: 4,
    soNgayThucHien: 3,
    soNgayDuyetTP: 1,
    ngayHoanThanhDuKienGoc: '2026-07-30',
    ngayHoanThanhDuKienHienTai: '2026-07-30',
    tienDoBoPhan: 0,
    tienDoPhong: 0,
    delayLogs: [],
    trangThai: 'DANG_THUC_HIEN',
    tinhTrangDuAn: 'Đang triển khai',
    hinhThucDauThau: 'Chỉ định thầu',
    tpDaDuyet: true,
    kanbanStep: 1,
    vongHienTai: 1,
    tasks: [
      viecNhap('NHAP-03-T1', 'Khảo sát hiện trạng', 100, 'S007', '2026-07-27', 3),
    ],
  },
];
