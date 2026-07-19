import { useState } from 'react';
import { ProjectTask } from '../types';
import FileDropZone from './FileDropZone';
import { parseAttachments, joinAttachments } from '../utils/attachments';

interface StaffTaskResultPanelProps {
  task: ProjectTask;
  onSave: (patch: Partial<ProjectTask>) => void;
  onClose: () => void;
}

// Inline editor: work result, % progress, attachment, delay note
export default function StaffTaskResultPanel({ task, onSave, onClose }: StaffTaskResultPanelProps) {
  const [ketQua, setKetQua] = useState(task.ketQuaCongViec || '');
  const [progress, setProgress] = useState<number>(task.staffProgress ?? (task.isCompleted ? 100 : 0));
  const [delayNote, setDelayNote] = useState(task.overdueReason || '');
  const [files, setFiles] = useState<string[]>(parseAttachments(task.taiLieuDinhKem));
  const [saveError, setSaveError] = useState('');

  const handleSave = () => {
    // Quy tắc hoàn thành: phải có kết quả công việc mới được chốt 100% / done
    if (progress >= 100 && !ketQua.trim()) {
      setSaveError('Cần nhập kết quả công việc trước khi chốt tiến độ 100% hoàn thành!');
      return;
    }
    // NOTE: never send isCompleted:false here — updateTaskInTree treats any isCompleted
    // key as a completion cascade and would reset staffProgress back to 0.
    // Let the staffProgress branch derive completion; only force-complete at 100%.
    const patch: Partial<ProjectTask> = {
      ketQuaCongViec: ketQua.trim() || undefined,
      staffProgress: progress,
      overdueReason: delayNote.trim() || undefined,
      taiLieuDinhKem: joinAttachments(files)
    };
    if (progress >= 100) {
      patch.isCompleted = true;
      patch.completedAt = new Date().toISOString().split('T')[0];
    }
    onSave(patch);
    onClose();
  };

  return (
    <div className="mt-2 mb-3 bg-brand-primary/5 dark:bg-brand-primary/[0.03] border border-brand-primary/60 dark:border-brand-primary/40 rounded-xl p-3.5 space-y-3 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-brand-primary-700 dark:text-brand-primary-300 uppercase tracking-wider flex items-center gap-1.5">
          <span className="flex h-2 w-2 rounded-full bg-brand-primary animate-pulse"></span>
          KẾT QUẢ CÔNG VIỆC
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold uppercase"
        >
          Đóng ✕
        </button>
      </div>

      {/* % progress slider */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] font-bold">
          <span className="text-slate-700 dark:text-slate-300">Tiến độ thực hiện của bạn</span>
          <span className="text-brand-accent dark:text-brand-accent-300">{progress}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={progress}
          onChange={(e) => setProgress(parseInt(e.target.value))}
          className="w-full h-1.5 bg-slate-100 dark:bg-dark-elevated rounded-lg appearance-none cursor-pointer accent-brand-accent"
        />
        <div className="flex justify-between text-[9px] text-slate-400">
          <span>Chưa bắt đầu</span>
          <span>Kéo đến 100% (kèm kết quả bên dưới) sẽ tự đánh dấu hoàn thành</span>
        </div>
      </div>

      {saveError && (
        <div className="bg-brand-danger/10 dark:bg-brand-danger/10 text-brand-danger dark:text-brand-danger text-[11px] font-bold px-3 py-2 rounded-lg border border-brand-danger/25 dark:border-brand-danger/40">
          ⚠ {saveError}
        </div>
      )}

      {/* Work result text */}
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
          Cập nhật kết quả công việc (tóm tắt sản phẩm, link tài liệu...):
        </span>
        <textarea
          value={ketQua}
          onChange={(e) => { setKetQua(e.target.value); if (saveError) setSaveError(''); }}
          placeholder="Ví dụ: Đã bóc xong khối lượng phần ngầm, file BOQ đính kèm bên dưới..."
          className="w-full h-16 p-2 text-xs bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Attachment */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Tài liệu đính kèm (nhiều tệp, mỗi tệp &lt; 25MB):</span>
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((name, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 bg-brand-primary/10 dark:bg-brand-primary/15 border border-brand-primary/15 dark:border-brand-primary/50 rounded-lg text-xs">
                  <span className="font-bold truncate text-brand-primary-800 dark:text-brand-primary-300" title={name}>📎 {name}</span>
                  <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-brand-danger hover:text-brand-danger text-[10px] font-extrabold ml-1 uppercase shrink-0">Xóa</button>
                </div>
              ))}
            </div>
          )}
          <FileDropZone
            inputId={`staff-file-${task.id}`}
            label={files.length ? '➕ Thêm / kéo-thả tệp khác' : '📤 Đính kèm / kéo-thả tệp báo cáo'}
            multiple
            maxSizeMB={25}
            oversizeHint="Hãy dán ĐƯỜNG LINK tệp vào ô 'Cập nhật kết quả công việc' bên trên để tránh làm nặng hệ thống."
            onFiles={(fs) => {
              const names = fs.map((f) => f.name);
              setFiles((prev) => [...prev, ...names.filter((n) => !prev.includes(n))]);
            }}
          />
        </div>

        {/* Delay note */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Nếu cần dời tiến độ — ghi rõ nguyên nhân:</span>
          <input
            type="text"
            value={delayNote}
            onChange={(e) => setDelayNote(e.target.value)}
            placeholder="VD: CĐT bổ sung bản vẽ, chờ báo giá vật tư..."
            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-dark-bg border border-brand-warning/25 dark:border-brand-warning/50 rounded-lg font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-warning"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-elevated rounded-lg transition-colors"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-[11px] font-black transition-colors"
        >
          💾 Cập nhật kết quả
        </button>
      </div>
    </div>
  );
}
