import { useState } from 'react';
import { Staff, ThongBaoNoiBo } from '../types';
import { Megaphone, Send, Users, ChevronDown, ChevronUp, Clock, Trash2 } from 'lucide-react';
import { AutoGrowTextarea } from './ui';
import TextWithLinks from './TextWithLinks';

// ===== THÔNG BÁO NỘI BỘ (chị Trâm — góp ý #8, mục 1) =====
// "Khi tạo thông báo nội bộ có quyền chọn người được nhận thông báo, hoặc toàn bộ người được thêm
//  vào app nhận thông báo."
//
// Dùng LUÔN hệ thống chuông có sẵn (pushNotify) nên tin nội bộ đi cùng đường với tin nghiệp vụ:
// đồng bộ cloud, hiện ảnh + tên người gửi, mọi máy đều nhận. Vì là tin do NGƯỜI gửi nên vẫn gắn
// tên người gửi (khác tin nhắc hạn của hệ thống — xem góp ý #21).
//
// BỔ SUNG 18/08/2026 (chị Trâm), 3 việc:
//  1. "khi c chọn level nào đc thấy là nó báo cho các level đó luôn" → thêm cách chọn người nhận
//     thứ 3: CHỌN THEO CẤP (L1/L2/L3/L4). Tick cấp nào là mọi người thuộc cấp đó nhận tin.
//  2. Khung này chuyển sang mục riêng "Thông báo - Template" trên thanh tác vụ (trước ở Lịch cá nhân).
//  3. "thông báo nội bộ cũng rất quan trọng, sẽ đc lưu lại, chứ phải chỉ là 1 cái thông báo rồi trôi
//     đi đâu nhé" → mỗi tin gửi đi được LƯU thành bản ghi riêng (collection `announcements`) và liệt
//     kê ngay dưới ô soạn. Tin trên chuông chỉ giữ 30 tin/người nên KHÔNG dùng chuông làm nơi lưu.
//
// Quyền: chỉ Trưởng phòng (L1) và Quản lý (L2) được GỬI — nhân viên không tự phát thông báo toàn
// phòng, nhưng ai đã nhận tin thì ĐỌC LẠI được trong danh sách bên dưới.

type VaiTro = 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER';

// Cùng cách gọi tên Level với cả app (xem TEN_LEVEL ở TemplateMauPanel).
const TEN_LEVEL: { key: VaiTro; nhan: string }[] = [
  { key: 'BOOD', nhan: 'L1 Trưởng phòng' },
  { key: 'MANAGER', nhan: 'L2 Quản lý' },
  { key: 'STAFF', nhan: 'L3 Nhân viên' },
  { key: 'VIEWER', nhan: 'L4 Ban giám đốc' },
];

const gioPhutNgay = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hai = (n: number) => String(n).padStart(2, '0');
  return `${hai(d.getHours())}:${hai(d.getMinutes())} ${hai(d.getDate())}-${hai(d.getMonth() + 1)}-${d.getFullYear()}`;
};

interface ThongBaoNoiBoPanelProps {
  /** Nhân sự nhận được thông báo (đã loại người nghỉ / tài khoản chỉ xem ở phía App). */
  nhanSu: Staff[];
  /** Vai trò (level) của một nhân sự — App truyền vào để không nhân đôi luật đổi chức vụ → role. */
  vaiTroCua: (s: Staff) => string | undefined;
  /** Thông báo nội bộ đã lưu (App giữ, đồng bộ cloud). */
  danhSach: ThongBaoNoiBo[];
  /** Được phép GỬI thông báo (L1 / L2). Người không có quyền chỉ đọc lại tin mình đã nhận. */
  coQuyenGui: boolean;
  /** Mã nhân sự người đang xem — để lọc tin họ đã nhận. */
  staffIdDangXem?: string;
  onGui: (targetIds: string[], noiDung: string, kieuNhan: 'toanBo' | 'theoCap' | 'tungNguoi', capNhan: VaiTro[]) => void;
  /** Xoá một thông báo khỏi danh sách đã lưu — chỉ L1/L2. Hộp hỏi lại nằm ở đây, trước khi gọi. */
  onXoa: (id: string) => void;
}

