import { useState, useEffect } from 'react';

// Ô nhập ngày dùng chung cho TOÀN app, hiển thị kiểu Việt Nam DD-MM-YYYY.
// Lý do không dùng <input type="date"> native: ô ngày native luôn hiển thị theo ngôn ngữ
// trình duyệt/hệ điều hành (máy Anh-Mỹ → MM/DD/YYYY), không ép được về DD-MM-YYYY.
// Ô này là <input type="text"> tự parse nên hiển thị nhất quán ở mọi máy.
//
// Giá trị VÀO/RA vẫn là ISO "YYYY-MM-DD" (hoặc '') — khớp với dữ liệu lưu trữ.

// ISO "2026-07-12" → hiển thị "12-07-2026" (thao tác chuỗi thuần, không qua Date để khỏi lệch múi giờ)
const isoToVN = (iso?: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

// Người dùng gõ "12-07-2026" / "12/7/2026" → ISO "2026-07-12". Trả null nếu không hợp lệ.
const vnToISO = (s: string): string | null => {
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s.trim());
  if (!m) return null;
  const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
  if (y < 1900 || y > 2200) return null;
  const dt = new Date(y, mo - 1, d);
  // Chặn ngày không tồn tại (vd 31-02): Date sẽ tự nhảy sang tháng sau
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

interface DateInputProps {
  value: string;                    // ISO "YYYY-MM-DD" hoặc ''
  onChange: (iso: string) => void;  // Trả ISO (hoặc '' khi để trống)
  disabled?: boolean;
  className?: string;
  title?: string;
  id?: string;
  placeholder?: string;
}

export default function DateInput({ value, onChange, disabled, className = '', title, id, placeholder = 'dd-mm-yyyy' }: DateInputProps) {
  // Giữ chuỗi đang gõ cục bộ, chỉ commit khi rời ô (blur) / nhấn Enter — tránh năm gõ dở bị hiểu sai.
  const [draft, setDraft] = useState(isoToVN(value));
  useEffect(() => { setDraft(isoToVN(value)); }, [value]);

  const commit = () => {
    const t = draft.trim();
    if (t === '') { if (value) onChange(''); return; }
    const iso = vnToISO(t);
    if (iso) { if (iso !== value) onChange(iso); setDraft(isoToVN(iso)); }
    else setDraft(isoToVN(value)); // gõ sai → khôi phục giá trị cũ
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      id={id}
      value={draft}
      disabled={disabled}
      title={title}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      className={className}
    />
  );
}
