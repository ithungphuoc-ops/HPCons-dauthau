import { Project } from '../types';
import { soLanGuiTruocApp, tongSoLanGuiCDT } from './guiCDT';

// ===== BẢNG THỐNG KÊ DỰ ÁN ĐẤU THẦU (hồ sơ ISO) — chị Trâm, góp ý #13 =====
// Dựng ĐÚNG mẫu sheet 3 "Bang thong ke du an - Ky 1" trong file
//   PHONG DAU THAU - MUC TIEU NAM 2026 - KY 1 - ver2.xlsx
// Đây là bằng chứng ISO cho mục tiêu 1 & 3 của Phòng Đấu thầu, nên bảng phải giống mẫu cả về
// BỐ CỤC lẫn HÌNH THỨC — chị Trâm trả lại bản đầu vì "chưa đúng format và rất xấu".
//
// ĐÃ ĐO TỪ FILE MẪU và cài đúng theo đó:
//   · Cột: A STT · B Mã dự án · C Dự án · D Chủ đầu tư · E–AB bốn tháng × 6 cột con ·
//     AC–AG Phân tích thầu (5 cột) · AH Hình thức báo giá · AI Đấu thầu cạnh tranh ·
//     AJ Đã có kết quả · AK Có đề xuất tối ưu chi phí · AL Vị trí dự án  → 38 cột.
//   · 4 tầng đầu: R1 tiêu đề (gộp hết bề ngang) · R2 nhóm · R3 tên tháng · R4 tên 6 cột con.
//     STT/Mã/Dự án/CĐT và 5 cột cuối gộp dọc R2:R4; nhóm tháng gộp ngang 6 cột; 5 cột
//     "Phân tích thầu" gộp dọc R3:R4.
//   · Chữ Times New Roman 11 (tiêu đề 20), CĂN GIỮA cả ngang lẫn dọc, tự xuống dòng.
//   · Ô tiêu đề: nền xanh đậm #2F5597 (Accent1 Darker 25% của mẫu), chữ trắng, in đậm.
//   · Viền: ngoài đậm (medium), trong mảnh (hair). Bề rộng cột & chiều cao dòng lấy theo mẫu.
//   · Dòng cuối TỔNG HỢP: cộng SKH và Nhận xét của TỪNG THÁNG + cộng từng cột phân tích thầu.
//
// VÌ SAO XUẤT DẠNG HTML-EXCEL (.xls) CHỨ KHÔNG PHẢI .xlsx: bản SheetJS đang dùng trong app
// (thư viện `xlsx` community) KHÔNG ghi được định dạng — xuất .xlsx thì mất sạch viền/màu/font,
// đúng cái làm bản đầu "rất xấu". App đã có 2 báo cáo khác ("Xuất Excel", "Báo cáo Chiến lược")
// dùng cách HTML-Excel này và mở bằng Excel bình thường, nên đi theo cùng cách, không thêm
// thư viện mới. Muốn .xlsx thật có định dạng thì phải thêm gói `xlsx-js-style` — cần Sếp/IT đồng ý.

export type KyBaoCao = 1 | 2 | 3;

/** Các tháng của một kỳ. Kỳ 3 gồm tháng 12 của năm TRƯỚC + tháng 1,2,3 của năm báo cáo. */
export const thangCuaKy = (ky: KyBaoCao): number[] =>
  ky === 1 ? [4, 5, 6, 7] : ky === 2 ? [8, 9, 10, 11] : [12, 1, 2, 3];

/** Năm dương lịch của một tháng trong kỳ (tháng 12 của kỳ 3 nằm ở năm trước). */
const namCuaThang = (ky: KyBaoCao, thang: number, nam: number): number =>
  ky === 3 && thang === 12 ? nam - 1 : nam;

/** Hạng mục KHÔNG đưa vào bảng thống kê ISO (chị Trâm chốt 17/08/2026). */
export const HANG_MUC_LOAI_KHOI_BANG_ISO: string[] = ['Cải tạo', 'Báo giá phát sinh'];

export const hoSoVaoBangISO = (p: Project): boolean =>
  p.loaiBanGhi !== 'DU_AN' && !HANG_MUC_LOAI_KHOI_BANG_ISO.includes(p.hangMuc);

/** "2026-04-16" → "16.04.2026" (đúng định dạng ngày trong file mẫu). */
const ngayMau = (iso?: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
};

const esc = (v?: string | number): string =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

interface LanGui {
  thang: number;
  dienGiai: string;
  ngayGui: string;
  camKet: string;
  thucHien: string;
  nhanXet: 0 | 1;
}

