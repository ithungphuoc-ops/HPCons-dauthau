export interface DelayLog {
  id: string;
  ngayThayDoi: string; // Ngày thực hiện điều chỉnh
  ngayCu: string; // Hạn hoàn thành cũ
  ngayMoi: string; // Hạn hoàn thành mới
  soNgayLech: number; // Số ngày lệch tự động tính toán
  lyDo: string; // Lý do dời tiến độ
  nguoiDuyet: string; // Nhân sự phê duyệt
}

export interface ProjectTask {
  id: string;
  name: string;
  weight: number; // Tỉ trọng (%) ví dụ 25, 40
  isCompleted: boolean;
  completedAt?: string;
  overdueReason?: string; // Bắt buộc nhập giải trình nếu trễ hạn
  assignedTo?: string; // ID nhân sự được phân công trực tiếp
  assignedStaffIds?: string[]; // Nhiều nhân sự thực hiện chung
  detailedPlan?: string; // Kế hoạch chi tiết của công việc con
  staffProgress?: number; // Tiến độ do nhân viên thực hiện (chiếm 70%)
  managerProgress?: number; // Tiến độ do quản lý duyệt/đồng hành (chiếm 30%)
  subtasks?: ProjectTask[]; // Đệ quy: Công việc con cấp tiếp theo
  kpi?: number; // Điểm KPI tự động tính toán cho tác vụ (chỉ dựa trên tiến độ)
  ketQuaCongViec?: string; // Báo cáo kết quả công việc con
  taiLieuDinhKem?: string; // Tên file tài liệu đính kèm kết quả
  ngayBatDau?: string; // Ngày bắt đầu công việc con (YYYY-MM-DD) — phục vụ sơ đồ Gantt
  soNgay?: number; // Số ngày dự kiến thực hiện công việc con — phục vụ sơ đồ Gantt
}

export interface ProjectComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

