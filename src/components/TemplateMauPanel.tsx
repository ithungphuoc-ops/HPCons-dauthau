import { useState } from 'react';
import { TenderTemplate } from '../types';
import { FileSpreadsheet, Plus, ExternalLink, Trash2, Trash, Undo2, AlertTriangle, Pencil, Check, X } from 'lucide-react';
import TextWithLinks from './TextWithLinks';

// ===== TEMPLATE MẪU ĐẤU THẦU (chị Trâm — góp ý #8, mở rộng 18/08/2026) =====
// "Thêm chức năng Template mẫu để update các file excel, biểu mẫu cho phòng sử dụng."
// Chị Trâm bổ sung 18/08: (1) đưa RA NGOÀI thành mục riêng ở thanh tác vụ — nằm trong Lịch cá nhân
// thì không ai tìm thấy; (2) mỗi biểu mẫu chọn được LEVEL NÀO ĐƯỢC THẤY.
//
// ⚠ CHỈ CÒN MỘT NÚT XOÁ (chị Trâm chốt 18/08/2026: "2 cái này có khác nhau j đâu, làm 1 nút thôi").
// Trước đó có 2 nút gần giống nhau — 📦 "đánh dấu mẫu cũ" và 🗑 "xoá" — nhìn không phân biệt được.
// Nay chỉ còn 🗑: bỏ vào THÙNG RÁC BIỂU MẪU, vẫn phục hồi được bằng nút ↩. Xoá vĩnh viễn là nút
// riêng NẰM TRONG thùng rác và phải xác nhận. Biểu mẫu cũ đánh dấu bằng cờ `daHuy` từ bản trước
// cũng được gom vào thùng rác này để không còn 2 mục na ná nhau.
//
// ⚠ XOÁ VĨNH VIỄN CHỈ LEVEL 1 (chị Trâm chốt 18/08/2026: "Biểu mẫu chỉ có level 1 mới đc xóa vĩnh
// viễn"). Quản lý (L2) vẫn thêm biểu mẫu và bỏ vào thùng rác được — hai việc đó còn lấy lại được;
// còn xoá sạch khỏi danh mục thì không phục hồi được nên để Trưởng phòng quyết.
//
// ⚠ VÌ SAO LƯU ĐƯỜNG LINK, KHÔNG TẢI FILE LÊN: app chưa dùng Firebase Storage, mà một document
// Firestore tối đa 1MB — file Excel biểu mẫu thường vượt xa. Muốn tải tệp thật lên app thì phải
// bật Firebase Storage (cần Sếp/IT quyết).
//
// ⚠ TÊN BIỂU MẪU LÀ MỘT ĐƯỜNG LINK — bấm vào là MỞ TỆP theo link đã khai. Chị Trâm báo 18/08/2026:
// gõ link không đúng ("k,jklk") thì bấm tên nhảy sang trang 404 của app, không hiểu đi đâu. Nay:
// link không hợp lệ thì KHÔNG render thành liên kết nữa, mà hiện cảnh báo + in rõ link đang khai,
// và ô nhập link cũng cảnh báo ngay lúc gõ.
//
// ⚠ NÚT SỬA (bút chì) — chị Trâm báo 24/08/2026: "Thêm bút chỉnh sửa nội dung link và tiêu đề
// link". Trước đây gõ sai tên/link là phải Xoá (vào thùng rác) rồi Thêm lại từ đầu, mất luôn cả
// "Cấp được thấy"/ghi chú đã khai. Nay bấm 🖉 mở form sửa ngay tại chỗ (tên, link, ghi chú, cấp
// được thấy) — dùng lại đúng `onUpdate` đã có sẵn cho việc phục hồi từ thùng rác.

type VaiTro = 'BOOD' | 'MANAGER' | 'STAFF' | 'VIEWER';

const TEN_LEVEL: { key: VaiTro; nhan: string }[] = [
  { key: 'BOOD', nhan: 'L1 Trưởng phòng' },
  { key: 'MANAGER', nhan: 'L2 Quản lý' },
  { key: 'STAFF', nhan: 'L3 Nhân viên' },
  { key: 'VIEWER', nhan: 'L4 Ban giám đốc' },
];

