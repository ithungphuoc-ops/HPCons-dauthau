import { useState } from 'react';
import { workflowSteps } from '../data/mockData';
import { Play, ArrowRight, UserCheck, ShieldAlert, Cpu, Trophy } from 'lucide-react';
import { motion } from 'motion/react';

export default function WorkflowViewer() {
  const [activeStep, setActiveStep] = useState<number>(3); // Default to delay offset (step 3)

  const getStepIcon = (id: number) => {
    switch(id) {
      case 1: return <UserCheck className="w-5 h-5 text-brand-accent dark:text-brand-accent-300" />;
      case 2: return <Cpu className="w-5 h-5 text-brand-accent dark:text-brand-accent-300" />;
      case 3: return <ShieldAlert className="w-5 h-5 text-brand-warning animate-pulse" />;
      case 4: return <Play className="w-5 h-5 text-brand-primary" />;
      case 5: return <Trophy className="w-5 h-5 text-brand-accent dark:text-brand-accent-300" />;
      default: return <UserCheck className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStepAutomationRule = (id: number) => {
    switch(id) {
      case 1:
        return {
          trigger: 'Quản lý tạo mới hồ sơ đấu thầu.',
          action: 'Hệ thống tự động cộng dồn Ngày Bắt Đầu + Số Ngày Dự Kiến để thiết lập "Hạn Gốc" (NgayHoanThanhDuKienGoc).',
          output: 'Bản ghi Dự án được lưu với Trạng thái "Đang thực hiện".'
        };
      case 2:
        return {
          trigger: 'Nhân sự thực hiện bóc xong BOQ và kéo thanh tiến độ.',
          action: 'Kích hoạt thông báo duyệt đến tài khoản Quản lý dự án để đối soát Tiến độ Bộ phận và Tiến độ Phòng.',
          output: 'Cập nhật chỉ số KPI sơ bộ dựa trên chất lượng nộp đợt 1.'
        };
      case 3:
        return {
          trigger: 'Quản lý đăng ký một dòng Delay Log mới.',
          action: 'Hệ thống tự động tính [Ngày mới - Ngày cũ] để ra số ngày trễ. Tự động cộng số ngày này vào Hạn Hiện Tại (NgayHoanThanhDuKienHienTai) của cả hai cấp (Bộ phận/Phòng).',
          output: 'Lưu lịch sử dời hạn vào bảng "lich_su_tre" phục vụ hậu kiểm.'
        };
      case 4:
        return {
          trigger: 'Nhân sự bấm "Khóa Hồ Sơ Thầu" và nhập Ngày hoàn thành thực tế.',
          action: 'Hệ thống so sánh Ngày thực tế với Hạn Hiện Tại. Nếu vượt quá, chuyển Trạng thái thành "Hoàn thành trễ hạn".',
          output: 'Nếu trễ hạn, tự động Unhide/Require bắt buộc điền "Ghi chú nguyên nhân trễ hạn".'
        };
      case 5:
        return {
          trigger: 'Đến kỳ chốt KPI và xét thưởng của phòng thầu (cuối tháng/quý).',
          action: 'Hệ thống quét tất cả dự án trễ hạn. Phân tích nguyên nhân: Nếu lỗi chủ quan (phạt trừ điểm KPI chuyên viên); nếu lỗi khách quan (giữ nguyên KPI, bảo lưu quỹ thưởng).',
          output: 'Xuất bảng điểm KPI và đề xuất phân phối Quỹ thưởng theo chất lượng hồ sơ.'
        };
      default:
        return { trigger: '', action: '', output: '' };
    }
  };

  const activeAutomation = getStepAutomationRule(activeStep);

  return (
    <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm" id="workflow-viewer-container">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Cpu className="text-brand-accent dark:text-brand-accent-300 w-4 h-4" />
            QUY TRÌNH NGHIỆP VỤ &amp; LUỒNG TỰ ĐỘNG HÓA (ERP/BPM)
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Bấm vào từng bước bên dưới để xem chi tiết các trigger tự động hóa, điều kiện rẽ nhánh và kết quả đầu ra của hệ thống.
          </p>
        </div>
        <span className="text-[10px] bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300 font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
          BPM Engine
        </span>
      </div>

      {/* Workflow Horizontal Node Flow */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-8 bg-slate-50/50 dark:bg-dark-bg/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 overflow-x-auto animate-in fade-in duration-300">
        {workflowSteps.map((step, idx) => {
          const isActive = activeStep === step.id;
          return (
            <div key={step.id} className="flex items-center gap-2 flex-1 min-w-[150px] last:flex-none">
              <button
                onClick={() => setActiveStep(step.id)}
                className={`flex-1 p-3 rounded-lg border text-left transition-all ${
                  isActive
                    ? 'bg-brand-accent text-white border-brand-accent shadow-md'
                    : 'bg-white dark:bg-dark-bg hover:bg-slate-50 dark:hover:bg-dark-elevated/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    isActive ? 'bg-white text-brand-accent' : 'bg-slate-100 dark:bg-dark-elevated text-slate-600 dark:text-slate-400'
                  }`}>
                    {step.id}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-85">{step.actor}</span>
                </div>
                <h4 className="text-xs font-bold mt-1.5 line-clamp-1">{step.title}</h4>
              </button>
              
              {idx < workflowSteps.length - 1 && (
                <ArrowRight className="w-5 h-5 text-slate-400 hidden md:block flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step details & automation triggers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-dark-bg/40 p-5 rounded-xl border border-slate-100 dark:border-slate-800">
        {/* Left Side: Step Information */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white dark:bg-dark-bg rounded-xl shadow-2xs border border-slate-100 dark:border-slate-800">
              {getStepIcon(activeStep)}
            </div>
            <div>
              <span className="text-[10px] font-bold text-brand-accent dark:text-brand-accent-300 uppercase tracking-wider">BƯỚC {activeStep}</span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {workflowSteps.find(s => s.id === activeStep)?.title}
              </h3>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            {workflowSteps.find(s => s.id === activeStep)?.description}
          </p>

          <div className="mt-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vai trò đảm nhiệm:</span>
            <div className="inline-block bg-white dark:bg-dark-elevated border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
              {workflowSteps.find(s => s.id === activeStep)?.actor}
            </div>
          </div>
        </div>

        {/* Right Side: Smart automation engine */}
        <div className="bg-white dark:bg-dark-bg p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col gap-4">
          <h4 className="text-xs font-bold text-brand-accent dark:text-brand-accent-300 uppercase tracking-wider border-b border-brand-accent/20 pb-2 flex items-center gap-1.5">
            <Cpu className="w-4 h-4" />
            Động Cơ Tự Động Hóa Hệ Thống (BPM Engine)
          </h4>

          <div className="space-y-3.5">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">1. SỰ KIỆN KÍCH HOẠT (TRIGGER)</span>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold mt-0.5">{activeAutomation.trigger}</p>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">2. HÀNH ĐỘNG TỰ ĐỘNG (SYSTEM ACTION)</span>
              <p className="text-xs text-brand-primary font-semibold mt-0.5 bg-brand-primary/10 p-2 rounded border border-brand-primary/20">
                {activeAutomation.action}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">3. KẾT QUẢ ĐẦU RA (OUTPUT)</span>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">{activeAutomation.output}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