/**
 * Các lần gửi CĐT của một hồ sơ, chỉ giữ lần NẰM TRONG kỳ báo cáo.
 * Diễn giải ghi theo hạng mục để đọc giống mẫu: "Gửi khái toán lần 2", "Gửi chi tiết lần 7".
 * Nhận xét: 1 = gửi đúng/sớm hạn cam kết · 0 = trễ (mẫu ghi đúng như vậy).
 */
const lanGuiTrongKy = (p: Project, ky: KyBaoCao, nam: number): LanGui[] => {
  const thangs = thangCuaKy(ky);
  const camKet = p.hanHenCDT || p.ngayHoanThanhDuKienHienTai || p.ngayHoanThanhDuKienGoc || '';
  const khoiDiem = soLanGuiTruocApp(p);
  // "Khái toán" → "Gửi khái toán lần N"; "Báo giá chi tiết" → "Gửi chi tiết lần N"; còn lại "Gửi lần N"
  const loai = p.hangMuc === 'Khái toán' ? 'khái toán '
    : p.hangMuc === 'Báo giá chi tiết' ? 'chi tiết '
      : p.hangMuc === 'VE' ? 'VE '
        : p.hangMuc === 'Lập hồ sơ thầu' ? 'hồ sơ thầu ' : '';
  return (p.guiCDTLogs || [])
    .map((g): LanGui | null => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(g.ngay || '');
      if (!m) return null;
      const namGui = parseInt(m[1], 10);
      const thangGui = parseInt(m[2], 10);
      if (!thangs.includes(thangGui) || namGui !== namCuaThang(ky, thangGui, nam)) return null;
      return {
        thang: thangGui,
        dienGiai: `Gửi ${loai}lần ${khoiDiem + g.lan}`,
        ngayGui: ngayMau(g.ngay),
        camKet: ngayMau(camKet),
        thucHien: ngayMau(g.ngay),
        nhanXet: (!!camKet && g.ngay > camKet ? 0 : 1) as 0 | 1,
      };
    })
    .filter((x): x is LanGui => x !== null)
    .sort((a, b) => a.ngayGui.split('.').reverse().join('').localeCompare(b.ngayGui.split('.').reverse().join('')));
};

/** 5 cột "Phân tích thầu" — đánh dấu 1 vào đúng một cột (mẫu để trống các cột còn lại). */
const phanTichThau = (p: Project): (1 | '')[] => {
  if (p.tinhTrangDuAn === 'Đã trúng thầu') return ['', '', '', 1, ''];
  if (p.tinhTrangDuAn === 'Rớt thầu') return ['', '', 1, '', ''];
  if (p.tinhTrangDuAn === 'Ngưng triển khai') return ['', 1, '', '', ''];
  if (tongSoLanGuiCDT(p) > 0) return [1, '', '', '', ''];   // đã gửi, chưa có kết quả → Chờ KQ
  return ['', '', '', '', 1];                                // chưa gửi lần nào → còn Tiếp cận CĐT
};

const TEN_COT_THANG = ['Diễn giải', 'Số kế hoạch (SKH)', 'Ngày gửi kế hoạch', 'Tiến độ cam kết', 'Tiến độ thực hiện', 'Nhận xét'];
const TEN_COT_PHAN_TICH = ['Chờ KQ', 'Ngưng triển khai', 'Thua', 'Thắng', 'Tiếp cận CĐT'];
const TEN_COT_CUOI = [
  'Hình thức báo giá',
  'Hình thức đấu thầu cạnh tranh',
  'Gói thầu đã có kết quả gói thầu',
  'Thống kê dự án có đề xuất tối ưu chi phí cho CĐT',
  'Vị trí dự án',
];
// Bề rộng cột (đơn vị "ký tự" của Excel, đo từ file mẫu) → đổi sang px cho HTML: px ≈ ký tự × 7 + 5
const RONG_COT = [6.9, 14, 27.5, 22.9]
  .concat(...[0, 1, 2, 3].map(() => [10.4, 11.1, 10, 10, 10, 8.6]))
  .concat([12, 10.1, 8.6, 10.6, 11.5])
  .concat([16.6, 12.6, 11.8, 12.5, 32.9]);
const px = (ch: number) => Math.round(ch * 7 + 5);

const SO_COT_THANG = 6;

