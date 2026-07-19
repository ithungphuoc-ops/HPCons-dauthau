import { useState, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { Key, ShieldAlert, Save, X, Upload, Camera } from 'lucide-react';
import { downscaleImage } from '../lib/firebase';
import { useModalA11y } from '../utils/useModalA11y';

interface ChangePasswordModalProps {
  mode: 'forced' | 'self'; // 'forced' = bắt buộc đổi lần đầu; 'self' = tự đổi
  currentAvatar?: string; // ảnh hiện tại (đã có thì không bắt buộc tải lại)
  hoTen?: string; // để hiển thị chữ cái khi chưa có ảnh
  // Xử lý đổi mật khẩu (qua Firebase Auth) — trả về chuỗi lỗi hoặc null nếu thành công
  onSubmit: (newPassword: string, oldPassword?: string, avatar?: string) => Promise<string | null>;
  onCancel: () => void; // 'self' = đóng; 'forced' = đăng xuất
}

export default function ChangePasswordModal({ mode, currentAvatar, hoTen, onSubmit, onCancel }: ChangePasswordModalProps) {
  const isForced = mode === 'forced';
  // Bắt buộc đổi lần đầu: không cho Esc thoát (không truyền onClose)
  const panelRef = useModalA11y(isForced ? undefined : onCancel);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [avatar, setAvatar] = useState(currentAvatar || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Tệp không phải hình ảnh!'); return; }
    if (file.size > 3 * 1024 * 1024) { setError('Ảnh tối đa 3MB!'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      if (ev.target?.result) {
        // Thu nhỏ ảnh trước khi lưu để không vượt giới hạn dung lượng khi đồng bộ cloud
        const small = await downscaleImage(ev.target.result as string);
        setAvatar(small);
        setError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const initials = ((hoTen || '').trim().split(/\s+/).pop()?.[0] || '') + ((hoTen || '').trim().split(/\s+/)[0]?.[0] || '');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    // Lần đầu đăng nhập: bắt buộc có ảnh đại diện
    if (isForced && !avatar) {
      setError('Vui lòng thêm ảnh đại diện trước khi tiếp tục.');
      return;
    }
    if (newPw.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPw === '123456') {
      setError('Không được dùng lại mật khẩu mặc định (123456). Vui lòng đặt mật khẩu khác.');
      return;
    }
    if (newPw !== confirmPw) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }
    // Mật khẩu cũ được Firebase xác thực (không so sánh cục bộ)
    setBusy(true);
    const err = await onSubmit(newPw, isForced ? undefined : oldPw, avatar || undefined);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 bg-slate-900/70 backdrop-blur-sm">
      {/* Mobile <768px: gần toàn màn hình (13-overlays/dialog.md); md+: hộp giữa màn hình */}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="change-password-title" tabIndex={-1} className="bg-white dark:bg-dark-card rounded-none md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full h-full md:h-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-dark-card/50">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-brand-accent dark:text-brand-accent-300" />
            <h3 id="change-password-title" className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {isForced ? 'Đổi mật khẩu lần đầu' : 'Đổi mật khẩu'}
            </h3>
          </div>
          {!isForced && (
            <button onClick={onCancel} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-elevated text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1 md:flex-none overflow-y-auto">
          {isForced && (
            <>
              <div className="bg-brand-warning/10 dark:bg-brand-warning/10 border border-brand-warning/25 dark:border-brand-warning/20 rounded-lg p-3 text-[11px] text-brand-warning dark:text-brand-warning font-medium flex gap-2 items-start">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Lần đầu đăng nhập: vui lòng <b>thêm ảnh đại diện</b> và <b>đổi mật khẩu</b> để tiếp tục.</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 self-start">
                  Ảnh đại diện <span className="text-brand-danger">*</span>
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="relative group w-20 h-20 rounded-full border-2 border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer bg-slate-100 dark:bg-dark-elevated flex items-center justify-center"
                  title="Nhấp để tải ảnh từ máy"
                >
                  {avatar ? (
                    <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-black text-slate-400 dark:text-slate-500 uppercase">{initials || '?'}</span>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>
                <button type="button" onClick={() => fileRef.current?.click()} className="text-[10px] font-bold text-brand-accent dark:text-brand-accent-300 hover:underline flex items-center gap-1">
                  <Upload className="w-3 h-3" /> Tải ảnh từ máy
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              </div>
            </>
          )}

          {!isForced && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Mật khẩu hiện tại <span className="text-brand-danger">*</span>
              </label>
              <input
                type="password"
                required
                value={oldPw}
                onChange={(e) => { setOldPw(e.target.value); setError(''); }}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Mật khẩu mới <span className="text-brand-danger">*</span>
            </label>
            <input
              type="password"
              required
              value={newPw}
              onChange={(e) => { setNewPw(e.target.value); setError(''); }}
              placeholder="Tối thiểu 6 ký tự"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Xác nhận mật khẩu mới <span className="text-brand-danger">*</span>
            </label>
            <input
              type="password"
              required
              value={confirmPw}
              onChange={(e) => { setConfirmPw(e.target.value); setError(''); }}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>

          {error && (
            <p className="text-[11px] text-brand-danger font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-danger shrink-0" />
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors"
            >
              {isForced ? 'Đăng xuất' : 'Hủy bỏ'}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-slate-400 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:cursor-wait"
            >
              <Save className="w-3.5 h-3.5" />
              {busy ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN ĐỔI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
