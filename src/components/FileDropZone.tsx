import React, { useState, useRef } from 'react';

interface FileDropZoneProps {
  onFiles: (files: File[]) => void;   // Trả về danh sách file hợp lệ (dưới giới hạn dung lượng)
  inputId: string;                    // id riêng cho input ẩn (tránh trùng khi có nhiều ô)
  label?: string;                     // Nhãn nút khi chưa kéo
  accept?: string;                    // Định dạng cho phép
  className?: string;                 // Class tùy biến cho vùng thả
  multiple?: boolean;                 // Cho phép chọn / kéo-thả nhiều file cùng lúc
  maxSizeMB?: number;                 // Giới hạn dung lượng mỗi file (mặc định 25MB)
  oversizeHint?: string;              // Gợi ý khi file vượt giới hạn (tùy ngữ cảnh)
}

// Vùng đính kèm tệp có hỗ trợ KÉO-THẢ nhiều file: bấm để chọn HOẶC kéo file thả vào ô.
// Mỗi file giới hạn dưới maxSizeMB (mặc định 25MB) để tránh làm nặng hệ thống — file lớn hơn
// bị bỏ qua kèm cảnh báo yêu cầu gửi đường link. Chỉ lấy tên file (file.name), không đổi cấu trúc dữ liệu.
export default function FileDropZone({
  onFiles,
  inputId,
  label = '📤 Đính kèm tệp báo cáo',
  accept,
  className = '',
  multiple = false,
  maxSizeMB = 25,
  oversizeHint = 'Vui lòng gửi ĐƯỜNG LINK tệp thay vì tải trực tiếp để tránh làm nặng hệ thống.',
}: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [warning, setWarning] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = (list: FileList | null) => {
    if (!list || !list.length) return;
    const files = Array.from(list);
    const limit = maxSizeMB * 1024 * 1024;
    const ok = files.filter((f) => f.size <= limit);
    const tooBig = files.filter((f) => f.size > limit);
    if (tooBig.length) {
      const names = tooBig.map((f) => `"${f.name}" (${(f.size / 1024 / 1024).toFixed(1)}MB)`).join(', ');
      setWarning(`⚠ ${tooBig.length} tệp vượt quá ${maxSizeMB}MB: ${names}. ${oversizeHint}`);
    } else {
      setWarning('');
    }
    if (ok.length) onFiles(ok);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-1.5">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (!dragOver) setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
        onDrop={handleDrop}
        className={`w-full py-1.5 px-3 rounded-lg text-[10px] font-black transition-colors cursor-pointer text-center border border-dashed ${
          dragOver
            ? 'bg-brand-primary/15 dark:bg-brand-primary/15 border-brand-primary text-brand-primary-800 dark:text-brand-primary-300 ring-1 ring-brand-primary-400'
            : 'bg-white dark:bg-dark-bg hover:bg-brand-primary/10 dark:hover:bg-brand-primary/15 border-brand-primary/40 dark:border-brand-primary-800 text-brand-primary-700 dark:text-brand-primary-300'
        } ${className}`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { processFiles(e.target.files); e.target.value = ''; }}
        />
        {dragOver ? `📥 Thả tệp vào đây${multiple ? ' (có thể nhiều tệp)' : ''}` : label}
      </div>
      {warning && (
        <div className="text-[10px] font-bold text-brand-danger dark:text-brand-danger bg-brand-danger/10 dark:bg-brand-danger/10 border border-brand-danger/25 dark:border-brand-danger/40 rounded-lg px-2 py-1.5 flex items-start justify-between gap-2">
          <span className="flex-1">{warning}</span>
          <button type="button" onClick={() => setWarning('')} className="shrink-0 text-brand-danger hover:text-brand-danger uppercase">✕</button>
        </div>
      )}
    </div>
  );
}
