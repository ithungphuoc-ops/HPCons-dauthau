import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { tinhViTriBangNoi } from '../utils/viTriBangNoi';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { nowVN } from '../utils/dateVN';

// Ô nhập ngày dùng chung cho TOÀN app, hiển thị kiểu Việt Nam DD-MM-YYYY.
// Lý do không dùng <input type="date"> native: ô ngày native luôn hiển thị theo ngôn ngữ
// trình duyệt/hệ điều hành (máy Anh-Mỹ → MM/DD/YYYY), không ép được về DD-MM-YYYY.
// Ô này là <input type="text"> tự parse nên hiển thị nhất quán ở mọi máy.
//
// Giá trị VÀO/RA vẫn là ISO "YYYY-MM-DD" (hoặc '') — khớp với dữ liệu lưu trữ.
//
// ===== LỊCH CHỌN NGÀY (chị Trâm yêu cầu 17/08/2026 — góp ý #6: "Thêm lịch trong quá trình chọn
// ngày thực hiện đỡ gõ tay") =====
// Vẫn GÕ TAY được như cũ; thêm nút lịch bên cạnh để bấm chọn. Lịch tự dựng (không dùng ô native)
// để giữ đúng thứ tự DD-MM-YYYY và tuần bắt đầu từ THỨ HAI theo lịch Việt Nam.

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