export interface Project {
  id: string;
  // Cấp bản ghi: DU_AN = Dự án cha (chỉ đăng ký tên/CĐT, KHÔNG lên Kanban);
  // CONG_VIEC = công việc/gói thầu con thuộc một dự án (báo giá chi tiết, khái toán...) — CHỈ những cái này lên Kanban.
  // Bỏ trống = dữ liệu cũ, coi như CONG_VIEC.
  loaiBanGhi?: 'DU_AN' | 'CONG_VIEC';
  duAnChaId?: string; // Với CONG_VIEC: id của Dự án cha
  projectId: string; // Định dạng YYYY.NN (Ví dụ: 2026.01)
  tenDuAn: string; // Tên dự án thầu
  quanLyId: string; // Quản lý CHÍNH đảm nhận (hiển thị nổi bật, nhận thông báo chính)
  quanLyIdsPhu?: string[]; // Quản lý PHỤ / kế thừa — cùng quyền thao tác như quản lý khi người chính bận
  thucHienId: string; // Nhân sự trực tiếp thực hiện (Thực hiện)
  thucHienIds?: string[]; // Nhiều nhân sự thực hiện bổ sung (Lookup Field)
  hangMuc: 'Báo giá chi tiết' | 'Khái toán' | 'Báo giá phát sinh' | 'Cải tạo' | 'VE' | 'Lập hồ sơ thầu'; // Hạng mục công việc
  moTa: string; // Mô tả chi tiết nội dung công việc
  ngayBatDau: string; // Ngày bắt đầu thực hiện
  soNgayDuKien: number; // TỔNG số ngày = thực hiện + TP duyệt + Giám đốc duyệt (ra hạn nộp CĐT)
  soNgayThucHien?: number; // Chặng 1: Bộ phận thực hiện (bóc tách, áp giá, đóng gói)
  soNgayDuyetTP?: number; // Chặng 2: Trưởng phòng kiểm tra & duyệt giá
  soNgayDuyetBLD?: number; // Chặng 3: Giám đốc / Ban lãnh đạo duyệt trước khi nộp CĐT
  ngayHoanThanhDuKienGoc: string; // Mốc hoàn thành gốc (ngày bắt đầu + số ngày dự kiến)
  ngayHoanThanhDuKienHienTai: string; // Mốc hoàn thành hiện tại (đã cộng dồn offset từ Delay Logs)
  tienDoBoPhan: number; // Tiến độ Bộ phận (Team Level %) - từ 0 đến 100
  tienDoPhong: number; // Tiến độ Phòng (Department Level %) - từ 0 đến 100
  delayLogs: DelayLog[]; // Lịch sử dời tiến độ
  ngayHoanThanhThucTe?: string; // Ngày hoàn thành thực tế (nếu có)
  nguyenNhanTreHan?: string; // Nguyên nhân trễ hạn (Bắt buộc nếu hoàn thành trễ hoặc đang trễ quá hạn)
  trangThai: 'DANG_THUC_HIEN' | 'HOAN_THANH_DUNG_HAN' | 'HOAN_THANH_TRE_HAN' | 'TRE_TIEN_DO';
  createdBy?: string; // ID người đăng ký hồ sơ thầu
  tasks: ProjectTask[]; // Danh sách tác vụ phụ để tự động nội suy tiến độ
  comments?: ProjectComment[]; // Thảo luận trao đổi (Level 3 Staff)
  oneDriveLink?: string; // Đường dẫn liên kết thư mục OneDrive tài liệu thầu
  kpi?: number; // Điểm KPI tự động tính toán cho dự án thầu (chỉ dựa trên tiến độ)
  kanbanStep?: number; // Bước hiện tại trên bảng Kanban quy trình thầu (1-7)
  ketQuaPhong?: string; // Kết quả kiểm tra & cập nhật cấp Phòng do Trưởng phòng nhập
  // Quy trình duyệt: Quản lý tạo công việc → false (chờ TP duyệt qua chuông). TP mở, kiểm tra kế hoạch,
  // thêm ngày kiểm tra của mình, lưu → true. CHỈ công việc đã duyệt mới lên Kanban / Gantt.
  // Bỏ trống (dữ liệu cũ / TP tự tạo) = coi như đã duyệt.
  tpDaDuyet?: boolean;
  hanHenCDT?: string; // Thời hạn ĐÃ HẸN với Chủ đầu tư (nếu có) — mốc cam kết ngoài, nhập tay
  // Quản lý cập nhật kế hoạch làm tiến độ DELAY xa hơn hạn đã báo → true (chờ TP duyệt lại &
  // chỉnh ngày kiểm tra phòng). Thẻ VẪN ở trên Kanban. TP lưu là xóa cờ.
  choDuyetLai?: boolean;
  cdtDieuChinh?: { ngay: string; noiDung: string; buocVe: number }[]; // Lịch sử CĐT yêu cầu điều chỉnh (kéo tiến độ về bước trước)
  chuDauTu?: string; // Tên Chủ đầu tư (CĐT)
  diaChi?: string; // Địa chỉ dự án / Công trình
  hinhThucDauThau?: 'Chỉ định thầu' | 'Đấu thầu cạnh tranh'; // Hình thức đấu thầu
  tinhTrangDuAn?: 'Đang triển khai' | 'Đã trúng thầu' | 'Rớt thầu' | 'Ngưng triển khai'; // Tình trạng dự án thực tế
  quocTich?: string; // Quốc tịch CĐT
  khuCongNghiep?: string; // Khu công nghiệp
  tinhThanh?: string; // Tỉnh / Thành phố
  loaiCongTrinh?: string; // Loại công trình
  hinhThucXayDung?: 'Xây mới' | 'Cải tạo' | 'Sửa chữa' | 'Mở rộng'; // Hình thức xây dựng
  giaiDoanDuAn?: 'Thiết kế & Báo giá' | 'Tiếp cận & Tiền khả thi' | 'Chưa tiếp cận'; // Giai đoạn dự án
  dienTichDat?: number; // Diện tích đất (m2)
  mucUuTien?: number; // Mức ưu tiên (0, 1, 2)
  hoSoPhatThau?: 'HP thiết kế' | 'CĐT phát thầu' | 'Đơn vị khác thiết kế'; // Hồ sơ phát thầu do bên nào thiết kế
  giaTriBaoGia?: number; // Giá trị báo giá gần nhất (ưu tiên giá trị KHĐ) — VND. Chưa có ô nhập nên tạm để trống trên báo cáo.
}

