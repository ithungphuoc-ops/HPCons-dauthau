// Hiển thị đoạn văn bản tự do và TỰ NHẬN DIỆN ĐƯỜNG LINK thành liên kết bấm được
// (chị Trâm chốt 26/07/2026: dán link thư mục triển khai của team vào ô mô tả / ghi chú thì
// phải bấm mở được luôn, không phải copy tay).
//
// Nhận cả 3 dạng hay dùng trong hồ sơ thầu:
//   • https://... hoặc http://...
//   • www....
//   • đường dẫn thư mục nội bộ \\server\thau\... (hiện dạng liên kết nhưng KHÔNG bấm được —
//     trình duyệt chặn mở file:// từ trang web, nên chỉ tô màu để dễ nhìn & bôi đen copy)
//
// Văn bản luôn xuống dòng đầy đủ (whitespace-pre-wrap + break-words), KHÔNG cắt bớt.

const MAU_LINK = /((?:https?:\/\/|www\.)[^\s<>"')]+[^\s<>"').,;:!?]|\\\\[^\s<>"']+)/gi;

export default function TextWithLinks({ text, className = '' }: { text: string; className?: string }) {
  const phan = text.split(MAU_LINK);
  return (
    <span className={`whitespace-pre-wrap break-words ${className}`}>
      {phan.map((doan, i) => {
        if (!doan) return null;
        // Đường dẫn thư mục nội bộ: chỉ tô màu, không tạo thẻ <a> (trình duyệt chặn mở)
        if (doan.startsWith('\\\\')) {
          return (
            <span key={i} className="font-mono text-brand-accent dark:text-brand-accent-300" title="Đường dẫn thư mục nội bộ — bôi đen để sao chép">
              {doan}
            </span>
          );
        }
        if (/^(https?:\/\/|www\.)/i.test(doan)) {
          const href = doan.startsWith('www.') ? `https://${doan}` : doan;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand-accent dark:text-brand-accent-300 font-bold underline underline-offset-2 hover:opacity-80 break-all"
              title={`Mở liên kết: ${href}`}
            >
              {doan}
            </a>
          );
        }
        return <span key={i}>{doan}</span>;
      })}
    </span>
  );
}
