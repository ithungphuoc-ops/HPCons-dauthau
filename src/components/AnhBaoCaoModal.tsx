import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Project } from '../types';
import { Image as ImageIcon, X, Save } from 'lucide-react';
import { useModalA11y } from '../utils/useModalA11y';
import FileDropZone from './FileDropZone';
import { AutoGrowTextarea } from './ui';
import { parseAttachments, joinAttachments } from '../utils/attachments';
import { luuAnh, taiAnhVe, CAU_NHAC_CHUA_MO_QUYEN } from '../utils/anhDinhKem';

// ===== ẢNH BÁO CÁO ĐÃ GỬI BÁO GIÁ (chị Trâm — góp ý #12) =====
// "Thêm trường hình ảnh báo cáo đã gửi báo giá đi cho quản lý; khi Quản lý kéo từ Bước 2 qua Bước 3
//  trong bảng Kanban, yêu cầu nhập hình ảnh mới cho qua."
//
// Hộp này bật lên ĐÚNG LÚC kéo thẻ 2 → 3 khi hồ sơ chưa có ảnh: đính kèm xong bấm lưu là thẻ tự
// sang Bước 3, không phải kéo lại (cùng cách làm với hộp nhập tiến độ Phòng ở cửa 3 → 4).
//
// ⚠ VÁ LỖI 20/08/2026 (Sếp báo: "chưa test được do app chặn đưa hình ảnh lên"): hộp này TRƯỚC ĐÂY
// chỉ ghi TÊN tệp (`files.map(f => f.name)`), không hề gọi `luuAnh()` để lưu NỘI DUNG ảnh thật —
// trong khi ô "Ảnh báo cáo" tương đương ở `ProjectForm.tsx` (góp ý #75) đã gọi đúng. Hậu quả: ảnh
// đính vào ĐÚNG Ở HỘP NÀY xong bấm "Tải về" ở thẻ hồ sơ sẽ báo "chỉ khai TÊN, không tải về được" —
// y hệt triệu chứng ảnh cũ trước bản 18/08, dù ảnh vừa mới đính. Nay gọi `luuAnh()` giống hệt
// ProjectForm.tsx để nội dung ảnh thật sự được lưu (nén trong trình duyệt) và tải về được ngay.

interface AnhBaoCaoModalProps {
  project: Project;
  /** Vai trò người đang thao tác — ghi vào `nguoiThem` của ảnh lưu, khớp cách ProjectForm.tsx đang làm. */
  currentUserRole?: string;
  /** Lưu danh sách tên tệp ảnh (nối bằng " | ") + ghi chú; xong thì thẻ đi tiếp sang Bước 3. */
  onSave: (tepAnh: string, ghiChu: string) => void;
  onClose: () => void;
}

