import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, Staff, DelayLog, ProjectTask } from '../types';
import { chucVuToRole, CHUC_VU_KHONG_TINH_NHAN_SU, getDeptDeadline, getExecEnd, ymdOf, khauDangTre, nhanKhauTre } from '../App';
import { BUOC_XONG_PHAN_PHONG } from './KanbanBoard';

// Ai được đứng trong ô "Chuyên viên thực hiện" (chị Trâm chốt 17/08/2026: "không hiện tên Level 4").
// Lọc theo ĐÚNG luật nhân sự đang có của app, không tự đặt luật riêng:
//   · Bỏ Level 4 (Ban giám đốc — chỉ xem, không nhận việc).
//   · Bỏ các chức danh KHÔNG tính là nhân sự Phòng: Ban giám đốc · Quản trị hệ thống · Khách
//     (hằng CHUC_VU_KHONG_TINH_NHAN_SU trong App.tsx — dùng chung với ô chọn người giao việc).
//     Cần thiết vì tài khoản chức danh "Ban giám đốc" có thể đang mang quyền Level 1, lọc mỗi
//     theo Level là vẫn lọt (đúng cảnh chị Trâm thấy 18/08).
//   · Bỏ người đã nghỉ việc.
const nhanSuNhanViecDuoc = (s: Staff): boolean =>
  !s.daNghi
  && (s.role || chucVuToRole(s.chucVu)) !== 'VIEWER'
  && !CHUC_VU_KHONG_TINH_NHAN_SU.includes(s.chucVu);
import { Plus, Trash2, Calendar, Clock, AlertTriangle, CheckCircle2, Save, X, CheckSquare, Square, Search, ChevronDown, Pencil } from 'lucide-react';
import { motion } from 'motion/react';
import SubtaskGantt, { DEFAULT_TASK_DAYS, khoangKeHoachViecCon } from './SubtaskGantt';
import { TenViecConThuongDung } from '../utils/thuVienViecCon';
import { calculateProjectProgress, progressOfRound, weightIssue, weightSumOfRound, weightSumAllRounds, soVongCoViec, tasksOfRound } from '../utils/taskTree';
import { fmtDateVN } from '../utils/dateVN';
import { tongSoLanGuiCDT, nhanLanGui, soLanGuiTruocApp } from '../utils/guiCDT';
import { maHienThi, maHoSo } from '../lib/utils';
import DateInput from './DateInput';
import TextWithLinks from './TextWithLinks';
import FileDropZone from './FileDropZone';
import { luuAnh, taiAnhVe, CAU_NHAC_CHUA_MO_QUYEN } from '../utils/anhDinhKem';
import { AutoGrowTextarea } from './ui';
import { parseAttachments, joinAttachments } from '../utils/attachments';
import { useModalA11y } from '../utils/useModalA11y';
import { MAU_MO_TA_DU_AN, dungMauNeuTrong, chiLaKhungTrong } from '../utils/mauNhapLieu';

interface ProjectFormProps {
  project?: Project; // If provided, we are editing; else creating
  staffList: Staff[];
  onSave: (project: Project) => void;
  onCancel: () => void;
  nextProjectId: string;
  currentUserRole?: 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER';
  formMode?: 'CREATE_TENDER' | 'ADD_WORK' | 'EDIT_ALL';
  projectsListForSelect?: Project[];
  /** Thông tin chung của mỗi DỰ ÁN dùng làm mẫu (tra theo id dự án cha) — App đã gộp sẵn dữ liệu
   *  của dự án cha với gói thầu con gần nhất, vì hồ sơ dự án cha thường chỉ khai tên + CĐT, còn
   *  quốc tịch / diện tích / hình thức đấu thầu... nằm ở gói thầu (chị Trâm nhắc 18/08/2026). */
  thongTinMauTheoDuAn?: Record<string, Partial<Project>>;
  // Thông tin mô tả của các DỰ ÁN CHA (tra theo id) — để hiện "Mô tả dự án" chỉ-xem trên hồ sơ
  // công việc. Gom từ toàn bộ dự án nên không bị bộ lọc quyền cắt mất như projectsListForSelect.
  duAnChaInfo?: Record<string, { tenDuAn: string; chuDauTu?: string; diaChi?: string; moTa?: string }>;
  /** Thư viện tên việc con (đếm từ mọi hồ sơ) — hiện thành gợi ý ở thanh "Thêm việc con" (góp ý #62). */
  thuVienTenViecCon?: TenViecConThuongDung[];
  /** ===== DỰ ÁN CHỌN SẴN khi mở form "Công việc mới" (chị Trâm chốt 18/08/2026) =====
   *  "khi quản lý nhận đc thông báo đc chọn làm quản lý dự án A, lúc click vô e thẳng tới trường công
   *   việc mới + chọn đúng tên dự án đó sẵn cho họ tạo luôn, còn thao tác thủ công bấm nút tạo công
   *   việc sau đó chọn dự án vẫn giữ nguyên bình thường."
   *  Bỏ trống (đường bấm nút "CÔNG VIỆC MỚI" như cũ) thì form vẫn để trống cho người dùng tự chọn. */
  duAnChonSan?: string;
  /** Mã của các DỰ ÁN đã tồn tại (đã in hoa, bỏ khoảng trắng) — trừ chính hồ sơ đang sửa.
   *  Mỗi dự án chỉ có một mã duy nhất trong môi trường Phòng Đấu Thầu; trùng mã thì không cho lưu. */
  maDuAnDaDung?: string[];
}

