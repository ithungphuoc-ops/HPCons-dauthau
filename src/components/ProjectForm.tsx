import React, { useState, useEffect, useMemo } from 'react';
import { Project, Staff, DelayLog, ProjectTask } from '../types';
import { Plus, Trash2, Calendar, Clock, AlertTriangle, CheckCircle2, Save, X, CheckSquare, Square, Link } from 'lucide-react';
import { motion } from 'motion/react';
import SubtaskGantt, { DEFAULT_TASK_DAYS } from './SubtaskGantt';
import { calculateProjectProgress } from '../utils/taskTree';
import { fmtDateVN } from '../utils/dateVN';
import DateInput from './DateInput';
import { useModalA11y } from '../utils/useModalA11y';

interface ProjectFormProps {
  project?: Project; // If provided, we are editing; else creating
  staffList: Staff[];
  onSave: (project: Project) => void;
  onCancel: () => void;
  nextProjectId: string;
  currentUserRole?: 'BOOD' | 'MANAGER' | 'STAFF';
  formMode?: 'CREATE_TENDER' | 'ADD_WORK' | 'EDIT_ALL';
  projectsListForSelect?: Project[];
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

export default function ProjectForm({ 
  project, 
  staffList, 
  onSave, 
  onCancel, 
  nextProjectId, 
  currentUserRole,
  formMode = 'EDIT_ALL',
  projectsListForSelect = []
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
  const [moTa, setMoTa] = useState<string>(project?.moTa || '');
  const [oneDriveLink, setOneDriveLink] = useState<string>(project?.oneDriveLink || '');

  // New specific bidding statistics fields
  const [chuDauTu, setChuDauTu] = useState<string>(project?.chuDauTu || '');
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
  const [hanHenCDT, setHanHenCDT] = useState<string>(project?.hanHenCDT || '');
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
  const planRange = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const parse = (s?: string) => { if (!s) return NaN; const t = new Date(s).getTime(); return isNaN(t) ? NaN : t; };
    // DÙNG CHUNG logic với SubtaskGantt: việc CHƯA đặt ngày được xếp nối tiếp (cursor) và số ngày
    // mặc định = DEFAULT_TASK_DAYS (3), KHÔNG phải 1 — nếu không "Bộ phận thực hiện" sẽ lệch với Gantt.
    const base = parse(ngayBatDau);
    let cursor = !isNaN(base) ? base : Date.now();
    let min: number | null = null, max: number | null = null, hasDates = false;
    tasks.forEach(t => {
      const ex = parse(t.ngayBatDau);
      const start = !isNaN(ex) ? ex : cursor;
      if (!isNaN(ex)) hasDates = true;
      const days = t.soNgay && t.soNgay > 0 ? t.soNgay : DEFAULT_TASK_DAYS;
      const end = start + days * DAY;
      cursor = end;
      if (min === null || start < min) min = start;
      if (max === null || end > max) max = end;
    });
    if (!hasDates || min === null || max === null) return null;
    const f = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    // maxDate = NGÀY CUỐI LÀM VIỆC (max exclusive - 1); days = số ngày (đếm cả 2 đầu min→ngày cuối)
    return { minDate: f(min), maxDate: f(max - DAY), days: Math.max(1, Math.round((max - min) / DAY)) };
  }, [tasks, ngayBatDau]);

  // Đồng bộ: có kế hoạch con đặt ngày → ngày bắt đầu & số ngày Bộ phận bám theo kế hoạch
  useEffect(() => {
    if (planRange) {
      setNgayBatDau(planRange.minDate);
      setSoNgayThucHien(planRange.days);
    }
  }, [planRange]);

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
  
  const [ngayHoanThanhThucTe, setNgayHoanThanhThucTe] = useState<string>(project?.ngayHoanThanhThucTe || '');
  const [nguyenNhanTreHan, setNguyenNhanTreHan] = useState<string>(project?.nguyenNhanTreHan || '');

  // Delay logs management
  const [delayLogs, setDelayLogs] = useState<DelayLog[]>(project?.delayLogs || []);

  // Selection state for ADD_WORK mode
  const [selectedProjectId, setSelectedProjectId] = useState<string>(project?.id || '');