export default function AnhBaoCaoModal({ project, currentUserRole, onSave, onClose }: AnhBaoCaoModalProps) {
  const [tep, setTep] = useState<string[]>(parseAttachments(project.anhBaoCaoGuiBaoGia));
  const [ghiChu, setGhiChu] = useState<string>(project.ghiChuGuiBaoGia || '');
  const [vuaDan, setVuaDan] = useState(false);
  const [loiAnh, setLoiAnh] = useState<string | null>(null);
  const boxRef = useModalA11y(onClose);

  // ===== DÁN ẢNH BẰNG Ctrl+V (chị Trâm chốt 17/08/2026) =====
  // Chụp màn hình rồi Ctrl+V thẳng vào hộp này là ảnh được lưu NỘI DUNG THẬT luôn (qua luuAnh),
  // không phải lưu ra tệp rồi mới kéo-thả. Ảnh dán từ clipboard không có tên nên app tự đặt theo giờ dán.
  useEffect(() => {
    const dan = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || []);
      const anh = items.filter(i => i.type.startsWith('image/'));
      if (!anh.length) return;
      e.preventDefault();
      const gio = new Date();
      const hai = (n: number) => String(n).padStart(2, '0');
      const dau = `anh-da-gui-bao-gia-${gio.getFullYear()}${hai(gio.getMonth() + 1)}${hai(gio.getDate())}`;
      anh.forEach((it, i) => {
        const f = it.getAsFile();
        if (!f) return;
        const ten = (f.name && f.name !== 'image.png')
          ? f.name
          : `${dau}-${hai(gio.getHours())}${hai(gio.getMinutes())}${hai(gio.getSeconds())}${anh.length > 1 ? `-${i + 1}` : ''}.png`;
        const tepDatTen = new File([f], ten, { type: f.type });
        luuAnh(project.id, tepDatTen, currentUserRole)
          .then((kq) => {
            setTep(prev => Array.from(new Set([...prev, ten])));
            setVuaDan(true);
            setLoiAnh(kq.luuTamTrenMay ? CAU_NHAC_CHUA_MO_QUYEN : null);
            window.setTimeout(() => setVuaDan(false), 2500);
          })
          .catch((err) => setLoiAnh(String(err?.message || err)));
      });
    };
    document.addEventListener('paste', dan);
    return () => document.removeEventListener('paste', dan);
  }, [project.id, currentUserRole]);

  const chuaDuTepAnh = tep.length === 0;

  const guiForm = (e: FormEvent) => {
    e.preventDefault();
    if (chuaDuTepAnh) return;
    onSave(joinAttachments(tep), ghiChu.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="anh-bao-cao-tieu-de"
        className="w-full max-w-lg bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            <h2 id="anh-bao-cao-tieu-de" className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-brand-accent shrink-0" />
              Ảnh báo cáo đã gửi báo giá
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {project.hangMuc} — {project.tenDuAn}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-danger hover:bg-brand-danger/10 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={guiForm} className="p-4 space-y-4">
          <p className="text-[11px] font-semibold text-brand-warning bg-brand-warning/10 border border-brand-warning/25 rounded-lg px-3 py-2">
            Hồ sơ chỉ sang <b>Bước 3 (Duyệt hồ sơ thầu cấp phòng)</b> khi đã có ảnh chụp báo cáo
            đã gửi báo giá cho Chủ đầu tư. Đính kèm ảnh rồi bấm lưu là thẻ tự đi tiếp.
          </p>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Ảnh đã gửi báo giá *
            </span>
            <FileDropZone
              inputId="anh-bao-cao-gui-bao-gia"
              label="🖼 Kéo-thả ảnh · bấm để chọn · hoặc Ctrl+V dán ảnh vừa chụp"
              accept="image/*,.pdf"
              multiple
              maxSizeMB={25}
              oversizeHint="Ảnh quá lớn thì gửi ĐƯỜNG LINK trong ô ghi chú bên dưới."
              onFiles={(files) => {
                setLoiAnh(null);
                files.forEach(f => {
                  luuAnh(project.id, f, currentUserRole)
                    .then((kq) => {
                      setTep(prev => Array.from(new Set([...prev, f.name])));
                      if (kq.luuTamTrenMay) setLoiAnh(CAU_NHAC_CHUA_MO_QUYEN);
                    })
                    .catch((err) => setLoiAnh(String(err?.message || err)));
                });
              }}
            />
            {tep.length > 0 && (
              <ul className="space-y-1">
                {tep.map(ten => (
                  <li key={ten} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    <span className="flex-1 truncate" title={ten}>🖼 {ten}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await taiAnhVe(project.id, ten);
                        if (!ok) setLoiAnh(`Ảnh "${ten}" chưa lưu được nội dung tệp nên không tải về được ngay — thử dán/kéo-thả lại.`);
                      }}
                      className="text-brand-accent dark:text-brand-accent-300 hover:underline shrink-0"
                    >
                      ⬇ Tải về
                    </button>
                    <button
                      type="button"
                      onClick={() => setTep(prev => prev.filter(x => x !== ten))}
                      className="text-brand-danger hover:underline shrink-0"
                    >
                      Bỏ
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {loiAnh && (
              <span className="text-[10px] font-bold text-brand-warning block">{loiAnh}</span>
            )}
            {chuaDuTepAnh && (
              <span className="text-[10px] font-bold text-brand-danger block">
                Chưa có ảnh nào — cần ít nhất 1 ảnh để chuyển sang Bước 3.
              </span>
            )}
            {vuaDan && (
              <span className="text-[10px] font-black text-brand-success block">
                ✓ Đã nhận ảnh dán từ clipboard (Ctrl+V).
              </span>
            )}
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
              Chụp màn hình rồi bấm <b>Ctrl+V</b> ngay trong hộp này cũng được. App chỉ lưu TÊN tệp
              (không tải nội dung ảnh lên) — ảnh gốc giữ ở thư mục của phòng.
            </span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ghi-chu-gui-bao-gia" className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Ghi chú (gửi cho ai, gửi bằng đường nào) — không bắt buộc
            </label>
            <AutoGrowTextarea
              id="ghi-chu-gui-bao-gia"
              value={ghiChu}
              onChange={(e) => setGhiChu(e.target.value)}
              placeholder="VD: Đã gửi mail cho Mr. Chen lúc 16:30 ngày 17-08-2026, kèm bảng giá ver02."
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-elevated"
            >
              Để sau
            </button>
            <button
              type="submit"
              disabled={chuaDuTepAnh}
              className="px-4 py-2 rounded-lg text-[11px] font-black text-white bg-brand-accent hover:bg-brand-accent-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Lưu ảnh &amp; sang Bước 3
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