// Simple date helpers
const addDaysToDate = (dateStr: string, days: number): string => {
  if (!dateStr || isNaN(days)) return '';
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const getDaysDifference = (dateStr1: string, dateStr2: string): number => {
  if (!dateStr1 || !dateStr2) return 0;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/** Một dự án đọc từ App Thông tin dự án — khớp với route /api/du-an-tong. */
type DuAnTongItem = {
  maDuAn: string; tenDuAn: string; chuDauTu?: string; diaChi?: string; quocTich?: string;
  hinhThucXayDung?: string; hoSoPhatThau?: string; dienTichDat?: number;
  tienDoThietKe?: number; giaiDoanThietKe?: string;
};

export default function ProjectForm({ 
  project, 
  staffList, 
  onSave, 
  onCancel, 
  nextProjectId, 
  currentUserRole,
  formMode = 'EDIT_ALL',
  projectsListForSelect = [],
  thongTinMauTheoDuAn = {},
  thuVienTenViecCon = [],
  duAnChonSan,
  maDuAnDaDung = [],
  duAnChaInfo
}: ProjectFormProps) {
  const isEditing = !!project;
  // Đang sửa DỰ ÁN CHA (DU_AN): chỉ hiện thông tin chung + thông tin kinh doanh,
  // ẩn hạng mục / tiến độ / phân rã / delay / KPI (các mục đó thuộc công việc con)
  const isParentEdit = formMode === 'EDIT_ALL' && project?.loaiBanGhi === 'DU_AN';

  // Form states
  const [projectId, setProjectId] = useState<string>(project?.projectId || nextProjectId);
  const [tenDuAn, setTenDuAn] = useState<string>(project?.tenDuAn || '');
  const [quanLyId, setQuanLyId] = useState<string>(project?.quanLyId || staffList[0]?.id || '');
  // Quản lý phụ / kế thừa (chị chốt 17/07) — cùng quyền khi người chính bận
  const [quanLyIdsPhu, setQuanLyIdsPhu] = useState<string[]>(project?.quanLyIdsPhu || []);
  // Chuyên viên KHÔNG mặc định theo người đứng đầu danh sách — sẽ tự tổng hợp từ việc con khi lưu
  const [thucHienId, setThucHienId] = useState<string>(project?.thucHienId || '');
  const [thucHienIds, setThucHienIds] = useState<string[]>(project?.thucHienIds || (project?.thucHienId ? [project.thucHienId] : []));
  const [hangMuc, setHangMuc] = useState<Project['hangMuc']>(project?.hangMuc || 'Báo giá chi tiết');
  // KHUNG MÔ TẢ DỰ ÁN dựng sẵn (chị Trâm chốt 19/09/2026) — chỉ áp cho hồ sơ DỰ ÁN (mở từ dấu +
  // hoặc Tạo thủ công trong bảng Danh mục). Công việc con KHÔNG dùng khung này: ô moTa của công
  // việc là ghi chú riêng của Quản lý, nhét khung vào đó là ép họ xoá tay mỗi lần tạo việc.
  const [moTa, setMoTa] = useState<string>(
    (formMode === 'CREATE_TENDER' || (formMode === 'EDIT_ALL' && project?.loaiBanGhi === 'DU_AN'))
      ? dungMauNeuTrong(project?.moTa, MAU_MO_TA_DU_AN)
      : (project?.moTa || ''),
  );

  // New specific bidding statistics fields
  const [chuDauTu, setChuDauTu] = useState<string>(project?.chuDauTu || '');
  // ===== DỰ ÁN MẪU — LẤY SẴN THÔNG TIN TỪ MỘT DỰ ÁN CŨ (chị Trâm chốt 18/08/2026) =====
  // "Nhiều dự án có nhiều gói thầu, hoặc triển khai GĐ2 — cho em 1 trường dự án mẫu, chọn bằng tên
  //  dự án rồi lấy được các trường của dự án cũ, sau đó chị sửa lại tên gói thầu, mã dự án..."
  // Chỉ chép phần THÔNG TIN CHUNG (CĐT, địa chỉ, KCN, loại công trình, nhân sự phụ trách...).
  // TUYỆT ĐỐI KHÔNG chép: mã dự án, tên, ngày tháng, tiến độ, việc con, nhật ký — những thứ đó
  // phải là của hồ sơ mới, chép sang là số liệu sai ngay từ đầu.
  const [duAnMauId, setDuAnMauId] = useState<string>('');
  const [duAnMauTimKiem, setDuAnMauTimKiem] = useState<string>('');   // gõ tên/mã để lọc
  const [moDsDuAnMau, setMoDsDuAnMau] = useState<boolean>(false);     // danh sách chỉ bung khi bấm
  const [diaChi, setDiaChi] = useState<string>(project?.diaChi || '');
  const [hinhThucDauThau, setHinhThucDauThau] = useState<Project['hinhThucDauThau']>(project?.hinhThucDauThau || 'Đấu thầu cạnh tranh');
  const [tinhTrangDuAn, setTinhTrangDuAn] = useState<Project['tinhTrangDuAn']>(project?.tinhTrangDuAn || 'Đang triển khai');
  
  // Specific sales fields from Template 2
  const [quocTich, setQuocTich] = useState<string>(project?.quocTich || '');
  const [khuCongNghiep, setKhuCongNghiep] = useState<string>(project?.khuCongNghiep || '');
  const [tinhThanh, setTinhThanh] = useState<string>(project?.tinhThanh || '');
  const [loaiCongTrinh, setLoaiCongTrinh] = useState<string>(project?.loaiCongTrinh || '');
  const [hinhThucXayDung, setHinhThucXayDung] = useState<Project['hinhThucXayDung']>(project?.hinhThucXayDung || 'Xây mới');
  const [giaiDoanDuAn, setGiaiDoanDuAn] = useState<Project['giaiDoanDuAn']>(project?.giaiDoanDuAn || 'Thiết kế & Báo giá');
  const [dienTichDat, setDienTichDat] = useState<number>(project?.dienTichDat || 0);
  const [mucUuTien, setMucUuTien] = useState<number>(project?.mucUuTien || 0);
  const [hoSoPhatThau, setHoSoPhatThau] = useState<Project['hoSoPhatThau']>(project?.hoSoPhatThau || 'CĐT phát thầu');

  // Ngày bắt đầu KHÔNG nhập tay: tự lấy min(ngày bắt đầu việc con) qua planRange.
  // Tạo công việc mới (ADD_WORK) để trống chờ kế hoạch con; các mode khác giữ mặc định cũ.
  const [ngayBatDau, setNgayBatDau] = useState<string>(
    project?.ngayBatDau || (formMode === 'ADD_WORK' ? '' : new Date().toISOString().split('T')[0])
  );
  // Timeline 2 chặng: Thực hiện (bộ phận) + TP duyệt = hạn nộp CĐT (không tính chặng Giám đốc/BLĐ)
  const [soNgayThucHien, setSoNgayThucHien] = useState<number>(
    project?.soNgayThucHien ?? (project?.soNgayDuKien ? Math.max(1, project.soNgayDuKien - 1) : 13)
  );
  const [soNgayDuyetTP, setSoNgayDuyetTP] = useState<number>(project?.soNgayDuyetTP ?? 1);
  // Thời hạn ĐÃ HẸN với CĐT (nếu có) — mốc cam kết ngoài, nhập tay, độc lập với hạn tự tính
  const [maNoiBo, setMaNoiBo] = useState<string>(project?.maNoiBo || '');
  const [hanHenCDT, setHanHenCDT] = useState<string>(project?.hanHenCDT || '');
  // Số lần ĐÃ GỬI CĐT trước khi dùng app — khai tay (góp ý #11). Giữ dạng chuỗi để ô nhập xoá
  // trắng được; lúc lưu mới đổi sang số.
  const [soLanGuiCDTTruocApp, setSoLanGuiCDTTruocApp] = useState<string>(
    project?.soLanGuiCDTTruocApp ? String(project.soLanGuiCDTTruocApp) : ''
  );
  const soNgayDuyetBLD = 0; // Bỏ chặng Giám đốc/BLĐ khỏi hạn CĐT — chỉ tính tới TP duyệt
  // Tổng số ngày (ra hạn nộp CĐT) = thực hiện + TP duyệt
  const soNgayDuKien = soNgayThucHien + soNgayDuyetTP;
  
  // Tasks management
  const [tasks, setTasks] = useState<ProjectTask[]>(project?.tasks || [
    { id: 'T1', name: 'Nghiên cứu hồ sơ thầu & Thiết kế sơ bộ', weight: 25, isCompleted: false },
    { id: 'T2', name: 'Bóc tách khối lượng BOQ Kiến trúc & MEPF', weight: 40, isCompleted: false },
    { id: 'T3', name: 'Xây dựng đơn giá chi tiết & Áp giá vật tư', weight: 20, isCompleted: false },
    { id: 'T4', name: 'Phê duyệt tờ trình thầu & Đóng gói hồ sơ', weight: 15, isCompleted: false }
  ]);
  const [newTaskName, setNewTaskName] = useState<string>('');
  const [newTaskWeight, setNewTaskWeight] = useState<number>(25);

  // ===== Chu kỳ tạo tiến độ: KẾ HOẠCH CON quyết định chặng "Bộ phận thực hiện" =====
  // Ngày bắt đầu = min(ngày bắt đầu việc con); kết thúc = max(ngày kết thúc việc con)
  // → số ngày Bộ phận tự tính, KHÔNG nhập tay. TP chỉ điền thêm ngày kiểm tra của mình.
  // MỘT NGUỒN DUY NHẤT với tiêu đề bảng phân rã: dùng chung khoangKeHoachViecCon trong SubtaskGantt.
  // Trước đây đoạn này tự cộng `soNgay × 1 ngày` của việc CẤP 1, không xét phần cấp 2 và không có luật
  // nửa ngày → cùng một kế hoạch mà tiêu đề bảng in một ngày kết thúc, dòng này in một ngày khác
  // (chị Trâm báo 18/08/2026). Nay hai chỗ chắc chắn khớp nhau.
  const planRange = useMemo(
    () => khoangKeHoachViecCon(tasks, Math.max(1, project?.vongHienTai || 1), ngayBatDau),
    [tasks, ngayBatDau, project?.vongHienTai],
  );

  // Đồng bộ: có kế hoạch con đặt ngày → ngày bắt đầu & số ngày Bộ phận bám theo kế hoạch
  useEffect(() => {
    if (planRange) {
      setNgayBatDau(planRange.minDate);
      setSoNgayThucHien(planRange.days);
    }
  }, [planRange]);

  /** Chép thông tin chung từ một dự án cũ sang form đang mở (xem ghi chú ở state duAnMauId). */
  const chepTuDuAnMau = (id: string) => {
    setDuAnMauId(id);
    if (!id) return;
    const goc = (projectsListForSelect || []).find(x => x.id === id);
    if (!goc) return;
    // Ưu tiên bản đã gộp (dự án cha + gói thầu con) rồi mới tới bản ghi dự án cha.
    const m = { ...goc, ...(thongTinMauTheoDuAn[id] || {}) } as Project;
    setChuDauTu(m.chuDauTu || '');
    setDiaChi(m.diaChi || '');
    setQuocTich(m.quocTich || '');
    setKhuCongNghiep(m.khuCongNghiep || '');
    setTinhThanh(m.tinhThanh || '');
    setLoaiCongTrinh(m.loaiCongTrinh || '');
    setHinhThucXayDung(m.hinhThucXayDung || 'Xây mới');
    setGiaiDoanDuAn(m.giaiDoanDuAn || 'Thiết kế & Báo giá');
    setDienTichDat(m.dienTichDat || 0);
    setMucUuTien(m.mucUuTien || 0);
    setHoSoPhatThau(m.hoSoPhatThau || 'CĐT phát thầu');
    setHinhThucDauThau(m.hinhThucDauThau || 'Đấu thầu cạnh tranh');
    setTinhTrangDuAn(m.tinhTrangDuAn || 'Đang triển khai');
    setMoTa(dungMauNeuTrong(m.moTa, MAU_MO_TA_DU_AN));
    if (m.quanLyId) setQuanLyId(m.quanLyId);
    setQuanLyIdsPhu((m.quanLyIdsPhu || []).filter(x => x !== m.quanLyId));
  };

  // Chuyên viên thực hiện = tổng hợp từ NGƯỜI ĐƯỢC GIAO các việc con (không lấy mặc định đầu danh sách).
  // Chuyên viên chính = người được giao nhiều việc nhất.
  const taskAssignees = useMemo(() => {
    const count: Record<string, number> = {};
    const walk = (list: ProjectTask[]) => list.forEach(t => {
      const ids = [t.assignedTo, ...(t.assignedStaffIds || [])].filter(Boolean) as string[];
      new Set(ids).forEach(id => { count[id] = (count[id] || 0) + 1; });
      if (t.subtasks?.length) walk(t.subtasks);
    });
    walk(tasks);
    return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [tasks]);

  const [tienDoBoPhan, setTienDoBoPhan] = useState<number>(project?.tienDoBoPhan || 0);
  const [tienDoPhong, setTienDoPhong] = useState<number>(project?.tienDoPhong || 0);
  // Kết quả kiểm tra cấp Phòng — chuyển từ khối xổ xuống (drawer chỉ xem) vào form (chị chốt 15/07)
  const [ketQuaPhong, setKetQuaPhong] = useState<string>(project?.ketQuaPhong || '');
  // Tệp kết quả công việc cấp Phòng (kéo-thả). Chỉ lưu TÊN tệp — cùng quy ước với việc con.
  const [taiLieuKetQuaPhong, setTaiLieuKetQuaPhong] = useState<string[]>(parseAttachments(project?.taiLieuKetQuaPhong));
  // ===== ẢNH BÁO CÁO ĐÃ GỬI BÁO GIÁ — NAY SỬA ĐƯỢC NGAY TRONG FORM (góp ý #75, 18/08/2026) =====
  // Trước đây ô này CHỈ có trong hộp AnhBaoCaoModal bật lên lúc kéo thẻ Bước 2 → 3. Từ khi nới cửa
  // cho Quản lý (kéo thẻ là mở form để cập nhật), nếu form không có ô ảnh thì Quản lý cập nhật xong
  // vẫn bị báo "chưa có ảnh" mà không có chỗ nào để thêm — kẹt vòng lặp. Nên đưa ô này vào form.
  const [anhBaoCao, setAnhBaoCao] = useState<string[]>(parseAttachments(project?.anhBaoCaoGuiBaoGia));
  const [ghiChuGuiBaoGia, setGhiChuGuiBaoGia] = useState<string>(project?.ghiChuGuiBaoGia || '');
  const [vuaDanAnh, setVuaDanAnh] = useState(false);
  const [loiAnh, setLoiAnh] = useState<string | null>(null);

  // DÁN ẢNH BẰNG Ctrl+V ngay trong form (cùng cách làm với AnhBaoCaoModal — chị Trâm chốt 17/08/2026):
  // chụp màn hình rồi Ctrl+V là ảnh vào danh sách luôn, không phải lưu ra tệp rồi kéo-thả.
  // CHỈ bắt khi clipboard có ẢNH, nên dán chữ vào các ô nhập khác không bị ảnh hưởng.
  useEffect(() => {
    const dan = (e: ClipboardEvent) => {
      const anh = Array.from(e.clipboardData?.items || []).filter(i => i.type.startsWith('image/'));
      if (!anh.length) return;
      e.preventDefault();
      const gio = new Date();
      const hai = (n: number) => String(n).padStart(2, '0');
      const dau = `anh-da-gui-bao-gia-${gio.getFullYear()}${hai(gio.getMonth() + 1)}${hai(gio.getDate())}`;
      // LƯU NỘI DUNG ẢNH THẬT để sau tải về được (chị Trâm 18/08/2026: cần ảnh làm bằng chứng khi
      // báo cáo mục tiêu). Ảnh dán từ clipboard không có tên nên app tự đặt theo ngày-giờ dán.
      anh.forEach((it, i) => {
        const f = it.getAsFile();
        if (!f) return;
        const ten = (f.name && f.name !== 'image.png')
          ? f.name
          : `${dau}-${hai(gio.getHours())}${hai(gio.getMinutes())}${hai(gio.getSeconds())}${anh.length > 1 ? `-${i + 1}` : ''}.png`;
        const tepDatTen = new File([f], ten, { type: f.type });
        luuAnh(project?.id || 'moi', tepDatTen, currentUserRole)
          .then((kq) => {
            setAnhBaoCao(prev => Array.from(new Set([...prev, ten])));
            setVuaDanAnh(true);
            setLoiAnh(kq.luuTamTrenMay ? CAU_NHAC_CHUA_MO_QUYEN : null);
            window.setTimeout(() => setVuaDanAnh(false), 2500);
          })
          .catch((err) => setLoiAnh(String(err?.message || err)));
      });
    };
    document.addEventListener('paste', dan);
    return () => document.removeEventListener('paste', dan);
  }, []);
  
  const [ngayHoanThanhThucTe, setNgayHoanThanhThucTe] = useState<string>(project?.ngayHoanThanhThucTe || '');
  const [nguyenNhanTreHan, setNguyenNhanTreHan] = useState<string>(project?.nguyenNhanTreHan || '');
  // Hai ô lý do trễ TÁCH THEO KHÂU (chị Trâm chốt 19/09/2026) — xem ghi chú ở mục 6.
  const [lyDoTreBoPhan, setLyDoTreBoPhan] = useState<string>(project?.lyDoTreBoPhan || '');
  const [lyDoTrePhong, setLyDoTrePhong] = useState<string>(project?.lyDoTrePhong || '');

  // Delay logs management
  const [delayLogs, setDelayLogs] = useState<DelayLog[]>(project?.delayLogs || []);

  // Selection state for ADD_WORK mode
  // Mở từ thông báo "được chọn làm Quản lý" thì dự án đã được chọn sẵn (xem prop duAnChonSan).
  const [selectedProjectId, setSelectedProjectId] = useState<string>(project?.id || duAnChonSan || '');
  // Ô tìm dự án cha theo tên/mã (danh sách dài thì gõ vài chữ là ra — chị Trâm chốt 25/07/2026)
  const [parentQuery, setParentQuery] = useState<string>('');
  // Danh sách dự án cha dạng SỔ XUỐNG: bấm mới mở, chọn xong tự đóng — form gọn hơn là
  // bày cả danh sách dài (chị chốt 25/07/2026).
  const [parentOpen, setParentOpen] = useState<boolean>(false);
  const parentBoxRef = useRef<HTMLDivElement>(null);
  // Bấm ra ngoài hoặc bấm Esc thì đóng danh sách sổ xuống
  useEffect(() => {
    if (!parentOpen) return;
    const onDown = (e: MouseEvent) => {
      if (parentBoxRef.current && !parentBoxRef.current.contains(e.target as Node)) setParentOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setParentOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [parentOpen]);

  // Dự án ĐANG LÀM lên trên, ĐÃ XONG xuống dưới; trong mỗi nhóm thì dự án khởi tạo MUỘN NHẤT ở trên.
  // "Đã xong" = tình trạng không còn là "Đang triển khai" (đã trúng / rớt / ngưng) hoặc hồ sơ đã chốt hoàn thành.
  // Mốc "mới nhất": id do app sinh có dạng P<mốc thời gian> → dùng luôn làm thời điểm tạo; hồ sơ nhập từ
  // Excel / mã tự đặt thì không có mốc đó nên lùi về ngày bắt đầu, cuối cùng so mã hồ sơ.
  const parentOptions = useMemo(() => {
    const daXong = (p: Project) =>
      (p.tinhTrangDuAn && p.tinhTrangDuAn !== 'Đang triển khai') ||
      p.trangThai === 'HOAN_THANH_DUNG_HAN' || p.trangThai === 'HOAN_THANH_TRE_HAN';
    const mocTao = (p: Project) => {
      const m = /^P(\d{10,})$/.exec(p.id);
      if (m) return Number(m[1]);
      const t = new Date(p.ngayBatDau || '').getTime();
      return isNaN(t) ? 0 : t;
    };
    const q = parentQuery.trim().toLowerCase();
    return [...projectsListForSelect]
      // Tìm theo MÃ ĐẦY ĐỦ (cả hai ô) — gõ "BG-COL" cũng ra, không chỉ gõ được ô 1.
      .filter(p => !q || `${maHoSo(p)} ${p.tenDuAn} ${p.chuDauTu || ''}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const xa = daXong(a) ? 1 : 0;
        const xb = daXong(b) ? 1 : 0;
        if (xa !== xb) return xa - xb;                       // đang làm trước, đã xong sau
        const ta = mocTao(a), tb = mocTao(b);
        if (ta !== tb) return tb - ta;                       // tạo muộn hơn lên trên
        return (b.projectId || '').localeCompare(a.projectId || '');
      })
      .map(p => ({ p, daXong: daXong(p) }));
  }, [projectsListForSelect, parentQuery]);

  // Dự án cha đang chọn — hiện trên nút sổ xuống khi danh sách đã gập
  const selectedProject = useMemo(
    () => projectsListForSelect.find(p => p.id === selectedProjectId),
    [projectsListForSelect, selectedProjectId]
  );

  // ADD_WORK: khi chọn Dự án cha, KẾ THỪA thông tin cấp dự án (MÃ dự án, tên, CĐT, địa chỉ...) sang
  // công việc con. Công việc con dùng ĐÚNG mã của dự án cha, phân biệt nhau bằng hạng mục
  // (chị Trâm chốt 26/07/2026) — trước đây cấp mã riêng tuần tự nên mã công việc chẳng liên quan
  // gì mã dự án. Giữ hạng mục / GHI CHÚ công việc / ngày / cây công việc / tiến độ ở giá trị MỚI
  // để nhập riêng cho công việc con này.
  useEffect(() => {
    if (formMode === 'ADD_WORK' && selectedProjectId) {
      const parent = projectsListForSelect.find(p => p.id === selectedProjectId);
      if (parent) {
        setProjectId(parent.projectId);
        setTenDuAn(parent.tenDuAn);
        setChuDauTu(parent.chuDauTu || '');
        setDiaChi(parent.diaChi || '');
        setHinhThucDauThau(parent.hinhThucDauThau || 'Đấu thầu cạnh tranh');
        // KHÔNG kế thừa tình trạng của dự án cha (chị Trâm báo 27/07/2026): cha "Đã trúng thầu" thì
        // gói thầu MỚI cũng bị gắn nhãn trúng thầu ngay lúc tạo → bị xếp vào "Đã xong", biến mất
        // khỏi chuông chờ Trưởng phòng duyệt, và không lên được Kanban/Gantt → kẹt cứng không ai gỡ.
        // Trúng/rớt là kết quả của TỪNG gói thầu, gói mới lập thì luôn đang triển khai.
        setTinhTrangDuAn('Đang triển khai');
        setQuocTich(parent.quocTich || '');
        setKhuCongNghiep(parent.khuCongNghiep || '');
        setTinhThanh(parent.tinhThanh || '');
        setLoaiCongTrinh(parent.loaiCongTrinh || '');
        setHinhThucXayDung(parent.hinhThucXayDung || 'Xây mới');
        setGiaiDoanDuAn(parent.giaiDoanDuAn || 'Thiết kế & Báo giá');
        setDienTichDat(parent.dienTichDat || 0);
        setMucUuTien(parent.mucUuTien || 0);
        setHoSoPhatThau(parent.hoSoPhatThau || 'CĐT phát thầu');
        setQuanLyId(parent.quanLyId || staffList[0]?.id || '');
        setQuanLyIdsPhu(parent.quanLyIdsPhu || []);
      }
    }
  }, [selectedProjectId, formMode, projectsListForSelect, staffList]);
  
  // States for adding a new delay log
  const [showAddDelay, setShowAddDelay] = useState<boolean>(false);
  const [newDelayDate, setNewDelayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newDelayNewEnd, setNewDelayNewEnd] = useState<string>('');
  const [newDelayReason, setNewDelayReason] = useState<string>('');
  // Phiếu đang lập thuộc khâu nào — mặc định Bộ phận (xem ghi chú `khau` trong types.ts).
  const [newDelayKhau, setNewDelayKhau] = useState<'BO_PHAN' | 'PHONG'>('BO_PHAN');

  // Auto-calculated fields
  const [ngayHoanThanhDuKienGoc, setNgayHoanThanhDuKienGoc] = useState<string>('');
  const [ngayHoanThanhDuKienHienTai, setNgayHoanThanhDuKienHienTai] = useState<string>('');

  // ===== CHỌN MÃ DỰ ÁN TỪ APP THÔNG TIN DỰ ÁN (chị Trâm chốt 15/09/2026) =====
  // "Chị chỉ cần click chọn mã dự án là sẽ tự động xổ các trường dữ liệu còn lại. Trường dữ liệu
  //  này chỉ là GỢI Ý, được quyền sửa tay (vì đôi khi ghi sai mô tả)."
  // Nên: điền xong KHÔNG khoá ô nào — mọi trường vẫn gõ đè được như trước.
  const [dsDuAnTong, setDsDuAnTong] = useState<DuAnTongItem[]>([]);
  const [tinhTrangDuAnTong, setTinhTrangDuAnTong] = useState<'dangTai' | 'xong' | 'chuaNoi' | 'loi'>('dangTai');
  const [thongBaoDuAnTong, setThongBaoDuAnTong] = useState('');
  const [moDsMaDuAn, setMoDsMaDuAn] = useState(false);
  const [timMaDuAn, setTimMaDuAn] = useState('');
  // Dự án vừa chọn — giữ lại để "sổ" tiến độ thiết kế kèm theo, và để biết ô nào là số liệu gợi ý.
  const [duAnTongDaChon, setDuAnTongDaChon] = useState<DuAnTongItem | null>(null);

  // Chỉ nạp ở màn KHỞI TẠO DỰ ÁN và sửa hồ sơ Dự án — các chế độ khác không dùng tới.
  const canDanhMucDuAn = formMode === 'CREATE_TENDER' || isParentEdit;
  useEffect(() => {
    if (!canDanhMucDuAn) return;
    let huy = false;
    (async () => {
      try {
        const res = await fetch('/api/du-an-tong', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (huy) return;
        const items: DuAnTongItem[] = Array.isArray(data?.items) ? data.items : [];
        setDsDuAnTong(items);
        if (data?.chuaCauHinh) { setTinhTrangDuAnTong('chuaNoi'); setThongBaoDuAnTong(data?.thongBao || ''); }
        else if (!res.ok || data?.thongBao) { setTinhTrangDuAnTong('loi'); setThongBaoDuAnTong(data?.thongBao || 'Không lấy được danh mục dự án.'); }
        else setTinhTrangDuAnTong('xong');
      } catch {
        if (!huy) { setTinhTrangDuAnTong('loi'); setThongBaoDuAnTong('Không gọi được App Thông tin dự án.'); }
      }
    })();
    return () => { huy = true; };
  }, [canDanhMucDuAn]);

  /**
   * Chọn một mã dự án → ĐIỀN GỢI Ý vào các ô còn lại.
   * CỐ Ý chỉ điền ô nào đang TRỐNG, không đè lên chữ người dùng đã gõ: chị Trâm nói dữ liệu bên kia
   * "đôi khi ghi sai mô tả" nên người nhập hay sửa lại — đè mất công gõ của họ là phản tác dụng.
   * Riêng mã dự án và tên thì luôn lấy theo lựa chọn, vì đó chính là thứ vừa được chọn.
   */
  const chonMaDuAnTong = (d: DuAnTongItem) => {
    setDuAnTongDaChon(d);
    setProjectId(d.maDuAn);
    if (d.tenDuAn) setTenDuAn(d.tenDuAn);
    if (d.chuDauTu && !chuDauTu.trim()) setChuDauTu(d.chuDauTu);
    if (d.diaChi && !diaChi.trim()) setDiaChi(d.diaChi);
    if (d.quocTich && !quocTich.trim()) setQuocTich(d.quocTich);
    if (d.hinhThucXayDung) setHinhThucXayDung(d.hinhThucXayDung as Project['hinhThucXayDung']);
    if (d.hoSoPhatThau) setHoSoPhatThau(d.hoSoPhatThau as Project['hoSoPhatThau']);
    if (d.dienTichDat && !dienTichDat) setDienTichDat(d.dienTichDat);
    setErrors(prev => { const c = { ...prev }; delete c.projectId; delete c.tenDuAn; return c; });
    setMoDsMaDuAn(false);
    setTimMaDuAn('');
  };

  // Form error validation
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Recalculate original end date whenever start date or expected days change
  useEffect(() => {
    if (ngayBatDau && soNgayDuKien > 0) {
      // TÍNH CẢ NGÀY ĐẦU: bắt đầu 20/07 + 9 ngày (8 thực hiện + 1 TP duyệt) → hạn hoàn thành Phòng
      // là 28/07, không phải 29/07 (chị Trâm báo lỗi 25/07/2026).
      const originalEnd = addDaysToDate(ngayBatDau, soNgayDuKien - 1);
      setNgayHoanThanhDuKienGoc(originalEnd);

      // ===== HẠN HIỆN TẠI DÙNG CHUNG CÔNG THỨC VỚI MỌI MÀN HÌNH (sửa 14/09/2026) =====
      // Chị Trâm báo: "Quản lý bấm dời tiến độ việc con thì lại lấn qua tiến độ của phòng."
      //
      // Cách cũ: hạn hiện tại = hạn GỐC + tổng ngày xin gia hạn. Mà hạn gốc = ngày bắt đầu +
      // soNgayDuKien − 1, tức hạn TỔNG đã gồm luôn ngày Trưởng phòng duyệt và ngày BLĐ duyệt.
      // Cộng phiếu vào đó nghĩa là ngày xin gia hạn bị tính chồng lên phần thời gian của Phòng —
      // trái với luật chị chốt: "giấy phép đó chỉ tính cho tiến độ bộ phận".
      // Kèm hệ quả thứ hai: trường lưu tính một kiểu, Dashboard/Kanban/Gantt tính kiểu khác, nên
      // cùng một hồ sơ mỗi nơi ra một ngày.
      //
      // Nay gọi thẳng getDeptDeadline — đúng hàm mà mọi màn hình đang dùng. Trong đó phiếu gia hạn
      // cộng vào hạn BỘ PHẬN trước, rồi mới cộng số ngày Trưởng phòng kiểm tra. Nhờ vậy số ngày
      // xin gia hạn không ăn vào phần của Phòng, và bốn nơi cùng ra một con số.
      const currentEnd = ymdOf(getDeptDeadline({
        ngayBatDau,
        tasks,
        soNgayThucHien,
        soNgayDuyetTP,
        soNgayDuyetBLD,
        soNgayDuKien,
        vongHienTai: Math.max(1, project?.vongHienTai || 1),
        delayLogs,
      }));
      setNgayHoanThanhDuKienHienTai(currentEnd);
    }
  }, [ngayBatDau, soNgayDuKien, delayLogs, tasks, soNgayThucHien, soNgayDuyetTP, soNgayDuyetBLD, project?.vongHienTai]);

  /**
   * HẠN BỘ PHẬN HIỆN TẠI — mốc việc con phải xong, ĐÃ cộng các phiếu gia hạn của vòng này.
   *
   * Phiếu dời hạn NEO VÀO MỐC NÀY, không neo vào hạn Phòng (chị Trâm chốt 15/09/2026):
   * "Tiến độ dời hạn lấy căn cứ theo tiến độ Bộ phận, đừng lấy căn cứ theo tiến độ của chị. Nếu
   *  tiến độ chị kiểm tra chị thêm 1 ngày thì chị phải thêm ghi chú dời hạn của chị riêng; còn nếu
   *  không thay đổi cứ cộng 1 ngày thì tiến độ Bộ phận và chị chung 1 ghi chú thôi, và chỉ cần
   *  Quản lý đăng ký thôi — do Bộ phận trễ kéo theo chị trễ."
   *
   * Hạn Phòng = hạn Bộ phận + số ngày Trưởng phòng kiểm tra, nên Bộ phận lùi bao nhiêu thì Phòng
   * tự lùi bấy nhiêu — một phiếu là đủ cho cả hai. Trước đây phiếu ghi theo hạn PHÒNG nên đọc lên
   * tưởng Quản lý đang xin dời cả phần ngày kiểm tra của Trưởng phòng.
   */
  /** Trưởng phòng đã TĂNG số ngày kiểm tra so với bản đã lưu → phải có phiếu riêng cho phần này. */
  const tpTangNgayKiemTra = !!project
    && soNgayDuyetTP > (project.soNgayDuyetTP ?? 1);

  const hanBoPhanHienTai = useMemo(
    () => (ngayBatDau ? ymdOf(getExecEnd({
      ngayBatDau, tasks, soNgayThucHien, soNgayDuyetTP, soNgayDuyetBLD, soNgayDuKien,
      vongHienTai: Math.max(1, project?.vongHienTai || 1), delayLogs,
    })) : ''),
    [ngayBatDau, tasks, soNgayThucHien, soNgayDuyetTP, soNgayDuyetBLD, soNgayDuKien, delayLogs, project?.vongHienTai],
  );

  /**
   * Tổng số ngày XIN GIA HẠN của vòng hiện tại — đúng phần được cộng thêm vào hạn, không tính phần
   * hạn tự lùi do kế hoạch việc con dài ra. Bằng đúng hiệu giữa "Hạn hiện tại" và "Hạn tự tính".
   */
  const tongNgayXinGiaHan = useMemo(
    () => (delayLogs || [])
      .filter(l => Math.max(1, l.vong || 1) === Math.max(1, project?.vongHienTai || 1))
      .filter(l => l.khau !== 'PHONG')
      .reduce((t, l) => t + Math.max(0, l.soNgayLech || 0), 0),
    [delayLogs, project?.vongHienTai],
  );

  /**
   * HẠN BỘ PHẬN THEO BẢN ĐÃ LƯU — tức hạn TRƯỚC KHI người dùng sửa việc con trên form.
   *
   * ⚠ ĐÂY MỚI LÀ "HẠN CŨ" CỦA PHIẾU (chị Trâm báo lỗi 19/09/2026):
   * "Chị sửa tiến độ việc con thêm ngày, tiến độ mới dời khoảng 5 ngày... lúc làm phiếu thì ghi
   *  chỉ trễ 3 ngày và tiến độ từ 21 => 24/9 hoàn toàn sai, chị xin dời từ 16/9 đến 21/9 cơ."
   *
   * Trước đây phiếu neo vào `hanBoPhanHienTai` — mà hàm đó tính trên việc con ĐANG SỬA TRÊN FORM,
   * nên nó đã là hạn MỚI (21/09) rồi. Lấy hạn mới làm "hạn cũ" thì phiếu ghi 21/09 → 24/09, kể
   * một câu chuyện không có thật, còn quãng dời thật 16/09 → 21/09 thì biến mất khỏi lịch sử.
   * Vẫn là lỗi "hai vế lấy khác nguồn" đã gặp mấy lần — lần này vế CŨ lỡ lấy dữ liệu MỚI.
   */
  const hanBoPhanTheoBanLuu = useMemo(
    () => (project ? ymdOf(getExecEnd({ ...project })) : ''),
    [project],
  );

  /**
   * HẠN PHÒNG TRƯỚC / SAU khi Trưởng phòng đổi số ngày kiểm tra.
   *
   * Phiếu khâu PHÒNG chỉ để GHI LẠI một việc đã xảy ra: Trưởng phòng vừa tăng ô "TP duyệt", hạn
   * Phòng do đó đã dịch ra. Hai mốc này app tính được, KHÔNG bắt người lập phiếu tự chọn — bắt
   * chọn tay thì họ chọn một ngày, app tính ra ngày khác, phiếu ghi một đằng hạn chạy một nẻo.
   */
  const hanPhongTruocKhiDoi = useMemo(
    () => (ngayBatDau && project ? ymdOf(getDeptDeadline({
      ngayBatDau, tasks, soNgayThucHien, soNgayDuyetTP: project.soNgayDuyetTP ?? 1,
      soNgayDuyetBLD, soNgayDuKien,
      vongHienTai: Math.max(1, project?.vongHienTai || 1), delayLogs,
    })) : ''),
    [ngayBatDau, tasks, soNgayThucHien, soNgayDuyetBLD, soNgayDuKien, delayLogs, project],
  );

  /**
   * HẠN PHÒNG SAU khi đổi số ngày kiểm tra — tính bằng CHÍNH công thức đã dùng cho `hanPhongTruocKhiDoi`,
   * chỉ khác đúng một tham số `soNgayDuyetTP`.
   *
   * ⚠ TRƯỚC ĐÂY LẤY TỪ STATE `ngayHoanThanhDuKienHienTai` — và đó là lỗi chị Trâm báo 19/09/2026:
   * "Khi chị bấm thêm ngày do Phòng duyệt trễ thêm 1 ngày thì phiếu bị lùi ngày."
   * State đó do một useEffect khác tính, nên ngay sau khi vừa lập một phiếu Bộ phận thì nó còn là
   * giá trị của chu kỳ render trước (chưa cộng phiếu vừa thêm). Vế trái tính tươi, vế phải đọc số
   * cũ → hiệu ra ÂM, phiếu ghi hạn mới SỚM hơn hạn cũ.
   * Nay hai vế cùng một nguồn, cùng một thời điểm nên không thể lệch — đúng nguyên tắc đã áp cho
   * phiếu dời hạn (14/09) và cho cửa chặn lưu (16/09).
   */
  const hanPhongSauKhiDoi = useMemo(
    () => (ngayBatDau ? ymdOf(getDeptDeadline({
      ngayBatDau, tasks, soNgayThucHien, soNgayDuyetTP, soNgayDuyetBLD, soNgayDuKien,
      vongHienTai: Math.max(1, project?.vongHienTai || 1), delayLogs,
    })) : ''),
    [ngayBatDau, tasks, soNgayThucHien, soNgayDuyetTP, soNgayDuyetBLD, soNgayDuKien, delayLogs, project?.vongHienTai],
  );

  /** Mốc neo của phiếu đang lập: phiếu Bộ phận neo vào hạn Bộ phận, phiếu Phòng neo vào hạn Phòng. */
  const mocNeoPhieu = newDelayKhau === 'PHONG' ? hanPhongTruocKhiDoi : hanBoPhanTheoBanLuu;

  // ===== CẢNH BÁO PHẢI TẮT NGAY KHI NGƯỜI DÙNG ĐÃ SỬA (Sếp báo lỗi 14/09/2026) =====
  // Các ô nhập đều tự xoá lỗi của mình khi gõ lại, nhưng hai lỗi suy ra TỪ BẢNG VIỆC CON thì không
  // ai dọn: `tasksWeight` (chia đủ 100%) và `ngayBatDau` (ngày bắt đầu lấy từ việc con sớm nhất).
  // Hệ quả giống hệt ca Sếp vừa gặp với phiếu dời tiến độ: người dùng làm đúng yêu cầu rồi mà chữ
  // đỏ vẫn nằm lì, không biết còn thiếu gì. Sửa bảng việc con là tắt hai cảnh báo đó ngay; bấm Lưu
  // thì validation vẫn chạy lại từ đầu nên không có chuyện lọt lỗi thật.
  useEffect(() => {
    setErrors(prev => {
      if (!prev.tasksWeight && !prev.ngayBatDau) return prev;
      const copy = { ...prev };
      delete copy.tasksWeight;
      delete copy.ngayBatDau;
      return copy;
    });
    setLoiAn([]);
  }, [tasks]);

  // Vòng làm việc đang chạy của hồ sơ (mỗi lần trả về làm lại & gửi CĐT lần nữa là 1 vòng).
  const vongHienTai = Math.max(1, project?.vongHienTai || 1);
  // Tỉ trọng của vòng hiện tại — dùng cho ràng buộc 100% và dòng chân bảng phân rã.
  const viTrongVong = useMemo(() => weightSumOfRound(tasks, vongHienTai), [tasks, vongHienTai]);
  const viTrongLuyKe = useMemo(() => weightSumAllRounds(tasks), [tasks]);
  const soVong = useMemo(() => Math.max(vongHienTai, soVongCoViec(tasks)), [tasks, vongHienTai]);

  // Tiến độ Bộ phận tính RIÊNG cho vòng hiện tại (vòng mới bắt đầu lại từ 0%).
  const autoBoPhanProgress = useMemo(() => {
    return soVong > 1 ? progressOfRound(tasks, vongHienTai) : calculateProjectProgress(tasks);
  }, [tasks, vongHienTai, soVong]);

  useEffect(() => {
    setTienDoBoPhan(autoBoPhanProgress);
  }, [autoBoPhanProgress]);

  // If a new delay log is being added, pre-fill its New End Date suggestion
  useEffect(() => {
    if (showAddDelay && mocNeoPhieu) {
      // Phiếu Phòng: hạn mới KHÔNG cho chọn — chính là hạn Phòng sau khi đã đổi số ngày TP duyệt.
      // Phiếu Bộ phận: gợi ý +3 ngày để người lập sửa lại theo nhu cầu thật.
      // Phiếu Bộ phận: nếu việc con vừa bị kéo dài thì hạn mới CHÍNH LÀ hạn theo kế hoạch vừa sửa —
      // điền sẵn đúng con số đó, người lập chỉ việc xem lại. Chưa sửa gì thì mới gợi ý +3 ngày.
      setNewDelayNewEnd(newDelayKhau === 'PHONG'
        ? hanPhongSauKhiDoi
        : (hanBoPhanHienTai && hanBoPhanHienTai > mocNeoPhieu
            ? hanBoPhanHienTai
            : addDaysToDate(mocNeoPhieu, 3)));
    }
  }, [showAddDelay, mocNeoPhieu, newDelayKhau, hanPhongSauKhiDoi, hanBoPhanHienTai]);

  // Smart Delay & KPI Evaluation Logic
  const isOverdue = (): boolean => {
    // If completed: check if actual completed date is after current expected completion date
    if (ngayHoanThanhThucTe && ngayHoanThanhDuKienHienTai) {
      return new Date(ngayHoanThanhThucTe) > new Date(ngayHoanThanhDuKienHienTai);
    }
    
    // If not completed: check if current date exceeds current expected completion date and progress is < 100%
    // SỬA 08/09/2026 (Sếp báo): trước để cứng ngày giả lập '2026-06-26' (sót từ lúc demo), nên nút
    // bắt buộc nhập lý do trễ hạn tính sai theo ngày đó suốt từ trước giờ, không theo đúng hôm nay.
    const todayStr = new Date().toISOString().split('T')[0];
    if (ngayHoanThanhDuKienHienTai && (tienDoBoPhan < 100 || tienDoPhong < 100)) {
      return new Date(todayStr) > new Date(ngayHoanThanhDuKienHienTai);
    }
    return false;
  };

  // ===== HẠN BỊ ĐẨY XA SO VỚI LẦN LƯU TRƯỚC (Sếp báo lỗi 08/09/2026) =====
  // Trước đây: sửa hồ sơ (vd sau khi TP kéo về Bước 1 để QL cập nhật lại việc con) làm "Hạn hoàn
  // thành Phòng (tự tính)" bị đẩy xa thêm N ngày thì app lưu thẳng, không bắt ghi lại vào lịch sử dời
  // tiến độ — chỉ coi là "trễ" khi hạn đã TRÔI QUA (isOverdue), còn hạn tương lai bị đẩy xa hơn thì
  // lọt qua hoàn toàn. So sánh NGAY TẠI FORM (không phân biệt vai trò lưu — TP hay QL lưu cũng đều
  // bị bắt) nên không lặp lại lỗ hổng "chỉ nhánh Quản lý ở App.tsx mới so sánh".
  //
  // ===== HAI VẾ SO SÁNH PHẢI LẤY CÙNG MỘT NGUỒN (chị Trâm báo lỗi 16/09/2026) =====
  // "Quản lý kéo về Bước 1, hạn của Quản lý đã tăng 4 ngày, Trưởng phòng vẫn 1 ngày như cũ. Sau khi
  //  bấm lưu thì lại yêu cầu nhập tiến độ Phòng là sao — chị đâu có tăng ngày kiểm lên ngày nào."
  //
  // Nguyên nhân: vế trái là hạn TÍNH LẠI trên form, vế phải là TRƯỜNG ĐÃ LƯU. Mà khi Quản lý kéo hồ
  // sơ về Bước 1 (handlePullBackApply), app chỉ cập nhật `ngayHoanThanhDuKienHienTai`, KHÔNG cập
  // nhật `ngayHoanThanhDuKienGoc` — nên trường đó nằm lại ở giá trị của kế hoạch cũ. Trưởng phòng mở
  // ra, không sửa gì, bấm lưu: form tính ra hạn theo kế hoạch MỚI, so với trường cũ thì đương nhiên
  // lớn hơn → app đòi khai phiếu, dù phiếu đã có sẵn trong bảng và đã giải thích đúng 4 ngày đó.
  //
  // Nay vế phải cũng TÍNH LẠI bằng chính công thức, từ dữ liệu ĐÃ LƯU (việc con cũ, phiếu cũ). Hai
  // vế cùng thước đo nên chênh lệch chỉ còn phản ánh đúng thứ người dùng vừa sửa trên form — đúng
  // bài học đã rút ra ngày 14/09 khi phiếu ghi "+0 ngày".
  // CỐ Ý không đi sửa trường đã lưu: chỉ đổi CÁCH ĐỌC thì không phải rà lại mọi luồng ghi, và hồ sơ
  // cũ đọc lên vẫn đúng.
  const gocTheoBanDaLuu = useMemo(
    () => (project ? ymdOf(getDeptDeadline({ ...project, delayLogs: [] })) : ''),
    [project],
  );
  // ===== VÒNG MỚI = LÀM LẠI TỪ ĐẦU, KHÔNG CÓ "DỜI HẠN" (chị Trâm chốt 19/09/2026) =====
  // "Vòng mới tính là làm lại báo giá, không còn liên quan tới tiến độ của vòng cũ nữa em, cho nên
  //  nó như là 1 công việc lặp lại từ đầu rồi, thì làm gì còn dời hạn chứ."
  // Bản ĐÃ LƯU chưa có việc con nào thuộc vòng đang chạy → vòng vừa mở, lần lưu này là LẬP kế hoạch
  // cho vòng mới. Hạn "cũ" lúc đó vẫn là hạn của vòng trước — một kế hoạch đã khép lại — nên đem so
  // thì ngày nào cũng ra "bị đẩy xa". Đó là lý do hồ sơ sang vòng 2 bị đòi khai phiếu dời tiến độ
  // và bảng Lịch sử các vòng hiện "+6n · 1 phiếu" trong khi không ai làm chậm ngày nào.
  const laLapKeHoachVongMoi = useMemo(() => {
    const vong = Math.max(1, project?.vongHienTai || 1);
    if (!project || vong <= 1) return false;
    return !(project.tasks || []).some(t => Math.max(1, t.vong || 1) === vong);
  }, [project]);

  const daBiDayXaHan = !!project && !laLapKeHoachVongMoi && !!gocTheoBanDaLuu && !!ngayHoanThanhDuKienGoc
    && ngayHoanThanhDuKienGoc > gocTheoBanDaLuu;

  // SỬA 08/09/2026 (Sếp chỉnh lại): lý do dời tiến độ phải nhập ĐÚNG Ở MỤC "5. Lịch Sử Dời Tiến Độ"
  // (bấm "+ Đăng ký dời tiến độ" — đã có sẵn phiếu riêng: hạn mới, lý do, người phê duyệt), KHÔNG
  // phải ô "Ghi chú nguyên nhân trễ hạn" ở mục 6 (ô đó dành riêng cho lúc hồ sơ ĐÃ quá hạn thật, phục
  // vụ chấm KPI cuối kỳ — khác mục đích). Nên `delayReasonRequired`/`nguyenNhanTreHan` GIỮ NGUYÊN chỉ
  // gắn với isOverdue() như cũ; hạn bị đẩy xa được validate RIÊNG bằng daCoLogDoiTienDo bên dưới.
  const delayReasonRequired = isOverdue();

  // Đã có ít nhất 1 dòng MỚI trong lịch sử dời tiến độ kể từ khi mở form (so độ dài với delayLogs gốc
  // của project) — tức Quản lý/TP đã dùng đúng phiếu "Đăng ký dời tiến độ" để khai lý do + người duyệt.
  const daCoLogDoiTienDo = delayLogs.length > (project?.delayLogs || []).length;

  /**
   * Đã có phiếu MỚI thuộc khâu PHÒNG chưa — dùng để buộc Trưởng phòng ghi chú khi tự tăng số ngày
   * kiểm tra (chị Trâm chốt 15/09/2026: "nếu tiến độ chị kiểm tra chị thêm 1 ngày thì chị phải thêm
   * ghi chú dời hạn của chị riêng").
   */
  const daCoLogPhieuPhong = delayLogs.filter(l => l.khau === 'PHONG').length
    > (project?.delayLogs || []).filter(l => l.khau === 'PHONG').length;

  // Quản lý (Level 2) CHỈ XEM thông tin chung & thông tin gốc phòng kinh doanh —
  // chỉ Trưởng phòng (Level 1) khởi tạo & chỉnh sửa các mục này.
  const infoLocked = currentUserRole === 'MANAGER';
  // Các trường THUỘC DỰ ÁN (tên dự án, CĐT, địa chỉ, hình thức đấu thầu, tình trạng dự án và toàn bộ
  // "Thông tin gốc Phòng Kinh doanh") CHỈ được sửa ở bước khởi tạo dự án hoặc chỉnh sửa chính hồ sơ
  // Dự án. Khi tạo/sửa CÔNG VIỆC thì chỉ xem — sửa ở hồ sơ Dự án để mọi công việc con cùng cập nhật
  // (chị Trâm chốt 25/07/2026). Trước đây sửa được ở công việc nên dữ liệu dự án bị lệch giữa các công việc.
  const duAnInfoLocked = !(formMode === 'CREATE_TENDER' || isParentEdit);
  const duAnLockNote = (
    <span className="ml-1 normal-case text-[9px] font-bold text-brand-accent dark:text-brand-accent-300">
      🔒 Thông tin dự án — sửa tại hồ sơ Dự án
    </span>
  );

  // ===== Ô SẼ NHẬN DỮ LIỆU TỪ APP THÔNG TIN DỰ ÁN (chị Trâm chốt 12/09/2026) =====
  // Chị khoanh đúng các ô này và yêu cầu ghi chú ngay trên nhãn, để người nhập biết ô nào rồi đây
  // App Thông tin dự án sẽ đổ dữ liệu về (không nên gõ tay lệch chuẩn), ô nào là của Phòng tự quản.
  // HIỆN TẠI chưa nối app nên vẫn nhập tay hết; ghi chú này là để chuẩn bị và để đối chiếu khi nối.
  // KHÔNG gắn cho: Mã Phòng đặt, Mô tả, Hình thức đấu thầu, Tình trạng dự án, Quản lý chính/phụ —
  // đó là dữ liệu của riêng Phòng Đấu thầu.
  const ghiChuNguonAppDuAn = (
    <span
      className="ml-1 normal-case text-[9px] font-bold text-slate-400 dark:text-slate-500"
      title="Ô này sẽ được App Thông tin dự án đổ dữ liệu về khi hai app nối với nhau. Hiện tại nhập tay."
    >
      (App thông tin dự án)
    </span>
  );

  // HAI thứ KHÁC NHAU, đừng gộp (chị Trâm chốt 26/07/2026):
  //   • MÔ TẢ DỰ ÁN  = moTa của bản ghi DU_AN — Trưởng phòng khai ở hồ sơ Dự án, nơi khác chỉ xem.
  //   • GHI CHÚ CÔNG VIỆC = moTa của bản ghi CONG_VIEC — Quản lý ghi tự do (lưu ý riêng, link thư
  //     mục triển khai chung của team). KHÔNG kế thừa từ dự án cha, KHÔNG bị đồng bộ đè.
  // Cùng dùng chung ô nhập bên dưới; khác nhau ở nhãn và ở chỗ nó được render.
  // Ô nhập TỰ GIÃN theo nội dung — mô tả dài bao nhiêu hiện hết bấy nhiêu, không có thanh cuộn
  // trong ô, không cắt chữ (chị Trâm chốt 26/07/2026).
  const moTaField = (nhan: string, goiY: string, rows: number) => (
    <>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">{nhan}</label>
      <AutoGrowTextarea
        minRows={rows}
        value={moTa}
        onChange={(e) => setMoTa(e.target.value)}
        placeholder={goiY}
        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:ring-brand-accent bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100"
      />
    </>
  );

  // Mô tả của DỰ ÁN CHA để hiện (chỉ xem) trên hồ sơ công việc. Lấy từ duAnChaInfo do App truyền —
  // gom từ TOÀN BỘ projects nên Quản lý không bị bộ lọc quyền cắt mất dự án cha.
  const idChaDangXet = formMode === 'ADD_WORK' ? selectedProjectId : project?.duAnChaId;
  const moTaDuAnCha = idChaDangXet ? duAnChaInfo?.[idChaDangXet]?.moTa : undefined;

  // Handle adding Delay Log
  const handleAddDelayLog = (e: React.MouseEvent) => {
    e.preventDefault();
    const errs: { [key: string]: string } = {};
    if (!newDelayNewEnd) errs.newEnd = 'Vui lòng chọn ngày hoàn thành mới';
    if (!newDelayReason.trim()) errs.reason = 'Vui lòng nhập lý do dời hạn';

    // Phiếu Phòng: hạn mới do app tự tính từ ô "TP duyệt". Chưa tăng số ngày đó thì hạn Phòng không
    // dịch, phiếu ghi ra 0 ngày — một dòng trống nghĩa nằm trong lịch sử. Chặn ngay và nói rõ phải
    // làm gì, thay vì để lập rồi mới thấy vô nghĩa.
    if (newDelayKhau === 'PHONG' && mocNeoPhieu && newDelayNewEnd
        && getDaysDifference(mocNeoPhieu, newDelayNewEnd) <= 0) {
      errs.newEnd = 'Chưa tăng ô "Trưởng phòng duyệt (ngày)" nên hạn Phòng không dịch — không có gì để ghi phiếu. Tăng số ngày kiểm tra ở mục 3 trước, rồi quay lại lập phiếu này.';
    }

    if (newDelayKhau !== 'PHONG' && newDelayNewEnd && mocNeoPhieu) {
      const diff = getDaysDifference(mocNeoPhieu, newDelayNewEnd);
      if (diff <= 0) {
        errs.newEnd = 'Hạn Bộ phận mới phải sau hạn Bộ phận hiện tại';
      }
    }

    if (Object.keys(errs).length > 0) {
      setErrors(prev => ({ ...prev, ...errs }));
      return;
    }

    // ===== SỐ NGÀY GHI VÀO PHIẾU CHỈ LÀ PHẦN XIN THÊM NGOÀI KẾ HOẠCH =====
    // Phần hạn lùi do việc con dài ra thì getExecEnd đã tự thấy từ chính kế hoạch — ghi vào
    // `soNgayLech` nữa là cộng hai lần (đúng bug chị Trâm báo 29/07/2026). Nên đo từ hạn THEO KẾ
    // HOẠCH ĐANG CÓ TRÊN FORM tới ngày người lập chọn: bằng nhau ⇒ 0, chọn xa hơn ⇒ phần dư đó mới
    // là xin gia hạn thật.
    // Cặp ngày cũ/mới của phiếu vẫn ghi đúng quãng dời thật để đọc lịch sử thấy chuyện đã xảy ra.
    const mocTheoKeHoach = newDelayKhau === 'PHONG' ? mocNeoPhieu : (hanBoPhanHienTai || mocNeoPhieu);
    const calculatedShift = Math.max(0, getDaysDifference(mocTheoKeHoach, newDelayNewEnd));

    const newLog: DelayLog = {
      id: `L${Date.now()}`,
      ngayThayDoi: newDelayDate,
      // Cặp hạn cũ/mới ghi theo mốc neo của khâu — xem ghi chú ở `hanBoPhanHienTai` và `khau`.
      ngayCu: mocNeoPhieu,
      ngayMoi: newDelayNewEnd,
      // Phiếu KHAI TAY ở mục 5 mang số ngày THẬT: đây đúng là phần xin thêm ngoài kế hoạch việc con,
      // và getExecEnd() bên App.tsx sẽ cộng đúng số này vào hạn Bộ phận (chị Trâm chốt 12/09/2026).
      soNgayLech: calculatedShift,
      khau: newDelayKhau,
      lyDo: newDelayReason,
      // Không hỏi người duyệt nữa — xem ghi chú ở chỗ đã bỏ ô nhập trong phiếu.
      nguoiDuyet: '',
      // Gắn VÒNG đang chạy — mở vòng mới thì hạn tính lại từ bộ việc con của vòng đó, không cộng
      // tiếp phiếu của vòng trước (bằng không hồ sơ sang vòng 2 là tự nhảy hạn thêm bấy nhiêu ngày).
      vong: Math.max(1, project?.vongHienTai || 1),
      // KHÂU GÂY TRỄ — chấm theo kế hoạch việc con và tiến độ ĐANG có trên form (chị Trâm 15/09/2026).
      khauTre: khauDangTre({
        ngayBatDau, tasks, soNgayThucHien, soNgayDuyetTP, soNgayDuyetBLD, soNgayDuKien,
        vongHienTai: Math.max(1, project?.vongHienTai || 1),
        delayLogs, tienDoBoPhan, tienDoPhong,
      }),
    };

    setDelayLogs([...delayLogs, newLog]);
    setShowAddDelay(false);
    setNewDelayReason('');
    
    
    // Clear log errors
    setErrors(prev => {
      const copy = { ...prev };
      delete copy.newEnd;
      delete copy.reason;
      delete copy.approver;
      // ⚠ PHẢI xoá luôn `delayLogRequired` (Sếp báo lỗi 14/09/2026).
      // Đây là cờ "bắt buộc khai phiếu dời tiến độ trước khi lưu", được đặt lúc bấm Lưu. Người dùng
      // làm đúng yêu cầu — bấm "+ Đăng ký dời tiến độ" và khai xong — nhưng cờ cũ không được dọn nên
      // dòng đỏ vẫn nằm lì trên màn hình, trông như app vẫn chưa chấp nhận. Thực tế bấm Lưu lần nữa
      // là lưu được (validation tính lại từ đầu), nhưng không ai đoán ra điều đó khi đang nhìn chữ
      // đỏ "Bắt buộc…". Vừa khai xong là cờ phải tắt ngay.
      delete copy.delayLogRequired;
      return copy;
    });
    // Khối lỗi gom ở cuối form cũng phải dọn theo, bằng không nó lặp lại đúng câu vừa được giải quyết.
    setLoiAn([]);
  };

  const handleRemoveDelayLog = (logId: string) => {
    setDelayLogs(delayLogs.filter(log => log.id !== logId));
  };

  /**
   * ===== SỬA LẠI PHIẾU ĐÃ LẬP (chị Trâm chốt 19/09/2026) =====
   * "Mấy cái này nhiều khi chị bấm nhanh quá thành bấm nhầm, do Phòng chỉnh mà thành Bộ phận
   *  chỉnh. Em cho chị cây bút LV1 tự chỉnh lại được nhé em, không cho chỉnh ngày, chỉ cho chỉnh
   *  lý do."
   *
   * CHỈ cho sửa KHÂU và LÝ DO. Ngày và số ngày KHOÁ CỨNG: chúng là kết quả app tự tính từ kế
   * hoạch tại thời điểm lập phiếu — cho gõ tay vào là phiếu nói một đằng, hạn chạy một nẻo, đúng
   * lớp lỗi đã phải sửa mấy lần.
   *
   * ⚠ Đổi khâu có ĐỔI HẠN: phiếu Bộ phận cộng ngày vào hạn, phiếu Phòng thì không (số ngày đó đã
   * nằm trong ô "TP duyệt"). Nên sửa nhầm khâu là hạn sai theo — chính vì vậy mới cần sửa được.
   * Hộp sửa nói rõ điều này để người sửa biết mình đang làm gì.
   */
  const formRef = useRef<HTMLFormElement>(null);
  const [suaPhieuId, setSuaPhieuId] = useState<string | null>(null);
  const [suaPhieuKhau, setSuaPhieuKhau] = useState<'BO_PHAN' | 'PHONG'>('BO_PHAN');
  const [suaPhieuLyDo, setSuaPhieuLyDo] = useState('');

  const moSuaPhieu = (log: DelayLog) => {
    setSuaPhieuId(log.id);
    setSuaPhieuKhau(log.khau === 'PHONG' ? 'PHONG' : 'BO_PHAN');
    setSuaPhieuLyDo(log.lyDo || '');
  };
  const luuSuaPhieu = () => {
    if (!suaPhieuId) return;
    setDelayLogs(prev => prev.map(l => l.id === suaPhieuId
      ? { ...l, khau: suaPhieuKhau, lyDo: suaPhieuLyDo.trim() || l.lyDo }
      : l));
    setSuaPhieuId(null);
    // ===== SỬA XONG LÀ GHI LUÔN (chị Trâm chốt 19/09/2026: "sửa phải cho lưu nha") =====
    // Trước đây nút này chỉ đổi dữ liệu trong form, phải nhớ bấm tiếp "Lưu Hồ Sơ" ở cuối trang —
    // quên một cái là công sửa mất sạch khi đóng form. Nay tự bấm lưu hồ sơ luôn.
    // Dùng requestSubmit() (không phải submit()) để form vẫn chạy qua handleSubmit — tức vẫn đi
    // hết các cửa kiểm tra, không lách validation.
    // setTimeout 0: đợi React ghi xong state delayLogs rồi mới submit, bằng không lưu lại đúng
    // bản cũ — chính lớp lỗi "đọc state của chu kỳ render trước" đã gặp ở phiếu khâu Phòng.
    setTimeout(() => formRef.current?.requestSubmit(), 0);
  };

  // Modal cảnh báo trễ hẹn CĐT (thay cho confirm() mặc định)
  const [showCdtWarning, setShowCdtWarning] = useState(false);
  // Lỗi validation rơi vào ô KHÔNG hiện trên màn hình (mục bị ẩn theo chế độ form) — hiện cạnh nút
  // Lưu để không bao giờ có cảnh "bấm Lưu mà không thấy gì xảy ra" (Sếp báo 12/09/2026).
  const [loiAn, setLoiAn] = useState<string[]>([]);
  // Trap bàn phím cho modal cảnh báo trễ hẹn CĐT (render có điều kiện bên trong form)
  const cdtWarningRef = useModalA11y(() => setShowCdtWarning(false), showCdtWarning);

  // Submit the form
  const handleSubmit = (e?: React.FormEvent, bypassCdtGuard = false) => {
    e?.preventDefault?.();
    const errs: { [key: string]: string } = {};

    if (formMode === 'ADD_WORK' && !selectedProjectId) {
      setErrors({ selectedProjectId: 'Vui lòng chọn gói thầu từ danh sách trước' });
      return;
    }

    // Permissive check for project_id to support YYYY.NN (e.g. 2026.01) and DA2026.0XX formats
    const projectIdRegex = /^[A-Za-z0-9._-]+$/;
    if (!projectId.trim()) {
      errs.projectId = 'Mã số dự án không được để trống';
    } else if (!projectIdRegex.test(projectId) || projectId.trim().length < 3) {
      errs.projectId = 'Mã số dự án không đúng định dạng (Ví dụ: 2026.01 hoặc DA2026.006)';
    } else if (
      // MÃ DỰ ÁN DUY NHẤT trong môi trường Phòng Đấu Thầu (chị Trâm chốt 26/07/2026).
      // Chỉ kiểm khi đang đăng ký/sửa hồ sơ DỰ ÁN — công việc con dùng chung mã của dự án cha
      // nên trùng mã ở cấp công việc là đúng, không được báo lỗi.
      (formMode === 'CREATE_TENDER' || isParentEdit) &&
      maDuAnDaDung.includes(projectId.trim().toUpperCase())
    ) {
      errs.projectId = `Mã dự án "${projectId.trim()}" đã có dự án khác dùng — mỗi dự án phải có mã riêng. Vui lòng đổi mã khác.`;
    }

    if (!tenDuAn.trim()) errs.tenDuAn = 'Tên dự án thầu không được để trống';
    
    if (!ngayBatDau) errs.ngayBatDau = 'Chưa có ngày bắt đầu — hãy đặt ngày cho ít nhất một công việc con ở mục Sơ đồ phân rã (hệ thống tự lấy ngày sớm nhất).';
    // Thời hạn có thể để trống (0 ngày) khi tạo — Trưởng phòng sẽ vào thiết lập sau (báo qua chuông)
    
    // ===== HAI RÀNG BUỘC TIẾN ĐỘ KHÔNG ÁP CHO DỰ ÁN CHA (Sếp báo lỗi 12/09/2026) =====
    // "Cây bút đó bấm vô, sửa xong, không cho lưu."
    // Bản ghi DU_AN chỉ là hồ sơ đăng ký tên dự án + Chủ đầu tư: không có việc con, không tiến độ,
    // không lên Kanban, và soNgayDuKien = 0 nên hạn hoàn thành trùng luôn ngày bắt đầu. Qua ngày đó
    // là isOverdue() trả true → form đòi "nguyên nhân trễ hạn". Nhưng ô nhập nguyên nhân nằm ở mục 6
    // và phiếu dời tiến độ nằm ở mục 5 — HAI MỤC NÀY ĐỀU BỊ ẨN khi sửa dự án cha (xem isParentEdit ở
    // phần render). Kết quả: lỗi được đặt vào một ô không tồn tại trên màn hình, scrollIntoView không
    // tìm thấy gì để cuộn tới, nên bấm "Lưu Hồ Sơ" trông như không có phản ứng — kẹt cứng vĩnh viễn.
    // Khái niệm trễ hạn / dời tiến độ chỉ có nghĩa với bản ghi CÔNG VIỆC, nên bỏ hẳn cho dự án cha —
    // cùng cách đã làm với ràng buộc tỉ trọng 100% ngay bên dưới.
    if (!isParentEdit && delayReasonRequired && !nguyenNhanTreHan.trim()) {
      errs.nguyenNhanTreHan = 'Bắt buộc: Dự án đang trễ hạn thầu! Vui lòng điền nguyên nhân để thẩm định KPI.';
    }

    // Hạn hoàn thành Phòng bị đẩy xa so với lần lưu trước mà CHƯA khai phiếu ở mục 5 — bắt buộc bấm
    // "+ Đăng ký dời tiến độ" (đúng chỗ có sẵn: hạn mới, lý do, người phê duyệt), không cho lưu thẳng.
    // ===== TRƯỞNG PHÒNG TỰ TĂNG NGÀY KIỂM TRA → PHẢI CÓ PHIẾU RIÊNG (chị Trâm chốt 15/09/2026) =====
    // "Nếu tiến độ chị kiểm tra chị thêm 1 ngày thì chị phải thêm ghi chú dời hạn của chị riêng."
    // Số ngày Trưởng phòng kiểm tra đẩy hạn Phòng và hạn thầu ra xa mà KHÔNG để lại dấu vết nào
    // trong lịch sử dời tiến độ — đọc báo cáo cuối kỳ chỉ thấy hạn tự nhiên lùi, không rõ vì đâu.
    // Phiếu khâu PHÒNG chỉ để GHI LẠI lý do, số ngày không cộng thêm lần nữa (xem `khau` ở types.ts).
    if (!isParentEdit && tpTangNgayKiemTra && !daCoLogPhieuPhong) {
      errs.delayLogRequired = 'Bắt buộc: Số ngày Trưởng phòng kiểm tra đã tăng so với lần lưu trước. Bấm "+ Đăng ký dời tiến độ" ở mục 5, chọn khâu "Phòng (ngày TP kiểm tra)" và khai lý do trước khi lưu.';
    }

    if (!isParentEdit && daBiDayXaHan && !daCoLogDoiTienDo) {
      errs.delayLogRequired = 'Bắt buộc: Hạn hoàn thành Phòng đã bị đẩy xa so với lần lưu trước! Bấm "+ Đăng ký dời tiến độ" ở mục 5 (Lịch Sử Dời Tiến Độ) để khai lý do trước khi lưu.';
    }

    // RÀNG BUỘC PHÂN BỔ TỈ TRỌNG (chị Trâm chốt 25/07/2026): phải chia đủ 100% cho VÒNG HIỆN TẠI
    // mới được lưu. Tạo công việc mới thì bắt buộc phải có việc con; sửa hồ sơ thì chỉ ràng buộc
    // khi vòng hiện tại đã có việc con (Trưởng phòng vẫn dựng được khung hồ sơ trước khi phân rã).
    if (!(formMode === 'CREATE_TENDER' || isParentEdit)) {
      const issue = weightIssue(tasks, vongHienTai);
      if (issue && (formMode === 'ADD_WORK' || issue.soViec > 0)) {
        errs.tasksWeight = issue.moTa + ' Chia đủ 100% rồi mới lưu được hồ sơ.';
      }
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // scroll to first error
      const firstErrorKey = Object.keys(errs)[0];
      const element = document.getElementById(`field-${firstErrorKey}`);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // ===== KHÔNG BAO GIỜ CHẶN LƯU MÀ IM LẶNG (Sếp báo lỗi 12/09/2026) =====
      // Nếu ô chứa lỗi KHÔNG có trên màn hình (bị ẩn theo chế độ form), người dùng bấm Lưu chỉ thấy
      // form đứng im, không biết vì sao — đúng cảnh đã xảy ra với form sửa Dự án cha. Gom các lỗi
      // "vô hình" lại và hiện ngay cạnh nút Lưu để luôn có thứ đọc được.
      const loiKhongThayDuoc = Object.keys(errs)
        .filter(k => !document.getElementById(`field-${k}`))
        .map(k => errs[k]);
      setLoiAn(loiKhongThayDuoc);
      return;
    }
    setLoiAn([]);

    // CẢNH BÁO trước khi Trưởng phòng bấm duyệt: tiến độ tính ra VƯỢT thời hạn đã hẹn CĐT.
    // Thay confirm() mặc định của trình duyệt bằng modal web (đẹp hơn) — mở modal rồi dừng lại.
    if (!bypassCdtGuard && currentUserRole === 'BOOD' && formMode !== 'CREATE_TENDER' && hanHenCDT &&
        soNgayDuKien > 0 && ngayHoanThanhDuKienGoc && ngayHoanThanhDuKienGoc > hanHenCDT) {
      setShowCdtWarning(true);
      return;
    }

    // Calculate actual status
    let trangThai: Project['trangThai'] = 'DANG_THUC_HIEN';
    // "Hoàn thành" CHỈ khi hồ sơ đã THỰC SỰ gửi CĐT (kanbanStep >= 5, qua Kanban) hoặc Trưởng
    // phòng tự tay nhập ngày hoàn thành thực tế — không phải cứ kéo thanh Tiến độ Phòng lên 100%
    // trong form là tự động coi là xong. Trước đây tienDoPhong === 100 một mình là đủ, nên sửa
    // hồ sơ đang ở Bước 1-3 (chưa hề trình BLĐ/gửi CĐT) mà thanh trượt sẵn ở 100% là hồ sơ bị đánh
    // dấu "đã hoàn thành" ngay dù thẻ Kanban vẫn còn nằm ở bước sớm — mâu thuẫn (chị Trâm báo 28/07/2026).
    // MỐC HOÀN THÀNH NAY LÀ BƯỚC 4 (trình BLĐ), không phải Bước 5 (đã gửi CĐT) — chị Trâm chốt
    // 12/09/2026: phần từ trình BLĐ tới lúc gửi CĐT là tiến độ chiến lược, không tính cho Phòng.
    const xongPhanPhong = (project?.kanbanStep || 1) >= BUOC_XONG_PHAN_PHONG;
    const isCompleted = (tienDoPhong === 100 && xongPhanPhong) || ngayHoanThanhThucTe !== '';
    
    if (isCompleted) {
      const completionDate = ngayHoanThanhThucTe || new Date().toISOString().split('T')[0];
      if (new Date(completionDate) > new Date(ngayHoanThanhDuKienHienTai)) {
        trangThai = 'HOAN_THANH_TRE_HAN';
      } else {
        trangThai = 'HOAN_THANH_DUNG_HAN';
      }
    } else {
      // Cùng lỗi ngày giả cứng như isOverdue() ở trên — sửa chung một lượt (08/09/2026).
      const todayStr = new Date().toISOString().split('T')[0];
      if (new Date(todayStr) > new Date(ngayHoanThanhDuKienHienTai)) {
        trangThai = 'TRE_TIEN_DO';
      } else {
        trangThai = 'DANG_THUC_HIEN';
      }
    }

    // Calculate dynamic individual project KPI score
    let daysDelayed = 0;
    if (isCompleted) {
      const completionDate = ngayHoanThanhThucTe || new Date().toISOString().split('T')[0];
      daysDelayed = Math.max(0, getDaysDifference(ngayHoanThanhDuKienHienTai, completionDate));
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      daysDelayed = Math.max(0, getDaysDifference(ngayHoanThanhDuKienHienTai, todayStr));
    }
    // KPI chỉ tính theo tiến độ (không còn điểm chất lượng)
    const finalKpi = Math.max(0, 100 - (daysDelayed * 5));

    // CREATE_TENDER = tạo Dự án cha (DU_AN, không lên Kanban); ADD_WORK = tạo Công việc con mới (CONG_VIEC, id MỚI, có dự án cha)
    const loaiBanGhi: Project['loaiBanGhi'] =
      formMode === 'CREATE_TENDER' ? 'DU_AN'
      : formMode === 'ADD_WORK' ? 'CONG_VIEC'
      : (project?.loaiBanGhi || 'CONG_VIEC');
    const duAnChaId = formMode === 'ADD_WORK' ? selectedProjectId : (formMode === 'EDIT_ALL' ? project?.duAnChaId : undefined);

    // SỬA 08/09/2026 (Sếp báo lỗi): trước đây Delay Logs CHỈ ghi ở luồng riêng "kéo hồ sơ từ Bước 4
    // về Bước 1" (xem handlePullBackApply/PullBackDelayModal) — sửa hồ sơ bình thường ở ĐÂY làm hạn
    // bị đẩy xa hơn thì hoàn toàn lọt qua, không có bằng chứng trong lịch sử. Giờ validate ở trên
    // (daBiDayXaHan && !daCoLogDoiTienDo) đã CHẶN LƯU cho tới khi Quản lý/TP tự bấm "+ Đăng ký dời
    // tiến độ" ở mục 5 và điền đúng phiếu (lý do, người phê duyệt, hạn mới) — phiếu đó tự đẩy vào
    // state `delayLogs` qua handleAddDelayLog rồi, nên ở ĐÂY chỉ cần lưu nguyên `delayLogs`, không tự
    // chế thêm dòng nào nữa (tránh trùng / sai người khai lý do).
    const finalDelayLogs = delayLogs;

    const savedProject: Project = {
      id: (formMode === 'EDIT_ALL' ? project?.id : undefined) || `P${Date.now()}`,
      loaiBanGhi,
      duAnChaId,
      // Ô nhập chỉ HIỂN THỊ hoa nhờ CSS "uppercase" (text-transform) — giá trị state gõ vào
      // vẫn giữ nguyên chữ hoa/thường thật. Không chuẩn hóa ở đây thì lưu xuống theo đúng
      // chữ người dùng gõ (có thể là chữ thường), rồi các nơi khác hiển thị lại {p.projectId}
      // không có CSS này sẽ lộ ra "lúc hoa lúc thường" (chị Trâm báo 25/08/2026).
      projectId: projectId.trim().toUpperCase(),
      tenDuAn,
      quanLyId,
      quanLyIdsPhu: quanLyIdsPhu.filter(id => id !== quanLyId),
      // Dự án cha KHÔNG gán chuyên viên. Với công việc: chuyên viên tự tổng hợp từ
      // người được giao các việc con (chính = người được giao nhiều nhất).
      thucHienId: loaiBanGhi === 'DU_AN' ? '' : (taskAssignees[0] || thucHienId),
      thucHienIds: loaiBanGhi === 'DU_AN' ? [] : (taskAssignees.length > 0 ? taskAssignees : thucHienIds),
      hangMuc,
      // Người dùng không điền gì vào khung dựng sẵn → lưu rỗng, đừng để hồ sơ đầy khung trống.
      moTa: chiLaKhungTrong(moTa, MAU_MO_TA_DU_AN) ? '' : moTa,
      ngayBatDau,
      soNgayDuKien,
      soNgayThucHien,
      soNgayDuyetTP,
      soNgayDuyetBLD,
      ngayHoanThanhDuKienGoc,
      ngayHoanThanhDuKienHienTai,
      tienDoBoPhan: isCompleted ? 100 : tienDoBoPhan,
      tienDoPhong: isCompleted ? 100 : tienDoPhong,
      ketQuaPhong: ketQuaPhong.trim() || undefined,
      taiLieuKetQuaPhong: joinAttachments(taiLieuKetQuaPhong),
      anhBaoCaoGuiBaoGia: joinAttachments(anhBaoCao) || undefined,
      ghiChuGuiBaoGia: ghiChuGuiBaoGia.trim() || undefined,
      // PHẢI mang theo bước Kanban hiện tại: trước đây form không trả trường này nên mỗi lần TP
      // lưu (ví dụ kéo tiến độ Phòng 100%) hồ sơ mất vị trí cột và bị suy ra lại thành bước 5.
      kanbanStep: project?.kanbanStep,
      // Vòng làm việc — mất trường này là hồ sơ tụt về vòng 1, tỉ trọng vòng 2 bị tính sai.
      vongHienTai: project?.vongHienTai,
      delayLogs: finalDelayLogs,
      ngayHoanThanhThucTe: isCompleted ? (ngayHoanThanhThucTe || new Date().toISOString().split('T')[0]) : undefined,
      nguyenNhanTreHan: delayReasonRequired ? nguyenNhanTreHan : undefined,
      // Lý do trễ theo khâu KHÔNG phụ thuộc delayReasonRequired: đó là lịch sử đã xảy ra, phải
      // giữ lại kể cả khi hồ sơ hiện không còn trong trạng thái trễ.
      lyDoTreBoPhan: lyDoTreBoPhan.trim() || undefined,
      lyDoTrePhong: lyDoTrePhong.trim() || undefined,
      trangThai,
      tasks: loaiBanGhi === 'DU_AN' ? [] : tasks, // Dự án cha không có cây công việc (không lên Kanban)
      tpDaDuyet: project?.tpDaDuyet, // Cờ TP duyệt — App quyết định giá trị cuối theo vai trò người lưu
      choDuyetLai: project?.choDuyetLai, // Cờ chờ duyệt lại khi delay — App xóa khi TP lưu
      maNoiBo: maNoiBo.trim().toUpperCase() || undefined,
      hanHenCDT: hanHenCDT || undefined,
      soLanGuiCDTTruocApp: (() => {
        const n = parseInt(soLanGuiCDTTruocApp, 10);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      })(),

      kpi: finalKpi,
      chuDauTu: chuDauTu.trim() || undefined,
      diaChi: diaChi.trim() || undefined,
      hinhThucDauThau,
      tinhTrangDuAn,
      quocTich: quocTich.trim() || undefined,
      khuCongNghiep: khuCongNghiep.trim() || undefined,
      tinhThanh: tinhThanh.trim() || undefined,
      loaiCongTrinh: loaiCongTrinh.trim() || undefined,
      hinhThucXayDung,
      giaiDoanDuAn,
      dienTichDat,
      mucUuTien,
      hoSoPhatThau
    };

    onSave(savedProject);
  };

  return (
    /* ===== FORM DÙNG HẾT BỀ RỘNG (chị Trâm chốt 18/08/2026: "banh bự ra luôn đi em cho đẹp") =====
       Trước đây bó `max-w-4xl` (896px) rồi căn giữa, nên trên màn hình rộng hai bên trống mênh mông
       trong khi các ô nhập bên trong lại chật. Nay bỏ chặn bề rộng — form ăn hết vùng làm việc,
       các khối 2–4 cột bên trong tự giãn theo (giống việc bỏ chặn max-w-7xl ở mục A6/#10). */
    <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-100 dark:border-slate-800 shadow-md p-6 w-full" id="project-form-container">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-4 mb-6">
        <div>
          <span className="text-xs bg-brand-accent/10 dark:bg-brand-accent/15 text-brand-accent-700 dark:text-brand-accent-300 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
            {formMode === 'CREATE_TENDER' ? 'Đăng Ký Dự Án Mới' :
             formMode === 'ADD_WORK' ? 'Thêm Công Việc Vào Dự Án (Level 1 & 2)' :
             isEditing ? 'Hồ Sơ Đang Chỉnh Sửa' : 'Khởi Tạo Hồ Sơ Mới'}
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-2">
            {formMode === 'CREATE_TENDER' ? 'Đăng Ký Dự Án (chỉ tên & thông tin chung — không lên Kanban)' :
             formMode === 'ADD_WORK' ? 'Tạo Công Việc Con (báo giá chi tiết / khái toán / VE...) — sẽ lên Kanban' :
             isEditing ? `Cập nhật: ${project.tenDuAn}` : 'Khai Báo Dự Án Đấu Thầu Mới'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {formMode === 'CREATE_TENDER' ? 'Chỉ đăng ký thông tin chung của dự án (tên, CĐT, địa chỉ, KCN...). Sau đó dùng "Công việc mới" để thêm các gói việc con vào dự án này.' :
             formMode === 'ADD_WORK' ? 'Chọn Dự án cha rồi thiết lập hạng mục, nhân sự, thời hạn & phân rã công việc. Mỗi công việc con là một thẻ riêng trên Kanban.' :
             'Phân cấp kiểm duyệt tiến độ, đồng bộ lịch dời hạn và giám sát KPI.'}
          </p>
        </div>
        <button 
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">

        {/* Modal CẢNH BÁO trễ hẹn CĐT — thay cho confirm() mặc định của trình duyệt */}
        {showCdtWarning && (
          <div
            className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setShowCdtWarning(false)}
          >
            <div
              ref={cdtWarningRef}
              role="dialog" aria-modal="true" aria-labelledby="cdt-warning-title" tabIndex={-1}
              className="bg-white dark:bg-dark-card rounded-t-2xl rounded-b-none md:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-bottom-0 md:zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Dải màu cảnh báo trên đầu */}
              <div className="h-1.5 bg-gradient-to-r from-brand-danger via-brand-warning to-brand-warning" />
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-11 h-11 rounded-full bg-brand-danger/15 dark:bg-brand-danger/15 flex items-center justify-center border border-brand-danger/25 dark:border-brand-danger/25">
                    <AlertTriangle className="w-6 h-6 text-brand-danger dark:text-brand-danger" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 id="cdt-warning-title" className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                      Cảnh báo trễ hẹn Chủ đầu tư
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Tiến độ mới tính ra ngày nộp{' '}
                      <b className="text-brand-danger dark:text-brand-danger">{fmtDateVN(ngayHoanThanhDuKienGoc)}</b>,{' '}
                      <b>vượt quá</b> thời hạn đã hẹn Chủ đầu tư (
                      <b className="text-brand-primary dark:text-brand-primary-300">{fmtDateVN(hanHenCDT)}</b>).
                    </p>
                  </div>
                </div>

                <div className="bg-brand-warning/10 dark:bg-brand-warning/10 border border-brand-warning/25 dark:border-brand-warning/40 rounded-xl px-3 py-2.5 text-[11px] text-brand-warning dark:text-brand-warning font-medium leading-relaxed">
                  Bấm <b>“Vẫn duyệt”</b> để chấp nhận trễ hẹn CĐT (sẽ thương lượng lại), hoặc{' '}
                  <b>“Quay lại điều chỉnh”</b> để sửa kế hoạch cho kịp hạn.
                </div>

                <div className="flex justify-end gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowCdtWarning(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-dark-elevated text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Quay lại điều chỉnh
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCdtWarning(false); handleSubmit(undefined, true); }}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-brand-danger hover:bg-brand-danger/85 text-white transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Vẫn duyệt
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dropdown for ADD_WORK mode */}
        {formMode === 'ADD_WORK' && (
          <div className="p-4 bg-brand-accent/5 dark:bg-brand-accent/15 border border-brand-accent/15 dark:border-brand-accent/40 rounded-xl space-y-3">
            <label className="block text-xs font-black text-brand-accent-700 dark:text-brand-accent-300 uppercase tracking-wider">
              Chọn Dự Án Cha Để Thêm Công Việc *
            </label>
            {/* Ô TÌM + danh sách chọn: gõ tên/mã/CĐT để lọc nhanh khi có nhiều gói thầu.
                Thứ tự: đang làm trước (mới tạo nhất trên cùng), đã xong nằm dưới. */}
            {projectsListForSelect.length === 0 ? (
              <div className="px-3 py-2.5 border border-brand-warning/40 rounded-lg text-xs font-bold text-brand-warning bg-brand-warning/5">
                Chưa có dự án nào — hãy bấm "Dự án mới" để đăng ký trước.
              </div>
            ) : (
              <div className="relative" ref={parentBoxRef}>
                {/* Nút sổ xuống: hiện dự án đang chọn (hoặc lời mời chọn) — bấm mới mở danh sách */}
                <button
                  type="button"
                  onClick={() => setParentOpen(o => !o)}
                  aria-expanded={parentOpen}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left bg-white dark:bg-dark-elevated cursor-pointer transition-colors ${
                    errors.selectedProjectId
                      ? 'border-brand-danger/50'
                      : 'border-brand-accent/25 dark:border-brand-accent-800 hover:border-brand-accent'
                  }`}
                >
                  {selectedProject ? (
                    <>
                      <span className="text-[9px] font-mono font-black px-1 py-0.5 rounded shrink-0 bg-slate-100 dark:bg-dark-card text-slate-500 dark:text-slate-400">
                        {maHoSo(selectedProject)}
                      </span>
                      <span className="text-xs font-bold truncate flex-1 text-slate-800 dark:text-slate-100" title={selectedProject.tenDuAn}>
                        {selectedProject.tenDuAn}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-bold flex-1 text-slate-400 dark:text-slate-500">
                      Bấm để chọn dự án cha ({projectsListForSelect.length} dự án)...
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${parentOpen ? 'rotate-180' : ''}`} />
                </button>

                {parentOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-brand-accent/25 dark:border-brand-accent-800 bg-white dark:bg-dark-elevated shadow-lg overflow-hidden">
                <div className="relative p-2 border-b border-slate-100 dark:border-slate-800">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={parentQuery}
                    onChange={(e) => setParentQuery(e.target.value)}
                    placeholder="Tìm theo tên dự án, mã hồ sơ hoặc Chủ đầu tư..."
                    className="w-full pl-7 pr-7 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium bg-white dark:bg-dark-bg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-accent focus:outline-none"
                  />
                  {parentQuery && (
                    <button
                      type="button"
                      onClick={() => setParentQuery('')}
                      title="Xóa từ khóa tìm"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {parentOptions.length === 0 ? (
                    <div className="px-3 py-3 text-xs font-bold text-slate-400 text-center">
                      Không có dự án nào khớp "{parentQuery}".
                    </div>
                  ) : parentOptions.map(({ p, daXong }, i) => {
                    const dauNhomDaXong = daXong && !parentOptions[i - 1]?.daXong;
                    const chon = selectedProjectId === p.id;
                    return (
                      <div key={p.id}>
                        {dauNhomDaXong && (
                          <div className="px-3 py-1 bg-slate-50 dark:bg-dark-card text-[9px] font-black uppercase tracking-wider text-slate-400">
                            Dự án đã xong
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProjectId(p.id);
                            setParentOpen(false);   // chọn xong là gập danh sách lại cho gọn
                            setParentQuery('');
                            if (errors.selectedProjectId) {
                              setErrors(prev => { const copy = { ...prev }; delete copy.selectedProjectId; return copy; });
                            }
                          }}
                          className={`w-full text-left px-3 py-2 transition-colors cursor-pointer ${
                            chon
                              ? 'bg-brand-accent text-white'
                              : 'hover:bg-brand-accent/10 dark:hover:bg-brand-accent/20 text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-mono font-black px-1 py-0.5 rounded shrink-0 ${chon ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-dark-card text-slate-500 dark:text-slate-400'}`}>
                              {maHoSo(p)}
                            </span>
                            <span className="text-xs font-bold truncate flex-1" title={p.tenDuAn}>{p.tenDuAn}</span>
                            {/* Đánh dấu mục lấy từ Danh mục dự án (App Thông tin dự án) mà app này
                                chưa có hồ sơ — chọn xong app sẽ tự dựng hồ sơ dự án rồi gắn công
                                việc vào, nên người dùng cần biết trước là sắp tạo cái mới. */}
                            {p.id.startsWith('DM::') && (
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${chon ? 'bg-white/20 text-white' : 'bg-brand-primary/10 text-brand-primary dark:text-brand-primary-300'}`}>
                                TỪ DANH MỤC
                              </span>
                            )}
                            {chon && <span className="text-[10px] font-black shrink-0">✓ Đã chọn</span>}
                          </div>
                          {(p.chuDauTu || daXong) && (
                            <div className={`text-[10px] font-semibold mt-0.5 truncate ${chon ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                              {p.chuDauTu || 'Chưa có CĐT'}{daXong ? ` • ${p.tinhTrangDuAn || 'Đã hoàn thành'}` : ''}
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
                </div>
                )}
              </div>
            )}
            {errors.selectedProjectId && (
              <span className="text-[11px] text-brand-danger font-bold block">{errors.selectedProjectId}</span>
            )}
            <p className="text-[10px] text-brand-accent dark:text-brand-accent-300 font-semibold italic">
              * Sau khi chọn, hệ thống tự động tải thông số và hiển thị Sơ đồ phân rã công việc chi tiết.
            </p>
          </div>
        )}

        {/* THÔNG TIN DỰ ÁN (chỉ xem) — hiện khi tạo công việc con và khi sửa hồ sơ công việc.
            Cố ý KHÔNG có ô nhập nào: mọi trường ở đây thuộc về hồ sơ Dự án, sửa tại đó
            (chị Trâm chốt 26/07/2026). */}
        {((formMode === 'ADD_WORK' && selectedProjectId) || (formMode === 'EDIT_ALL' && !isParentEdit)) && (
          <div className="bg-slate-50 dark:bg-dark-elevated p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <span className="w-1.5 h-3 bg-brand-accent rounded-full"></span>
              Thông tin dự án
              <span className="ml-1 normal-case text-[9px] font-bold text-brand-accent dark:text-brand-accent-300">
                🔒 Chỉ xem — sửa tại hồ sơ Dự án
              </span>
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              {([
                ['Mã gói thầu', projectId, 'font-mono'],
                ['Tên dự án', tenDuAn || 'Chưa cập nhật', ''],
                ['Chủ đầu tư', chuDauTu || 'Chưa cập nhật', ''],
                ['Địa chỉ công trình', diaChi || 'Chưa cập nhật', ''],
                ['Quốc tịch CĐT', quocTich || 'Chưa cập nhật', ''],
                ['Hình thức xây dựng', hinhThucXayDung, ''],
                ['Hồ sơ mời thầu thiết kế bởi', hoSoPhatThau, ''],
                ['Diện tích đất (m²)', dienTichDat > 0 ? String(dienTichDat) : 'Chưa cập nhật', ''],
                ['Hình thức đấu thầu', hinhThucDauThau, ''],
                ['Tình trạng dự án', tinhTrangDuAn || 'Đang triển khai', ''],
              ] as const).map(([nhan, giaTri, themClass]) => (
                <div key={nhan}>
                  <span className="text-slate-400 dark:text-slate-500 block font-bold uppercase tracking-wider text-[9px]">{nhan}</span>
                  <strong className={`text-slate-800 dark:text-slate-200 text-xs block font-bold ${themClass}`} title={giaTri}>{giaTri}</strong>
                </div>
              ))}
            </div>

            {/* Mô tả DỰ ÁN — khác với ghi chú công việc ở mục 2 bên dưới */}
            {moTaDuAnCha !== undefined && (
              <div>
                <span className="text-slate-400 dark:text-slate-500 block font-bold uppercase tracking-wider text-[9px] mb-0.5">Mô tả dự án</span>
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                  <TextWithLinks text={moTaDuAnCha || 'Trưởng phòng chưa nhập mô tả tại hồ sơ Dự án.'} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 1: Thông tin chung */}
        {(formMode === 'CREATE_TENDER' || formMode === 'EDIT_ALL') && (
          <fieldset disabled={infoLocked} className="bg-slate-50/50 dark:bg-dark-card/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4 min-w-0">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-2">
            <span className="w-1.5 h-3 bg-brand-accent rounded-full"></span>
            {duAnInfoLocked ? '1. Nhân sự phụ trách gói thầu' : '1. Thông Tin Chung & Quy Mô Gói Thầu'}
            {infoLocked && <span className="ml-1 normal-case text-[9px] font-bold text-brand-warning dark:text-brand-warning">🔒 Chỉ Trưởng phòng (Level 1) chỉnh sửa</span>}
          </h3>

          {/* CÁC TRƯỜNG THUỘC DỰ ÁN — chỉ hiện ở hồ sơ Dự án (khởi tạo / sửa dự án).
              Ở hồ sơ CÔNG VIỆC thì ẩn hẳn: chúng đã hiện gọn gàng ở khối "Thông tin dự án" phía
              trên, bày lại thành một loạt ô xám khóa kèm badge 🔒 lặp lại chỉ làm rối form
              (chị Trâm báo 26/07/2026). Mục 1 ở hồ sơ công việc chỉ còn phần nhân sự. */}
          {!duAnInfoLocked && (
          <>
          {/* ===== DỰ ÁN MẪU — LẤY SẴN THÔNG TIN TỪ MỘT DỰ ÁN CŨ (chị Trâm chốt 18/08/2026) =====
              "Nhiều dự án có nhiều gói thầu, hoặc triển khai GĐ2 — chọn bằng tên dự án rồi lấy được
               các trường của dự án cũ, sau đó chị sửa lại tên gói thầu, mã dự án."
              Chỉ hiện khi ĐĂNG KÝ MỚI (sửa dự án cũ thì không cần), và chỉ chép THÔNG TIN CHUNG —
              mã, tên, ngày tháng, tiến độ, việc con vẫn để trống cho hồ sơ mới. */}
          {!project && (projectsListForSelect || []).length > 0 && (() => {
            // Danh sách CHỈ BUNG KHI BẤM (chị Trâm chốt 18/08/2026: "không show ra như dị, chỉ cần
            // cho chị nút xổ xuống và thêm chỗ gõ tên"). Trong bảng xổ mới có ô gõ để lọc.
            const q = duAnMauTimKiem.trim().toLowerCase();
            const ds = [...(projectsListForSelect || [])]
              .filter(m => !q || `${maHoSo(m)} ${m.tenDuAn} ${m.chuDauTu || ''}`.toLowerCase().includes(q))
              .sort((a, b) => (b.projectId || '').localeCompare(a.projectId || ''))
              .slice(0, 40);
            const dangChon = (projectsListForSelect || []).find(m => m.id === duAnMauId);
            return (
              <div className="mb-4 p-3 rounded-xl border border-brand-accent/30 bg-brand-accent/5 dark:bg-brand-accent/10">
                <label className="block text-xs font-bold text-brand-accent dark:text-brand-accent-300 mb-1.5">
                  📋 Lấy thông tin từ dự án cũ
                </label>

                <div className="relative">
                  {/* Nút xổ xuống — gập lại là chỉ thấy 1 dòng */}
                  <button
                    type="button"
                    onClick={() => { setMoDsDuAnMau(v => !v); setDuAnMauTimKiem(''); }}
                    className="w-full flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-dark-elevated text-left"
                  >
                    {dangChon ? (
                      <>
                        <span className="text-[10px] font-mono font-black text-slate-500 dark:text-slate-400 shrink-0">{maHoSo(dangChon)}</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{dangChon.tenDuAn}</span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 truncate">— Chọn dự án để lấy thông tin —</span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 ml-auto transition-transform ${moDsDuAnMau ? 'rotate-180' : ''}`} />
                  </button>

                  {dangChon && !moDsDuAnMau && (
                    <button
                      type="button"
                      onClick={() => { setDuAnMauId(''); setDuAnMauTimKiem(''); }}
                      className="absolute -top-6 right-0 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-brand-danger"
                    >
                      Bỏ chọn
                    </button>
                  )}

                  {moDsDuAnMau && (
                    <div className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-dark-card shadow-2xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <input
                          autoFocus
                          value={duAnMauTimKiem}
                          onChange={(e) => setDuAnMauTimKiem(e.target.value)}
                          placeholder="Gõ tên dự án, mã hoặc tên Chủ đầu tư để tìm..."
                          className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated"
                        />
                      </div>
                      <ul className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {ds.length === 0 ? (
                          <li className="px-3 py-2 text-[11px] text-slate-400 italic">Không có dự án nào khớp "{duAnMauTimKiem}".</li>
                        ) : ds.map(m => (
                          <li key={m.id}>
                            <button type="button"
                              onClick={() => { chepTuDuAnMau(m.id); setDuAnMauTimKiem(''); setMoDsDuAnMau(false); }}
                              className="w-full text-left px-3 py-1.5 hover:bg-brand-accent/10 flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-mono font-black text-slate-500 dark:text-slate-400 shrink-0">{maHoSo(m)}</span>
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{m.tenDuAn}</span>
                              {m.chuDauTu && <span className="text-[10px] text-slate-400 truncate shrink">· {m.chuDauTu}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                        <button type="button" onClick={() => setMoDsDuAnMau(false)}
                          className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-brand-accent">Đóng</button>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
                  Lấy sẵn thông tin chung của dự án. Mã, tên, ngày tháng và tiến độ vẫn để trống.
                </p>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Project_ID */}
            {/* ===== MÃ HỒ SƠ TÁCH LÀM HAI Ô (chị Trâm chốt 12/09/2026) =====
                Chuẩn bị nối dữ liệu từ App Thông tin dự án: mã bên đó và mã Phòng tự đặt là hai
                thứ khác nhau, để chung một ô thì lúc đổ dữ liệu về sẽ ghi đè lẫn nhau.
                Hiện chưa nối app nên NHẬP TAY cả hai ô; nối xong thì ô 1 do App Thông tin dự án cấp.
                Mã thuộc về DỰ ÁN: công việc con dùng chung mã cha → khóa tại hồ sơ công việc,
                sửa ở hồ sơ Dự án là mọi công việc con đổi theo. */}
            <div className="md:col-span-3" id="field-projectId">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Mã dự án *{ghiChuNguonAppDuAn}{duAnInfoLocked && duAnLockNote}
              </label>
              {/* Ô mã dự án: VỪA gõ tay được VỪA chọn từ danh mục App Thông tin dự án.
                  Chọn xong là các ô còn lại tự điền — nhưng chỉ là GỢI Ý, gõ đè thoải mái. */}
              <div className="relative">
                <input
                  type="text"
                  disabled={duAnInfoLocked}
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setDuAnTongDaChon(null); // gõ tay thì thôi coi là "đã chọn từ danh mục"
                    if (errors.projectId) setErrors(prev => { const copy = { ...prev }; delete copy.projectId; return copy; });
                  }}
                  placeholder="260034-HPCS"
                  title="Gõ tay, hoặc bấm nút bên phải để chọn từ App Thông tin dự án."
                  className={`w-full ${canDanhMucDuAn ? 'pr-9' : ''} px-3 py-2 border rounded-lg text-sm font-bold text-slate-700 dark:text-slate-100 bg-white dark:bg-dark-elevated uppercase disabled:opacity-60 disabled:cursor-not-allowed ${errors.projectId ? 'border-brand-danger/50' : 'border-slate-200 dark:border-slate-700'}`}
                />
                {canDanhMucDuAn && !duAnInfoLocked && (
                  <button type="button" onClick={() => setMoDsMaDuAn(v => !v)}
                    title="Chọn mã dự án từ App Thông tin dự án"
                    className="absolute inset-y-0 right-0 w-9 flex items-center justify-center text-slate-400 hover:text-brand-accent cursor-pointer">
                    <ChevronDown className={`w-4 h-4 transition-transform ${moDsMaDuAn ? 'rotate-180' : ''}`} />
                  </button>
                )}

                {moDsMaDuAn && (
                  <div className="absolute z-30 mt-1 w-[min(30rem,80vw)] bg-white dark:bg-dark-card border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                      <input autoFocus type="text" value={timMaDuAn} onChange={e => setTimMaDuAn(e.target.value)}
                        placeholder="Tìm theo mã, tên dự án hoặc chủ đầu tư..."
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-dark-elevated text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-accent" />
                    </div>

                    {tinhTrangDuAnTong === 'dangTai' && (
                      <p className="px-3 py-3 text-[11px] text-slate-400 italic">Đang lấy danh mục dự án…</p>
                    )}
                    {(tinhTrangDuAnTong === 'chuaNoi' || tinhTrangDuAnTong === 'loi') && (
                      <div className="px-3 py-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        <p className="font-bold text-brand-warning mb-0.5">Chưa lấy được danh mục dự án</p>
                        <p>{thongBaoDuAnTong || 'Chưa nối App Thông tin dự án.'}</p>
                        <p className="mt-1">Cứ <b>gõ tay mã dự án</b> vào ô trên và nhập các thông tin còn lại như bình thường.</p>
                      </div>
                    )}
                    {tinhTrangDuAnTong === 'xong' && (() => {
                      const q = timMaDuAn.trim().toLowerCase();
                      const ds = q
                        ? dsDuAnTong.filter(d => `${d.maDuAn} ${d.tenDuAn} ${d.chuDauTu || ''}`.toLowerCase().includes(q))
                        : dsDuAnTong;
                      if (ds.length === 0) {
                        return <p className="px-3 py-3 text-[11px] text-slate-400 italic">
                          {dsDuAnTong.length === 0 ? 'App Thông tin dự án chưa có dự án nào.' : `Không có dự án nào khớp "${timMaDuAn}".`}
                        </p>;
                      }
                      return (
                        <ul className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                          {ds.slice(0, 80).map(d => (
                            <li key={d.maDuAn}>
                              <button type="button" onClick={() => chonMaDuAnTong(d)}
                                className="w-full text-left px-3 py-2 hover:bg-brand-accent/10 min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[10.5px] font-mono font-black text-brand-accent dark:text-brand-accent-300 shrink-0">{d.maDuAn}</span>
                                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{d.tenDuAn}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 dark:text-slate-500 min-w-0">
                                  {d.chuDauTu && <span className="truncate">{d.chuDauTu}</span>}
                                  {typeof d.tienDoThietKe === 'number' && (
                                    <span className="shrink-0 font-bold text-brand-success">TK {d.tienDoThietKe}%</span>
                                  )}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}

                    <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button type="button" onClick={() => setMoDsMaDuAn(false)}
                        className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-brand-accent">Đóng</button>
                    </div>
                  </div>
                )}
              </div>
              {errors.projectId && <span className="text-[10px] text-brand-danger mt-1 block font-medium">{errors.projectId}</span>}
            </div>

            <div className="md:col-span-3" id="field-maNoiBo">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Mã Phòng đặt{duAnInfoLocked && duAnLockNote}
              </label>
              <input
                type="text"
                disabled={duAnInfoLocked}
                value={maNoiBo}
                onChange={(e) => setMaNoiBo(e.target.value)}
                placeholder="BG-COL"
                title="Ô 2 — mã Phòng Đấu thầu tự đặt theo quy định công ty và quy định nội bộ. Bỏ trống được."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-100 bg-white dark:bg-dark-elevated uppercase disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block font-medium">
                Mã đầy đủ: <b className="text-slate-600 dark:text-slate-300 font-mono">{maHoSo({ projectId, maNoiBo }) || '—'}</b>
              </span>
            </div>

            {/* Nhắc rõ: thông tin vừa điền là GỢI Ý, sửa tay thoải mái (chị Trâm 15/09/2026) */}
            {duAnTongDaChon && (
              <div className="md:col-span-12 -mt-1">
                <p className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                  ℹ️ Đã lấy thông tin dự án <b className="font-mono text-slate-600 dark:text-slate-300">{duAnTongDaChon.maDuAn}</b> từ
                  App Thông tin dự án. Các ô vừa điền chỉ là <b>gợi ý</b> — thấy chỗ nào chưa đúng thì
                  sửa tay thoải mái, hồ sơ bên này lưu theo đúng những gì bạn nhập.
                </p>
              </div>
            )}

            {/* Tên dự án — thuộc DỰ ÁN, khoá khi đang ở hồ sơ công việc */}
            <div className="md:col-span-6" id="field-tenDuAn">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Tên dự án thầu *{ghiChuNguonAppDuAn}{duAnInfoLocked && duAnLockNote}
              </label>
              <input
                type="text"
                disabled={duAnInfoLocked}
                value={tenDuAn}
                onChange={(e) => {
                  setTenDuAn(e.target.value);
                  if (errors.tenDuAn) setErrors(prev => { const copy = { ...prev }; delete copy.tenDuAn; return copy; });
                }}
                placeholder="VD: Tổ hợp cao ốc Sun Garden..."
                className={`w-full px-3 py-2 border rounded-lg text-sm font-medium bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 ${errors.tenDuAn ? 'border-brand-danger/50 focus:ring-brand-danger' : 'border-slate-200 dark:border-slate-700 focus:ring-brand-accent'}`}
              />
              {errors.tenDuAn && <span className="text-[11px] text-brand-danger mt-1 block font-medium">{errors.tenDuAn}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Chủ đầu tư */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Chủ đầu tư (CĐT){ghiChuNguonAppDuAn}{duAnInfoLocked && duAnLockNote}
              </label>
              <input
                type="text"
                disabled={duAnInfoLocked}
                value={chuDauTu}
                onChange={(e) => setChuDauTu(e.target.value)}
                placeholder="VD: Tập đoàn Riverland, PVEP, Vingroup..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 focus:ring-brand-accent"
              />
            </div>

            {/* Địa chỉ dự án */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Địa chỉ dự án / Công trình{ghiChuNguonAppDuAn}{duAnInfoLocked && duAnLockNote}
              </label>
              <input
                type="text"
                disabled={duAnInfoLocked}
                value={diaChi}
                onChange={(e) => setDiaChi(e.target.value)}
                placeholder="VD: 36 Nguyễn Cơ Thạch, Quận 2, TP. Hồ Chí Minh..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 focus:ring-brand-accent"
              />
            </div>
          </div>

          {/* Thuộc tính công trình — 4 trường này TRƯỞNG PHÒNG TỰ NHẬP, không còn lấy từ Phòng Kinh doanh
              (chị Trâm chốt 25/07/2026: bỏ khối "Thông tin gốc Phòng Kinh doanh", gộp vào thông tin dự án).
              Vẫn là thông tin cấp DỰ ÁN → khóa khi đang ở hồ sơ công việc, giống tên dự án / CĐT / địa chỉ. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Quốc tịch CĐT{ghiChuNguonAppDuAn}{duAnInfoLocked && duAnLockNote}
              </label>
              <input
                type="text"
                disabled={duAnInfoLocked}
                value={quocTich}
                onChange={(e) => setQuocTich(e.target.value)}
                placeholder="Ví dụ: Đài Loan, Việt Nam..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 focus:ring-brand-accent disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Hình thức xây dựng{ghiChuNguonAppDuAn}{duAnInfoLocked && duAnLockNote}
              </label>
              <select
                disabled={duAnInfoLocked}
                value={hinhThucXayDung}
                onChange={(e) => setHinhThucXayDung(e.target.value as Project['hinhThucXayDung'])}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 focus:ring-brand-accent disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="Xây mới">Xây mới</option>
                <option value="Cải tạo">Cải tạo</option>
                <option value="Sửa chữa">Sửa chữa</option>
                <option value="Mở rộng">Mở rộng</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Hồ sơ mời thầu thiết kế bởi{ghiChuNguonAppDuAn}{duAnInfoLocked && duAnLockNote}
              </label>
              <select
                disabled={duAnInfoLocked}
                value={hoSoPhatThau}
                onChange={(e) => setHoSoPhatThau(e.target.value as Project['hoSoPhatThau'])}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 focus:ring-brand-accent disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="CĐT phát thầu">CĐT phát thầu</option>
                <option value="HP thiết kế">HP thiết kế</option>
                <option value="Đơn vị khác thiết kế">Đơn vị khác thiết kế</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Diện tích đất (m²){ghiChuNguonAppDuAn}{duAnInfoLocked && duAnLockNote}
              </label>
              <input
                type="number"
                min={0}
                disabled={duAnInfoLocked}
                value={dienTichDat > 0 ? dienTichDat : ''}
                onChange={(e) => setDienTichDat(parseFloat(e.target.value) || 0)}
                placeholder="Nhập diện tích m2"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 focus:ring-brand-accent disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Mô tả nội dung công việc — CHỈ ở hồ sơ Dự án (khởi tạo / chỉnh sửa dự án).
              Công việc con lấy mô tả này xuống và chỉ được xem. */}
          {(formMode === 'CREATE_TENDER' || isParentEdit) && (
            <div>
              {moTaField(
                'Mô tả chi tiết nội dung công việc (mô tả dự án)',
                'Phân tích bản vẽ kết cấu, bóc tách cấu kiện móng và dầm sàn tháp B...',
                3
              )}
              <p className="text-[10px] text-brand-accent dark:text-brand-accent-300 font-semibold italic mt-1">
                Mô tả này là mô tả chung của dự án; mọi công việc con đều xem được.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hình thức đấu thầu */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Hình thức đấu thầu{duAnInfoLocked && duAnLockNote}
              </label>
              <select
                disabled={duAnInfoLocked}
                value={hinhThucDauThau}
                onChange={(e) => setHinhThucDauThau(e.target.value as Project['hinhThucDauThau'])}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated"
              >
                <option value="Đấu thầu cạnh tranh">Đấu thầu cạnh tranh</option>
                <option value="Chỉ định thầu">Chỉ định thầu</option>
              </select>
            </div>

            {/* Tình trạng dự án */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Tình trạng dự án thực tế{duAnInfoLocked && duAnLockNote}
              </label>
              <select
                disabled={duAnInfoLocked}
                value={tinhTrangDuAn}
                onChange={(e) => setTinhTrangDuAn(e.target.value as Project['tinhTrangDuAn'])}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated"
              >
                <option value="Đang triển khai">Đang triển khai</option>
                <option value="Đã trúng thầu">Đã trúng thầu</option>
                <option value="Rớt thầu">Rớt thầu</option>
              </select>
            </div>
          </div>
          </>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quản lý CHÍNH */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Quản lý chính (Đảm nhận)</label>
              <select
                value={quanLyId}
                onChange={(e) => { const v = e.target.value; setQuanLyId(v); setQuanLyIdsPhu(prev => prev.filter(id => id !== v)); }}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated"
              >
                {staffList.map(s => (
                  <option key={s.id} value={s.id} className="dark:bg-dark-card">{s.hoTen} ({s.chucVu})</option>
                ))}
              </select>
            </div>

            {/* Quản lý phụ / kế thừa — chọn nhiều; thao tác được như quản lý khi người chính bận.
                Xếp NGANG HÀNG với quản lý chính cho gọn bảng (chị Trâm chốt 26/07/2026). */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Quản lý phụ / kế thừa
                <span className="font-normal text-slate-400">
                  {duAnInfoLocked ? ' (do bên khởi tạo dự án đặt — chỉ xem)' : ' (khi người chính bận — chọn nhiều)'}
                </span>
              </label>
              {/* XỔ HẾT danh sách, KHÔNG cuộn trong khung (chị Trâm chốt 17/08/2026: "đừng cuộn nhìn xấu").
                  Nhiều người thì xếp 2-3 cột cho gọn chiều cao. */}
              {/* ===== Ở HỒ SƠ CÔNG VIỆC: CHỈ HIỆN TÊN =====
                  Chị Trâm chốt 18/08/2026: quản lý phụ / kế thừa là do bên KHỞI TẠO dự án đặt, nên
                  tại hồ sơ gói thầu chỉ để Quản lý nhìn thấy mình được kế thừa, không sửa ở đây.
                  Muốn đổi thì sửa ở hồ sơ DỰ ÁN (nơi khối này vẫn cho tick). */}
              {duAnInfoLocked ? (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-slate-50/60 dark:bg-dark-bg/40 shadow-inner flex flex-wrap gap-1.5">
                  {quanLyIdsPhu.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic px-1 py-0.5">Dự án này chưa đặt quản lý phụ / kế thừa.</p>
                  ) : quanLyIdsPhu.map(id => {
                    const ns = staffList.find(x => x.id === id);
                    if (!ns) return null;
                    return (
                      <span key={id} title={`${ns.hoTen} — ${ns.chucVu}`}
                        className="inline-flex items-center gap-1.5 max-w-full bg-white dark:bg-dark-elevated border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-0.5">
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">{ns.hoTen}</span>
                        <span className="text-[10px] text-slate-400 truncate">({ns.chucVu})</span>
                      </span>
                    );
                  })}
                </div>
              ) : (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-dark-elevated shadow-inner grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                {staffList.filter(s => s.id !== quanLyId).map(s => {
                  const checked = quanLyIdsPhu.includes(s.id);
                  return (
                    /* MỖI NGƯỜI GỌN MỘT DÒNG (chị Trâm báo 18/08/2026: tên bị bẻ đôi, chức vụ dồn
                       sang phải nhìn rất rối). min-w-0 + truncate để tên dài thì cắt bớt bằng "…",
                       KHÔNG xuống dòng; chức vụ đứng sát sau tên. */
                    <label key={s.id} title={`${s.hoTen} — ${s.chucVu}`}
                      className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-slate-50 dark:hover:bg-dark-card/40 cursor-pointer text-xs min-w-0">
                      <input type="checkbox" checked={checked} onChange={() => setQuanLyIdsPhu(prev => checked ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                        className="rounded border-slate-300 dark:border-slate-600 accent-brand-primary shrink-0" />
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{s.hoTen}</span>
                      <span className="text-[10px] text-slate-400 truncate shrink">({s.chucVu})</span>
                    </label>
                  );
                })}
                {staffList.filter(s => s.id !== quanLyId).length === 0 && (
                  <p className="text-[11px] text-slate-400 italic px-1.5 py-1">Không còn nhân sự nào để chọn làm quản lý phụ.</p>
                )}
              </div>
              )}
              {!duAnInfoLocked && quanLyIdsPhu.length > 0 && (
                <p className="text-[10px] text-brand-primary dark:text-brand-primary-300 font-bold mt-1">✓ {quanLyIdsPhu.length} quản lý phụ — đều có quyền thao tác như quản lý.</p>
              )}
            </div>

            {/* ===== CHUYÊN VIÊN THỰC HIỆN — CHỈ HIỆN TÊN, KHÔNG CHO CHỌN =====
                Chị Trâm chốt 18/08/2026: *"mục này em hiện tên thôi không cho chọn, vì sẽ lấy từ
                thông tin phân rã công việc con bên dưới"*. Đúng với cách app đang lưu: lúc bấm Lưu,
                `thucHienIds` được TỔNG HỢP LẠI từ người được giao các việc con (xem taskAssignees),
                nên danh sách tick tay ở đây vốn đã bị ghi đè — để ô tick chỉ làm người dùng tưởng
                mình gán được rồi thắc mắc sao lưu xong lại khác. */}
            {formMode !== 'CREATE_TENDER' && !isParentEdit && (
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Chuyên viên thực hiện
                <span className="font-normal text-slate-400"> (tự lấy từ phân rã công việc con bên dưới)</span>
              </label>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-slate-50/60 dark:bg-dark-bg/40 shadow-inner flex flex-wrap gap-1.5">
                {taskAssignees.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic px-1 py-0.5">
                    Chưa có ai — giao người ở bảng “Phân rã công việc &amp; Sơ đồ Gantt” bên dưới, tên sẽ hiện ở đây.
                  </p>
                ) : taskAssignees.map(id => {
                  const ns = staffList.find(x => x.id === id);
                  if (!ns) return null;
                  return (
                    <span key={id} title={`${ns.hoTen} — ${ns.chucVu}`}
                      className="inline-flex items-center gap-1.5 max-w-full bg-white dark:bg-dark-elevated border border-slate-200 dark:border-slate-700 rounded-full pl-1 pr-2.5 py-0.5">
                      {ns.avatar ? (
                        <img src={ns.avatar} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-dark-card flex items-center justify-center text-[8px] font-black text-slate-500 shrink-0">
                          {(ns.hoTen || '?').trim().charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">{ns.hoTen}</span>
                    </span>
                  );
                })}
              </div>
            </div>
            )}
          </div>
        </fieldset>
        )}

        {/* Section 2: Bản chất công việc */}
        {(((formMode === 'EDIT_ALL' && !isParentEdit)) || (formMode === 'ADD_WORK' && selectedProjectId)) && (
        <div className="bg-slate-50/50 dark:bg-dark-card/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-2">
            <span className="w-1.5 h-3 bg-brand-accent rounded-full"></span>
            2. Bản Chất Hạng Mục Đầu Thầu
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Phân loại hạng mục */}
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Phân loại hạng mục</label>
              <select
                value={hangMuc}
                onChange={(e) => setHangMuc(e.target.value as Project['hangMuc'])}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated"
              >
                <option value="Báo giá chi tiết" className="dark:bg-dark-card">Báo giá chi tiết</option>
                <option value="Khái toán" className="dark:bg-dark-card">Khái toán</option>
                <option value="Báo giá phát sinh" className="dark:bg-dark-card">Báo giá phát sinh</option>
                <option value="Cải tạo" className="dark:bg-dark-card">Cải tạo</option>
                <option value="VE" className="dark:bg-dark-card">VE</option>
                <option value="Lập hồ sơ thầu" className="dark:bg-dark-card">Lập hồ sơ thầu</option>
              </select>
            </div>

            {/* Ghi chú riêng của CÔNG VIỆC — Quản lý ghi tự do, không liên quan mô tả dự án */}
            <div className="md:col-span-2">
              {moTaField(
                'Mô tả / ghi chú công việc',
                'Ghi chú riêng của công việc, hoặc dán link thư mục triển khai chung của team...',
                2
              )}
            </div>

          </div>

        </div>
        )}

        {/* Section 3: Thiết lập tiến độ gốc — CHỈ cho công việc con (dự án cha không có tiến độ riêng) */}
        {((formMode === 'EDIT_ALL' && !isParentEdit) || (formMode === 'ADD_WORK' && selectedProjectId)) && (
        <div className="bg-slate-50/50 dark:bg-dark-card/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-2">
            <span className="w-1.5 h-3 bg-brand-primary rounded-full"></span>
            3. Thiết Lập Tiến Độ Gốc &amp; Tính Toán Tự Động
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Ngày bắt đầu — LUÔN tự lấy min(ngày bắt đầu việc con) từ Sơ đồ phân rã, không nhập tay */}
            <div id="field-ngayBatDau">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Ngày bắt đầu *<span className="ml-1 text-[9px] font-black text-brand-accent">• TỰ TÍNH TỪ KẾ HOẠCH</span>
              </label>
              <DateInput
                value={ngayBatDau}
                onChange={() => {}}
                disabled
                title="Tự lấy ngày bắt đầu sớm nhất của các công việc con — đặt ngày ở mục Sơ đồ phân rã bên dưới"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-100 bg-white dark:bg-dark-elevated disabled:opacity-60 disabled:cursor-not-allowed"
              />
              {!ngayBatDau && !errors.ngayBatDau && (
                <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">Đặt ngày cho công việc con ở mục Sơ đồ phân rã — hệ thống tự lấy ngày sớm nhất.</p>
              )}
              {errors.ngayBatDau && <span className="text-[11px] text-brand-danger mt-1 block">{errors.ngayBatDau}</span>}
            </div>

            {/* HẠN HOÀN THÀNH PHÒNG (tự tính = ngày BĐ + thực hiện + TP duyệt, tính cả ngày đầu).
                KHÔNG gọi là "nộp CĐT" vì sau chặng này hồ sơ còn phải qua BGĐ (chị Trâm chốt 25/07/2026). */}
            <div>
              <label className="block text-xs font-bold text-brand-primary dark:text-brand-primary-300 mb-1.5">Hạn hoàn thành Phòng (tự tính)</label>
              <div className="px-3 py-2 bg-brand-primary/10 dark:bg-brand-primary/15 border border-brand-primary/25 dark:border-brand-primary/50 rounded-lg text-sm font-extrabold text-brand-primary-700 dark:text-brand-primary-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {fmtDateVN(ngayHoanThanhDuKienGoc) || 'N/A'}
              </div>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">
                Ngày BĐ + {soNgayDuKien} ngày (TH {soNgayThucHien} + TP {soNgayDuyetTP}) — tính cả ngày đầu.
                Nộp CĐT = hạn Phòng + số ngày BGĐ duyệt.
              </p>
            </div>

            {/* Hạn hoàn thành hiện tại */}
            <div>
              <label className="block text-xs font-bold text-brand-accent dark:text-brand-accent-300 mb-1.5">Hạn hiện tại (Đã bù lệch)</label>
              <div className="px-3 py-2 bg-brand-accent/10 dark:bg-brand-accent/15 border border-brand-accent/25 dark:border-brand-accent-900 rounded-lg text-sm font-extrabold text-brand-accent-700 dark:text-brand-accent-300 flex items-center gap-1.5 shadow-2xs">
                <Clock className="w-4 h-4" />
                {fmtDateVN(ngayHoanThanhDuKienHienTai) || 'N/A'}
              </div>
              {/* Ghi thẳng phép tính ra màn hình để đối chiếu được với bảng ở mục 5 (chị Trâm báo
                  15/09/2026: "tại sao không bao giờ khớp em nhỉ"). Hiệu của hai ô hạn LUÔN bằng
                  tổng cột "Do xin gia hạn"; phần hạn lùi do kế hoạch việc con dài ra đã nằm sẵn
                  trong ô "Hạn hoàn thành Phòng (tự tính)" nên không cộng lần nữa. */}
              <p className="text-[9px] text-brand-accent dark:text-brand-accent-300 mt-1 font-semibold">
                {tongNgayXinGiaHan > 0
                  ? `= ${fmtDateVN(ngayHoanThanhDuKienGoc)} + ${tongNgayXinGiaHan} ngày xin gia hạn (mục 5)`
                  : 'Chưa có phiếu xin gia hạn nào — bằng đúng hạn tự tính'}
              </p>
            </div>
          </div>

          {/* Timeline 2 chặng: Thực hiện (bộ phận) → TP duyệt → Nộp CĐT (không tính chặng Giám đốc).
              Có thể để trống (0 ngày) khi tạo — Trưởng phòng sẽ nhập thời hạn sau. Quản lý (L2) không sửa được. */}
          <div className="bg-white dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-xl p-3 space-y-3 mt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                Phân bổ thời hạn theo chặng (ra hạn hoàn thành Phòng)
              </span>
              {currentUserRole === 'MANAGER' && (
                <span className="text-[9px] font-bold text-brand-warning dark:text-brand-warning bg-brand-warning/10 dark:bg-brand-warning/10 px-2 py-0.5 rounded-full">🔒 Do Trưởng phòng thiết lập</span>
              )}
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 -mt-1">Có thể để trống (0 ngày) khi tạo — sau khi lập tiến độ con, hệ thống báo Trưởng phòng vào thêm ngày & lưu.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-brand-accent dark:text-brand-accent-300 mb-1">
                  🛠️ Bộ phận thực hiện (ngày){planRange && <span className="ml-1 text-[9px] font-black text-brand-accent">• TỰ TÍNH TỪ KẾ HOẠCH</span>}
                </label>
                <input type="number" min={0} value={soNgayThucHien} disabled={currentUserRole === 'MANAGER' || !!planRange}
                  title={planRange ? `Tự tính từ kế hoạch con: ${fmtDateVN(planRange.minDate)} → ${fmtDateVN(planRange.maxDate)}` : undefined}
                  onChange={(e) => { setSoNgayThucHien(Math.max(0, parseInt(e.target.value) || 0)); if (errors.soNgayDuKien) setErrors(prev => { const c = { ...prev }; delete c.soNgayDuKien; return c; }); }}
                  className="w-full px-2 py-2 border border-brand-accent/25 dark:border-brand-accent/50 rounded-lg text-sm font-black text-center text-brand-accent-700 dark:text-brand-accent-300 bg-brand-accent/5 dark:bg-brand-accent/15 disabled:opacity-60 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-brand-warning dark:text-brand-warning mb-1">👔 Trưởng phòng duyệt (ngày)</label>
                <input type="number" min={0} value={soNgayDuyetTP} disabled={currentUserRole === 'MANAGER'}
                  onChange={(e) => setSoNgayDuyetTP(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-2 py-2 border border-brand-warning/25 dark:border-brand-warning/50 rounded-lg text-sm font-black text-center text-brand-warning dark:text-brand-warning bg-brand-warning/5 dark:bg-brand-warning/10 disabled:opacity-60 disabled:cursor-not-allowed" />
              </div>
            </div>
            {/* Thanh timeline 2 màu theo tỉ lệ ngày */}
            {soNgayDuKien > 0 ? (
              <div className="flex h-6 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 text-[9px] font-black text-white">
                <div className="bg-brand-accent flex items-center justify-center" style={{ width: `${(soNgayThucHien / soNgayDuKien) * 100}%` }} title={`Thực hiện ${soNgayThucHien} ngày`}>{soNgayThucHien}d</div>
                {soNgayDuyetTP > 0 && <div className="bg-brand-warning flex items-center justify-center" style={{ width: `${(soNgayDuyetTP / soNgayDuKien) * 100}%` }} title={`TP duyệt ${soNgayDuyetTP} ngày`}>{soNgayDuyetTP}d</div>}
              </div>
            ) : (
              <div className="h-6 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-400">Chưa thiết lập thời hạn</div>
            )}
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-slate-500 dark:text-slate-400">Bắt đầu: {fmtDateVN(ngayBatDau) || '—'}</span>
              <span className="text-slate-700 dark:text-slate-200">Tổng <b className="text-brand-primary dark:text-brand-primary-300">{soNgayDuKien} ngày</b> → Hạn hoàn thành Phòng: <b className="text-brand-primary dark:text-brand-primary-300">{soNgayDuKien > 0 ? (fmtDateVN(ngayHoanThanhDuKienGoc) || '—') : 'Chưa có'}</b></span>
            </div>
            {/* Thời hạn ĐÃ HẸN với CĐT — mốc cam kết ngoài (nếu có), khác với hạn tự tính ở trên */}
            <div className="flex items-center gap-2 pt-1 border-t border-dashed border-slate-200 dark:border-slate-800">
              <label className="text-[10px] font-bold text-brand-primary-700 dark:text-brand-primary-300 shrink-0">🤝 Thời hạn hẹn CĐT (nếu có):</label>
              <DateInput value={hanHenCDT} disabled={currentUserRole === 'MANAGER'}
                onChange={setHanHenCDT}
                className="w-32 px-2 py-1 border border-brand-primary/25 dark:border-brand-primary/50 rounded-lg text-[11px] font-bold text-brand-primary-700 dark:text-brand-primary-300 bg-brand-primary/5 dark:bg-brand-primary/15 disabled:opacity-60 disabled:cursor-not-allowed" />
              {hanHenCDT && <button type="button" onClick={() => setHanHenCDT('')} className="text-[10px] font-bold text-brand-danger hover:underline">✕ bỏ hẹn</button>}
            </div>
            {/* KHAI TAY SỐ LẦN ĐÃ GỬI CĐT (chị Trâm — góp ý #11): gói thầu đang làm dở từ trước khi
                có app nên nhật ký của app không có các lần gửi cũ. Con số này chỉ CỘNG THÊM vào phần
                đếm khi hiển thị, không đụng tới nhật ký app tự ghi. */}
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-dashed border-slate-200 dark:border-slate-800">
              <label htmlFor="field-soLanGuiCDTTruocApp" className="text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                📤 Đã gửi CĐT trước khi dùng app:
              </label>
              <input
                id="field-soLanGuiCDTTruocApp"
                type="number"
                min={0}
                inputMode="numeric"
                value={soLanGuiCDTTruocApp}
                onChange={(e) => setSoLanGuiCDTTruocApp(e.target.value)}
                placeholder="0"
                title="Số lần đã gửi báo giá cho Chủ đầu tư TRƯỚC khi hồ sơ được đưa vào app. Để trống nếu hồ sơ bắt đầu từ trong app."
                className="w-16 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-black text-center text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated"
              />
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">lần</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Cộng vào số lần app tự ghi → ra tổng số lần gửi hiển thị trên thẻ Kanban và báo cáo.
              </span>
            </div>
            {errors.soNgayDuKien && <span className="text-[11px] text-brand-danger block">{errors.soNgayDuKien}</span>}
          </div>
        </div>
        )}

        {/* Sơ đồ phân rã công việc & Giao việc đa cấp (Chỉ hiển thị khi sửa đổi hoặc thêm việc và gói thầu được chọn) */}
        {(((formMode === 'EDIT_ALL' && !isParentEdit)) || (formMode === 'ADD_WORK' && selectedProjectId)) && (
        <div className="bg-slate-50/50 dark:bg-dark-card/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-2">
            <span className="w-1.5 h-3 bg-brand-primary rounded-full"></span>
            4. Sơ đồ phân rã công việc &amp; Giao việc đa cấp
          </h3>
          
          {/* Bảng phân rã DUY NHẤT: việc con + tỉ trọng + người giao + ngày bắt đầu + số ngày + thanh Gantt.
              Ngày bắt đầu công việc = min kế hoạch; kết thúc = max kế hoạch → ra số ngày Bộ phận tự động. */}
          <div className="space-y-1.5" id="field-tasksWeight">
            {/* Gọn giao diện (chị Trâm chốt 26/07/2026): bỏ dòng nhãn dài — bảng bên dưới đã có tiêu đề
                riêng, còn tiến độ Bộ phận đã hiện ở ô "Tiến độ Bộ phận" ngay dưới bảng. Chỉ giữ nhãn
                VÒNG khi hồ sơ làm lại nhiều vòng, vì thông tin đó không hiện ở đâu khác. */}
            {soVong > 1 && (
              <span className="text-[10px] font-bold text-brand-warning flex items-center gap-1.5">
                🔁 Vòng {vongHienTai}/{soVong} · lũy kế tỉ trọng {viTrongLuyKe}/{soVong * 100}%
              </span>
            )}
            <SubtaskGantt
              tasks={tasks}
              staff={staffList}
              projectStartDate={ngayBatDau}
              canEdit={currentUserRole === 'BOOD' || currentUserRole === 'MANAGER'}
              isBOOD={currentUserRole === 'BOOD'}
              vongHienTai={vongHienTai}
              thuVienTen={thuVienTenViecCon}
              onChange={setTasks}
            />
            {/* Lỗi phân bổ tỉ trọng — hiện ngay dưới bảng để Quản lý thấy đang kẹt chỗ nào */}
            {errors.tasksWeight && (
              <p className="text-[11px] font-bold text-brand-danger bg-brand-danger/10 border border-brand-danger/25 rounded-lg px-2.5 py-2">
                ⛔ {errors.tasksWeight}
              </p>
            )}
            {planRange && (
              <p className="text-[10px] font-bold text-brand-accent dark:text-brand-accent-300">
                📐 Kế hoạch con: {fmtDateVN(planRange.minDate)} → {fmtDateVN(planRange.maxDate)} = <b>{planRange.days} ngày</b> — đã tự cập nhật vào chặng "Bộ phận thực hiện".
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-brand-accent/5 p-3 rounded-lg border border-brand-accent/15">
              <span className="text-[10px] uppercase font-bold text-brand-accent block">Tiến độ Bộ phận (Team Level % - Tự động tính)</span>
              <strong className="text-xl font-black text-brand-accent-700 mt-1 block">{tienDoBoPhan}%</strong>
              <p className="text-[9px] text-brand-accent/70 mt-1">Được nội suy từ tổng tỉ trọng các tác vụ thành viên đã hoàn thành.</p>

              {/* ===== ẢNH BÁO CÁO ĐÃ GỬI BÁO GIÁ (góp ý #12, đưa vào form theo góp ý #75) =====
                  ⚠ ĐẶT Ở CỘT "TIẾN ĐỘ BỘ PHẬN" (chị Trâm chốt 18/08/2026: "vị trí ảnh báo cáo là của
                  quản lý, thì phải nằm bên cột tiến độ bộ phận em ơi") — trước đó em để bên cột Tiến
                  độ Phòng phê duyệt, mà cột đó là phần của Trưởng phòng, không phải việc Quản lý.
                  Quản lý và Trưởng phòng đều sửa được ngay tại đây: kéo-thả tệp, bấm chọn, hoặc
                  CHỤP MÀN HÌNH RỒI Ctrl+V dán thẳng vào ô. Đây là cửa của bước 2 → 3, nên phải có
                  chỗ cập nhật trong form — nếu không, Quản lý được mở form để bổ sung mà không có ô
                  nào để bổ sung (chị Trâm chốt 18/08/2026).
                  ⚠ App chỉ lưu TÊN tệp, không lưu nội dung ảnh (xem utils/attachments.ts). */}
              {project?.loaiBanGhi !== 'DU_AN' && (currentUserRole === 'BOOD' || currentUserRole === 'MANAGER') && (
                <div className="mt-3 pt-2 border-t border-brand-accent/20 dark:border-brand-accent/30">
                  <span className="text-[9px] uppercase font-bold text-brand-accent/80 dark:text-brand-accent-300/80 block mb-1">
                    Ảnh báo cáo đã gửi báo giá
                    <span className="normal-case font-medium text-brand-accent/60 dark:text-brand-accent-300/60">
                      {/* Nhãn phải nói ĐÚNG luật đang chạy: xem ANH_BAO_CAO_BAT_BUOC trong App.tsx.
                          Chị Trâm chốt 18/08/2026 tạm để chỉ nhắc, không chặn bước. */}
                      {' '}(nên có để làm bằng chứng đã gửi — không bắt buộc để qua Bước 3)
                    </span>
                  </span>
                  {anhBaoCao.length > 0 && (
                    <ul className="space-y-1 mb-1.5">
                      {anhBaoCao.map((name, i) => (
                        <li key={`${name}-${i}`} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-dark-bg/70 border border-slate-200/70 dark:border-slate-800 rounded-lg px-2 py-1">
                          <span className="flex-1 truncate" title={name}>🖼 {name}</span>
                          {/* TẢI VỀ — ảnh thêm từ bản 18/08/2026 có nội dung thật nên tải được;
                              ảnh khai từ trước chỉ có tên, bấm sẽ báo rõ là không có tệp. */}
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await taiAnhVe(project?.id || 'moi', name);
                              if (!ok) setLoiAnh(`Ảnh "${name}" chỉ được khai TÊN từ trước (bản cũ chưa lưu nội dung tệp) nên không tải về được. Vui lòng dán lại ảnh để hệ thống lưu tệp.`);
                            }}
                            className="shrink-0 text-brand-accent dark:text-brand-accent-300 hover:underline cursor-pointer"
                            title={`Tải ảnh "${name}" về máy`}
                          >
                            ⬇ Tải về
                          </button>
                          <button
                            type="button"
                            onClick={() => setAnhBaoCao(prev => prev.filter((_, idx) => idx !== i))}
                            className="shrink-0 text-brand-danger hover:underline uppercase cursor-pointer"
                            title={`Bỏ ảnh ${name}`}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <FileDropZone
                    inputId={`anh-bao-cao-form-${project?.id || 'new'}`}
                    label="🖼 Kéo-thả ảnh · bấm để chọn · hoặc Ctrl+V dán ảnh vừa chụp"
                    accept="image/*,.pdf"
                    multiple
                    maxSizeMB={25}
                    onFiles={(files) => {
                      setLoiAnh(null);
                      files.forEach(f => {
                        luuAnh(project?.id || 'moi', f, currentUserRole)
                          .then((kq) => {
                            setAnhBaoCao(prev => Array.from(new Set([...prev, f.name])));
                            if (kq.luuTamTrenMay) setLoiAnh(CAU_NHAC_CHUA_MO_QUYEN);
                          })
                          .catch((err) => setLoiAnh(String(err?.message || err)));
                      });
                    }}
                  />
                  {vuaDanAnh && (
                    <p className="mt-1 text-[10px] font-bold text-brand-success">✓ Đã lưu ảnh dán từ clipboard — tải về được.</p>
                  )}
                  {loiAnh && (
                    <p className="mt-1 text-[10px] font-bold text-brand-warning">{loiAnh}</p>
                  )}
                  <input
                    value={ghiChuGuiBaoGia}
                    onChange={(e) => setGhiChuGuiBaoGia(e.target.value)}
                    placeholder="Ghi chú (không bắt buộc) — VD: gửi qua Zalo cho anh Minh lúc 15h20"
                    className="mt-1.5 w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated"
                  />
                </div>
              )}
            </div>

            <div className="bg-brand-primary/5 dark:bg-brand-primary/15 p-3 rounded-lg border border-brand-primary/15 dark:border-brand-primary/30">
              <span className="text-[10px] uppercase font-bold text-brand-primary block">Tiến độ Phòng phê duyệt (Dept Level %)</span>
              <div className="flex items-center gap-2 mt-1">
                <strong className="text-xl font-black text-brand-primary-700 dark:text-brand-primary-300">{tienDoPhong}%</strong>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={tienDoPhong}
                  onChange={(e) => setTienDoPhong(parseInt(e.target.value))}
                  disabled={currentUserRole !== 'BOOD'}
                  className="flex-1 h-2 bg-slate-200 dark:bg-dark-elevated rounded-lg appearance-none cursor-pointer accent-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <p className="text-[9px] text-brand-primary/70 dark:text-brand-primary-300/70 mt-1">
                {currentUserRole === 'BOOD'
                  ? "Trưởng phòng kéo thanh này để chính thức phê duyệt tiến độ phòng."
                  : "🔒 Chỉ Trưởng phòng (Level 1) mới có quyền phê duyệt tiến độ phòng."}
              </p>

              {/* Kết quả kiểm tra cấp Phòng — nhập tại form (khối xổ xuống ngoài bảng chỉ XEM) */}
              <div className="mt-2">
                <span className="text-[9px] uppercase font-bold text-brand-primary/80 dark:text-brand-primary-300/80 block mb-1">Kết quả kiểm tra cấp Phòng</span>
                {currentUserRole === 'BOOD' ? (
                  <AutoGrowTextarea
                    value={ketQuaPhong}
                    onChange={(e) => setKetQuaPhong(e.target.value)}
                    placeholder="VD: Đã rà soát toàn bộ đơn giá và khối lượng BOQ, hồ sơ đạt yêu cầu trình ký..."
                    className="w-full p-2 text-xs bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                ) : (
                  <div className="p-2 bg-white/60 dark:bg-dark-bg/60 border border-slate-200/70 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 min-h-8 font-medium whitespace-pre-wrap">
                    {ketQuaPhong || <span className="italic text-slate-400">Trưởng phòng chưa nhập kết quả kiểm tra.</span>}
                  </div>
                )}
              </div>

              {/* Tệp kết quả công việc — kéo-thả hoặc bấm chọn. Kết quả có thể là MÔ TẢ ở trên,
                  hoặc TỆP ở đây, hoặc cả hai, hoặc để trống (không bắt buộc). */}
              <div className="mt-2">
                <span className="text-[9px] uppercase font-bold text-brand-primary/80 dark:text-brand-primary-300/80 block mb-1">
                  Tệp kết quả công việc {currentUserRole === 'BOOD' && <span className="normal-case font-medium text-brand-primary/60 dark:text-brand-primary-300/60">(kéo-thả tệp vào ô bên dưới)</span>}
                </span>
                {taiLieuKetQuaPhong.length > 0 && (
                  <ul className="space-y-1 mb-1.5">
                    {taiLieuKetQuaPhong.map((name, i) => (
                      <li key={`${name}-${i}`} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-dark-bg/70 border border-slate-200/70 dark:border-slate-800 rounded-lg px-2 py-1">
                        <span className="flex-1 truncate" title={name}>📎 {name}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await taiAnhVe(project?.id || 'moi', name);
                            if (!ok) setLoiAnh(`Tệp "${name}" chỉ được khai TÊN từ trước (chưa lưu nội dung tệp) nên không tải về được. Đính lại tệp/ảnh để app lưu nội dung thật.`);
                          }}
                          className="shrink-0 text-brand-accent dark:text-brand-accent-300 hover:underline cursor-pointer"
                          title={`Tải "${name}" về máy`}
                        >
                          ⬇ Tải về
                        </button>
                        {currentUserRole === 'BOOD' && (
                          <button
                            type="button"
                            onClick={() => setTaiLieuKetQuaPhong(prev => prev.filter((_, idx) => idx !== i))}
                            className="shrink-0 text-brand-danger hover:underline uppercase cursor-pointer"
                            title={`Bỏ tệp ${name}`}
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {currentUserRole === 'BOOD' ? (
                  <FileDropZone
                    inputId={`file-kq-phong-${project?.id || 'new'}`}
                    multiple
                    accept="image/*,.pdf"
                    label="📤 Đính kèm ảnh/tệp kết quả công việc"
                    onFiles={(files) => {
                      setLoiAnh(null);
                      files.forEach(f => {
                        luuAnh(project?.id || 'moi', f, currentUserRole)
                          .then((kq) => {
                            setTaiLieuKetQuaPhong(prev => Array.from(new Set([...prev, f.name])));
                            if (kq.luuTamTrenMay) setLoiAnh(CAU_NHAC_CHUA_MO_QUYEN);
                          })
                          .catch((err) => setLoiAnh(String(err?.message || err)));
                      });
                    }}
                  />
                ) : taiLieuKetQuaPhong.length === 0 && (
                  <div className="p-2 bg-white/60 dark:bg-dark-bg/60 border border-slate-200/70 dark:border-slate-800 rounded-lg text-xs italic text-slate-400">
                    Chưa có tệp kết quả nào.
                  </div>
                )}
              </div>

              {/* NHẬT KÝ GỬI CĐT — chỉ XEM. Mỗi lần Trưởng phòng kéo hồ sơ từ bước 4 sang bước 5
                  (đã gửi CĐT) hệ thống ghi 1 dòng, kèm số liệu của đúng vòng đó. */}
              {tongSoLanGuiCDT(project) > 0 && (
                <div className="mt-3 pt-2 border-t border-brand-primary/20 dark:border-brand-primary/30">
                  <span className="text-[9px] uppercase font-bold text-brand-primary/80 dark:text-brand-primary-300/80 block mb-1">
                    Nhật ký gửi Chủ đầu tư — {tongSoLanGuiCDT(project)} lần
                    {soLanGuiTruocApp(project) > 0 && ` (gồm ${soLanGuiTruocApp(project)} lần khai tay trước khi dùng app)`}
                  </span>
                  {/* Chỉ ghi LẦN MẤY + NGÀY GỬI (chị Trâm chốt 25/07/2026) */}
                  <ul className="space-y-1">
                    {[...(project?.guiCDTLogs || [])].sort((a, b) => b.lan - a.lan).map(log => (
                      <li key={log.lan} className="flex items-center justify-between gap-2 bg-white/70 dark:bg-dark-bg/70 border border-slate-200/70 dark:border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-black">
                        <span className="text-brand-accent dark:text-brand-accent-300">📤 Gửi CĐT lần {nhanLanGui(project, log.lan)}</span>
                        <span className="text-slate-500 dark:text-slate-400">{log.ngay.split('-').reverse().join('-')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Section 4: Lịch sử dời tiến độ (Delay Logs) — chỉ hiện khi SỬA hồ sơ để xem lịch sử; form
            khởi tạo không hiển thị. Hạn hoàn thành Phòng bị đẩy xa mà chưa khai phiếu ở đây thì bị
            chặn lưu (xem daBiDayXaHan/daCoLogDoiTienDo) — SỬA 08/09/2026 theo đúng góp ý của Sếp:
            lý do dời tiến độ phải nhập ở phiếu "Đăng ký dời tiến độ" NGAY TẠI ĐÂY, không phải ô
            "Ghi chú nguyên nhân trễ hạn" ở mục 6 (ô đó chỉ dành cho lúc hồ sơ đã thật sự quá hạn). */}
        {formMode === 'EDIT_ALL' && !isParentEdit && (
        <div className="bg-slate-50/50 dark:bg-dark-card/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4" id="field-delayLogRequired">
          <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-brand-warning rounded-full"></span>
              5. Lịch Sử Dời Tiến Độ (Delay Logs)
            </h3>
            <button
              type="button"
              onClick={() => setShowAddDelay(!showAddDelay)}
              className={`text-xs text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs ${
                errors.delayLogRequired ? 'bg-brand-danger hover:bg-brand-danger/85 animate-pulse' : 'bg-brand-warning hover:bg-brand-warning/85'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Đăng ký dời tiến độ
            </button>
          </div>

          {/* Cảnh báo hạn bị đẩy xa — bắt buộc khai phiếu ở NGAY mục này mới lưu được (chị/Sếp chốt
              08/09/2026: không dùng ké ô "Ghi chú nguyên nhân trễ hạn" ở mục 6 nữa). */}
          {errors.delayLogRequired && (
            <p className="text-[11px] font-bold text-brand-danger bg-brand-danger/10 border border-brand-danger/25 rounded-lg px-2.5 py-2">
              ⛔ {errors.delayLogRequired}
            </p>
          )}

          {/* New Delay Log Sub-form */}
          {showAddDelay && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-dark-bg p-4 rounded-lg border border-brand-warning/25 dark:border-brand-warning/40 shadow-inner space-y-4"
            >
              <h4 className="text-xs font-extrabold text-brand-warning dark:text-brand-warning uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-brand-warning" />
                Phiếu yêu cầu xin dời tiến độ
              </h4>
              {/* Nói rõ phiếu này dời hạn của KHÂU NÀO, và vì sao không phải khai thêm phiếu cho
                  phần Trưởng phòng (chị Trâm chốt 15/09/2026). */}
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed -mt-2">
                Phiếu này dời <b>hạn Bộ phận</b> (mốc việc con phải xong). Hạn Phòng và hạn thầu tự lùi
                theo đúng bấy nhiêu ngày, <b>không phải khai thêm phiếu</b> — Bộ phận trễ kéo theo Phòng trễ.
                Chỉ khi Trưởng phòng tự tăng số ngày kiểm tra thì mới lập phiếu riêng cho phần đó.
              </p>

              {/* Chọn khâu — CHỈ Trưởng phòng thấy, vì chỉ Trưởng phòng mới tăng được số ngày kiểm
                  tra. Quản lý luôn lập phiếu cho Bộ phận, không cần bày thêm lựa chọn. */}
              {currentUserRole === 'BOOD' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Phiếu này dời hạn của:</span>
                  {([
                    { v: 'BO_PHAN' as const, nhan: 'Bộ phận (việc con)' },
                    { v: 'PHONG' as const, nhan: 'Phòng (ngày TP kiểm tra)' },
                  ]).map(x => (
                    <button
                      key={x.v}
                      type="button"
                      onClick={() => { setNewDelayKhau(x.v); setNewDelayNewEnd(''); }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                        newDelayKhau === x.v
                          ? 'bg-brand-warning/20 border-brand-warning/50 text-brand-warning'
                          : 'bg-white dark:bg-dark-card border-slate-200 dark:border-slate-700 text-slate-500 hover:border-brand-warning/40'
                      }`}
                    >
                      {x.nhan}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Ngày lập phiếu</label>
                  <DateInput
                    value={newDelayDate}
                    onChange={setNewDelayDate}
                    className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-dark-card"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{newDelayKhau === 'PHONG' ? 'Hạn Phòng cũ' : 'Hạn Bộ phận cũ'}</label>
                  <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-dark-elevated border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs font-bold">
                    {fmtDateVN(mocNeoPhieu)}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{newDelayKhau === 'PHONG' ? 'Hạn Phòng mới' : 'Hạn Bộ phận mới *'}</label>
                  {/* Phiếu khâu PHÒNG: hạn mới là HỆ QUẢ của số ngày TP duyệt vừa đổi, app tự tính —
                      cho chọn tay thì người lập chọn một ngày, hạn chạy theo một ngày khác. */}
                  {newDelayKhau === 'PHONG' ? (
                    <div className="px-2.5 py-1.5 bg-brand-accent/10 border border-brand-accent/25 text-brand-accent dark:text-brand-accent-300 rounded text-xs font-bold">
                      {fmtDateVN(newDelayNewEnd) || '—'}
                      <span className="block text-[9px] font-medium text-slate-400 mt-0.5">Tự tính theo ô &quot;TP duyệt&quot;</span>
                    </div>
                  ) : (
                  <DateInput
                    value={newDelayNewEnd}
                    onChange={(v) => {
                      setNewDelayNewEnd(v);
                      if (errors.newEnd) setErrors(prev => { const copy = { ...prev }; delete copy.newEnd; return copy; });
                    }}
                    className={`w-full px-2.5 py-1.5 border rounded text-xs font-bold bg-white dark:bg-dark-card text-slate-800 dark:text-slate-100 ${errors.newEnd ? 'border-brand-danger/50' : 'border-slate-200 dark:border-slate-700'}`}
                  />
                  )}
                  {errors.newEnd && <span className="text-[10px] text-brand-danger block mt-0.5">{errors.newEnd}</span>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Số ngày lệch ước tính</label>
                  <div className="px-2.5 py-1.5 bg-brand-warning/10 dark:bg-brand-warning/10 border border-brand-warning/25 dark:border-brand-warning/30 text-brand-warning dark:text-brand-warning rounded text-xs font-extrabold">
                    {(() => {
                      // Không in số âm kèm chữ "trễ thêm" — vô nghĩa khi hạn không dịch ra
                      // (chị Trâm 19/09/2026: phiếu Phòng từng hiện "-1 Ngày trễ thêm").
                      if (!newDelayNewEnd || !mocNeoPhieu) return '0 Ngày';
                      const n = getDaysDifference(mocNeoPhieu, newDelayNewEnd);
                      return n > 0 ? `${n} Ngày trễ thêm` : 'Hạn không dịch';
                    })()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Chi tiết lý do dời hạn thầu *</label>
                  <input 
                    type="text"
                    value={newDelayReason}
                    onChange={(e) => {
                      setNewDelayReason(e.target.value);
                      if (errors.reason) setErrors(prev => { const copy = { ...prev }; delete copy.reason; return copy; });
                    }}
                    placeholder="VD: Chủ đầu tư đổi thiết kế cơ sở kết cấu / Đợi nhà thầu phụ báo giá mành rèm sâu..."
                    className={`w-full px-2.5 py-1.5 border rounded text-xs font-medium bg-white dark:bg-dark-card text-slate-800 dark:text-slate-100 ${errors.reason ? 'border-brand-danger/50' : 'border-slate-200 dark:border-slate-700'}`}
                  />
                  {errors.reason && <span className="text-[10px] text-brand-danger block mt-0.5">{errors.reason}</span>}
                </div>

                {/* ===== BỎ Ô "CẤP TRÊN PHÊ DUYỆT" (chị Trâm chốt 16/09/2026) =====
                    "Quy định công ty báo lên Zalo xong mới xin dời, cho nên không cần người duyệt —
                     chắc chắn Phó Tổng duyệt mới lên."
                    Việc duyệt đã xong ở ngoài app trước khi vào đây lập phiếu, nên bắt gõ lại tên
                    người duyệt chỉ là chép tay một thông tin app không kiểm chứng được — vừa mất
                    công vừa tạo cảm giác app đang "duyệt" trong khi thật ra không. */}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddDelay(false)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-dark-elevated hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-bold transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleAddDelayLog}
                  className="px-3 py-1.5 bg-brand-warning hover:bg-brand-warning/85 text-white rounded text-xs font-bold transition-all shadow-2xs"
                >
                  Phê duyệt & Lưu vào Gantt
                </button>
              </div>
            </motion.div>
          )}

          {/* Delay Logs List Table */}
          {delayLogs.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-2 bg-white dark:bg-dark-bg rounded border border-dashed border-slate-200 dark:border-slate-800">
              Không có ghi chú dời tiến độ thầu. Dự án đang bám sát mốc hoàn thành gốc.
            </p>
          ) : (
            /* Nhánh này giờ có HAI khối (hộp sửa phiếu + bảng) nên phải bọc Fragment. */
            <>
            {/* ===== HỘP SỬA PHIẾU (chị Trâm chốt 19/09/2026) — chỉ khâu & lý do, KHÔNG động tới ngày ===== */}
            {suaPhieuId && (() => {
              const log = delayLogs.find(l => l.id === suaPhieuId);
              if (!log) return null;
              const doiKhau = (log.khau === 'PHONG' ? 'PHONG' : 'BO_PHAN') !== suaPhieuKhau;
              return (
                <div className="bg-white dark:bg-dark-bg p-4 rounded-lg border border-brand-accent/30 dark:border-brand-accent/50 shadow-inner space-y-3 mb-3">
                  <h4 className="text-xs font-extrabold text-brand-accent dark:text-brand-accent-300 uppercase tracking-wider flex items-center gap-1">
                    <Pencil className="w-3.5 h-3.5" />
                    Sửa phiếu lập ngày {fmtDateVN(log.ngayThayDoi)}
                  </h4>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Hạn <b>{fmtDateVN(log.ngayCu)} → {fmtDateVN(log.ngayMoi)}</b> giữ nguyên, không sửa được —
                    đó là số app tự tính từ kế hoạch lúc lập phiếu. Chỉ sửa được khâu và lý do.
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Phiếu này dời hạn của:</span>
                    {([
                      { v: 'BO_PHAN' as const, nhan: 'Bộ phận (việc con)' },
                      { v: 'PHONG' as const, nhan: 'Phòng (ngày TP kiểm tra)' },
                    ]).map(x => (
                      <button
                        key={x.v}
                        type="button"
                        onClick={() => setSuaPhieuKhau(x.v)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          suaPhieuKhau === x.v
                            ? 'bg-brand-accent/20 border-brand-accent/50 text-brand-accent dark:text-brand-accent-300'
                            : 'bg-white dark:bg-dark-card border-slate-200 dark:border-slate-700 text-slate-500 hover:border-brand-accent/40'
                        }`}
                      >
                        {x.nhan}
                      </button>
                    ))}
                  </div>

                  {doiKhau && (
                    <p className="text-[11px] font-bold text-brand-warning bg-brand-warning/10 border border-brand-warning/25 rounded-lg px-2.5 py-2">
                      ⚠ Đổi khâu sẽ làm <b>hạn tính lại</b>: phiếu Bộ phận cộng ngày vào hạn, phiếu Phòng thì không
                      (số ngày đó đã nằm trong ô &quot;Trưởng phòng duyệt&quot; ở mục 3).
                    </p>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Lý do</label>
                    <input
                      type="text"
                      value={suaPhieuLyDo}
                      onChange={(e) => setSuaPhieuLyDo(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs font-medium bg-white dark:bg-dark-card text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSuaPhieuId(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                      Huỷ
                    </button>
                    <button
                      type="button"
                      onClick={luuSuaPhieu}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-brand-accent hover:bg-brand-accent-700 text-white transition-colors"
                    >
                      Lưu sửa phiếu &amp; lưu hồ sơ
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="bg-white dark:bg-dark-bg rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Mobile <768px: Card List thay bảng 7 cột (luật 9) */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {delayLogs.map((log) => (
                  <div key={log.id} className="p-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {fmtDateVN(log.ngayThayDoi)}
                        <span className="ml-1.5 text-[10px] font-black text-slate-400">· {log.khau === 'PHONG' ? 'Phòng' : 'Bộ phận'}</span>
                      </span>
                      <span className="font-extrabold text-brand-warning dark:text-brand-warning">
                        {(() => {
                          const n = getDaysDifference(log.ngayCu, log.ngayMoi);
                          return n > 0 ? `+${n} ngày` : n < 0 ? `sớm ${-n} ngày` : '—';
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="line-through text-slate-400 dark:text-slate-500">{fmtDateVN(log.ngayCu)}</span>
                      <span aria-hidden="true">→</span>
                      <span className="font-bold text-brand-accent dark:text-brand-accent-300">{fmtDateVN(log.ngayMoi)}</span>
                    </div>
                    <p className="italic text-slate-600 dark:text-slate-300">{log.lyDo}</p>
                    <div className="flex items-center justify-end gap-2">
                      {currentUserRole === 'BOOD' && (
                        <button
                          type="button"
                          onClick={() => moSuaPhieu(log)}
                          title="Sửa khâu / lý do của phiếu này"
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-400 hover:text-brand-accent rounded transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveDelayLog(log.id)}
                        title="Xóa ghi chú dời tiến độ"
                        className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-400 hover:text-brand-danger dark:hover:text-brand-danger rounded transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <table className="w-full text-left text-xs border-collapse hidden md:table">
                <thead>
                  <tr className="bg-brand-warning/5 dark:bg-brand-warning/10 text-brand-warning dark:text-brand-warning uppercase text-[9px] font-bold border-b border-brand-warning/25 dark:border-brand-warning/30">
                    <th className="p-2">Ngày Đăng Ký</th>
                    <th className="p-2">Khâu</th>
                    <th className="p-2">Hạn Cũ</th>
                    <th className="p-2">Hạn Mới</th>
                    <th className="p-2 text-center">Hạn Lùi</th>
                    {/* ĐÃ BỎ hai cột "Do xin gia hạn" và "Lúc lập phiếu" (chị Trâm chốt 19/09/2026:
                        "bỏ cột ghi chú Do xin gia hạn + Lúc lập phiếu", "đưa cột lý do rộng ra ghi
                        cho dễ đọc"). Muốn đối chiếu số ngày xin gia hạn thì xem dòng ghi ngay dưới
                        ô "Hạn hiện tại" ở mục 3 — chỗ đó ghi thẳng phép tính. */}
                    <th className="p-2 w-1/3">Lý Do Đề Xuất</th>
                    <th className="p-2 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-600 dark:text-slate-400">
                  {delayLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-brand-warning/5 dark:hover:bg-brand-warning/10">
                      <td className="p-2">{fmtDateVN(log.ngayThayDoi)}</td>
                      {/* KHÂU phiếu này dời hạn — Bộ phận (cộng vào hạn, kéo Phòng lùi theo) hay
                          Phòng (chỉ ghi lại lý do Trưởng phòng tăng ngày kiểm tra). */}
                      <td className="p-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black whitespace-nowrap ${
                          log.khau === 'PHONG'
                            ? 'bg-brand-accent/15 text-brand-accent dark:text-brand-accent-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300'
                        }`} title={log.khau === 'PHONG'
                          ? 'Trưởng phòng tăng số ngày kiểm tra — phiếu chỉ để ghi lý do, số ngày đã nằm trong ô "TP duyệt".'
                          : 'Quản lý xin thêm ngày cho việc con — số ngày này cộng vào hạn Bộ phận, hạn Phòng và hạn thầu tự lùi theo.'}>
                          {log.khau === 'PHONG' ? 'Phòng' : 'Bộ phận'}
                        </span>
                      </td>
                      <td className="p-2 line-through text-slate-400 dark:text-slate-500">{fmtDateVN(log.ngayCu)}</td>
                      <td className="p-2 font-bold text-brand-accent dark:text-brand-accent-300">{fmtDateVN(log.ngayMoi)}</td>
                      {/* ===== TÁCH LÀM HAI CỘT (chị Trâm báo 15/09/2026: "tại sao không bao giờ khớp") =====
                          Trước đây chỉ có MỘT cột "Trễ thêm (offset)" in ra `ngayMới − ngayCũ`, tức
                          TOÀN BỘ quãng hạn bị lùi. Nhưng hạn lùi đến từ hai nguồn khác nhau:
                            · XIN GIA HẠN (soNgayLech) — cộng thêm vào hạn, ngoài kế hoạch.
                            · KẾ HOẠCH VIỆC CON DÀI RA — hạn tự tính lại, KHÔNG cộng thêm lần nữa.
                          Cộng cả cột đó lại rồi so với hai ô hạn ở mục 3 thì không bao giờ khớp, vì
                          phần do kế hoạch việc con đã nằm sẵn trong "Hạn hoàn thành Phòng (tự tính)".
                          Nay tách rõ: cột "Do xin gia hạn" cộng lại đúng bằng hiệu của hai ô hạn đó. */}
                      {/* Hạn có thể RÚT VÀO (kế hoạch làm nhanh hơn) — chị Trâm chốt 19/09/2026 ghi
                          cả hai chiều vào lịch sử. Math.max(0,...) cũ nuốt mất chiều rút, in ra
                          "+0 ngày" như thể không có gì xảy ra. */}
                      <td className={`p-2 text-center font-bold ${getDaysDifference(log.ngayCu, log.ngayMoi) < 0 ? 'text-brand-success' : 'text-slate-500 dark:text-slate-400'}`}>
                        {(() => {
                          const n = getDaysDifference(log.ngayCu, log.ngayMoi);
                          if (n > 0) return `+${n} ngày`;
                          if (n < 0) return `sớm ${-n} ngày`;
                          return '—';
                        })()}
                      </td>
                      <td className="p-2 italic max-w-xs truncate text-slate-600 dark:text-slate-300" title={log.lyDo}>{log.lyDo}</td>
                      <td className="p-2 text-center whitespace-nowrap">
                        {/* Cây bút CHỈ Trưởng phòng thấy — sửa khâu / lý do khi bấm nhầm. */}
                        {currentUserRole === 'BOOD' && (
                          <button
                            type="button"
                            onClick={() => moSuaPhieu(log)}
                            title="Sửa khâu / lý do của phiếu này (không sửa được ngày)"
                            className="p-1 mr-1 text-slate-400 hover:text-brand-accent dark:hover:text-brand-accent-300 rounded transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveDelayLog(log.id)}
                          title="Xoá phiếu này"
                          className="p-1 text-slate-400 hover:text-brand-danger dark:hover:text-brand-danger rounded transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
        )}

        {/* Section 5: Đóng hồ sơ thầu & Thẩm định KPI trễ hạn — ĐÃ TÍCH HỢP vào Kanban (kéo lên bước 5
            tự chốt ngày & đánh giá theo hẹn CĐT). Chỉ hiện khi SỬA để TP chỉnh tay ngày gửi thật khác ngày kéo thẻ */}
        {formMode === 'EDIT_ALL' && !isParentEdit && (
        <div className="bg-slate-50/50 dark:bg-dark-card/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-2">
            <span className="w-1.5 h-3 bg-brand-accent-700 rounded-full"></span>
            6. Đóng Gói Thầu & Đánh Giá KPI Cuối Kỳ
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ngày hoàn thành thực tế */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Ngày đóng hồ sơ thực tế (Ngày hoàn thành thực tế)
                {currentUserRole === 'MANAGER' && <span className="ml-1 text-[9px] font-bold text-brand-warning dark:text-brand-warning">🔒 Do Trưởng phòng điều chỉnh</span>}
              </label>
              <DateInput
                value={ngayHoanThanhThucTe}
                disabled={currentUserRole === 'MANAGER'}
                onChange={setNgayHoanThanhThucTe}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Tự chốt khi kéo thẻ từ Bước 3 sang Bước 4 (Phòng xong phần mình) — Trưởng phòng sửa tay nếu ngày đóng thật khác ngày kéo thẻ.</p>
            </div>

            {/* Indicator status box */}
            <div className="flex items-center">
              {delayReasonRequired ? (
                <div className="bg-brand-danger/10 dark:bg-brand-danger/10 border border-brand-danger/25 dark:border-brand-danger/30 rounded-lg p-3 w-full flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-brand-danger dark:text-brand-danger flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-brand-danger dark:text-brand-danger text-xs uppercase block">CẢNH BÁO TỰ ĐỘNG HÓA TRỄ HẠN THẦU!</strong>
                    <span className="text-[11px] text-brand-danger dark:text-brand-danger block mt-0.5">
                      Ngày hoàn thành thực tế trễ hơn hạn thầu điều chỉnh hiện tại. Hệ thống đã kích hoạt trường bắt buộc dưới đây phục vụ hậu kiểm điểm KPI/Thưởng nhân viên.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-brand-primary/10 dark:bg-brand-primary/15 border border-brand-primary/25 dark:border-brand-primary/30 rounded-lg p-3 w-full flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-brand-primary dark:text-brand-primary-300 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-brand-primary-800 dark:text-brand-primary-300 text-xs uppercase block">ĐÚNG HẠN ĐỊNH MỨC THẦU</strong>
                    <span className="text-[11px] text-brand-primary-700 dark:text-brand-primary-300 block mt-0.5">
                      Dự án đang kiểm soát tốt, đúng mốc thời gian cam kết. Đủ điều kiện hưởng Quỹ Thưởng đấu thầu tối đa.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Conditional Input Field: Ghi chú nguyên nhân trễ hạn */}
          {delayReasonRequired && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-1.5"
              id="field-nguyenNhanTreHan"
            >
              <label className="block text-xs font-bold text-brand-danger dark:text-brand-danger mb-1 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-brand-danger dark:text-brand-danger" />
                Ghi chú nguyên nhân trễ hạn (BẮT BUỘC ĐIỀN) *
              </label>
              <AutoGrowTextarea
                value={nguyenNhanTreHan}
                onChange={(e) => {
                  setNguyenNhanTreHan(e.target.value);
                  if (errors.nguyenNhanTreHan) setErrors(prev => { const copy = { ...prev }; delete copy.nguyenNhanTreHan; return copy; });
                }}
                placeholder="Yêu cầu nhập lời giải trình cụ thể (ví dụ: Do bàn giao sai sót dữ liệu khảo sát hiện trạng, hoặc chậm trễ báo giá kính của nhà cung cấp, thiết bị kỹ thuật bị thay đổi...)"
                className={`w-full px-3 py-2 border rounded-lg text-sm font-medium bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 ${errors.nguyenNhanTreHan ? 'border-brand-danger bg-brand-danger/5 focus:ring-brand-danger' : 'border-slate-300 dark:border-slate-700 focus:ring-brand-accent'}`}
              />
              {errors.nguyenNhanTreHan && <span className="text-[11px] text-brand-danger dark:text-brand-danger mt-1 block font-bold">{errors.nguyenNhanTreHan}</span>}
            </motion.div>
          )}

          {/* ===== LỊCH SỬ TRỄ HẠN THEO KHÂU (chị Trâm chốt 19/09/2026) =====
              "Chỗ ghi chú lịch sử trễ hạn của Bộ phận và Phòng ở đây nhé."
              Hai ô khai ở hai mốc khác nhau, do hai người khác nhau:
                · Bộ phận — Quản lý khai khi kéo Bước 2 → 3 mà đã quá hạn Bộ phận.
                · Phòng   — Trưởng phòng khai khi kéo Bước 3 → 4 mà đã quá hạn Phòng.
              Để CẠNH NHAU ở đây để cuối kỳ đọc một chỗ là biết khâu nào chậm và chậm vì sao —
              trước đây chỉ có một ô chung, không phân biệt được ai.
              Trưởng phòng sửa lại được (bấm nhầm, hoặc viết rõ thêm); Quản lý chỉ xem. */}
          {(lyDoTreBoPhan || lyDoTrePhong || currentUserRole === 'BOOD') && (
            <div className="border-t border-slate-200/60 dark:border-slate-800/85 pt-4">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-2">
                Lịch sử trễ hạn theo khâu
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-brand-warning mb-1">
                    Bộ phận ghi <span className="font-medium text-slate-400">(khai lúc rời Bước 2)</span>
                  </label>
                  <AutoGrowTextarea
                    value={lyDoTreBoPhan}
                    onChange={(e) => setLyDoTreBoPhan(e.target.value)}
                    disabled={currentUserRole !== 'BOOD'}
                    minRows={2}
                    placeholder="Chưa có — Bộ phận chưa trễ hạn, hoặc chưa khai."
                    className="w-full px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-dark-card disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-brand-danger mb-1">
                    Phòng ghi <span className="font-medium text-slate-400">(khai lúc rời Bước 3)</span>
                  </label>
                  <AutoGrowTextarea
                    value={lyDoTrePhong}
                    onChange={(e) => setLyDoTrePhong(e.target.value)}
                    disabled={currentUserRole !== 'BOOD'}
                    minRows={2}
                    placeholder="Chưa có — Phòng chưa trễ hạn, hoặc chưa khai."
                    className="w-full px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-dark-card disabled:text-slate-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Audit KPI theo tiến độ */}
          <div className="border-t border-slate-200/60 dark:border-slate-800/85 pt-4">
            {/* KPI details preview */}
            <div className="bg-slate-100/50 dark:bg-dark-elevated/30 rounded-xl p-3 border border-slate-200/50 dark:border-slate-700/50 flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Tự Động Thẩm Định Điểm KPI Công Việc
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white dark:bg-dark-card rounded-lg p-1.5 border border-slate-100 dark:border-slate-800 shadow-2xs">
                  <span className="text-[9px] text-slate-400 block font-medium">Hạn thầu hiện tại</span>
                  <strong className="text-slate-700 dark:text-slate-300 text-xs font-mono">{fmtDateVN(ngayHoanThanhDuKienHienTai)}</strong>
                </div>
                <div className="bg-white dark:bg-dark-card rounded-lg p-1.5 border border-slate-100 dark:border-slate-800 shadow-2xs">
                  <span className="text-[9px] text-slate-400 block font-medium">Tiến độ hạn thầu</span>
                  <strong className={`text-xs block ${
                    (() => {
                      let diff = 0;
                      if (ngayHoanThanhThucTe) {
                        diff = getDaysDifference(ngayHoanThanhDuKienHienTai, ngayHoanThanhThucTe);
                      } else {
                        const todayStr = new Date().toISOString().split('T')[0];
                        diff = getDaysDifference(ngayHoanThanhDuKienHienTai, todayStr);
                      }
                      return diff > 0 ? 'text-brand-danger dark:text-brand-danger' : 'text-brand-primary dark:text-brand-primary-300';
                    })()
                  }`}>
                    {(() => {
                      let diff = 0;
                      if (ngayHoanThanhThucTe) {
                        diff = getDaysDifference(ngayHoanThanhDuKienHienTai, ngayHoanThanhThucTe);
                      } else {
                        const todayStr = new Date().toISOString().split('T')[0];
                        diff = getDaysDifference(ngayHoanThanhDuKienHienTai, todayStr);
                      }
                      return diff > 0 ? `Trễ ${diff} ngày (-${diff * 5}đ)` : 'Đúng hạn / Sớm';
                    })()}
                  </strong>
                </div>
                <div className="bg-brand-accent/10 dark:bg-brand-accent/15 rounded-lg p-1.5 border border-brand-accent/15 dark:border-brand-accent/30">
                  <span className="text-[9px] text-brand-accent dark:text-brand-accent-300 block font-bold uppercase tracking-wider">KPI TẠM TÍNH</span>
                  <strong className="text-brand-accent-700 dark:text-brand-accent-300 text-xs font-black font-mono block mt-0.5">
                    {(() => {
                      let diff = 0;
                      if (ngayHoanThanhThucTe) {
                        diff = getDaysDifference(ngayHoanThanhDuKienHienTai, ngayHoanThanhThucTe);
                      } else {
                        const todayStr = new Date().toISOString().split('T')[0];
                        diff = getDaysDifference(ngayHoanThanhDuKienHienTai, todayStr);
                      }
                      const progressScore = Math.max(0, 100 - (Math.max(0, diff) * 5));
                      return `${progressScore}đ`;
                    })()}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Lỗi rơi vào ô đang bị ẩn — hiện ngay tại đây, bằng không bấm Lưu sẽ không thấy gì xảy ra */}
        {loiAn.length > 0 && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-brand-danger/40 bg-brand-danger/10 p-3.5 space-y-1.5"
          >
            <p className="text-xs font-black text-brand-danger">Chưa lưu được hồ sơ:</p>
            <ul className="list-disc list-inside space-y-1">
              {loiAn.map((m, i) => (
                <li key={i} className="text-[11px] font-medium text-slate-700 dark:text-slate-200">{m}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 bg-slate-100 dark:bg-dark-elevated hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition-all"
          >
            Hủy và Quay Lại
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white font-bold rounded-xl text-sm transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
          >
            <Save className="w-4 h-4" />
            {formMode === 'CREATE_TENDER' ? 'Đăng Ký Dự Án' :
             formMode === 'ADD_WORK' ? 'Tạo Công Việc Con' :
             'Lưu Hồ Sơ'}
          </button>
        </div>
      </form>
    </div>
  );
}
