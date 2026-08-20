import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Project } from '../types';
import { FileCheck, X, Save } from 'lucide-react';
import { useModalA11y } from '../utils/useModalA11y';
import FileDropZone from './FileDropZone';
import { AutoGrowTextarea } from './ui';
import { parseAttachments, joinAttachments } from '../utils/attachments';
import { tongSoLanGuiCDT } from '../utils/guiCDT';
import { luuAnh, taiAnhVe, CAU_NHAC_CHUA_MO_QUYEN } from '../utils/anhDinhKem';

interface PhongProgressModalProps {
  project: Project;
  /** Vai trò người đang thao tác — ghi vào `nguoiThem` của ảnh lưu, khớp cách ProjectForm.tsx đang làm. */
  currentUserRole?: string;
  /** Lưu tiến độ Phòng + kết quả công việc (mô tả và/hoặc tệp). */
  onSave: (tienDoPhong: number, ketQuaPhong: string, taiLieuKetQuaPhong?: string) => void;
  onClose: () => void;
}

// Bảng nhập TIẾN ĐỘ PHÒNG + KẾT QUẢ CÔNG VIỆC của Trưởng phòng.
// Bật lên ở HAI chỗ: khi TP bị chặn ở cửa chốt vì tiến độ Phòng chưa đủ 100%, và khi hồ sơ vừa
// vào bước 4 mà chưa ghi kết quả công việc.
// Quy tắc (chị Trâm chốt 25/07/2026, dời cửa chốt về 3 → 4 ngày 27/07/2026):
//   - Tiến độ Phòng phải đủ 100% thì hồ sơ mới rời được bước 3 để trình BLĐ.
//   - Kết quả công việc KHÔNG bắt buộc: nhập mô tả, hoặc đính kèm tệp, hoặc cả hai, hoặc bỏ trống.
//
// ⚠ NỚI THÊM 20/08/2026 (Sếp yêu cầu: "từ bước 3 qua bước 4, mình cũng cần đưa hình ảnh lên nữa"):
// tệp đính kèm ở cửa này TRƯỚC ĐÂY chỉ ghi TÊN tệp (giống lỗi vừa vá ở AnhBaoCaoModal.tsx, cửa
// Bước 2→3) — nay gọi `luuAnh()` để lưu NỘI DUNG ảnh thật (nén trong trình duyệt), có nút Tải về,
// và hỗ trợ Ctrl+V dán ảnh chụp màn hình như cửa 2→3. Tệp không phải ảnh vẫn chỉ ghi tên như cũ.
export default function PhongProgressModal({ project, currentUserRole, onSave, onClose }: PhongProgressModalProps) {
  const panelRef = useModalA11y(onClose);
  const [tienDo, setTienDo] = useState<number>(project.tienDoPhong || 0);
  const [ketQua, setKetQua] = useState<string>(project.ketQuaPhong || '');
  const [tepList, setTepList] = useState<string[]>(parseAttachments(project.taiLieuKetQuaPhong));
  const [vuaDanAnh, setVuaDanAnh] = useState(false);
  const [loiAnh, setLoiAnh] = useState<string | null>(null);

  // DÁN ẢNH BẰNG Ctrl+V (cùng cách làm với AnhBaoCaoModal.tsx / ProjectForm.tsx) — chỉ bắt khi
  // clipboard có ẢNH, nên dán chữ vào ô mô tả kết quả công việc không bị ảnh hưởng.
  useEffect(() => {
    const dan = (e: ClipboardEvent) => {
      const anh = Array.from(e.clipboardData?.items || []).filter(i => i.type.startsWith('image/'));
      if (!anh.length) return;
      e.preventDefault();
      const gio = new Date();
      const hai = (n: number) => String(n).padStart(2, '0');
      const dau = `ket-qua-phong-${gio.getFullYear()}${hai(gio.getMonth() + 1)}${hai(gio.getDate())}`;
      anh.forEach((it, i) => {
        const f = it.getAsFile();
        if (!f) return;
        const ten = (f.name && f.name !== 'image.png')
          ? f.name
          : `${dau}-${hai(gio.getHours())}${hai(gio.getMinutes())}${hai(gio.getSeconds())}${anh.length > 1 ? `-${i + 1}` : ''}.png`;
        const tepDatTen = new File([f], ten, { type: f.type });
        luuAnh(project.id, tepDatTen, currentUserRole)
          .then((kq) => {
            setTepList(prev => Array.from(new Set([...prev, ten])));
            setVuaDanAnh(true);
            setLoiAnh(kq.luuTamTrenMay ? CAU_NHAC_CHUA_MO_QUYEN : null);
            window.setTimeout(() => setVuaDanAnh(false), 2500);
          })
          .catch((err) => setLoiAnh(String(err?.message || err)));
      });
    };
    document.addEventListener('paste', dan);
    return () => document.removeEventListener('paste', dan);
  }, [project.id, currentUserRole]);

  // Hồ sơ còn ở bước 3 = TP đang đứng trước cửa 3 → 4; từ bước 4 trở đi là cửa 4 → 5.
  // Dùng để nói đúng bước kế tiếp trong lời nhắc, tránh nhắc "sang bước 5" khi hồ sơ mới ở bước 3.
  const dangOBuoc3 = (project.kanbanStep || 1) <= 3;
  const buocKeTiep = dangOBuoc3 ? 'bước 4 (trình BLĐ / Giám đốc)' : 'bước 5 (đã gửi CĐT)';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(tienDo, ketQua, joinAttachments(tepList));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 bg-slate-900/70 backdrop-blur-sm">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="phong-progress-title"
        tabIndex={-1}
        className="bg-white dark:bg-dark-card rounded-none md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full h-full md:h-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-brand-primary/10 dark:bg-brand-primary/10">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-brand-primary" />
            <h3 id="phong-progress-title" className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Nhập tiến độ &amp; kết quả cấp Phòng
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-elevated text-slate-400 transition-colors cursor-pointer" title="Đóng, nhập sau">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1 md:flex-none md:max-h-[80vh] overflow-y-auto">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-lg p-2.5 font-medium">
            📁 <b className="text-slate-700 dark:text-slate-200">{project.tenDuAn}</b> — {project.hangMuc}
            <br />Hồ sơ đang ở <b>bước {project.kanbanStep || 1}</b>. Tiến độ Phòng phải đủ <b>100%</b> thì mới chuyển được sang
            {' '}{buocKeTiep}. Kết quả công việc <b>không bắt buộc</b> — nhập mô tả, đính kèm tệp, hoặc để trống.
            {tongSoLanGuiCDT(project) > 0 && (
              <>
                <br />📤 Hồ sơ này đã gửi CĐT <b className="text-brand-accent dark:text-brand-accent-300">{tongSoLanGuiCDT(project)} lần</b>
                {' '}(gần nhất {[...(project.guiCDTLogs || [])].sort((a, b) => b.lan - a.lan)[0].ngay.split('-').reverse().join('-')}).
                {' '}Số liệu nhập ở đây là của <b>vòng gửi lần {tongSoLanGuiCDT(project) + 1}</b>.
              </>
            )}
          </div>

          {/* Tiến độ Phòng */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-bold">
              <label htmlFor="phong-progress-range" className="text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] font-black">
                Tiến độ Phòng duyệt
              </label>
              <span className={tienDo >= 100 ? 'text-brand-success dark:text-brand-success-300 text-base font-black' : 'text-brand-warning text-base font-black'}>
                {tienDo}%
              </span>
            </div>
            <input
              id="phong-progress-range"
              type="range"
              min="0"
              max="100"
              step="5"
              value={tienDo}
              onChange={(e) => setTienDo(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-100 dark:bg-dark-elevated rounded-lg appearance-none cursor-pointer accent-brand-primary"
            />
            <div className="flex items-center justify-between gap-2">
              <p className={`text-[10px] font-bold ${tienDo >= 100 ? 'text-brand-success dark:text-brand-success-300' : 'text-brand-warning'}`}>
                {tienDo >= 100
                  ? `✓ Đủ 100% — hồ sơ được phép sang ${dangOBuoc3 ? 'bước 4' : 'bước 5'}.`
                  : `⚠ Chưa đủ 100% — hồ sơ chưa được sang ${dangOBuoc3 ? 'bước 4' : 'bước 5'}.`}
              </p>
              {tienDo < 100 && (
                <button type="button" onClick={() => setTienDo(100)} className="shrink-0 text-[10px] font-black text-brand-primary hover:underline cursor-pointer">
                  Duyệt đủ 100%
                </button>
              )}
            </div>
          </div>

          {/* Kết quả công việc: mô tả */}
          <div className="space-y-1">
            <label htmlFor="phong-result-note" className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Kết quả công việc — mô tả <span className="normal-case font-medium">(không bắt buộc)</span>
            </label>
            <AutoGrowTextarea
              id="phong-result-note"
              value={ketQua}
              onChange={(e) => setKetQua(e.target.value)}
              placeholder="VD: Đã rà soát toàn bộ đơn giá và khối lượng BOQ, hồ sơ đạt yêu cầu trình ký..."
              className="w-full p-2 text-xs bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          {/* Kết quả công việc: tệp/ảnh đính kèm (kéo-thả · bấm chọn · Ctrl+V dán ảnh chụp màn hình) */}
          <div className="space-y-1">
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Kết quả công việc — ảnh/tệp <span className="normal-case font-medium">(kéo-thả · Ctrl+V dán ảnh · không bắt buộc)</span>
            </span>
            {tepList.length > 0 && (
              <ul className="space-y-1 mb-1">
                {tepList.map((name, i) => (
                  <li key={`${name}-${i}`} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-lg px-2 py-1">
                    <span className="flex-1 truncate" title={name}>📎 {name}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await taiAnhVe(project.id, name);
                        if (!ok) setLoiAnh(`Tệp "${name}" chỉ được khai TÊN từ trước (chưa lưu nội dung tệp) nên không tải về được. Đính lại tệp/ảnh để app lưu nội dung thật.`);
                      }}
                      className="shrink-0 text-brand-accent dark:text-brand-accent-300 hover:underline cursor-pointer"
                      title={`Tải "${name}" về máy`}
                    >
                      ⬇ Tải về
                    </button>
                    <button
                      type="button"
                      onClick={() => setTepList(prev => prev.filter((_, idx) => idx !== i))}
                      className="shrink-0 text-brand-danger hover:underline uppercase cursor-pointer"
                      title={`Bỏ tệp ${name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <FileDropZone
              inputId={`file-kq-phong-modal-${project.id}`}
              multiple
              accept="image/*,.pdf"
              label="📤 Kéo-thả · bấm để chọn · hoặc Ctrl+V dán ảnh vừa chụp"
              onFiles={(files) => {
                setLoiAnh(null);
                files.forEach(f => {
                  luuAnh(project.id, f, currentUserRole)
                    .then((kq) => {
                      setTepList(prev => Array.from(new Set([...prev, f.name])));
                      if (kq.luuTamTrenMay) setLoiAnh(CAU_NHAC_CHUA_MO_QUYEN);
                    })
                    .catch((err) => setLoiAnh(String(err?.message || err)));
                });
              }}
            />
            {vuaDanAnh && (
              <p className="text-[10px] font-black text-brand-success">✓ Đã lưu ảnh dán từ clipboard — tải về được.</p>
            )}
            {loiAnh && (
              <p className="text-[10px] font-bold text-brand-warning">{loiAnh}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[11px] font-black text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">
              Để sau
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-[11px] font-black transition-colors cursor-pointer inline-flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Lưu kết quả Phòng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
