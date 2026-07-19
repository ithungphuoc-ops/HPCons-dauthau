import { Staff, Project, DatabaseTable } from '../types';

// Tài khoản quản trị gốc (admin = Quản trị hệ thống / Level 1).
// Mật khẩu do Firebase Auth quản lý — lần đầu đăng nhập bằng mật khẩu mặc định 123456 (tự kích hoạt),
// sau đó bắt buộc đổi.
export const ADMIN_SEED: Staff = {
  id: 'ADMIN',
  hoTen: 'Quản trị viên',
  chucVu: 'Quản trị hệ thống',
  avatar: '',
  kpiDiem: 0,
  soDuAnDangLam: 0,
  tiLeDungHan: 100,
  username: 'admin',
  email: '',
  role: 'BOOD',
  mustChangePassword: true,
};

// Nhân sự Phòng Đấu Thầu (mật khẩu Firebase quản lý; lần đầu đăng nhập bằng 123456 → bắt thêm ảnh + đổi mật khẩu).
const staffMember = (id: string, hoTen: string, username: string, chucVu: Staff['chucVu'], role: 'BOOD' | 'MANAGER' | 'STAFF'): Staff => ({
  id, hoTen, chucVu, avatar: '', kpiDiem: 0, soDuAnDangLam: 0, tiLeDungHan: 100,
  username, email: '', role, mustChangePassword: true,
});

export const mockStaff: Staff[] = [
  ADMIN_SEED,
  staffMember('S001', 'Hồ Hữu Phương', 'hohuuphuong', 'Ban giám đốc', 'BOOD'),
  staffMember('S002', 'Ngô Nữ Quỳnh Trâm', 'ngonuquynhtram', 'Trưởng phòng', 'BOOD'),
  staffMember('S003', 'Phan Thành Quốc', 'phanthanhquoc', 'Quản lý', 'MANAGER'),
  staffMember('S004', 'Nguyễn Xuân Thi', 'nguyenxuanthi', 'Chuyên viên đấu thầu', 'STAFF'),
  staffMember('S005', 'Nguyễn Cảnh Hồng Quân', 'nguyencanhhongquan', 'Chuyên viên đấu thầu', 'STAFF'),
  staffMember('S006', 'Trần Đức Mạnh', 'tranducmanh', 'Chuyên viên đấu thầu', 'STAFF'),
  staffMember('S007', 'Phan Minh Thuận', 'phanminhthuan', 'Chuyên viên đấu thầu', 'STAFF'),
  staffMember('S008', 'Nguyễn Thị Lộc', 'nguyenthiloc', 'Chuyên viên đấu thầu', 'STAFF'),
];

// Clean slate: không còn dự án/công việc demo. Admin tự nhập dữ liệu thật.
export const mockProjects: Project[] = [];

