import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Layers, 
  DollarSign, 
  CheckSquare, 
  Award, 
  ArrowRight, 
  ChevronRight, 
  Zap, 
  Clock, 
  ShieldAlert,
  UserCheck
} from 'lucide-react';

interface MindmapNode {
  id: string;
  title: string;
  role: string;
  level: string;
  description: string;
  inputs: string[];
  outputs: string[];
  triggers: string[];
  color: string;
  bgLight: string;
  bgDark: string;
  borderColor: string;
  icon: React.ComponentType<any>;
}

export default function TenderMindmap() {
  const [activeNode, setActiveNode] = useState<string>('node1');

  const nodes: MindmapNode[] = [
    {
      id: 'node1',
      title: '1. Khởi Tạo & Giao Việc',
      role: 'Trưởng phòng (BOOD)',
      level: 'Level 1',
      description: 'Tiếp nhận thông tin hồ sơ mời thầu, thiết lập danh mục gói thầu mới, tính toán thời hạn định mức gốc và giao cho Quản lý & Chuyên viên phụ trách.',
      inputs: ['Hồ sơ mời thầu (HSMT)', 'Bản vẽ cơ sở & Chỉ dẫn kĩ thuật'],
      outputs: ['Khai báo gói thầu mới', 'Hạn hoàn thành gốc (Baseline Deadline)'],
      triggers: ['Hệ thống tự động ghi nhận ngày giao thầu', 'Tạo tài khoản & phân quyền truy cập'],
      color: 'text-brand-accent dark:text-brand-accent-300',
      bgLight: 'bg-brand-accent/5',
      bgDark: 'dark:bg-brand-accent/10',
      borderColor: 'border-brand-accent/20',
      icon: FileText
    },
    {
      id: 'node2',
      title: '2. Bóc Tách Khối Lượng BOQ',
      role: 'Chuyên viên (STAFF)',
      level: 'Level 3',
      description: 'Thực hiện bóc tách chi tiết khối lượng bản vẽ Kiến trúc, Kết cấu, MEPF. Đây là cơ sở cốt lõi để áp đơn giá thầu.',
      inputs: ['Bản vẽ thiết kế thi công', 'Tiêu chuẩn nghiệm thu kỹ thuật'],
      outputs: ['Bảng khối lượng BOQ thô', 'Báo cáo sai lệch khối lượng'],
      triggers: ['Cập nhật % tiến độ bóc BOQ thô', 'Hệ thống tự động tính tỉ trọng (40%)'],
      color: 'text-brand-accent dark:text-brand-accent-300',
      bgLight: 'bg-brand-accent/5',
      bgDark: 'dark:bg-brand-accent/10',
      borderColor: 'border-brand-accent/20',
      icon: Layers
    },
    {
      id: 'node3',
      title: '3. Áp Giá & Lập Dự Toán',
      role: 'Chuyên viên (STAFF)',
      level: 'Level 3',
      description: 'Tra cứu giá vật tư thị trường, làm việc với các nhà cung cấp phụ phụ trợ để áp giá đơn bản thô, tính toán chi phí gián tiếp và lợi nhuận định biên.',
      inputs: ['Bảng BOQ đã bóc tách', 'Báo giá của nhà cung cấp/vật tư'],
      outputs: ['Bản tính giá thầu dự thảo', 'Bảng đơn giá chi tiết'],
      triggers: ['Cập nhật % tiến độ áp giá dự toán', 'Tự động tính tỉ trọng (35%)'],
      color: 'text-brand-warning',
      bgLight: 'bg-brand-warning/5',
      bgDark: 'dark:bg-brand-warning/10',
      borderColor: 'border-brand-warning/20',
      icon: DollarSign
    },
    {
      id: 'node4',
      title: '4. Thẩm Định & Duyệt Giá',
      role: 'Quản lý nhóm (MANAGER)',
      level: 'Level 2',
      description: 'Kiểm tra chéo khối lượng thầu, thẩm định biên lợi nhuận rủi ro, duyệt đơn giá thầu cuối cùng trước khi trình Trưởng phòng phê duyệt xuất hồ sơ.',
      inputs: ['File dự toán dự thảo', 'Tờ trình phê duyệt giá thầu'],
      outputs: ['Hồ sơ giá thầu hoàn chỉnh', 'Biên bản thẩm định nội bộ'],
      triggers: ['Quản lý ký duyệt/điều chỉnh tiến độ', 'Cho phép dời hạn thầu kèm Ghi chú giải trình'],
      color: 'text-brand-success',
      bgLight: 'bg-brand-success/5',
      bgDark: 'dark:bg-brand-success/10',
      borderColor: 'border-brand-success/20',
      icon: CheckSquare
    },
    {
      id: 'node5',
      title: '5. Đóng Thầu & Đánh Giá KPI',
      role: 'Hệ thống HP CONS (BPM)',
      level: 'Tự động hóa',
      description: 'Hồ sơ được nộp cho chủ đầu tư. Hệ thống đóng hồ sơ thầu, so sánh ngày nộp thực tế với hạn gốc và tự động đánh giá xếp hạng điểm KPI nhân sự.',
      inputs: ['Hồ sơ đấu thầu chính thức', 'Ngày hoàn thành thực tế'],
      outputs: ['Báo cáo KPI tự động cập nhật', 'Log lịch sử chậm trễ (Delay Logs)'],
      triggers: ['Thưởng điểm KPI nếu nộp đúng hạn', 'Trừ điểm KPI theo ngày trễ hạn thực tế'],
      color: 'text-brand-danger',
      bgLight: 'bg-brand-danger/5',
      bgDark: 'dark:bg-brand-danger/10',
      borderColor: 'border-brand-danger/20',
      icon: Award
    }
  ];

  return (
    <div className="bg-white dark:bg-dark-card p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm" id="mindmap-container">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Quy trình khép kín 5 bước phối hợp liên thông từ Trưởng phòng, Quản lý nhóm đến Chuyên viên. Nhấn vào từng bước để xem chi tiết luồng dữ liệu &amp; trigger tự động hóa.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] bg-slate-100 dark:bg-dark-elevated text-slate-600 dark:text-slate-400 font-extrabold px-2.5 py-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-brand-warning fill-brand-warning/10" />
            Báo cáo chụp màn hình 1-view cho Ban Giám Đốc (BGĐ)
          </span>
        </div>
      </div>

      {/* Grid Layout: Top is the 5-node timeline, Bottom is the detail panel */}
      <div className="space-y-6">
        {/* Horizontal flow line of nodes */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
          {nodes.map((node, index) => {
            const Icon = node.icon;
            const isActive = activeNode === node.id;
            return (
              <div key={node.id} className="relative flex flex-col items-center">
                {/* Connecting arrow lines for desktop screens */}
                {index < nodes.length - 1 && (
                  <div className="hidden sm:block absolute top-7 left-[60%] w-[80%] h-0.5 border-t border-dashed border-slate-200 dark:border-slate-800 z-0 pointer-events-none" />
                )}
                
                <button
                  onClick={() => setActiveNode(node.id)}
                  className={`w-full z-10 p-4 rounded-xl text-left border transition-all duration-300 relative ${
                    isActive
                      ? `ring-2 ring-offset-2 ring-brand-accent/50 dark:ring-offset-slate-900 border-brand-accent bg-slate-50 dark:bg-dark-elevated/60 shadow-md scale-[1.02]`
                      : `border-slate-200/60 dark:border-slate-800 bg-white dark:bg-dark-bg/40 hover:border-slate-300 dark:hover:border-slate-700 hover:scale-[1.01] cursor-pointer`
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-brand-accent text-white' : 'bg-slate-100 dark:bg-dark-elevated text-slate-500'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-elevated text-slate-600 dark:text-slate-400">
                      {node.level}
                    </span>
                  </div>
                  
                  <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-100 line-clamp-1">
                    {node.title}
                  </h4>
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5 truncate">
                    {node.role}
                  </p>
                  
                  {isActive && (
                    <span className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-3 h-3 bg-brand-accent rotate-45 hidden sm:block z-0" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Selected Node Details Display (The Smart Mindmap Mind Board) */}
        {(() => {
          const selected = nodes.find(n => n.id === activeNode);
          if (!selected) return null;
          const SelectedIcon = selected.icon;
          return (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-5 rounded-xl border ${selected.bgLight} ${selected.bgDark} ${selected.borderColor} grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-5`}
            >
              {/* Left Detail Summary */}
              <div className="xl:col-span-4 space-y-3 xl:border-r border-slate-200/50 dark:border-slate-800/80 xl:pr-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg bg-white dark:bg-dark-card border border-slate-200/60 dark:border-slate-800 ${selected.color}`}>
                    <SelectedIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-black text-brand-accent dark:text-brand-accent-300 block tracking-wider">
                      {selected.role} • {selected.level}
                    </span>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {selected.title}
                    </h4>
                  </div>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
                  {selected.description}
                </p>
              </div>

              {/* Middle Data Pipelines (Inputs/Outputs) */}
              <div className="xl:col-span-4 space-y-3 xl:border-r border-slate-200/50 dark:border-slate-800/80 xl:pr-4">
                <div>
                  <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider mb-1.5">
                    📥 Dữ liệu đầu vào (Inputs)
                  </span>
                  <div className="space-y-1">
                    {selected.inputs.map((inp, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-700 dark:text-slate-300 font-bold bg-white/40 dark:bg-dark-card/30 px-2 py-1 rounded-md border border-slate-200/20 dark:border-slate-800/20">
                        <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                        {inp}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider mb-1.5">
                    📤 Sản phẩm đầu ra (Outputs)
                  </span>
                  <div className="space-y-1">
                    {selected.outputs.map((out, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-700 dark:text-slate-300 font-bold bg-white/40 dark:bg-dark-card/30 px-2 py-1 rounded-md border border-slate-200/20 dark:border-slate-800/20">
                        <ArrowRight className="w-3 h-3 text-brand-primary shrink-0" />
                        {out}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Trigger & Automation Actions */}
              <div className="xl:col-span-4 space-y-2">
                <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider">
                  ⚙️ Các trigger &amp; logic hệ thống (Smart Triggers)
                </span>
                <div className="space-y-2">
                  {selected.triggers.map((trig, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-brand-accent/5 border border-brand-accent/20 p-2.5 rounded-lg">
                      <Zap className="w-3.5 h-3.5 text-brand-warning shrink-0 mt-0.5 fill-brand-warning/10" />
                      <div>
                        <p className="text-[9.5px] font-extrabold text-slate-800 dark:text-slate-200 leading-tight">
                          Trigger #{idx + 1}
                        </p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          {trig}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* Dynamic connection pipeline notes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-dark-bg p-3.5 rounded-xl border border-slate-200/40 dark:border-slate-800/50">
          <div className="flex gap-2 items-start">
            <Clock className="w-4 h-4 text-brand-accent dark:text-brand-accent-300 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase">
                Bảo vệ thời hạn (Auto-Offset)
              </h5>
              <p className="text-[9px] text-slate-500 mt-0.5">
                Khi quản lý dời hạn thầu, hệ thống tự động cộng dồn số ngày trễ vào toàn bộ tiến độ phòng và gửi email cảnh báo tự động.
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-start">
            <ShieldAlert className="w-4 h-4 text-brand-danger shrink-0 mt-0.5" />
            <div>
              <h5 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase">
                Giải trình nguyên nhân trễ
              </h5>
              <p className="text-[9px] text-slate-500 mt-0.5">
                Bắt buộc điền nguyên nhân dời lịch ngay trong Webform nếu phát hiện nộp muộn hơn hạn gốc để phục vụ hội đồng hậu kiểm KPI.
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-start">
            <UserCheck className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
            <div>
              <h5 className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase">
                Xếp hạng &amp; Đồng bộ KPI
              </h5>
              <p className="text-[9px] text-slate-500 mt-0.5">
                Điểm hiệu suất được tính tự động từ ngày nộp thực tế thầu thầu đối chiếu hạn thầu định mức gốc, kết nối trực tiếp bảng lương.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
