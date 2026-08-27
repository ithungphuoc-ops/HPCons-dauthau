import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import HighlightMatch, { normalizeSearch } from './HighlightMatch';

export interface DirectoryPerson {
  id: string; // uid App Tổng — dùng thẳng làm Mã Nhân sự (Staff.id)
  name: string;
  username: string;
  email: string | null;
  dept: string | null;
}

interface StaffDirectoryPickerProps {
  value: DirectoryPerson | null;
  onChange: (person: DirectoryPerson | null) => void;
  error?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1]?.[0] || '?').toUpperCase();
}

/**
 * Tìm & chọn 1 nhân sự THẬT từ danh bạ App Tổng (/api/staff-directory) — thay cho việc
 * gõ tay "Mã Nhân sự" + "Họ và Tên" trước đây (Sếp chốt 27/08/2026). Gõ @ hoặc tên,
 * kết quả tô xanh lá đúng chuẩn @mention toàn hệ sinh thái (xem HighlightMatch.tsx).
 */
export default function StaffDirectoryPicker({ value, onChange, error }: StaffDirectoryPickerProps) {
  const [query, setQuery] = useState('');
  const [directory, setDirectory] = useState<DirectoryPerson[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/staff-directory')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { directory: DirectoryPerson[] }) => {
        if (!cancelled) setDirectory(data.directory ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border-2 border-brand-success/60 bg-brand-success/5 dark:bg-brand-success/10 px-2.5 py-2">
        <div className="w-7 h-7 rounded-full bg-brand-primary text-white flex items-center justify-center text-[10px] font-black shrink-0">
          {initials(value.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{value.name}</div>
          {value.dept && <div className="text-[10px] text-slate-400 truncate">{value.dept}</div>}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[10px] font-bold text-brand-accent hover:underline shrink-0 cursor-pointer"
        >
          Đổi người khác
        </button>
      </div>
    );
  }

  const term = normalizeSearch(query.replace('@', '').trim());
  const results = term
    ? directory
        .filter((u) => normalizeSearch(u.name).includes(term) || normalizeSearch(u.username).includes(term))
        .slice(0, 8)
    : [];

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 border-2 rounded-lg px-2.5 py-1.5 bg-white dark:bg-dark-elevated ${
          error ? 'border-brand-danger/60' : 'border-brand-accent/70 focus-within:border-brand-accent'
        }`}
      >
        <Search className="w-3.5 h-3.5 text-brand-accent shrink-0" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={loading ? 'Đang tải danh bạ App Tổng...' : loadError ? 'Không tải được danh bạ' : 'Gõ @ hoặc tên để tìm nhân sự...'}
          disabled={loading || loadError}
          className="flex-1 min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200 bg-transparent outline-none placeholder:font-medium placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
      </div>
      {error && <span className="text-[9px] text-brand-danger mt-0.5 block font-medium leading-none">{error}</span>}
      {loadError && (
        <p className="text-[9px] text-brand-danger mt-1">Không tải được danh bạ App Tổng. Hãy tải lại trang và thử lại.</p>
      )}

      {open && term && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-dark-elevated shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-[11px] text-slate-400 text-center">
              Không tìm thấy nhân sự nào khớp &ldquo;{query}&rdquo; (hoặc đã có hồ sơ trong app này)
            </div>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onChange(u);
                  setQuery('');
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-dark-card cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-brand-primary text-white flex items-center justify-center text-[9px] font-black shrink-0">
                  {initials(u.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                    <HighlightMatch text={u.name} query={query.replace('@', '')} />{' '}
                    <span className="text-slate-400 font-medium">
                      @<HighlightMatch text={u.username} query={query.replace('@', '')} />
                    </span>
                  </div>
                  {u.dept && <div className="text-[10px] text-slate-400 truncate">{u.dept}</div>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