export default function ThongBaoNoiBoPanel({
  nhanSu, vaiTroCua, danhSach, coQuyenGui, staffIdDangXem, onGui, onXoa,
}: ThongBaoNoiBoPanelProps) {
  const [mo, setMo] = useState(false);
  const [noiDung, setNoiDung] = useState('');
  const [cachChon, setCachChon] = useState<'toanBo' | 'theoCap' | 'tungNguoi'>('toanBo');
  const [chon, setChon] = useState<string[]>([]);
  const [capNhan, setCapNhan] = useState<VaiTro[]>([]);

  // Số người thuộc từng cấp — hiện ngay trên nhãn để biết tick cấp đó là bao nhiêu người nhận.
  const soNguoiTheoCap = (c: VaiTro) => nhanSu.filter(s => vaiTroCua(s) === c).length;

  const nguoiNhan =
    cachChon === 'toanBo' ? nhanSu.map(s => s.id)
    : cachChon === 'theoCap' ? nhanSu.filter(s => capNhan.includes(vaiTroCua(s) as VaiTro)).map(s => s.id)
    : chon;
  const guiDuoc = noiDung.trim().length > 0 && nguoiNhan.length > 0;

  const gui = () => {
    if (!guiDuoc) return;
    onGui(nguoiNhan, noiDung.trim(), cachChon, capNhan);
    setNoiDung('');
    setChon([]);
    setCapNhan([]);
    setCachChon('toanBo');
  };

  // L1/L2 xem được mọi thông báo của phòng; người khác chỉ xem tin mình có trong danh sách nhận.
  const daLuu = danhSach
    .filter(t => coQuyenGui || (!!staffIdDangXem && (t.targetIds || []).includes(staffIdDangXem)))
    .sort((a, b) => (b.ngay || '').localeCompare(a.ngay || ''));

  const tenNguoiNhan = (t: ThongBaoNoiBo) => {
    const soNguoi = (t.targetIds || []).length;
    if (t.kieuNhan === 'toanBo') return `toàn bộ nhân sự (${soNguoi} người)`;
    if (t.kieuNhan === 'theoCap') {
      const nhan = TEN_LEVEL.filter(l => (t.capNhan || []).includes(l.key)).map(l => l.nhan).join(' · ');
      return `${nhan || 'theo cấp'} — ${soNguoi} người`;
    }
    const ten = (t.targetIds || []).map(id => nhanSu.find(s => s.id === id)?.hoTen).filter(Boolean);
    return ten.length > 0 ? ten.join(', ') : `${soNguoi} người`;
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setMo(v => !v)}
        aria-expanded={mo}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50/70 dark:hover:bg-dark-elevated/40 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Megaphone className="w-4 h-4 text-brand-accent shrink-0" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
            Thông báo nội bộ
          </span>
          <span className="text-[10px] font-black bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300 px-1.5 py-0.5 rounded-full shrink-0">
            {daLuu.length}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
            {coQuyenGui
              ? 'Gửi tin cho cả phòng / theo cấp / từng người — tin gửi đi được lưu lại để tra cứu'
              : 'Thông báo của phòng gửi cho bạn — được lưu lại, không trôi mất'}
          </span>
        </span>
        {mo ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {mo && (
        <div className="p-4 pt-0 space-y-3">
          {coQuyenGui && (
            <>
              <AutoGrowTextarea
                value={noiDung}
                onChange={(e) => setNoiDung(e.target.value)}
                placeholder="VD: 8h30 mai họp rà soát tiến độ các gói đang chờ CĐT phản hồi — cả phòng chuẩn bị số liệu."
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated"
              />

              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input type="radio" checked={cachChon === 'toanBo'} onChange={() => setCachChon('toanBo')} className="accent-brand-accent" />
                    Toàn bộ nhân sự ({nhanSu.length})
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input type="radio" checked={cachChon === 'theoCap'} onChange={() => setCachChon('theoCap')} className="accent-brand-accent" />
                    Theo cấp (level)
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input type="radio" checked={cachChon === 'tungNguoi'} onChange={() => setCachChon('tungNguoi')} className="accent-brand-accent" />
                    Chọn từng người
                  </label>
                </div>

                {/* CHỌN THEO CẤP — tick cấp nào là cả cấp đó nhận tin (chị Trâm 18/08/2026) */}
                {cachChon === 'theoCap' && (
                  <div className="flex flex-wrap items-center gap-2 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                    {TEN_LEVEL.map(l => {
                      const dangChon = capNhan.includes(l.key);
                      const soNguoi = soNguoiTheoCap(l.key);
                      return (
                        <button
                          key={l.key}
                          type="button"
                          disabled={soNguoi === 0}
                          onClick={() => setCapNhan(prev => dangChon ? prev.filter(x => x !== l.key) : [...prev, l.key])}
                          title={soNguoi === 0 ? 'Chưa có ai ở cấp này' : `${soNguoi} người ở cấp này`}
                          className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            dangChon
                              ? 'border-brand-accent bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand-accent/50'
                          }`}
                        >
                          {dangChon ? '✓ ' : ''}{l.nhan} ({soNguoi})
                        </button>
                      );
                    })}
                    {capNhan.length === 0 && (
                      <span className="text-[10px] text-brand-warning font-bold">Chưa tick cấp nào — chưa gửi được.</span>
                    )}
                  </div>
                )}

                {cachChon === 'tungNguoi' && (
                  <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                    {nhanSu.map(s => (
                      <li key={s.id}>
                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={chon.includes(s.id)}
                            onChange={(e) => setChon(prev => e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id))}
                            className="w-3 h-3 accent-brand-accent shrink-0"
                          />
                          <span className="truncate" title={`${s.hoTen} — ${s.chucVu}`}>{s.hoTen}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Sẽ gửi tới {nguoiNhan.length} người · tin lên chuông kèm tên người gửi và được lưu lại bên dưới
                </span>
                <button
                  type="button"
                  onClick={gui}
                  disabled={!guiDuoc}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-black text-white bg-brand-accent hover:bg-brand-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Gửi thông báo
                </button>
              </div>
            </>
          )}

          {/* ===== THÔNG BÁO ĐÃ GỬI — LƯU LẠI, KHÔNG TRÔI MẤT (chị Trâm 18/08/2026) ===== */}
          <div className={coQuyenGui ? 'pt-3 border-t border-slate-100 dark:border-slate-800' : ''}>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Thông báo đã lưu ({daLuu.length})
            </span>
            {daLuu.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-1.5">
                Chưa có thông báo nội bộ nào.
              </p>
            ) : (
              <ul className="space-y-1.5 mt-2">
                {daLuu.map(t => (
                  <li
                    key={t.id}
                    className="flex items-start justify-between gap-2 bg-slate-50 dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-lg px-3 py-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
                        <TextWithLinks text={t.noiDung} />
                      </div>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 block">
                        {t.nguoiGui ? `${t.nguoiGui} · ` : ''}{gioPhutNgay(t.ngay)} · gửi cho {tenNguoiNhan(t)}
                      </span>
                    </div>
                    {coQuyenGui && (
                      <button
                        type="button"
                        onClick={() => onXoa(t.id)}
                        title="Xoá khỏi danh sách đã lưu"
                        className="p-1 rounded text-slate-300 hover:text-brand-danger transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