  // ADD_WORK: khi chọn Dự án cha, KẾ THỪA thông tin cấp dự án (tên, CĐT, địa chỉ...) sang công việc con.
  // Giữ hạng mục / ngày / cây công việc / tiến độ ở giá trị MỚI để nhập cho công việc con này.
  useEffect(() => {
    if (formMode === 'ADD_WORK' && selectedProjectId) {
      const parent = projectsListForSelect.find(p => p.id === selectedProjectId);
      if (parent) {
        setTenDuAn(parent.tenDuAn);
        setChuDauTu(parent.chuDauTu || '');
        setDiaChi(parent.diaChi || '');
        setOneDriveLink(parent.oneDriveLink || '');
        setHinhThucDauThau(parent.hinhThucDauThau || 'Đấu thầu cạnh tranh');
        setTinhTrangDuAn(parent.tinhTrangDuAn || 'Đang triển khai');
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
  const [newDelayApprover, setNewDelayApprover] = useState<string>('');

  // Auto-calculated fields
  const [ngayHoanThanhDuKienGoc, setNgayHoanThanhDuKienGoc] = useState<string>('');
  const [ngayHoanThanhDuKienHienTai, setNgayHoanThanhDuKienHienTai] = useState<string>('');

  // Form error validation
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Recalculate original end date whenever start date or expected days change
  useEffect(() => {
    if (ngayBatDau && soNgayDuKien > 0) {
      const originalEnd = addDaysToDate(ngayBatDau, soNgayDuKien);
      setNgayHoanThanhDuKienGoc(originalEnd);

      // Current expected end date = original + total offsets from Delay Logs
      const totalOffsetDays = delayLogs.reduce((sum, log) => sum + log.soNgayLech, 0);
      const currentEnd = addDaysToDate(originalEnd, totalOffsetDays);
      setNgayHoanThanhDuKienHienTai(currentEnd);
    }
  }, [ngayBatDau, soNgayDuKien, delayLogs]);

  // Recalculate team progress automatically when tasks change
  const autoBoPhanProgress = useMemo(() => {
    return calculateProjectProgress(tasks);
  }, [tasks]);

  useEffect(() => {
    setTienDoBoPhan(autoBoPhanProgress);
  }, [autoBoPhanProgress]);

  // If a new delay log is being added, pre-fill its New End Date suggestion
  useEffect(() => {
    if (showAddDelay && ngayHoanThanhDuKienHienTai) {
      setNewDelayNewEnd(addDaysToDate(ngayHoanThanhDuKienHienTai, 3)); // suggest 3 days extra
    }
  }, [showAddDelay, ngayHoanThanhDuKienHienTai]);

  // Smart Delay & KPI Evaluation Logic
  const isOverdue = (): boolean => {
    // If completed: check if actual completed date is after current expected completion date
    if (ngayHoanThanhThucTe && ngayHoanThanhDuKienHienTai) {
      return new Date(ngayHoanThanhThucTe) > new Date(ngayHoanThanhDuKienHienTai);
    }
    
    // If not completed: check if current date exceeds current expected completion date and progress is < 100%
    const todayStr = '2026-06-26'; // Current simulation date
    if (ngayHoanThanhDuKienHienTai && (tienDoBoPhan < 100 || tienDoPhong < 100)) {
      return new Date(todayStr) > new Date(ngayHoanThanhDuKienHienTai);
    }
    return false;
  };

  const delayReasonRequired = isOverdue();

  // ===== Chốt chặn dời tiến độ khi Quản lý cập nhật =====
  // Sửa công việc làm HẠN HIỆN TẠI lùi xa hơn hạn trước khi sửa → bắt buộc nhập lý do dời
  // thì mới cho Lưu; lý do được ghi tự động vào Lịch Sử Dời Tiến Độ (Delay Logs).
  const [autoDelayReason, setAutoDelayReason] = useState<string>('');
  const scheduleExtendDays = useMemo(() => {
    if (formMode !== 'EDIT_ALL' || isParentEdit || !project?.ngayHoanThanhDuKienHienTai || !ngayHoanThanhDuKienHienTai) return 0;
    return Math.max(0, getDaysDifference(project.ngayHoanThanhDuKienHienTai, ngayHoanThanhDuKienHienTai));
  }, [formMode, isParentEdit, project?.ngayHoanThanhDuKienHienTai, ngayHoanThanhDuKienHienTai]);
  const scheduleExtended = currentUserRole === 'MANAGER' && scheduleExtendDays > 0;
  // Quản lý (Level 2) CHỈ XEM thông tin chung & thông tin gốc phòng kinh doanh —
  // chỉ Trưởng phòng (Level 1) khởi tạo & chỉnh sửa các mục này.
  const infoLocked = currentUserRole === 'MANAGER';

  // Handle adding Delay Log
  const handleAddDelayLog = (e: React.MouseEvent) => {
    e.preventDefault();
    const errs: { [key: string]: string } = {};
    if (!newDelayNewEnd) errs.newEnd = 'Vui lòng chọn ngày hoàn thành mới';
    if (!newDelayReason.trim()) errs.reason = 'Vui lòng nhập lý do dời hạn';
    if (!newDelayApprover.trim()) errs.approver = 'Vui lòng nhập người phê duyệt';

    if (newDelayNewEnd && ngayHoanThanhDuKienHienTai) {
      const diff = getDaysDifference(ngayHoanThanhDuKienHienTai, newDelayNewEnd);
      if (diff <= 0) {
        errs.newEnd = 'Ngày hoàn thành mới phải sau hạn hoàn thành hiện tại';
      }
    }

    if (Object.keys(errs).length > 0) {
      setErrors(prev => ({ ...prev, ...errs }));
      return;
    }

    const calculatedShift = getDaysDifference(ngayHoanThanhDuKienHienTai, newDelayNewEnd);

    const newLog: DelayLog = {
      id: `L${Date.now()}`,
      ngayThayDoi: newDelayDate,
      ngayCu: ngayHoanThanhDuKienHienTai,
      ngayMoi: newDelayNewEnd,
      soNgayLech: calculatedShift,
      lyDo: newDelayReason,
      nguoiDuyet: newDelayApprover
    };

    setDelayLogs([...delayLogs, newLog]);
    setShowAddDelay(false);
    setNewDelayReason('');
    setNewDelayApprover('');
    
    // Clear log errors
    setErrors(prev => {
      const copy = { ...prev };
      delete copy.newEnd;
      delete copy.reason;
      delete copy.approver;
      return copy;
    });
  };

  const handleRemoveDelayLog = (logId: string) => {
    setDelayLogs(delayLogs.filter(log => log.id !== logId));
  };

  // Modal cảnh báo trễ hẹn CĐT (thay cho confirm() mặc định)
  const [showCdtWarning, setShowCdtWarning] = useState(false);
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
    }

    if (!tenDuAn.trim()) errs.tenDuAn = 'Tên dự án thầu không được để trống';
    
    if (!ngayBatDau) errs.ngayBatDau = 'Chưa có ngày bắt đầu — hãy đặt ngày cho ít nhất một công việc con ở mục Sơ đồ phân rã (hệ thống tự lấy ngày sớm nhất).';
    // Thời hạn có thể để trống (0 ngày) khi tạo — Trưởng phòng sẽ vào thiết lập sau (báo qua chuông)
    
    // Conditionally check Delay Reason requirement
    if (delayReasonRequired && !nguyenNhanTreHan.trim()) {
      errs.nguyenNhanTreHan = 'Bắt buộc: Dự án đang trễ hạn thầu! Vui lòng điền nguyên nhân để thẩm định KPI.';
    }

    // Quản lý cập nhật làm hạn hoàn thành lùi xa hơn → bắt buộc nhập lý do dời tiến độ
    if (scheduleExtended && !autoDelayReason.trim()) {
      errs.autoDelayReason = `Tiến độ tổng tăng thêm ${scheduleExtendDays} ngày — bắt buộc nhập lý do dời tiến độ trước khi cập nhật.`;
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // scroll to first error
      const firstErrorKey = Object.keys(errs)[0];
      const element = document.getElementById(`field-${firstErrorKey}`);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // CẢNH BÁO trước khi Trưởng phòng bấm duyệt: tiến độ tính ra VƯỢT thời hạn đã hẹn CĐT.
    // Thay confirm() mặc định của trình duyệt bằng modal web (đẹp hơn) — mở modal rồi dừng lại.
    if (!bypassCdtGuard && currentUserRole === 'BOOD' && formMode !== 'CREATE_TENDER' && hanHenCDT &&
        soNgayDuKien > 0 && ngayHoanThanhDuKienGoc && ngayHoanThanhDuKienGoc > hanHenCDT) {
      setShowCdtWarning(true);
      return;
    }

    // Calculate actual status
    let trangThai: Project['trangThai'] = 'DANG_THUC_HIEN';
    const isCompleted = tienDoPhong === 100 || ngayHoanThanhThucTe !== '';
    
    if (isCompleted) {
      const completionDate = ngayHoanThanhThucTe || new Date().toISOString().split('T')[0];
      if (new Date(completionDate) > new Date(ngayHoanThanhDuKienHienTai)) {
        trangThai = 'HOAN_THANH_TRE_HAN';
      } else {
        trangThai = 'HOAN_THANH_DUNG_HAN';
      }
    } else {
      const todayStr = '2026-06-26';
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

    // Quản lý dời tiến độ → tự ghi vào Lịch Sử Dời Tiến Độ.
    // soNgayLech = 0 vì hạn mới đã được tính sẵn từ kế hoạch (khác log thủ công cộng offset) —
    // nếu ghi số ngày thật sẽ bị cộng trùng vào hạn hiện tại. Cột hiển thị tính lệch từ ngayCu/ngayMoi.
    const finalDelayLogs = scheduleExtended && project?.ngayHoanThanhDuKienHienTai
      ? [...delayLogs, {
          id: `L${Date.now()}`,
          ngayThayDoi: new Date().toISOString().split('T')[0],
          ngayCu: project.ngayHoanThanhDuKienHienTai,
          ngayMoi: ngayHoanThanhDuKienHienTai,
          soNgayLech: 0,
          lyDo: autoDelayReason.trim(),
          nguoiDuyet: 'Chờ Trưởng phòng duyệt lại',
        } as DelayLog]
      : delayLogs;

    const savedProject: Project = {
      id: (formMode === 'EDIT_ALL' ? project?.id : undefined) || `P${Date.now()}`,
      loaiBanGhi,
      duAnChaId,
      projectId,
      tenDuAn,
      quanLyId,
      quanLyIdsPhu: quanLyIdsPhu.filter(id => id !== quanLyId),
      // Dự án cha KHÔNG gán chuyên viên. Với công việc: chuyên viên tự tổng hợp từ
      // người được giao các việc con (chính = người được giao nhiều nhất).
      thucHienId: loaiBanGhi === 'DU_AN' ? '' : (taskAssignees[0] || thucHienId),
      thucHienIds: loaiBanGhi === 'DU_AN' ? [] : (taskAssignees.length > 0 ? taskAssignees : thucHienIds),
      hangMuc,
      moTa,
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
      delayLogs: finalDelayLogs,
      ngayHoanThanhThucTe: isCompleted ? (ngayHoanThanhThucTe || new Date().toISOString().split('T')[0]) : undefined,
      nguyenNhanTreHan: delayReasonRequired ? nguyenNhanTreHan : undefined,
      trangThai,
      tasks: loaiBanGhi === 'DU_AN' ? [] : tasks, // Dự án cha không có cây công việc (không lên Kanban)
      tpDaDuyet: project?.tpDaDuyet, // Cờ TP duyệt — App quyết định giá trị cuối theo vai trò người lưu
      choDuyetLai: project?.choDuyetLai, // Cờ chờ duyệt lại khi delay — App xóa khi TP lưu
      hanHenCDT: hanHenCDT || undefined,

      oneDriveLink,
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
    <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-100 dark:border-slate-800 shadow-md p-6 max-w-4xl mx-auto" id="project-form-container">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-4 mb-6">
        <div>
          <span className="text-xs bg-brand-accent/10 dark:bg-brand-accent/15 text-brand-accent-700 dark:text-brand-accent-300 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
            {formMode === 'CREATE_TENDER' ? 'Đăng Ký Dự Án Mới (Level 1)' :
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

      <form onSubmit={handleSubmit} className="space-y-6">

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
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                if (errors.selectedProjectId) {
                  setErrors(prev => {
                    const copy = { ...prev };
                    delete copy.selectedProjectId;
                    return copy;
                  });
                }
              }}
              className={`w-full px-3 py-2.5 border rounded-lg text-sm font-bold bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-accent ${
                errors.selectedProjectId ? 'border-brand-danger/50' : 'border-brand-accent/25 dark:border-brand-accent-800'
              }`}
            >
              <option value="">-- Click để chọn Dự án cha --</option>
              {projectsListForSelect.map(p => (
                <option key={p.id} value={p.id}>
                  {p.projectId} - {p.tenDuAn}
                </option>
              ))}
              {projectsListForSelect.length === 0 && (
                <option value="" disabled>Chưa có dự án nào — hãy bấm "Dự án mới" để đăng ký trước</option>
              )}
            </select>
            {errors.selectedProjectId && (
              <span className="text-[11px] text-brand-danger font-bold block">{errors.selectedProjectId}</span>
            )}
            <p className="text-[10px] text-brand-accent dark:text-brand-accent-300 font-semibold italic">
              * Sau khi chọn, hệ thống tự động tải thông số và hiển thị Sơ đồ phân rã công việc chi tiết.
            </p>
          </div>
        )}

        {/* Selected Project Read-only Summary Card in ADD_WORK mode */}
        {formMode === 'ADD_WORK' && selectedProjectId && (
          <div className="bg-slate-50 dark:bg-dark-elevated p-4 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 dark:text-slate-500 block font-bold uppercase tracking-wider text-[9px]">Mã Gói Thầu (Level 1 set)</span>
              <strong className="text-slate-800 dark:text-slate-200 text-sm font-mono font-black">{projectId}</strong>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 block font-bold uppercase tracking-wider text-[9px]">Tên Dự Án (Level 1 set)</span>
              <strong className="text-slate-800 dark:text-slate-200 text-sm block truncate" title={tenDuAn}>{tenDuAn}</strong>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 block font-bold uppercase tracking-wider text-[9px]">Quản lý phụ trách (Level 1 set)</span>
              <strong className="text-slate-800 dark:text-slate-200 text-xs block font-bold">
                {staffList.find(s => s.id === quanLyId)?.hoTen || 'Chưa gán'}
              </strong>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 block font-bold uppercase tracking-wider text-[9px]">Chuyên viên chính (Level 1 set)</span>
              <strong className="text-brand-accent dark:text-brand-accent-300 text-xs block font-bold">
                {staffList.find(s => s.id === thucHienId)?.hoTen || 'Chưa gán'}
              </strong>
            </div>
          </div>
        )}

        {/* Section 1: Thông tin chung */}
        {(formMode === 'CREATE_TENDER' || formMode === 'EDIT_ALL') && (
          <fieldset disabled={infoLocked} className="bg-slate-50/50 dark:bg-dark-card/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4 min-w-0">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-2">
            <span className="w-1.5 h-3 bg-brand-accent rounded-full"></span>
            1. Thông Tin Chung & Quy Mô Gói Thầu
            {infoLocked && <span className="ml-1 normal-case text-[9px] font-bold text-brand-warning dark:text-brand-warning">🔒 Chỉ Trưởng phòng (Level 1) chỉnh sửa</span>}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Project_ID */}
            <div className="md:col-span-3" id="field-projectId">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Mã Project_ID *</label>
              <input 
                type="text"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  if (errors.projectId) setErrors(prev => { const copy = { ...prev }; delete copy.projectId; return copy; });
                }}
                placeholder="2026.01"
                className={`w-full px-3 py-2 border rounded-lg text-sm font-bold text-slate-700 dark:text-slate-100 bg-white dark:bg-dark-elevated uppercase ${errors.projectId ? 'border-brand-danger/50' : 'border-slate-200 dark:border-slate-700'}`}
              />
              {errors.projectId && <span className="text-[10px] text-brand-danger mt-1 block font-medium">{errors.projectId}</span>}
            </div>

            {/* Tên dự án */}
            <div className="md:col-span-9" id="field-tenDuAn">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Tên dự án thầu *</label>
              <input 
                type="text"
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
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Chủ đầu tư (CĐT)</label>
              <input 
                type="text"
                value={chuDauTu}
                onChange={(e) => setChuDauTu(e.target.value)}
                placeholder="VD: Tập đoàn Riverland, PVEP, Vingroup..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 focus:ring-brand-accent"
              />
            </div>

            {/* Địa chỉ dự án */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Địa chỉ dự án / Công trình</label>
              <input 
                type="text"
                value={diaChi}
                onChange={(e) => setDiaChi(e.target.value)}
                placeholder="VD: 36 Nguyễn Cơ Thạch, Quận 2, TP. Hồ Chí Minh..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 focus:ring-brand-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hình thức đấu thầu */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Hình thức đấu thầu</label>
              <select
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
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Tình trạng dự án thực tế</label>
              <select
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
              {/* Quản lý phụ / kế thừa — chọn nhiều; thao tác được như quản lý khi người chính bận */}
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mt-3 mb-1.5">Quản lý phụ / kế thừa <span className="font-normal text-slate-400">(khi người chính bận — chọn nhiều)</span></label>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-dark-elevated max-h-[110px] overflow-y-auto space-y-1 shadow-inner">
                {staffList.filter(s => s.id !== quanLyId).map(s => {
                  const checked = quanLyIdsPhu.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50 dark:hover:bg-dark-card/40 cursor-pointer text-xs">
                      <input type="checkbox" checked={checked} onChange={() => setQuanLyIdsPhu(prev => checked ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                        className="rounded border-slate-300 dark:border-slate-600 accent-brand-primary" />
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{s.hoTen}</span>
                      <span className="text-[10px] text-slate-400">({s.chucVu})</span>
                    </label>
                  );
                })}
                {staffList.filter(s => s.id !== quanLyId).length === 0 && (
                  <p className="text-[11px] text-slate-400 italic px-1.5 py-1">Không còn nhân sự nào để chọn làm quản lý phụ.</p>
                )}
              </div>
              {quanLyIdsPhu.length > 0 && (
                <p className="text-[10px] text-brand-primary dark:text-brand-primary-300 font-bold mt-1">✓ {quanLyIdsPhu.length} quản lý phụ — đều có quyền thao tác như quản lý.</p>
              )}
            </div>

            {/* Nhân sự thực hiện (Lookup Multi-select) — KHÔNG hiện khi tạo/sửa Dự án cha:
                chuyên viên chỉ gán khi tạo CÔNG VIỆC con */}
            {formMode !== 'CREATE_TENDER' && !isParentEdit && (
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                Chuyên viên thực hiện (Multi-select)
              </label>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-dark-elevated max-h-[120px] overflow-y-auto space-y-1.5 shadow-inner">
                {staffList.map(s => {
                  const isSelected = thucHienIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-dark-elevated p-1 rounded transition-colors">
                       <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          let newIds = [];
                          if (e.target.checked) {
                            newIds = [...thucHienIds, s.id];
                          } else {
                            newIds = thucHienIds.filter(id => id !== s.id);
                          }
                          setThucHienIds(newIds);
                          if (newIds.length > 0) {
                            setThucHienId(newIds[0]);
                          }
                        }}
                        className="rounded border-slate-300 dark:border-slate-700 text-brand-accent focus:ring-brand-accent bg-transparent"
                      />
                      {s.avatar ? (
                        <img src={s.avatar} alt={s.hoTen} className="w-4.5 h-4.5 rounded-full object-cover" />
                      ) : (
                        <span className="w-4.5 h-4.5 rounded-full bg-slate-100 dark:bg-dark-elevated flex items-center justify-center text-[8px] font-black text-slate-500 shrink-0">{(s.hoTen || '?').trim().charAt(0).toUpperCase()}</span>
                      )}
                      <span className="font-semibold">{s.hoTen}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">({s.chucVu})</span>
                    </label>
                  );
                })}
              </div>
            </div>
            )}
          </div>
        </fieldset>
        )}

        {/* Section 1.5: Thông tin Phòng Kinh doanh (Chuẩn Template 2) */}
        {(formMode === 'EDIT_ALL' || formMode === 'CREATE_TENDER' || (formMode === 'ADD_WORK' && selectedProjectId)) && (
        <fieldset disabled={infoLocked} className="bg-brand-warning/5 dark:bg-brand-warning/10 p-4 rounded-xl border border-brand-warning/25 dark:border-brand-warning/30 space-y-4 min-w-0">
          <h3 className="text-xs font-bold text-brand-warning dark:text-brand-warning uppercase tracking-wider flex items-center gap-1.5 border-b border-brand-warning/60 dark:border-brand-warning/30 pb-2">
            <span className="w-1.5 h-3 bg-brand-warning rounded-full"></span>
            Thông Tin Gốc Phòng Kinh Doanh
            {infoLocked && <span className="ml-1 normal-case text-[9px] font-bold text-brand-warning dark:text-brand-warning">🔒 Chỉ Trưởng phòng (Level 1) chỉnh sửa</span>}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Quốc tịch */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Quốc tịch CĐT</label>
              <input
                type="text"
                value={quocTich}
                onChange={(e) => setQuocTich(e.target.value)}
                placeholder="Ví dụ: Đài Loan, Việt Nam..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated focus:ring-brand-accent"
              />
            </div>

            {/* Hình thức xây dựng */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Hình thức xây dựng</label>
              <select
                value={hinhThucXayDung}
                onChange={(e) => setHinhThucXayDung(e.target.value as Project['hinhThucXayDung'])}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated focus:ring-brand-accent"
              >
                <option value="Xây mới">Xây mới</option>
                <option value="Cải tạo">Cải tạo</option>
                <option value="Sửa chữa">Sửa chữa</option>
                <option value="Mở rộng">Mở rộng</option>
              </select>
            </div>

            {/* Hồ sơ phát thầu */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Hồ sơ mời thầu thiết kế bởi</label>
              <select
                value={hoSoPhatThau}
                onChange={(e) => setHoSoPhatThau(e.target.value as Project['hoSoPhatThau'])}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated focus:ring-brand-accent"
              >
                <option value="CĐT phát thầu">CĐT phát thầu</option>
                <option value="HP thiết kế">HP thiết kế</option>
                <option value="Đơn vị khác thiết kế">Đơn vị khác thiết kế</option>
              </select>
            </div>

            {/* Diện tích đất */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Diện tích đất (m²)</label>
              <input
                type="number"
                min={0}
                value={dienTichDat > 0 ? dienTichDat : ''}
                onChange={(e) => setDienTichDat(parseFloat(e.target.value) || 0)}
                placeholder="Nhập diện tích m2"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated focus:ring-brand-accent"
              />
            </div>
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

            {/* Mô tả chi tiết nội dung công việc */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Mô tả chi tiết nội dung công việc</label>
              <textarea
                rows={2}
                value={moTa}
                onChange={(e) => setMoTa(e.target.value)}
                placeholder="Phân tích bản vẽ kết cấu, bóc tách cấu kiện móng và dầm sàn tháp B..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:ring-brand-accent bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* OneDrive Link */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-brand-accent" />
                Đường dẫn thư mục hồ sơ đấu thầu (OneDrive Link)
              </label>
              <input 
                type="url"
                value={oneDriveLink}
                onChange={(e) => setOneDriveLink(e.target.value)}
                placeholder="VD: https://onedrive.live.com/redir?resid=..."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:ring-brand-accent bg-white dark:bg-dark-elevated text-slate-800 dark:text-slate-100 font-mono text-xs"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Liên kết OneDrive chứa toàn bộ hồ sơ BVTC, BOQ, và báo giá vật tư của nhà thầu phụ.
              </p>
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

            {/* Hạn nộp CĐT (tự tính = ngày BĐ + tổng 3 chặng) */}
            <div>
              <label className="block text-xs font-bold text-brand-primary dark:text-brand-primary-300 mb-1.5">Hạn nộp CĐT (tự tính)</label>
              <div className="px-3 py-2 bg-brand-primary/10 dark:bg-brand-primary/15 border border-brand-primary/25 dark:border-brand-primary/50 rounded-lg text-sm font-extrabold text-brand-primary-700 dark:text-brand-primary-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {fmtDateVN(ngayHoanThanhDuKienGoc) || 'N/A'}
              </div>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">Ngày BĐ + {soNgayDuKien} ngày (TH {soNgayThucHien} + TP {soNgayDuyetTP})</p>
            </div>

            {/* Hạn hoàn thành hiện tại */}
            <div>
              <label className="block text-xs font-bold text-brand-accent dark:text-brand-accent-300 mb-1.5">Hạn hiện tại (Đã bù lệch)</label>
              <div className="px-3 py-2 bg-brand-accent/10 dark:bg-brand-accent/15 border border-brand-accent/25 dark:border-brand-accent-900 rounded-lg text-sm font-extrabold text-brand-accent-700 dark:text-brand-accent-300 flex items-center gap-1.5 shadow-2xs">
                <Clock className="w-4 h-4" />
                {fmtDateVN(ngayHoanThanhDuKienHienTai) || 'N/A'}
              </div>
              <p className="text-[9px] text-brand-accent dark:text-brand-accent-300 mt-1 font-semibold">Tự động cộng các khoảng dời hạn</p>
            </div>
          </div>

          {/* Timeline 2 chặng: Thực hiện (bộ phận) → TP duyệt → Nộp CĐT (không tính chặng Giám đốc).
              Có thể để trống (0 ngày) khi tạo — Trưởng phòng sẽ nhập thời hạn sau. Quản lý (L2) không sửa được. */}
          <div className="bg-white dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-xl p-3 space-y-3 mt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                Phân bổ thời hạn theo chặng (ra hạn nộp CĐT)
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
              <span className="text-slate-700 dark:text-slate-200">Tổng <b className="text-brand-primary dark:text-brand-primary-300">{soNgayDuKien} ngày</b> → Nộp CĐT: <b className="text-brand-primary dark:text-brand-primary-300">{soNgayDuKien > 0 ? (fmtDateVN(ngayHoanThanhDuKienGoc) || '—') : 'Chưa có'}</b></span>
            </div>
            {/* Thời hạn ĐÃ HẸN với CĐT — mốc cam kết ngoài (nếu có), khác với hạn tự tính ở trên */}
            <div className="flex items-center gap-2 pt-1 border-t border-dashed border-slate-200 dark:border-slate-800">
              <label className="text-[10px] font-bold text-brand-primary-700 dark:text-brand-primary-300 shrink-0">🤝 Thời hạn hẹn CĐT (nếu có):</label>
              <DateInput value={hanHenCDT} disabled={currentUserRole === 'MANAGER'}
                onChange={setHanHenCDT}
                className="w-32 px-2 py-1 border border-brand-primary/25 dark:border-brand-primary/50 rounded-lg text-[11px] font-bold text-brand-primary-700 dark:text-brand-primary-300 bg-brand-primary/5 dark:bg-brand-primary/15 disabled:opacity-60 disabled:cursor-not-allowed" />
              {hanHenCDT && <button type="button" onClick={() => setHanHenCDT('')} className="text-[10px] font-bold text-brand-danger hover:underline">✕ bỏ hẹn</button>}
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
            3. Sơ đồ phân rã công việc &amp; Giao việc đa cấp
          </h3>
          
          {/* Bảng phân rã DUY NHẤT: việc con + tỉ trọng + người giao + ngày bắt đầu + số ngày + thanh Gantt.
              Ngày bắt đầu công việc = min kế hoạch; kết thúc = max kế hoạch → ra số ngày Bộ phận tự động. */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-accent" />
              Lịch trình công việc con &amp; Sơ đồ Gantt (tiến độ Bộ phận tự động gộp: <strong className="text-brand-accent dark:text-brand-accent-300">{tienDoBoPhan}%</strong>)
            </span>
            <SubtaskGantt
              tasks={tasks}
              staff={staffList}
              projectStartDate={ngayBatDau}
              canEdit={currentUserRole === 'BOOD' || currentUserRole === 'MANAGER'}
              isBOOD={currentUserRole === 'BOOD'}
              onChange={setTasks}
            />
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
                  <textarea
                    value={ketQuaPhong}
                    onChange={(e) => setKetQuaPhong(e.target.value)}
                    placeholder="VD: Đã rà soát toàn bộ đơn giá và khối lượng BOQ, hồ sơ đạt yêu cầu trình ký..."
                    className="w-full h-14 p-2 text-xs bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                  />
                ) : (
                  <div className="p-2 bg-white/60 dark:bg-dark-bg/60 border border-slate-200/70 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300 min-h-8 font-medium whitespace-pre-wrap">
                    {ketQuaPhong || <span className="italic text-slate-400">Trưởng phòng chưa nhập kết quả kiểm tra.</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Section 4: Lịch sử dời tiến độ (Delay Logs) — ĐÃ TÍCH HỢP vào luồng cập nhật (tự ghi khi
            Quản lý dời tiến độ), chỉ hiện khi SỬA hồ sơ để xem lịch sử; form khởi tạo không hiển thị */}
        {formMode === 'EDIT_ALL' && !isParentEdit && (
        <div className="bg-slate-50/50 dark:bg-dark-card/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-brand-warning rounded-full"></span>
              4. Lịch Sử Dời Tiến Độ (Delay Logs)
            </h3>
            <button
              type="button"
              onClick={() => setShowAddDelay(!showAddDelay)}
              className="text-xs bg-brand-warning hover:bg-brand-warning/85 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Đăng ký dời tiến độ
            </button>
          </div>

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
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Hạn hoàn thành cũ</label>
                  <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-dark-elevated border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs font-bold">
                    {fmtDateVN(ngayHoanThanhDuKienHienTai)}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Hạn hoàn thành mới *</label>
                  <DateInput
                    value={newDelayNewEnd}
                    onChange={(v) => {
                      setNewDelayNewEnd(v);
                      if (errors.newEnd) setErrors(prev => { const copy = { ...prev }; delete copy.newEnd; return copy; });
                    }}
                    className={`w-full px-2.5 py-1.5 border rounded text-xs font-bold bg-white dark:bg-dark-card text-slate-800 dark:text-slate-100 ${errors.newEnd ? 'border-brand-danger/50' : 'border-slate-200 dark:border-slate-700'}`}
                  />
                  {errors.newEnd && <span className="text-[10px] text-brand-danger block mt-0.5">{errors.newEnd}</span>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Số ngày lệch ước tính</label>
                  <div className="px-2.5 py-1.5 bg-brand-warning/10 dark:bg-brand-warning/10 border border-brand-warning/25 dark:border-brand-warning/30 text-brand-warning dark:text-brand-warning rounded text-xs font-extrabold">
                    {newDelayNewEnd && ngayHoanThanhDuKienHienTai 
                      ? `${getDaysDifference(ngayHoanThanhDuKienHienTai, newDelayNewEnd)} Ngày trễ thêm` 
                      : '0 Ngày'}
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

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Cấp trên phê duyệt ký duyệt *</label>
                  <input 
                    type="text"
                    value={newDelayApprover}
                    onChange={(e) => {
                      setNewDelayApprover(e.target.value);
                      if (errors.approver) setErrors(prev => { const copy = { ...prev }; delete copy.approver; return copy; });
                    }}
                    placeholder="VD: Trưởng phòng Nguyễn Minh Đức"
                    className={`w-full px-2.5 py-1.5 border rounded text-xs font-semibold bg-white dark:bg-dark-card text-slate-800 dark:text-slate-100 ${errors.approver ? 'border-brand-danger/50' : 'border-slate-200 dark:border-slate-700'}`}
                  />
                  {errors.approver && <span className="text-[10px] text-brand-danger block mt-0.5">{errors.approver}</span>}
                </div>
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
            <div className="bg-white dark:bg-dark-bg rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Mobile <768px: Card List thay bảng 7 cột (luật 9) */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {delayLogs.map((log) => (
                  <div key={log.id} className="p-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{fmtDateVN(log.ngayThayDoi)}</span>
                      <span className="font-extrabold text-brand-warning dark:text-brand-warning">+{Math.max(0, getDaysDifference(log.ngayCu, log.ngayMoi))} ngày</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="line-through text-slate-400 dark:text-slate-500">{fmtDateVN(log.ngayCu)}</span>
                      <span aria-hidden="true">→</span>
                      <span className="font-bold text-brand-accent dark:text-brand-accent-300">{fmtDateVN(log.ngayMoi)}</span>
                    </div>
                    <p className="italic text-slate-600 dark:text-slate-300">{log.lyDo}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">Duyệt: {log.nguoiDuyet}</span>
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
                    <th className="p-2">Hạn Cũ</th>
                    <th className="p-2">Hạn Mới</th>
                    <th className="p-2 text-center">Trễ Thêm (Offset)</th>
                    <th className="p-2">Lý Do Đề Xuất</th>
                    <th className="p-2">Người Duyệt</th>
                    <th className="p-2 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-600 dark:text-slate-400">
                  {delayLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-brand-warning/5 dark:hover:bg-brand-warning/10">
                      <td className="p-2">{fmtDateVN(log.ngayThayDoi)}</td>
                      <td className="p-2 line-through text-slate-400 dark:text-slate-500">{fmtDateVN(log.ngayCu)}</td>
                      <td className="p-2 font-bold text-brand-accent dark:text-brand-accent-300">{fmtDateVN(log.ngayMoi)}</td>
                      {/* Số ngày lệch hiển thị tính từ cặp hạn cũ/mới (log tự động có soNgayLech=0 để không cộng trùng offset) */}
                      <td className="p-2 text-center font-extrabold text-brand-warning dark:text-brand-warning">+{Math.max(0, getDaysDifference(log.ngayCu, log.ngayMoi))} ngày</td>
                      <td className="p-2 italic max-w-xs truncate text-slate-600 dark:text-slate-300" title={log.lyDo}>{log.lyDo}</td>
                      <td className="p-2 font-semibold text-slate-700 dark:text-slate-200">{log.nguoiDuyet}</td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveDelayLog(log.id)}
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
          )}
        </div>
        )}

        {/* Section 5: Đóng hồ sơ thầu & Thẩm định KPI trễ hạn — ĐÃ TÍCH HỢP vào Kanban (kéo lên bước 5
            tự chốt ngày & đánh giá theo hẹn CĐT). Chỉ hiện khi SỬA để TP chỉnh tay ngày gửi thật khác ngày kéo thẻ */}
        {formMode === 'EDIT_ALL' && !isParentEdit && (
        <div className="bg-slate-50/50 dark:bg-dark-card/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-2">
            <span className="w-1.5 h-3 bg-brand-accent-700 rounded-full"></span>
            5. Đóng Gói Thầu & Đánh Giá KPI Cuối Kỳ
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
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Tự chốt khi kéo thẻ lên bước 5 (Hồ sơ đã gửi CĐT) — Trưởng phòng sửa tay nếu ngày gửi thật khác ngày kéo thẻ.</p>
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
              <textarea
                rows={3}
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

        {/* Chốt chặn dời tiến độ: Quản lý sửa làm hạn lùi xa hơn → bắt buộc lý do mới cho Lưu */}
        {scheduleExtended && (
          <div id="field-autoDelayReason" className="bg-brand-warning/5 dark:bg-brand-warning/10 border border-brand-warning/40 dark:border-brand-warning/50 rounded-xl p-4 space-y-2">
            <span className="text-xs font-black text-brand-warning dark:text-brand-warning flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Cập nhật này làm TIẾN ĐỘ TỔNG TĂNG THÊM {scheduleExtendDays} ngày ({fmtDateVN(project?.ngayHoanThanhDuKienHienTai)} → {fmtDateVN(ngayHoanThanhDuKienHienTai)})
            </span>
            <p className="text-[10px] text-brand-warning/80 dark:text-brand-warning/80 font-semibold">
              Bắt buộc nhập lý do dời tiến độ — hệ thống sẽ tự ghi vào Lịch Sử Dời Tiến Độ (Delay Logs) và báo Trưởng phòng duyệt lại.
            </p>
            <textarea
              value={autoDelayReason}
              onChange={(e) => {
                setAutoDelayReason(e.target.value);
                if (errors.autoDelayReason) setErrors(prev => { const c = { ...prev }; delete c.autoDelayReason; return c; });
              }}
              rows={2}
              placeholder="Ví dụ: CĐT bổ sung hạng mục MEPF, khối lượng bóc tách tăng 30% so với kế hoạch ban đầu..."
              className="w-full px-3 py-2 border border-brand-warning/40 dark:border-brand-warning/60 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-bg focus:ring-1 focus:ring-brand-warning focus:outline-none"
            />
            {errors.autoDelayReason && <span className="text-[11px] text-brand-danger block font-bold">{errors.autoDelayReason}</span>}
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