export const databaseSchema: DatabaseTable[] = [
  {
    tableName: 'nhan_su (Personnel)',
    description: 'Bảng nhân sự hợp nhất đóng vai trò là nguồn dữ liệu duy nhất (Source-of-truth) quản lý KPI, phân quyền hệ thống Phòng Đấu thầu.',
    columns: [
      { name: 'id', type: 'VARCHAR(10)', constraints: 'PRIMARY KEY', description: 'Mã số nhân viên' },
      { name: 'ho_ten', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Họ và tên nhân sự' },
      { name: 'chuc_vu', type: 'VARCHAR(50)', constraints: 'NOT NULL', description: 'Chức vụ: Ban giám đốc, Trưởng phòng, Phó phòng, Quản lý, Chuyên viên' },
      { name: 'avatar', type: 'VARCHAR(255)', constraints: '', description: 'Đường dẫn ảnh đại diện' },
      { name: 'kpi_diem', type: 'INT', constraints: 'DEFAULT 100', description: 'Điểm đánh giá hiệu suất KPI' }
    ]
  },
  {
    tableName: 'du_an (Project)',
    description: 'Bảng cốt lõi quản lý hồ sơ thầu, thời hạn định mức, tiến độ tự động nội suy từ tác vụ và liên kết nhân sự chịu trách nhiệm.',
    columns: [
      { name: 'id', type: 'VARCHAR(10)', constraints: 'PRIMARY KEY', description: 'Mã dự án (Hệ thống)' },
      { name: 'project_id', type: 'VARCHAR(15)', constraints: 'UNIQUE NOT NULL', description: 'Mã số hồ sơ thầu định dạng YYYY.NN (Ví dụ: 2026.01)' },
      { name: 'ten_du_an', type: 'VARCHAR(255)', constraints: 'NOT NULL', description: 'Tên gói thầu / công trình' },
      { name: 'one_drive_link', type: 'VARCHAR(255)', constraints: '', description: 'Đường dẫn thư mục hồ sơ đấu thầu OneDrive' },
      { name: 'quality_score', type: 'INT', constraints: 'CHECK (quality_score BETWEEN 0 AND 100)', description: 'Điểm chất lượng hồ sơ thầu (1 - 100) do Trưởng phòng chấm' },
      { name: 'kpi_score', type: 'DECIMAL(5,2)', constraints: '', description: 'Điểm KPI công việc tự động thẩm định' },
      { name: 'quan_ly_id', type: 'VARCHAR(10)', constraints: 'FOREIGN KEY REFERENCES nhan_su(id)', description: 'Mã người quản lý phụ trách chung' },
      { name: 'thuc_hien_id', type: 'VARCHAR(10)', constraints: 'FOREIGN KEY REFERENCES nhan_su(id)', description: 'Mã chuyên viên chính thực hiện' },
      { name: 'hang_muc', type: 'VARCHAR(50)', constraints: 'NOT NULL', description: 'Hạng mục: Báo giá chi tiết, Khái toán, Lập hồ sơ...' },
      { name: 'mo_ta', type: 'TEXT', constraints: '', description: 'Phân tích chi tiết công việc' },
      { name: 'ngay_bat_dau', type: 'DATE', constraints: 'NOT NULL', description: 'Ngày bắt đầu lập thầu' },
      { name: 'so_ngay_du_kien', type: 'INT', constraints: 'NOT NULL', description: 'Thời hạn định mức (Ngày)' },
      { name: 'ngay_ht_du_kien_goc', type: 'DATE', constraints: 'NOT NULL', description: 'Hạn thầu ban đầu' },
      { name: 'ngay_ht_du_kien_ht', type: 'DATE', constraints: 'NOT NULL', description: 'Hạn thầu hiện tại (gồm dời lịch)' },
      { name: 'tien_do_bo_phan', type: 'INT', constraints: 'DEFAULT 0', description: 'Tiến độ thực tế tự động nội suy từ tác vụ (%)' },
      { name: 'tien_do_phong', type: 'INT', constraints: 'DEFAULT 0', description: 'Tiến độ kiểm duyệt của Phòng (%)' },
      { name: 'ngay_hoan_thanh_thuc_te', type: 'DATE', constraints: '', description: 'Ngày nộp thầu thực tế' },
      { name: 'nguyen_nhan_tre_han', type: 'TEXT', constraints: '', description: 'Ghi chú giải trình nếu trễ hạn thầu' },
      { name: 'trang_thai', type: 'VARCHAR(30)', constraints: 'NOT NULL', description: 'Trạng thái: DANG_THUC_HIEN, HOAN_THANH_DUNG_HAN, HOAN_THANH_TRE_HAN, TRE_TIEN_DO' },
      { name: 'created_by', type: 'VARCHAR(10)', constraints: 'FOREIGN KEY REFERENCES nhan_su(id)', description: 'Người khởi tạo hồ sơ thầu' }
    ]
  },
  {
    tableName: 'du_an_tac_vu (ProjectTask)',
    description: 'Bảng quản lý danh sách tác vụ con của dự án hỗ trợ tự động tính toán tổng tiến độ bộ phận theo tỉ trọng.',
    columns: [
      { name: 'id', type: 'VARCHAR(10)', constraints: 'PRIMARY KEY', description: 'Mã tác vụ' },
      { name: 'du_an_id', type: 'VARCHAR(10)', constraints: 'FOREIGN KEY REFERENCES du_an(id) ON DELETE CASCADE', description: 'Dự án sở hữu' },
      { name: 'name', type: 'VARCHAR(255)', constraints: 'NOT NULL', description: 'Tên tác vụ phụ' },
      { name: 'weight', type: 'INT', constraints: 'NOT NULL CHECK (weight > 0)', description: 'Tỉ trọng (%) của tác vụ trong dự án' },
      { name: 'is_completed', type: 'BOOLEAN', constraints: 'DEFAULT FALSE', description: 'Trạng thái hoàn thành' },
      { name: 'completed_at', type: 'DATE', constraints: '', description: 'Ngày hoàn thành tác vụ' },
      { name: 'overdue_reason', type: 'TEXT', constraints: '', description: 'Giải trình nếu hoàn thành tác vụ quá hạn thầu' }
    ]
  }
];

export const workflowSteps = [
  {
    id: 1,
    title: 'Giao Việc & Lập Tiến Độ Gốc',
    actor: 'Trưởng/Phó Phòng',
    description: 'Chỉ định Quản lý phụ trách & Chuyên viên thực hiện. Định vị mã Project_ID theo định dạng YYYY.NN. Đặt ngày bắt đầu và thời hạn định mức thầu.',
    status: 'completed'
  },
  {
    id: 2,
    title: 'Nội Suy Tiến Độ Qua Tác Vụ Con',
    actor: 'Chuyên Viên Thực Hiện',
    description: 'Staff cập nhật trạng thái các tác vụ thành phần. Hệ thống tự động tính toán dồn tỉ trọng để cập nhật trực tiếp Tiến độ Bộ phận (Team Level %).',
    status: 'completed'
  },
  {
    id: 3,
    title: 'Quản Lý Lịch Trình & Bù Trì Offset',
    actor: 'Hệ thống tự động & Quản lý',
    description: 'Khi phát sinh dời tiến độ thầu từ CĐT, Quản lý lập phiếu dời lịch. Hệ thống tự cập nhật hạn thầu hiện tại và điều chỉnh biểu đồ Gantt.',
    status: 'current'
  },
  {
    id: 4,
    title: 'Đóng Thầu & Khấu Trừ KPI Quá Hạn',
    actor: 'Nhân Sự & Trưởng/Phó Phòng',
    description: 'Bàn giao hồ sơ thầu thực tế. Nếu nộp thầu trễ hơn hạn thầu hiện tại, bắt buộc điền nguyên nhân chi tiết để thẩm định KPI.',
    status: 'upcoming'
  }
];
