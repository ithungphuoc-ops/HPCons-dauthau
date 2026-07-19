import { useState } from 'react';
import type { FormEvent } from 'react';
import { Project } from '../types';
import { RefreshCw, X, Plus, Trash2, Save } from 'lucide-react';
import { useModalA11y } from '../utils/useModalA11y';

interface CdtRevisionModalProps {
  project: Project;
  onSubmit: (noiDung: string, buocVe: number, newTasks: { name: string; weight: number }[]) => void;
  onClose: () => void;
}

export default function CdtRevisionModal({ project, onSubmit, onClose }: CdtRevisionModalProps) {
  const panelRef = useModalA11y(onClose);
  const [noiDung, setNoiDung] = useState('');
  const [buocVe, setBuocVe] = useState<number>(2);
  const [rows, setRows] = useState<{ name: string; weight: string }[]>([{ name: '', weight: '' }]);
  const [error, setError] = useState('');

  const setRow = (i: number, patch: Partial<{ name: string; weight: string }>) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows(rs => [...rs, { name: '', weight: '' }]);
  const removeRow = (i: number) => setRows(rs => rs.filter((_, idx) => idx !== i));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!noiDung.trim()) { setError('Vui lòng nhập nội dung CĐT điều chỉnh.'); return; }
    const newTasks = rows
      .filter(r => r.name.trim())
      .map(r => ({ name: r.name.trim(), weight: Math.max(0, parseInt(r.weight, 10) || 0) }));
    onSubmit(noiDung.trim(), buocVe, newTasks);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 bg-slate-900/70 backdrop-blur-sm">
      {/* Mobile <768px: gần toàn màn hình (13-overlays/dialog.md); md+: hộp giữa màn hình */}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="cdt-revision-title" tabIndex={-1} className="bg-white dark:bg-dark-card rounded-none md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full h-full md:h-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-brand-warning/10 dark:bg-brand-warning/10">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-brand-warning dark:text-brand-warning" />
            <h3 id="cdt-revision-title" className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">CĐT điều chỉnh hồ sơ</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-elevated text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1 md:flex-none md:max-h-[80vh] overflow-y-auto">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-dark-bg border border-slate-200/70 dark:border-slate-800 rounded-lg p-2.5 font-medium">
            📁 <b className="text-slate-700 dark:text-slate-200">{project.tenDuAn}</b> — {project.hangMuc}
            <br />Công việc đã hoàn thành của nhân sự vẫn được <b>giữ nguyên</b>. Hệ thống kéo tiến độ về bước đã chọn và tính lại % theo công việc mới.
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Nội dung CĐT điều chỉnh <span className="text-brand-danger">*</span>
            </label>
            <textarea
              value={noiDung}
              onChange={(e) => { setNoiDung(e.target.value); setError(''); }}
              placeholder="VD: CĐT điều chỉnh khối lượng phần MEP, bổ sung hạng mục PCCC..."
              className="w-full h-20 p-2 text-xs bg-white dark:bg-dark-bg border border-slate-200 dark:border-slate-800 rounded-lg font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-warning"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Kéo tiến độ về</label>
            <div className="flex gap-2">
              {[{ v: 1, t: 'Bước 1 — Tiếp nhận' }, { v: 2, t: 'Bước 2 — Triển khai hồ sơ' }].map(o => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setBuocVe(o.v)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                    buocVe === o.v
                      ? 'bg-brand-accent text-white border-brand-accent'
                      : 'bg-white dark:bg-dark-elevated text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-accent/50'
                  }`}
                >
                  {o.t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Công việc con mới (bổ sung)</label>
              <button type="button" onClick={addRow} className="text-[10px] font-black text-brand-accent dark:text-brand-accent-300 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Thêm dòng
              </button>
            </div>
            <div className="space-y-1.5">
              {rows.map((r, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => setRow(i, { name: e.target.value })}
                    placeholder="Tên công việc con mới..."
                    className="flex-1 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated focus:outline-none focus:ring-1 focus:ring-brand-accent"
                  />
                  <input
                    type="number"
                    min="0"
                    value={r.weight}
                    onChange={(e) => setRow(i, { weight: e.target.value })}
                    placeholder="%"
                    className="w-16 px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-dark-elevated focus:outline-none focus:ring-1 focus:ring-brand-accent"
                    title="Tỉ trọng (%)"
                  />
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(i)} className="p-1.5 text-brand-danger hover:bg-brand-danger/10 dark:hover:bg-brand-danger/10 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 mt-1">Có thể để trống nếu chưa bổ sung công việc mới.</p>
          </div>

          {error && <p className="text-[11px] text-brand-danger font-bold">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-elevated transition-colors">
              Hủy bỏ
            </button>
            <button type="submit" className="px-4 py-2 bg-brand-warning hover:bg-brand-warning/85 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer">
              <Save className="w-3.5 h-3.5" />
              ÁP DỤNG ĐIỀU CHỈNH
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