/** 0 → "A", 26 → "AA"… để dựng công thức SUM cho dòng TỔNG HỢP. */
const chuCot = (i: number): string => {
  let n = i, ten = '';
  do { ten = String.fromCharCode(65 + (n % 26)) + ten; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return ten;
};

// ===== DẤU TICK THAY CHO SỐ 1 (chị Trâm chốt 18/08/2026, gửi kèm ảnh bảng thật) =====
// "Hiển thị số 1 ở các ô nhận xét, phân tích thầu, hình thức đấu thầu cạnh tranh, gói thầu đã có
//  kết quả, thống kê có đề xuất tối ưu chi phí — chọn symbol, nó sẽ hiện ra dấu tick; còn số 0 là
//  loại, không tính."
// → 1 = ✔ xanh · 0 = ✘ cam (ô Nhận xét khi gửi TRỄ hạn) · không có gì = để trống.
// DÒNG TỔNG HỢP vẫn là SỐ để cộng được, đúng như file mẫu.
// Ô vẫn mang GIÁ TRỊ SỐ 1 / 0 để dòng TỔNG HỢP SUM được (chị Trâm 18/08/2026: "sở dĩ chị cho dấu
// tick = 1, còn dấu chéo = 0 chính là để sum xuống đó em, do tính tiến độ hoàn thành dựa trên
// tiến độ hoàn thành đúng kế hoạch / tổng tiến độ").
// Việc hiện ra ✔ / ✘ là do ĐỊNH DẠNG SỐ của Excel (class .tick bên dưới), không phải do ghi chữ.
// Excel không nhận định dạng thì vẫn thấy 1 / 0 — cộng vẫn đúng.
const oTick = (v: 0 | 1 | '', rs = ''): string =>
  v === '' ? `<td class="n"${rs}></td>` : `<td class="tick"${rs}>${v}</td>`;

/**
 * Dựng nội dung bảng thống kê ISO dạng HTML-Excel (mở bằng Excel giữ nguyên định dạng).
 * Trả về { html, soHoSo, soDong } để chỗ gọi tải tệp về và báo lại số liệu.
 */
export const dungBangThongKeISO = (
  projects: Project[],
  ky: KyBaoCao,
  nam: number,
  tenNguoiXuat?: string,
): { html: string; soHoSo: number; soDong: number } => {
  const thangs = thangCuaKy(ky);
  const hoSo = projects.filter(hoSoVaoBangISO);
  const SO_COT = 4 + thangs.length * SO_COT_THANG + TEN_COT_PHAN_TICH.length + TEN_COT_CUOI.length;

  // ---- Thân bảng ----
  const tongSKH: Record<number, number> = {};
  const tongNhanXet: Record<number, number> = {};
  thangs.forEach(t => { tongSKH[t] = 0; tongNhanXet[t] = 0; });
  const tongPhanTich = [0, 0, 0, 0, 0];
  let soDongThan = 0;
  let than = '';

  hoSo.forEach((p, i) => {
    const lan = lanGuiTrongKy(p, ky, nam);
    const theoThang: Record<number, LanGui[]> = {};
    thangs.forEach(t => { theoThang[t] = lan.filter(x => x.thang === t); });
    // Hồ sơ gửi nhiều lần trong CÙNG một tháng thì chiếm nhiều dòng (đúng như mẫu: dự án CHIEN YI,
    // PROFIT FOREST). Cột định danh và các cột cuối gộp dọc bằng rowspan.
    const soDong = Math.max(1, ...thangs.map(t => theoThang[t].length));
    const pt = phanTichThau(p);
    pt.forEach((v, idx) => { if (v === 1) tongPhanTich[idx] += 1; });

    for (let d = 0; d < soDong; d++) {
      than += '<tr>';
      if (d === 0) {
        const rs = soDong > 1 ? ` rowspan="${soDong}"` : '';
        than += `<td class="c"${rs}>${i + 1}</td>`;
        than += `<td class="c"${rs}>${esc(p.projectId)}</td>`;
        than += `<td class="c"${rs}>${esc(p.tenDuAn)}</td>`;
        than += `<td class="c"${rs}>${esc(p.chuDauTu)}</td>`;
      }
      thangs.forEach(t => {
        const g = theoThang[t][d];
        if (g) {
          tongSKH[t] += 1;
          tongNhanXet[t] += g.nhanXet;
          than += `<td class="c">${esc(g.dienGiai)}</td><td class="n">1</td>`
            + `<td class="c">${esc(g.ngayGui)}</td><td class="c">${esc(g.camKet)}</td>`
            + `<td class="c">${esc(g.thucHien)}</td>` + oTick(g.nhanXet);
        } else {
          than += '<td class="c"></td><td class="n"></td><td class="c"></td><td class="c"></td><td class="c"></td><td class="n"></td>';
        }
      });
      if (d === 0) {
        const rs = soDong > 1 ? ` rowspan="${soDong}"` : '';
        pt.forEach(v => { than += oTick(v === 1 ? 1 : '', rs); });
        than += `<td class="c"${rs}>${esc(p.hangMuc)}</td>`;
        than += oTick(p.hinhThucDauThau === 'Đấu thầu cạnh tranh' ? 1 : '', rs);
        than += oTick((p.tinhTrangDuAn === 'Đã trúng thầu' || p.tinhTrangDuAn === 'Rớt thầu') ? 1 : '', rs);
        // "Đề xuất tối ưu chi phí cho CĐT" = hạng mục VE (Value Engineering) — đúng nghiệp vụ phòng
        than += oTick(p.hangMuc === 'VE' ? 1 : '', rs);
        than += `<td class="c"${rs}>${esc(p.diaChi)}</td>`;
      }
      than += '</tr>';
      soDongThan += 1;
    }
  });

  // ---- Dòng TỔNG HỢP: dùng CÔNG THỨC SUM (chị Trâm chốt 18/08/2026) ----
  // "Chỗ xuất bảng em cho công thức nhé... sở dĩ chị cho dấu tick = 1, dấu chéo = 0 chính là để
  //  sum xuống đó, do tính tiến độ hoàn thành = số gửi đúng kế hoạch / tổng số lần gửi."
  // → ô dữ liệu giữ số 1/0 (chỉ hiển thị thành ✔/✘), dòng tổng ghi =SUM(...) để chị sửa tay ô nào
  //   là tổng tự chạy lại. (Dòng "tỷ lệ gửi đúng hạn" đã BỎ theo yêu cầu chị Trâm 18/08/2026.)
  const dongDau = 5;                       // dòng dữ liệu đầu tiên trong Excel (sau 1 dòng tiêu đề + 3 dòng đầu bảng)
  const dongCuoi = 4 + Math.max(1, soDongThan);
  const oTong = (cot: number, giaTri: number | string) =>
    `<td class="n" x:fmla="=SUM(${chuCot(cot)}${dongDau}:${chuCot(cot)}${dongCuoi})">${giaTri}</td>`;

  let dongTong = `<tr class="tong" style="height:34px"><td class="c" colspan="4">TỔNG HỢP</td>`;
  thangs.forEach((t, i) => {
    const c0 = 4 + i * SO_COT_THANG;
    dongTong += '<td></td>';                        // Diễn giải
    dongTong += oTong(c0 + 1, tongSKH[t]);          // Số kế hoạch (SKH)
    dongTong += '<td></td><td></td><td></td>';      // 3 cột ngày
    dongTong += oTong(c0 + 5, tongNhanXet[t]);      // Nhận xét (1 = đúng hạn)
  });
  const cPhanTich = 4 + thangs.length * SO_COT_THANG;
  tongPhanTich.forEach((v, i) => { dongTong += oTong(cPhanTich + i, v); });
  const cCuoi = cPhanTich + TEN_COT_PHAN_TICH.length;
  dongTong += '<td></td>';                          // Hình thức báo giá (chữ, không cộng)
  dongTong += oTong(cCuoi + 1, hoSo.filter(p => p.hinhThucDauThau === 'Đấu thầu cạnh tranh').length);
  dongTong += oTong(cCuoi + 2, hoSo.filter(p => p.tinhTrangDuAn === 'Đã trúng thầu' || p.tinhTrangDuAn === 'Rớt thầu').length);
  dongTong += oTong(cCuoi + 3, hoSo.filter(p => p.hangMuc === 'VE').length);
  dongTong += '<td></td></tr>';                     // Vị trí dự án

  // ---- 4 tầng tiêu đề ----
  const colgroup = RONG_COT.slice(0, SO_COT).map(w => `<col width="${px(w)}">`).join('');
  const hangThang = thangs.map(t => `<th class="h" colspan="${SO_COT_THANG}">Tháng ${t}/${namCuaThang(ky, t, nam)}</th>`).join('');
  const hangPhanTich = TEN_COT_PHAN_TICH.map(c => `<th class="h" rowspan="2">${esc(c)}</th>`).join('');
  const hangConThang = thangs.map(() => TEN_COT_THANG.map(c => `<th class="h">${esc(c)}</th>`).join('')).join('');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Bang thong ke du an - Ky ${ky}</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/><x:Print><x:ValidPrinterInfo/><x:PaperSizeIndex>9</x:PaperSizeIndex>
<x:Scale>60</x:Scale><x:HorizontalResolution>600</x:HorizontalResolution></x:Print>
<x:FreezePanes/><x:FrozenNoSplit/><x:SplitHorizontal>4</x:SplitHorizontal><x:TopRowBottomPane>4</x:TopRowBottomPane>
<x:SplitVertical>4</x:SplitVertical><x:LeftColumnRightPane>4</x:LeftColumnRightPane><x:ActivePane>0</x:ActivePane>
</x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  /* Toàn bảng dùng Times New Roman như file mẫu của Phòng */
  table { border-collapse: collapse; font-family: "Times New Roman", serif; font-size: 11pt; }
  td, th { border: 0.5pt solid #808080; vertical-align: middle; text-align: center;
           mso-number-format:"\\@"; }  /* \\@ = giữ nguyên chữ, không để Excel tự đổi ngày */
  th.h { background: #2F5597; color: #FFFFFF; font-weight: bold; }
  tr.hdr td, tr.hdr th { border: 1pt solid #000000; }
  /* Mẫu của Phòng căn GIỮA mọi ô, kể cả tên dự án dài (đo ở file mẫu: A5,B5,C5,AL5 center+wrap) */
  td.c { text-align: center; }
  td.n { text-align: center; mso-number-format:"0"; }
  /* Ô TICK: giá trị THẬT trong ô là số 1 / 0 để SUM được (chị Trâm chốt 18/08/2026); Excel chỉ
     HIỂN THỊ thành dấu tick / dấu chéo nhờ định dạng số ở dòng dưới. Lưu ý khi sửa: đây là chuỗi
     template của JS nên mọi dấu gạch chéo ngược phải viết ĐÔI, viết thiếu là Excel bỏ qua định
     dạng và hiện ra số 1 / 0 (đúng lỗi gặp lần đầu) — hoặc tệ hơn, TypeScript báo lỗi octal. */
  td.tick { text-align: center; font-weight: bold;
            mso-number-format:"[Blue]\\0022✔\\0022\\;\\;[Red]\\0022✘\\0022"; }
  tr.tong td { background: #2F5597; color: #FFFFFF; font-weight: bold; border-top: 1pt solid #000000; }
  .tieude { font-size: 20pt; font-weight: bold; text-align: center; border: 1pt solid #000000; }
  .ghichu { font-family: "Times New Roman", serif; font-size: 10pt; font-style: italic; }
</style>
</head>
<body>
<table>
  <colgroup>${colgroup}</colgroup>
  <tr style="height:46px"><td class="tieude" colspan="${SO_COT}">BẢNG THỐNG KÊ DỰ ÁN ĐẤU THẦU - KỲ ${ky} - NĂM ${nam}</td></tr>
  <tr class="hdr" style="height:34px">
    <th class="h" rowspan="3">STT</th>
    <th class="h" rowspan="3">Mã dự án</th>
    <th class="h" rowspan="3">Dự án</th>
    <th class="h" rowspan="3">Chủ đầu tư</th>
    <th class="h" colspan="${thangs.length * SO_COT_THANG}">Số kế hoạch thực hiện dự án (diễn giải lần gửi/ số báo giá gửi trong tháng)</th>
    <th class="h" colspan="${TEN_COT_PHAN_TICH.length}">Phân tích thầu</th>
    ${TEN_COT_CUOI.map(c => `<th class="h" rowspan="3">${esc(c)}</th>`).join('')}
  </tr>
  <tr class="hdr" style="height:31px">${hangThang}${hangPhanTich}</tr>
  <tr class="hdr" style="height:38px">${hangConThang}</tr>
  ${than}
  ${dongTong}
</table>
<p class="ghichu">Phạm vi: KHÔNG tính gói thầu hạng mục ${HANG_MUC_LOAI_KHOI_BANG_ISO.join(' / ')} (theo mục tiêu ISO của Phòng Đấu thầu).<br>
Ký hiệu: ✔ = 1 (gửi đúng hoặc sớm hạn cam kết) · ✘ = 0 (gửi trễ hạn) · để trống = không tính. Ô là SỐ nên cộng được — dòng TỔNG HỢP dùng công thức SUM, sửa ô nào thì tổng tự chạy lại.<br>
Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}${tenNguoiXuat ? ` · Người xuất: ${tenNguoiXuat}` : ''}</p>
</body></html>`;

  return { html, soHoSo: hoSo.length, soDong: soDongThan };
};

/** Tên tệp xuất ra (.xls vì là HTML-Excel có định dạng — xem ghi chú đầu file). */
export const tenTepBangISO = (ky: KyBaoCao, nam: number): string =>
  `BANG THONG KE DU AN DAU THAU - KY ${ky} - NAM ${nam}.xls`;