/** Biểu mẫu không khai level nào = MỌI cấp đều thấy (dữ liệu cũ đọc bình thường). */
export const thayDuocMau = (t: TenderTemplate, vaiTro?: string): boolean =>
  !t.levels || t.levels.length === 0 || (!!vaiTro && t.levels.includes(vaiTro as VaiTro));

/**
 * Link mở được hay không. Nhận 3 dạng thật sự dùng ở phòng:
 *   • https://... hoặc http://...        (OneDrive, Google Drive, SharePoint)
 *   • www....                            (tự thêm https:// khi mở)
 *   • \\\\máy-chủ\\thư-mục hoặc D:\\thư-mục  (thư mục chung trong mạng nội bộ)
 * Còn lại (gõ chữ bất kỳ) coi là CHƯA hợp lệ — nếu cứ để làm link thì trình duyệt hiểu là đường
 * dẫn trong app và nhảy sang trang 404.
 */
export const linkMoDuoc = (link?: string): boolean => {
  const s = (link || '').trim();
  if (!s) return false;
  if (/^https?:\/\/\S+/i.test(s)) return true;
  if (/^www\.\S+\.\S+/i.test(s)) return true;
  if (/^\\\\\S+/.test(s)) return true;            // \\server\share
  if (/^[a-zA-Z]:[\\/]\S*/.test(s)) return true;  // D:\thu-muc
  return false;
};

/** Địa chỉ thật để mở: www... thì thêm https:// cho trình duyệt hiểu. */
const diaChiMo = (link: string) => (/^www\./i.test(link.trim()) ? `https://${link.trim()}` : link.trim());

interface TemplateMauPanelProps {
  templates: TenderTemplate[];
  /** Vai trò người đang xem — lọc biểu mẫu theo level được phép thấy. */
  vaiTro?: string;
  /** Thêm / sửa / xoá biểu mẫu: chỉ Trưởng phòng (L1) và Quản lý (L2). */
  canEdit: boolean;
  onAdd: (ten: string, link: string, ghiChu: string, levels: VaiTro[]) => void;
  onUpdate: (id: string, thayDoi: Partial<TenderTemplate>) => void;
  /** Bỏ vào thùng rác (xoá mềm) — vẫn phục hồi được. */
  onDelete: (id: string) => void;
  /** Xoá vĩnh viễn khỏi danh mục — chỉ gọi từ trong thùng rác, sau khi người dùng xác nhận. */
  onXoaVinhVien: (id: string) => void;
}