export interface Personnel {
  id: string;
  hoTen: string;
  chucVu: 'Ban giám đốc' | 'Trưởng phòng' | 'Phó phòng' | 'Quản lý' | 'Chuyên viên đấu thầu' | 'Quản trị hệ thống';
  avatar: string;
  kpiDiem: number; // Điểm KPI trung bình hiện tại
  soDuAnDangLam: number;
  tiLeDungHan: number; // Tỷ lệ hoàn thành đúng hạn (%)
  username?: string; // Tên đăng nhập (đăng nhập bằng tên này hoặc email). Admin dùng "admin".
  email?: string;
  password?: string;
  mustChangePassword?: boolean; // Bắt buộc đổi mật khẩu ở lần đăng nhập tới (acc mới dùng mật khẩu mặc định 123456)
  role?: 'BOOD' | 'MANAGER' | 'STAFF';
  daNghi?: boolean; // Nhân sự đã nghỉ việc: khóa tài khoản nhưng giữ nguyên công việc đã/đang làm
  // Quản lý phụ trách (đội ngũ): id của Quản lý (Level 2) mà nhân viên này trực thuộc.
  // Do Trưởng phòng (L1) gán trong mục Đội Ngũ & KPI. Mỗi nhân viên chỉ thuộc 1 quản lý.
  // Dùng cho quyền XEM đội ngũ/KPI của L2 — KHÔNG ảnh hưởng việc giao việc (QL vẫn giao cho ai cũng được).
  quanLyPhuTrachId?: string;
}

export type Staff = Personnel;

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  details: string;
  timestamp: string;
  // Nhân sự liên quan tới hoạt động (người tham gia dự án). Nếu có, chỉ những người này
  // (và Trưởng phòng) mới thấy log. Nếu bỏ trống = hoạt động hệ thống (chỉ Trưởng phòng thấy).
  relatedStaffIds?: string[];
}

// Thông báo trong app (chuông 🔔) — lưu trên cloud để mọi máy đều nhận được
export interface AppNotification {
  id: string;
  targetId: string; // Mã nhân sự người nhận
  text: string; // Nội dung thông báo
  projId?: string; // Hồ sơ liên quan (bấm vào mở)
  ngay: string; // Thời điểm phát sinh (ISO)
  daDoc?: boolean; // Đã xem (mở chuông là tính đã xem) — tin vẫn giữ trong danh sách, chỉ tắt số đếm
}

// Việc cá nhân trong "Lịch cá nhân" — nhắc trên chuông (và popup trình duyệt nếu được cấp quyền).
// Lưu localStorage theo người dùng; nhắc chỉ chạy khi app đang mở (web app, không chạy nền).
export interface PersonalTask {
  id: string;
  ownerId: string;      // Mã nhân sự chủ sở hữu (chỉ chủ mới thấy/nhắc)
  title: string;        // Nội dung việc
  dueDate: string;      // Ngày hạn / ngày hẹn (YYYY-MM-DD)
  dueTime?: string;     // Giờ hẹn (HH:MM) — tùy chọn; không có = coi như cuối ngày
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'; // Lặp lại (mặc định none)
  // Lịch lặp lại: các buổi bị xóa lẻ (YYYY-MM-DD) — "chỉ xóa buổi này".
  excludeDates?: string[];
  // Lịch lặp lại kết thúc vào ngày này (bao gồm, YYYY-MM-DD) — "xóa buổi này & các buổi sau" cắt chuỗi tại đây.
  repeatUntil?: string;
  createdAt: number;    // Thời điểm tạo (ms) — để nhắc mốc "sau tạo 1 tiếng"
  note?: string;        // Ghi chú thêm (tùy chọn)
  done?: boolean;       // Đã xong
  // Cờ đánh dấu 3 mốc nhắc đã bắn (tránh nhắc trùng): sau tạo 1h · trước hạn 3 ngày · trước hạn 1 ngày
  // (giữ cho dữ liệu cũ; bản mới dùng firedKeys để hỗ trợ lịch lặp lại)
  fired?: { created?: boolean; d3?: boolean; d1?: boolean };
  // Khóa các mốc đã nhắc theo TỪNG lần xảy ra: 'created' | '<YYYY-MM-DD>:d3|d1|t0' — cho phép lịch lặp nhắc mỗi chu kỳ
  firedKeys?: string[];
}

export interface DatabaseTable {
  tableName: string;
  description: string;
  columns: {
    name: string;
    type: string;
    constraints: string;
    description: string;
  }[];
}
