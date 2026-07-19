import { useState } from 'react';
import { databaseSchema } from '../data/mockData';
import { Database, Key, Table, FileCode, CheckCircle, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function SchemaExplorer() {
  const [selectedTable, setSelectedTable] = useState<string>(databaseSchema[1].tableName); // Default to Project
  const [copied, setCopied] = useState<boolean>(false);

  const activeTable = databaseSchema.find(t => t.tableName === selectedTable) || databaseSchema[0];

  // SQL DDL Generator
  const ddlScript = `-- SCRIPT KHỞI TẠO CƠ SỞ DỮ LIỆU PHÒNG ĐẤU THẦU (ERP/BPM)
-- Tự động hóa tính điểm KPI và đồng bộ tiến độ bộ phận / phòng thầu

-- 1. Bảng nhân sự (nhan_su)
CREATE TABLE nhan_su (
    id VARCHAR(10) PRIMARY KEY,
    ho_ten VARCHAR(100) NOT NULL,
    chuc_vu VARCHAR(50) NOT NULL,
    avatar VARCHAR(255),
    kpi_diem INT DEFAULT 100
);

-- 2. Bảng dự án thầu (du_an)
CREATE TABLE du_an (
    id VARCHAR(10) PRIMARY KEY,
    project_id VARCHAR(15) UNIQUE NOT NULL,
    ten_du_an VARCHAR(255) NOT NULL,
    one_drive_link VARCHAR(255),
    quality_score INT CHECK (quality_score BETWEEN 0 AND 100),
    kpi_score DECIMAL(5, 2),
    quan_ly_id VARCHAR(10) REFERENCES nhan_su(id),
    thuc_hien_id VARCHAR(10) REFERENCES nhan_su(id),
    hang_muc VARCHAR(50) NOT NULL CHECK (hang_muc IN ('Báo giá chi tiết', 'Khái toán', 'Báo giá phát sinh', 'Cải tạo', 'Thiết kế kỹ thuật', 'Lập hồ sơ thầu')),
    mo_ta TEXT,
    ngay_bat_dau DATE NOT NULL,
    so_ngay_du_kien INT NOT NULL CHECK (so_ngay_du_kien > 0),
    ngay_ht_du_kien_goc DATE NOT NULL,
    ngay_ht_du_kien_ht DATE NOT NULL,
    tien_do_bo_phan INT DEFAULT 0 CHECK (tien_do_bo_phan BETWEEN 0 AND 100),
    tien_do_phong INT DEFAULT 0 CHECK (tien_do_phong BETWEEN 0 AND 100),
    ngay_hoan_thanh_thuc_te DATE,
    nguyen_nhan_tre_han TEXT,
    trang_thai VARCHAR(30) NOT NULL CHECK (trang_thai IN ('DANG_THUC_HIEN', 'HOAN_THANH_DUNG_HAN', 'HOAN_THANH_TRE_HAN', 'TRE_TIEN_DO')),
    created_by VARCHAR(10) REFERENCES nhan_su(id)
);

-- 3. Bảng lịch sử dời tiến độ (lich_su_tre)
CREATE TABLE lich_su_tre (
    id VARCHAR(10) PRIMARY KEY,
    du_an_id VARCHAR(10) REFERENCES du_an(id) ON DELETE CASCADE,
    ngay_thay_doi DATE NOT NULL,
    ngay_cu DATE NOT NULL,
    ngay_moi DATE NOT NULL,
    so_ngay_lech INT NOT NULL,
    ly_do TEXT NOT NULL,
    nguoi_duyet VARCHAR(100) NOT NULL
);

-- 4. Trigger tự động bù trừ (offset) tiến độ dự án khi chèn bản ghi dời hạn mới
CREATE OR REPLACE FUNCTION fn_offset_ngay_hoan_thanh()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE du_an
    SET ngay_ht_du_kien_ht = ngay_ht_du_kien_ht + (NEW.ngay_moi - NEW.ngay_cu)
    WHERE id = NEW.du_an_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sau_khi_doi_tien_do
AFTER INSERT ON lich_su_tre
FOR EACH ROW
EXECUTE FUNCTION fn_offset_ngay_hoan_thanh();`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(ddlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="schema-explorer-container">
      {/* Tables Selection & Details */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-brand-accent dark:text-brand-accent-300" />
            Lược đồ cơ sở dữ liệu (ERP/BPM)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Được thiết kế chuẩn hóa quan hệ (3NF) tối ưu cho việc truy vấn tiến độ phân cấp và tự động đồng bộ hạn thầu.
          </p>

          <div className="flex flex-col gap-2">
            {databaseSchema.map((schema) => (
              <button
                key={schema.tableName}
                onClick={() => setSelectedTable(schema.tableName)}
                className={`p-3 rounded-lg text-left text-xs transition-all flex items-center justify-between ${
                  selectedTable === schema.tableName
                    ? 'bg-brand-accent text-white font-semibold shadow-xs'
                    : 'bg-slate-50 dark:bg-dark-card/50 hover:bg-slate-100 dark:hover:bg-dark-elevated/80 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 opacity-75" />
                  <span>{schema.tableName}</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  selectedTable === schema.tableName ? 'bg-brand-accent-700 text-white' : 'bg-slate-200 dark:bg-dark-elevated text-slate-600 dark:text-slate-400'
                }`}>
                  {schema.columns.length} Fields
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Database architecture highlights */}
        <div className="bg-slate-900 text-slate-300 p-5 rounded-xl border border-slate-800 shadow-xs flex flex-col gap-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-brand-primary" />
            Đặc điểm thiết kế thông minh
          </h4>
          <ul className="text-xs space-y-2.5 list-none pl-0">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5 flex-shrink-0"></span>
              <span><strong>Trigger dời hạn thầu (Offset):</strong> Hệ thống sử dụng trigger tự động cập nhật hạn chót hiện tại cộng dồn theo các khoảng lệch ngày từ Delay Logs.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5 flex-shrink-0"></span>
              <span><strong>Tài liệu thầu OneDrive:</strong> Hỗ trợ liên kết trực tiếp đến thư mục tài liệu OneDrive chứa bản vẽ BVTC, BOQ của nhà thầu phụ phục vụ hậu kiểm.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5 flex-shrink-0"></span>
              <span><strong>Ràng buộc KPI ngặt nghèo:</strong> Trường nguyên nhân trễ hạn bắt buộc kích hoạt ở mức Database nếu xảy ra tình trạng trễ ngày thầu dự kiến.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Table schema explorer & script preview */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        {/* Schema Column Grid */}
        <div className="bg-white dark:bg-dark-card p-5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Table className="w-5 h-5 text-brand-accent dark:text-brand-accent-300" />
                Bảng: {activeTable.tableName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activeTable.description}</p>
            </div>
          </div>

          <div className="md:overflow-x-auto">
            {/* Mobile <768px: bảng reflow thành Card List (luật 9); md+: bảng như cũ */}
            <table className="w-full text-left text-xs border-collapse block md:table">
              <thead className="hidden md:table-header-group">
                <tr className="bg-slate-50 dark:bg-dark-card text-slate-600 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="p-3 font-semibold">Tên Cột (Field)</th>
                  <th className="p-3 font-semibold">Kiểu Dữ Liệu</th>
                  <th className="p-3 font-semibold">Ràng Buộc</th>
                  <th className="p-3 font-semibold">Mô Tả Ý Nghĩa</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group divide-y divide-slate-100 dark:divide-slate-800">
                {activeTable.columns.map((col, idx) => (
                  <tr key={idx} className="block md:table-row py-2 md:py-0 hover:bg-slate-50/50 dark:hover:bg-dark-card/40">
                    <td className="block md:table-cell px-3 py-0.5 md:p-3 font-mono font-bold text-brand-accent dark:text-brand-accent-300 flex items-center gap-1">
                      {col.constraints.includes('PRIMARY KEY') && <span title="Khóa chính"><Key className="w-3.5 h-3.5 text-brand-warning flex-shrink-0" /></span>}
                      {col.constraints.includes('FOREIGN KEY') && <span title="Khóa ngoại"><Database className="w-3.5 h-3.5 text-brand-accent dark:text-brand-accent-300 flex-shrink-0" /></span>}
                      {col.name}
                    </td>
                    <td className="block md:table-cell px-3 py-0.5 md:p-3 font-mono text-slate-600 dark:text-slate-300">{col.type}</td>
                    <td className="block md:table-cell px-3 py-0.5 md:p-3">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        col.constraints.includes('PRIMARY KEY') ? 'bg-brand-warning/15 text-brand-warning' :
                        col.constraints.includes('FOREIGN KEY') ? 'bg-brand-accent/10 text-brand-accent dark:text-brand-accent-300' :
                        col.constraints.includes('NOT NULL') ? 'bg-slate-100 dark:bg-dark-elevated text-slate-800 dark:text-slate-300' :
                        'bg-slate-50 dark:bg-dark-card text-slate-500 dark:text-slate-400'
                      }`}>
                        {col.constraints || 'None'}
                      </span>
                    </td>
                    <td className="block md:table-cell px-3 py-0.5 md:p-3 text-slate-600 dark:text-slate-300 font-medium">{col.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SQL Script generation preview */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-900 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-brand-accent-300" />
              Mã DDL Khởi Tạo SQL (PostgreSQL Standard)
            </h4>
            <button
              onClick={copyToClipboard}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                copied
                  ? 'bg-brand-primary text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Đã sao chép!
                </>
              ) : (
                'Sao chép mã SQL'
              )}
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto text-[11px] font-mono text-slate-400 bg-slate-900/50 p-3 rounded-lg border border-slate-800/80 leading-relaxed scrollbar-thin">
            <pre className="whitespace-pre-wrap">{ddlScript}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