/** Ghép ISO từ 3 số, KHÔNG qua Date để không lệch múi giờ. */
const ghepISO = (y: number, m0: number, d: number): string =>
  `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const TEN_THANG = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
// Tuần bắt đầu từ THỨ HAI (lịch Việt Nam), không phải Chủ nhật như mặc định của JS
const TEN_THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

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

  const [moLich, setMoLich] = useState(false);
  const boc = useRef<HTMLSpanElement>(null);
  const hopLich = useRef<HTMLDivElement>(null);

  // ===== LỊCH PHẢI NỔI RA NGOÀI KHUNG CHỨA (chị Trâm báo 17/08/2026, kèm ảnh) =====
  // Trước đây lịch là <div absolute> nằm TRONG ô nhập, nên khi ô nhập ở trong bảng có cuộn ngang
  // (bảng phân rã việc con) hay trong khung có chiều cao giới hạn, lịch bị CẮT — hiện ra nửa
  // cuốn lịch và không bấm vào ngày được. Nay lịch được đưa ra thẳng <body> qua portal và định vị
  // bằng position: fixed theo đúng vị trí ô nhập, nên không khung nào cắt được nữa.
  const RONG_LICH = 240;   // = w-60
  const CAO_LICH = 312;    // đủ cho 6 hàng ngày + thanh lật tháng + 2 lối tắt
  const [viTri, setViTri] = useState<{ top: number; left: number } | null>(null);
  const nutLich = useRef<HTMLButtonElement | null>(null);

  // LUẬT CHUNG cho mọi bảng xổ ra (chị Trâm chốt 18/08/2026): xổ SÁT BÊN PHẢI biểu tượng, hết chỗ thì
  // lật sang bên trái, và KHÔNG BAO GIỜ đè lên biểu tượng. Xem utils/viTriBangNoi.ts.
  // Neo vào NÚT LỊCH (biểu tượng vừa bấm) chứ không neo cả ô nhập — neo cả ô thì lịch bị đẩy xa,
  // đúng chỗ chị Trâm khoanh đỏ.
  const tinhViTri = useCallback(() => {
    const o = (nutLich.current || boc.current)?.getBoundingClientRect();
    if (!o) return;
    setViTri(tinhViTriBangNoi(o, RONG_LICH, CAO_LICH));
  }, []);

  // Mở lịch → tính vị trí; cuộn/đổi cỡ cửa sổ trong lúc đang mở → tính lại để lịch dính theo ô.
  // Bắt sự kiện cuộn ở pha capture để nhận cả cuộn của khung bên trong (bảng việc con cuộn ngang).
  useEffect(() => {
    if (!moLich) { setViTri(null); return; }
    tinhViTri();
    const lai = () => tinhViTri();
    window.addEventListener('scroll', lai, true);
    window.addEventListener('resize', lai);
    return () => {
      window.removeEventListener('scroll', lai, true);
      window.removeEventListener('resize', lai);
    };
  }, [moLich, tinhViTri]);

  // Tháng đang xem trên lịch: theo giá trị đang có; chưa có gì thì lấy tháng hiện tại (giờ VN).
  const thangCuaGiaTri = () => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
    if (m) return { y: parseInt(m[1], 10), m0: parseInt(m[2], 10) - 1 };
    const h = nowVN();
    return { y: h.getFullYear(), m0: h.getMonth() };
  };
  const [thangXem, setThangXem] = useState(thangCuaGiaTri);
  // Mở lịch ra là nhảy về tháng của giá trị đang chọn, không giữ tháng đã lật lần trước.
  useEffect(() => { if (moLich) setThangXem(thangCuaGiaTri()); }, [moLich, value]);

  // Bấm ra ngoài thì đóng lịch
  useEffect(() => {
    if (!moLich) return;
    // Lịch nằm ngoài cây DOM của ô nhập (portal) nên phải xét CẢ hai vùng, nếu không bấm vào
    // chính cuốn lịch cũng bị coi là "bấm ra ngoài" và lịch tự đóng.
    const ngoai = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boc.current?.contains(t) || hopLich.current?.contains(t)) return;
      setMoLich(false);
    };
    document.addEventListener('mousedown', ngoai);
    return () => document.removeEventListener('mousedown', ngoai);
  }, [moLich]);

  const commit = () => {
    const t = draft.trim();
    if (t === '') { if (value) onChange(''); return; }
    const iso = vnToISO(t);
    if (iso) { if (iso !== value) onChange(iso); setDraft(isoToVN(iso)); }
    else setDraft(isoToVN(value)); // gõ sai → khôi phục giá trị cũ
  };

  const chonNgay = (iso: string) => {
    if (iso !== value) onChange(iso);
    setDraft(isoToVN(iso));
    setMoLich(false);
  };

  const latThang = (buoc: number) => setThangXem(({ y, m0 }) => {
    const t = m0 + buoc;
    return { y: y + Math.floor(t / 12), m0: ((t % 12) + 12) % 12 };
  });

  // Dựng lưới ngày của tháng đang xem
  const soNgayTrongThang = new Date(thangXem.y, thangXem.m0 + 1, 0).getDate();
  const thuCuaNgay1 = new Date(thangXem.y, thangXem.m0, 1).getDay(); // 0 = Chủ nhật
  const oTrong = (thuCuaNgay1 + 6) % 7;                              // dịch để Thứ Hai đứng đầu
  const homNay = nowVN();
  const isoHomNay = ghepISO(homNay.getFullYear(), homNay.getMonth(), homNay.getDate());

  // ===== NÚT LỊCH KHÔNG ĐƯỢC ĐÈ LÊN NGÀY (chị Trâm báo 18/08/2026) =====
  // Ô nhập và nút lịch nằm cạnh nhau trong một `inline-flex`. Chỗ nào truyền `w-full` (ô ngày trong
  // bảng phân rã việc con) thì ô nhập chiếm 100% bề rộng của span, không còn chỗ cho nút → nút bị
  // đẩy tràn ra và nằm ĐÈ lên chữ ngày, chữ "18-08-2026" bị cắt còn "18-08-2".
  // Cách chữa: nhận ra `w-full`, cho SPAN rộng hết chỗ còn Ô NHẬP dùng `flex-1 min-w-0` — hai thứ
  // chia nhau một hàng, nút luôn có chỗ riêng.
  const anRongHet = /(^|\s)w-full(\s|$)/.test(className);
  const classO = anRongHet
    ? `flex-1 min-w-0 ${className.replace(/(^|\s)w-full(\s|$)/g, ' ')}`
    : className;

  return (
    <span ref={boc} className={`relative inline-flex items-center gap-1 max-w-full ${anRongHet ? 'w-full min-w-0' : ''}`}>
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
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape' && moLich) { e.preventDefault(); setMoLich(false); }
        }}
        className={classO}
      />

      {!disabled && (
        <button
          type="button"
          ref={nutLich}
          onClick={() => setMoLich(v => !v)}
          title="Mở lịch chọn ngày"
          aria-label="Mở lịch chọn ngày"
          aria-expanded={moLich}
          className="shrink-0 p-1 rounded-md text-slate-400 hover:text-brand-accent hover:bg-brand-accent/10 dark:text-slate-500 dark:hover:text-brand-accent-300 transition-colors cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>
      )}

      {moLich && !disabled && viTri && typeof document !== 'undefined' && createPortal(
        // Đưa ra <body> + position:fixed → không bị khung cuộn nào cắt (xem tinhViTri phía trên).
        // z-[100] để nổi trên cả hộp thoại của app (modal đang dùng z-50).
        <div
          ref={hopLich}
          style={{ top: viTri.top, left: viTri.left, width: RONG_LICH }}
          className="fixed z-[100] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-dark-card shadow-2xl p-2"
        >
          {/* Thanh lật tháng */}
          <div className="flex items-center justify-between mb-1.5">
            <button type="button" onClick={() => latThang(-1)} aria-label="Tháng trước"
              className="p-1 rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-elevated cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">
              {TEN_THANG[thangXem.m0]} {thangXem.y}
            </span>
            <button type="button" onClick={() => latThang(1)} aria-label="Tháng sau"
              className="p-1 rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-elevated cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Hàng tên thứ — T7 và CN tô vàng cho dễ nhận ra cuối tuần */}
          <div className="grid grid-cols-7 gap-0.5 mb-0.5">
            {TEN_THU.map((t, i) => (
              <span key={t} className={`text-center text-[9px] font-black uppercase py-0.5 ${i >= 5 ? 'text-brand-warning' : 'text-slate-400 dark:text-slate-500'}`}>
                {t}
              </span>
            ))}
          </div>

          {/* Lưới ngày */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: oTrong }).map((_, i) => <span key={`trong-${i}`} />)}
            {Array.from({ length: soNgayTrongThang }, (_, i) => i + 1).map(ngay => {
              const iso = ghepISO(thangXem.y, thangXem.m0, ngay);
              const dangChon = iso === value;
              const laHomNay = iso === isoHomNay;
              return (
                <button
                  key={ngay}
                  type="button"
                  onClick={() => chonNgay(iso)}
                  className={`h-6 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                    dangChon
                      ? 'bg-brand-accent text-white'
                      : laHomNay
                        ? 'border border-brand-accent text-brand-accent dark:text-brand-accent-300 hover:bg-brand-accent/10'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-elevated'
                  }`}
                  title={isoToVN(iso)}
                >
                  {ngay}
                </button>
              );
            })}
          </div>

          {/* Hai lối tắt hay dùng nhất */}
          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={() => chonNgay(isoHomNay)}
              className="text-[10px] font-black text-brand-accent dark:text-brand-accent-300 hover:underline cursor-pointer">
              Hôm nay
            </button>
            <button type="button" onClick={() => { onChange(''); setDraft(''); setMoLich(false); }}
              className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-brand-danger cursor-pointer">
              Xoá ngày
            </button>
          </div>
        </div>,
        document.body
      )}
    </span>
  );
}
