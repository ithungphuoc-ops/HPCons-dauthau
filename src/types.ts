export interface DelayLog {
  id: string;
  ngayThayDoi: string; // Ngày thực hiện điều chỉnh
  ngayCu: string; // Hạn hoàn thành cũ
  ngayMoi: string; // Hạn hoàn thành mới
  // ⚠ KHÔNG PHẢI "số ngày đã dời" — đây là phần ngày cần CỘNG THÊM vào hạn gốc.
  // Hạn gốc đã được tính lại từ kế hoạch việc con (ngày bắt đầu + span việc con + ngày TP duyệt),
  // nên lần dời nào phát sinh TỪ việc con thì để 0, bằng không hạn bị cộng hai lần
  // (chị Trâm báo 29/07/2026: hạn Phòng 01/08 nhưng "hạn hiện tại" nhảy lên 03/08).
  // Chỉ lần dời KHAI TAY (chọn ngày mới ở mục "Đăng ký dời tiến độ") mới mang số thật.
  // Muốn biết đã dời bao nhiêu ngày để hiển thị/báo cáo: dùng tongNgayDoiHan() trong utils/dateVN.
  soNgayLech: number;
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
  // ===== GIỜ CỦA VIỆC CON (chị Trâm chốt 17/08/2026 — góp ý #20) =====
  // Việc con được tính tới GIỜ, không chỉ tới ngày. Cả hai trường đều TÙY CHỌN, dạng 'HH:MM'
  // (24 giờ). BỎ TRỐNG = TRỌN NGÀY: bắt đầu 00:00:00 và hạn 23:59:59 của ngày tương ứng —
  // đúng như cách app đang tính trước đây, nên dữ liệu cũ đọc lên không đổi nghĩa.
  // Việc gọn trong một ngày thì để soNgay = 1 rồi nhập 08:00 → 14:00.
  // Hàm dùng chung: mocBatDauViec / mocHanViec / fmtHanViecVN trong utils/dateVN.
  gioBatDau?: string; // Giờ bắt đầu — bỏ trống = 00:00
  gioHan?: string;    // Giờ hết hạn của NGÀY HẠN — bỏ trống = hết ngày (23:59:59)
  // VÒNG làm việc: mỗi lần hồ sơ bị trả về làm lại rồi gửi CĐT lần nữa là một vòng mới.
  // Tỉ trọng phải đủ 100% TRONG TỪNG VÒNG (2 lần báo giá → lũy kế 200%).
  // Bỏ trống = vòng 1 (dữ liệu cũ đọc bình thường).
  vong?: number;
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
  // @deprecated 25/07/2026 — đã bỏ ô nhập; nội dung chuyển vào moTa. Giữ trường để đọc dữ liệu cũ.
  oneDriveLink?: string;
  kpi?: number; // Điểm KPI tự động tính toán cho dự án thầu (chỉ dựa trên tiến độ)
  kanbanStep?: number; // Bước hiện tại trên bảng Kanban quy trình thầu (1-7)
  ketQuaPhong?: string; // Kết quả kiểm tra & cập nhật cấp Phòng do Trưởng phòng nhập
  // Tệp kết quả công việc cấp Phòng (nhiều tệp nối bằng " | " — cùng quy ước với taiLieuDinhKem
  // của việc con, xem utils/attachments.ts). Chỉ lưu TÊN tệp, không lưu nội dung tệp.
  taiLieuKetQuaPhong?: string;
  // NHẬT KÝ GỬI CĐT: mỗi lần Trưởng phòng kéo tay hồ sơ từ bước 4 (trình BLĐ/Giám đốc) sang
  // bước 5 (đã gửi CĐT) = 1 lần gửi. Hồ sơ bị CĐT/BGĐ yêu cầu sửa → TP kéo về bước 1-3, làm
  // lại quy trình, rồi kéo 4→5 lần nữa = lần gửi kế tiếp. Mỗi bản ghi chụp lại tiến độ Phòng
  // và kết quả công việc của đúng vòng đó để về sau đối chiếu.
  guiCDTLogs?: {
    lan: number;              // Lần gửi thứ mấy (1, 2, 3...)
    ngay: string;             // Ngày gửi (YYYY-MM-DD)
    tienDoPhong: number;      // Tiến độ Phòng tại thời điểm gửi
    ketQuaPhong?: string;     // Mô tả kết quả công việc của vòng đó
    taiLieuKetQuaPhong?: string; // Tệp kết quả của vòng đó (nối bằng " | ")
    nguoiGui?: string;        // Người kéo thẻ sang bước 5
  }[];
  // Quy trình duyệt: Quản lý tạo công việc → false (chờ TP duyệt qua chuông). TP mở, kiểm tra kế hoạch,
  // thêm ngày kiểm tra của mình, lưu → true. CHỈ công việc đã duyệt mới lên Kanban / Gantt.
  // Bỏ trống (dữ liệu cũ / TP tự tạo) = coi như đã duyệt.
  tpDaDuyet?: boolean;
  hanHenCDT?: string; // Thời hạn ĐÃ HẸN với Chủ đầu tư (nếu có) — mốc cam kết ngoài, nhập tay
  // Số lần ĐÃ GỬI CĐT TRƯỚC KHI DÙNG APP — khai tay (chị Trâm, góp ý #11): gói thầu đang dở khi app
  // mới dựng nên nhật ký của app không có các lần gửi cũ. Chỉ cộng vào lúc HIỂN THỊ, KHÔNG đụng
  // trường `lan` của guiCDTLogs (lan đang khớp với VÒNG làm việc). Dùng hàm trong utils/guiCDT.ts.
  soLanGuiCDTTruocApp?: number;
  // ẢNH BÁO CÁO ĐÃ GỬI BÁO GIÁ (chị Trâm — góp ý #12): bắt buộc có ít nhất 1 ảnh mới cho kéo thẻ
  // từ Bước 2 sang Bước 3. Chỉ lưu TÊN tệp, nhiều tệp nối bằng " | " (utils/attachments.ts).
  anhBaoCaoGuiBaoGia?: string;
  ghiChuGuiBaoGia?: string;   // Gửi cho ai, gửi bằng đường nào — tùy chọn
  // Quản lý cập nhật kế hoạch làm tiến độ DELAY xa hơn hạn đã báo → true (chờ TP duyệt lại &
  // chỉnh ngày kiểm tra phòng). Thẻ VẪN ở trên Kanban. TP lưu là xóa cờ.
  choDuyetLai?: boolean;
  // VÌ SAO phải duyệt lại — để Trưởng phòng nhìn chuông là biết có phải việc gấp không
  // (chị Trâm chốt 29/07/2026: đang báo "DELAY" cho cả trường hợp chỉ chia lại việc con).
  //   'DOI_HAN'  — hạn nộp bị đẩy ra, đây mới là DELAY thật.
  //   'PHAN_BO'  — chỉ đổi phân bổ / thêm việc con, THỜI GIAN GÓI THẦU KHÔNG ĐỔI → duyệt cho nhanh.
  // Bỏ trống (dữ liệu cũ) = coi như 'DOI_HAN' để không vô tình báo nhẹ đi một ca delay thật.
  lyDoChoDuyetLai?: 'DOI_HAN' | 'PHAN_BO';
  // VÒNG làm việc đang chạy (1, 2, 3...). Trưởng phòng mở vòng mới khi kéo hồ sơ về Bước 1 để làm lại
  // sau khi đã gửi CĐT. Mỗi vòng phải phân bổ tỉ trọng việc con đủ 100% → 2 vòng thì lũy kế 200%.
  // Bỏ trống = vòng 1 (dữ liệu cũ đọc bình thường).
  vongHienTai?: number;
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
  chucVu: 'Ban giám đốc' | 'Trưởng phòng' | 'Phó phòng' | 'Quản lý' | 'Chuyên viên đấu thầu' | 'Quản trị hệ thống' | 'Khách (chỉ xem)';
  avatar: string;
  kpiDiem: number; // Điểm KPI trung bình hiện tại
  soDuAnDangLam: number;
  tiLeDungHan: number; // Tỷ lệ hoàn thành đúng hạn (%)
  username?: string; // Tên đăng nhập (đăng nhập bằng tên này hoặc email). Admin dùng "admin".
  email?: string;
  password?: string;
  mustChangePassword?: boolean; // Bắt buộc đổi mật khẩu ở lần đăng nhập tới (acc mới dùng mật khẩu mặc định 123456)
  role?: 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER';
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
  // Việc con CỤ THỂ trong cây công việc của hồ sơ trên (nếu tin nói về đúng 1 việc con — vd
  // nhắc hạn việc con, giao việc con). Có thì bấm vào tin CUỘN THẲNG tới đúng việc con đó
  // trong cây, không chỉ mở hồ sơ rồi để người dùng tự tìm (Nguyễn Xuân Thi báo 24/08/2026:
  // "Click vào thông báo không nhảy tới task").
  taskId?: string;
  ngay: string; // Thời điểm phát sinh (ISO)
  daDoc?: boolean; // Đã xem (mở chuông là tính đã xem) — tin vẫn giữ trong danh sách, chỉ tắt số đếm
  // NGƯỜI GÂY RA tin này (chị Trâm chốt 30/07/2026 — làm chuông dễ đọc như Base):
  // để hiện ảnh + tên người thao tác ngay đầu dòng, nhìn là biết ai làm gì.
  // App tự gán = người đang đăng nhập lúc phát sinh, không phải khai ở từng chỗ gọi.
  // Bỏ trống = tin do HỆ THỐNG tự nhắc (nhắc hạn, lịch cá nhân) — hiện biểu tượng hệ thống.
  actorId?: string;
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

// TEMPLATE MẪU ĐẤU THẦU (chị Trâm — góp ý #8): danh mục biểu mẫu dùng chung của phòng.
// Lưu ĐƯỜNG LINK tệp (OneDrive/Drive/thư mục chung), KHÔNG nhúng nội dung tệp: app chưa dùng
// Firebase Storage và 1 document Firestore tối đa 1MB — file Excel biểu mẫu vượt xa mức đó.
export interface TenderTemplate {
  id: string;
  ten: string;        // Tên biểu mẫu
  link: string;       // Đường link tới tệp
  ghiChu?: string;    // Ghi chú / phiên bản
  nguoiThem?: string; // Ai thêm vào danh mục
  ngay?: string;      // Thời điểm thêm (ISO)
  // AI ĐƯỢC THẤY biểu mẫu này (chị Trâm chốt 18/08/2026). Bỏ trống = MỌI cấp đều thấy.
  // Ví dụ mẫu nội bộ của Trưởng phòng thì chỉ để ['BOOD'].
  levels?: ('BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER')[];
  // BIỂU MẪU CŨ: không xoá hẳn (còn hồ sơ cũ dùng bản đó) mà chuyển xuống mục "Biểu mẫu đã hủy",
  // tên bị gạch ngang. Bấm khôi phục là dùng lại.
  daHuy?: boolean;
  ngayHuy?: string;   // Thời điểm đánh dấu là mẫu cũ (ISO)
  // LỠ XOÁ THÌ PHỤC HỒI ĐƯỢC (chị Trâm báo 18/08/2026: "c mới xóa 2 biểu mẫu thì ko thấy nằm ở đâu
  // trong thùng rác nữa"). Nút xoá nay chỉ đưa vào THÙNG RÁC, không xoá dữ liệu; xoá vĩnh viễn là
  // một nút riêng nằm trong thùng rác, có hỏi lại.
  daXoa?: boolean;
  ngayXoa?: string;   // Thời điểm bỏ vào thùng rác (ISO)
  nguoiXoa?: string;  // Ai bỏ vào thùng rác
}

// ===== THÔNG BÁO NỘI BỘ ĐƯỢC LƯU LẠI (chị Trâm chốt 18/08/2026) =====
// "thông báo nội bộ cũng rất quan trọng, sẽ đc lưu lại, chứ phải chỉ là 1 cái thông báo rồi trôi đi
//  đâu nhé" → ngoài việc bắn lên chuông (AppNotification, chỉ giữ 30 tin/người), mỗi thông báo nội
// bộ còn được lưu THÀNH BẢN GHI RIÊNG, không bị dồn mất, tra cứu lại được bất cứ lúc nào.
export interface ThongBaoNoiBo {
  id: string;
  noiDung: string;
  nguoiGui?: string;      // Tên người gửi
  nguoiGuiId?: string;    // Mã nhân sự người gửi
  ngay: string;           // Thời điểm gửi (ISO)
  targetIds: string[];    // Mã nhân sự đã nhận tin
  // Cách chọn người nhận lúc gửi — để đọc lại biết tin này gửi cho ai.
  kieuNhan?: 'toanBo' | 'theoCap' | 'tungNguoi';
  capNhan?: ('BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER')[];  // chỉ có khi kieuNhan = 'theoCap'
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