export default function TemplateMauPanel({ templates, vaiTro, canEdit, onAdd, onUpdate, onDelete, onXoaVinhVien }: TemplateMauPanelProps) {
  const [ten, setTen] = useState('');
  const [link, setLink] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [levels, setLevels] = useState<VaiTro[]>([]);   // rỗng = mọi cấp đều thấy
  const [moThungRac, setMoThungRac] = useState(false);

  // ===== SỬA BIỂU MẪU TẠI CHỖ (chị Trâm báo 24/08/2026) =====
  const [dangSuaId, setDangSuaId] = useState<string | null>(null);
  const [suaTen, setSuaTen] = useState('');
  const [suaLink, setSuaLink] = useState('');
  const [suaGhiChu, setSuaGhiChu] = useState('');
  const [suaLevels, setSuaLevels] = useState<VaiTro[]>([]);

  const batDauSua = (t: TenderTemplate) => {
    setDangSuaId(t.id);
    setSuaTen(t.ten);
    setSuaLink(t.link);
    setSuaGhiChu(t.ghiChu || '');
    setSuaLevels(t.levels || []);
  };
  const huySua = () => setDangSuaId(null);
  const suaLinkSai = suaLink.trim().length > 0 && !linkMoDuoc(suaLink);
  const suaDuocLuu = suaTen.trim().length > 0 && linkMoDuoc(suaLink);
  const luuSua = (id: string) => {
    if (!suaDuocLuu) return;
    onUpdate(id, {
      ten: suaTen.trim(),
      link: suaLink.trim(),
      ghiChu: suaGhiChu.trim() || undefined,
      levels: suaLevels.length > 0 ? suaLevels : undefined,
    });
    setDangSuaId(null);
  };

  const linkSai = link.trim().length > 0 && !linkMoDuoc(link);
  const themDuoc = ten.trim().length > 0 && linkMoDuoc(link);
  const them = () => {
    if (!themDuoc) return;
    onAdd(ten.trim(), link.trim(), ghiChu.trim(), levels);
    setTen(''); setLink(''); setGhiChu(''); setLevels([]);
  };

  // MỘT khái niệm "đã bỏ đi" duy nhất: daXoa (nút 🗑 mới) hoặc daHuy (cờ của bản trước).
  const daBoDi = (t: TenderTemplate) => !!t.daXoa || !!t.daHuy;

  const nhinThay = templates.filter(t => canEdit || thayDuocMau(t, vaiTro));
  const dangDung = nhinThay.filter(t => !daBoDi(t)).sort((a, b) => (b.ngay || '').localeCompare(a.ngay || ''));
  // Thùng rác chỉ người có quyền sửa mới thấy — người khác không cần biết mẫu ai lỡ xoá.
  const thungRac = canEdit
    ? nhinThay.filter(daBoDi).sort((a, b) =>
        (b.ngayXoa || b.ngayHuy || '').localeCompare(a.ngayXoa || a.ngayHuy || ''))
    : [];

  const nhanLevel = (t: TenderTemplate) =>
    !t.levels || t.levels.length === 0
      ? 'Mọi cấp đều thấy'
      : TEN_LEVEL.filter(l => t.levels!.includes(l.key)).map(l => l.nhan).join(' · ');

  const dongMau = (t: TenderTemplate, trongRac: boolean) => {
    const moDuoc = linkMoDuoc(t.link);

    // ===== ĐANG SỬA biểu mẫu này — hiện form sửa tại chỗ thay vì dòng hiển thị bình thường =====
    if (dangSuaId === t.id) {
      return (
        <li key={t.id} className="border border-brand-accent/40 rounded-lg px-3 py-2 bg-brand-accent/5 dark:bg-brand-accent/10 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              value={suaTen}
              onChange={(e) => setSuaTen(e.target.value)}
              placeholder="Tên biểu mẫu"
              autoFocus
              className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated"
            />
            <div className="space-y-1">
              <input
                value={suaLink}
                onChange={(e) => setSuaLink(e.target.value)}
                placeholder="Đường link tệp"
                className={`w-full px-2.5 py-1.5 border rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated ${
                  suaLinkSai ? 'border-brand-warning' : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              {suaLinkSai && (
                <p className="text-[10px] font-bold text-brand-warning flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  Đây chưa phải đường link mở được.
                </p>
              )}
            </div>
          </div>
          <input
            value={suaGhiChu}
            onChange={(e) => setSuaGhiChu(e.target.value)}
            placeholder="Ghi chú (không bắt buộc)"
            className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cấp được thấy:
            </span>
            {TEN_LEVEL.map(l => {
              const chon = suaLevels.includes(l.key);
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setSuaLevels(prev => chon ? prev.filter(x => x !== l.key) : [...prev, l.key])}
                  className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-colors ${
                    chon
                      ? 'border-brand-accent bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand-accent/50'
                  }`}
                >
                  {chon ? '✓ ' : ''}{l.nhan}
                </button>
              );
            })}
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {suaLevels.length === 0 ? '(không chọn = mọi cấp đều thấy)' : `(${suaLevels.length} cấp)`}
            </span>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={huySua}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-black text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-elevated flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Hủy
            </button>
            <button
              type="button"
              onClick={() => luuSua(t.id)}
              disabled={!suaDuocLuu}
              title={!suaDuocLuu ? 'Cần có tên biểu mẫu và một đường link mở được' : 'Lưu thay đổi'}
              className="px-3 py-1.5 rounded-lg text-[11px] font-black text-white bg-brand-accent hover:bg-brand-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Lưu
            </button>
          </div>
        </li>
      );
    }

    return (
      <li key={t.id} className={`flex items-start justify-between gap-2 border rounded-lg px-3 py-2 ${
        trongRac
          ? 'bg-brand-danger/5 dark:bg-brand-danger/10 border-brand-danger/20 dark:border-brand-danger/25'
          : 'bg-slate-50 dark:bg-dark-bg border-slate-200/70 dark:border-slate-800'
      }`}>
        <div className="min-w-0 space-y-0.5">
          {/* Link mở được thì tên là liên kết; link chưa hợp lệ thì để chữ thường + cảnh báo,
              KHÔNG cho bấm (bấm sẽ nhảy vào trang 404 của app — chị Trâm báo 18/08/2026). */}
          {moDuoc ? (
            <a
              href={diaChiMo(t.link)}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-[12px] font-black hover:underline flex items-center gap-1 ${
                trongRac ? 'text-slate-400 line-through' : 'text-brand-accent dark:text-brand-accent-300'
              }`}
              title={`Mở tệp: ${t.link}`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.ten}</span>
              <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
            </a>
          ) : (
            <span
              className={`text-[12px] font-black flex items-center gap-1 ${
                trongRac ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'
              }`}
              title="Đường link khai chưa đúng nên không mở được"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.ten}</span>
            </span>
          )}

          {/* IN RÕ ĐƯỜNG LINK để biết bấm vào tên là đi đâu */}
          <div className={`text-[9px] font-mono truncate ${moDuoc ? 'text-slate-400 dark:text-slate-500' : 'text-brand-warning'}`} title={t.link}>
            {moDuoc ? `🔗 ${t.link}` : (
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                Link chưa đúng: “{t.link}” — sửa lại thành https://… hoặc \\máy-chủ\thư-mục mới mở được.
              </span>
            )}
          </div>

          {t.ghiChu && (
            <div className={`text-[10px] ${trongRac ? 'text-slate-400 line-through' : 'text-slate-500 dark:text-slate-400'}`}>
              <TextWithLinks text={t.ghiChu} />
            </div>
          )}
          <span className="text-[9px] text-slate-400 dark:text-slate-500 block">
            👁 {nhanLevel(t)}
            {t.nguoiThem ? ` · ${t.nguoiThem}` : ''}
            {t.ngay ? ` · ${(t.ngay || '').slice(0, 10).split('-').reverse().join('-')}` : ''}
            {trongRac && (t.ngayXoa || t.ngayHuy)
              ? ` · đã xoá ${((t.ngayXoa || t.ngayHuy) || '').slice(0, 10).split('-').reverse().join('-')}${t.nguoiXoa ? ` bởi ${t.nguoiXoa}` : ''}`
              : ''}
          </span>
        </div>

        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            {trongRac ? (
              <>
                {/* PHỤC HỒI — xoá cả 2 cờ để mẫu về đúng danh mục đang dùng */}
                <button
                  type="button"
                  onClick={() => onUpdate(t.id, { daXoa: false, ngayXoa: undefined, nguoiXoa: undefined, daHuy: false, ngayHuy: undefined })}
                  title="Phục hồi biểu mẫu này (lấy lại từ thùng rác)"
                  className="px-2 py-1 rounded text-[10px] font-black text-brand-success hover:bg-brand-success/10 flex items-center gap-1 transition-colors"
                >
                  <Undo2 className="w-3.5 h-3.5" /> Phục hồi
                </button>
                {/* XOÁ VĨNH VIỄN — CHỈ TRƯỞNG PHÒNG (L1), phải xác nhận vì không lấy lại được */}
                {vaiTro === 'BOOD' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Xoá VĨNH VIỄN biểu mẫu "${t.ten}"? Sau bước này không phục hồi được nữa.`)) {
                        onXoaVinhVien(t.id);
                      }
                    }}
                    title="Xoá vĩnh viễn — không phục hồi được (chỉ Trưởng phòng)"
                    className="p-1 rounded text-slate-300 hover:text-brand-danger transition-colors"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            ) : (
              <>
                {/* SỬA — chị Trâm báo 24/08/2026: gõ sai tên/link không cần Xoá rồi Thêm lại */}
                <button
                  type="button"
                  onClick={() => batDauSua(t)}
                  title="Sửa tên/link/ghi chú của biểu mẫu này"
                  className="p-1 rounded text-slate-300 hover:text-brand-accent transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {/* MỘT nút duy nhất: bỏ vào thùng rác (chị Trâm chốt 18/08/2026) */}
                <button
                  type="button"
                  onClick={() => onDelete(t.id)}
                  title="Xoá biểu mẫu — vào thùng rác, phục hồi lại được"
                  className="p-1 rounded text-slate-300 hover:text-brand-danger transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-slate-100 dark:border-slate-800">
        <FileSpreadsheet className="w-4 h-4 text-brand-success shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
          Template mẫu đấu thầu
        </span>
        <span className="text-[10px] font-black bg-brand-success/10 text-brand-success px-1.5 py-0.5 rounded-full shrink-0">
          {dangDung.length}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
          Biểu mẫu Excel / hồ sơ mẫu dùng chung cho cả phòng — bấm tên là mở tệp theo link
        </span>
      </div>

      <div className="p-4 space-y-3">
        {dangDung.length === 0 ? (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
            Chưa có biểu mẫu nào đang dùng. {canEdit ? 'Thêm biểu mẫu ở ô bên dưới.' : 'Trưởng phòng / Quản lý sẽ bổ sung.'}
          </p>
        ) : (
          <ul className="space-y-1.5">{dangDung.map(t => dongMau(t, false))}</ul>
        )}

        {/* ===== THÙNG RÁC BIỂU MẪU — lỡ xoá thì bấm Phục hồi (chị Trâm 18/08/2026) ===== */}
        {thungRac.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setMoThungRac(v => !v)}
              className="text-[11px] font-black text-brand-danger hover:opacity-80 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Thùng rác biểu mẫu ({thungRac.length}) {moThungRac ? '▴' : '▾'}
            </button>
            {moThungRac && (
              <>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                  Biểu mẫu đã xoá vẫn giữ ở đây để lấy lại. Bấm <strong>Phục hồi</strong> là về chỗ cũ.
                  {vaiTro === 'BOOD'
                    ? ' Nút 🗑 trong thùng rác là xoá vĩnh viễn — không lấy lại được.'
                    : ' Xoá vĩnh viễn thì chỉ Trưởng phòng (Level 1) làm được.'}
                </p>
                <ul className="space-y-1.5 mt-2">{thungRac.map(t => dongMau(t, true))}</ul>
              </>
            )}
          </div>
        )}

        {/* ===== THÊM BIỂU MẪU ===== */}
        {canEdit && (
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                value={ten}
                onChange={(e) => setTen(e.target.value)}
                placeholder="Tên biểu mẫu — VD: Mẫu bảng tổng hợp giá ver05"
                className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated"
              />
              <div className="space-y-1">
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="Đường link tệp — dán link OneDrive / Drive, hoặc \\máy-chủ\thư-mục"
                  className={`w-full px-2.5 py-1.5 border rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated ${
                    linkSai ? 'border-brand-warning' : 'border-slate-200 dark:border-slate-700'
                  }`}
                />
                {linkSai && (
                  <p className="text-[10px] font-bold text-brand-warning flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    Đây chưa phải đường link mở được. Dán link bắt đầu bằng <strong>https://</strong> (OneDrive,
                    Google Drive, SharePoint) hoặc đường dẫn mạng <strong>{'\\\\máy-chủ\\thư-mục'}</strong>.
                  </p>
                )}
              </div>
            </div>
            <input
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
              placeholder="Ghi chú (không bắt buộc) — VD: dùng cho gói nhà xưởng, thay mẫu ver04"
              className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated"
            />

            {/* Level nào được thấy — không tick cái nào = mọi cấp đều thấy */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cấp được thấy:
              </span>
              {TEN_LEVEL.map(l => {
                const chon = levels.includes(l.key);
                return (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setLevels(prev => chon ? prev.filter(x => x !== l.key) : [...prev, l.key])}
                    className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-colors ${
                      chon
                        ? 'border-brand-accent bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand-accent/50'
                    }`}
                  >
                    {chon ? '✓ ' : ''}{l.nhan}
                  </button>
                );
              })}
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {levels.length === 0 ? '(không chọn = mọi cấp đều thấy)' : `(${levels.length} cấp)`}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                App lưu ĐƯỜNG LINK, không tải tệp lên — tệp gốc giữ ở thư mục chung của phòng nên ai
                cũng lấy được bản mới nhất.
              </span>
              <button
                type="button"
                onClick={them}
                disabled={!themDuoc}
                title={!themDuoc ? 'Cần có tên biểu mẫu và một đường link mở được' : 'Thêm vào danh mục dùng chung'}
                className="px-3 py-1.5 rounded-lg text-[11px] font-black text-white bg-brand-success hover:bg-brand-success-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm biểu mẫu
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
