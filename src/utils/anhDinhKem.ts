import { ghiBanGhiLe, docBanGhiLe } from '../lib/firebase';

// ===== ẢNH ĐÍNH KÈM TẢI VỀ ĐƯỢC (chị Trâm chốt 18/08/2026) =====
// "e có thể chuyển cái này thành tệp đc ko. sau c cần c tải về, vì khi c báo cáo mục tiêu c cần tải
//  ảnh này về làm bằng chứng á e."
//
// TRƯỚC ĐÂY: mọi ô đính kèm của app chỉ lưu TÊN tệp (xem utils/attachments.ts) nên bấm vào không tải
// được gì — chị Trâm cần ảnh thật để kèm báo cáo mục tiêu.
//
// CÁCH LÀM Ở ĐÂY — giữ nguyên phần còn lại của app, KHÔNG cần bật thêm dịch vụ Google nào:
//   1. Ảnh được NÉN NGAY TRONG TRÌNH DUYỆT trước khi lưu (thu về tối đa 1600px cạnh dài, JPEG ~0,72)
//      nên ảnh chụp màn hình Zalo thường còn 100–300KB, nằm dưới hạn 1MB/document của Firestore.
//   2. Ảnh KHÔNG nằm trong hồ sơ mà ở một collection riêng `anhDinhKem`, mỗi ảnh một document.
//      Hồ sơ vẫn chỉ giữ TÊN tệp như cũ → mở danh sách hồ sơ không phải tải ảnh, giữ đúng mục 38
//      (giảm chi phí đọc/ghi Firestore). Ảnh chỉ được đọc ĐÚNG LÚC bấm "Tải về".
//   3. Bản thử (không nối Firestore) lưu trong localStorage của máy để thử được ngay.
//
// ⚠ HẠN CỦA CÁCH NÀY: một document Firestore tối đa 1MB, nên ảnh quá lớn sẽ bị từ chối (hàm trả lỗi
// rõ ràng để người dùng biết). Muốn lưu tệp gốc dung lượng lớn (PDF hồ sơ, ảnh không nén) thì phải
// bật Firebase Storage — cần Sếp/IT quyết vì phát sinh chi phí lưu trữ.
//
// 🔧 VIỆC CHO IT: mở quyền Firestore cho collection `anhDinhKem` (cùng điều kiện với `notifications`),
// nếu không thì trên bản thật việc thêm/tải ảnh sẽ báo lỗi quyền.

const COLLECTION = 'anhDinhKem';
const KHOA_LOCAL = 'erp_anh_dinh_kem';
const HAN_BYTE = 900 * 1024;   // chừa chỗ cho phần bao của document (hạn thật là 1MB)

/** Câu nhắc dùng chung mọi nơi gọi luuAnh() khi Firestore chưa mở quyền — tránh 3 nơi ghi 3 kiểu. */
export const CAU_NHAC_CHUA_MO_QUYEN =
  'Đã lưu ảnh trên máy này và tải về được ngay. Nhưng máy khác CHƯA xem được vì Firestore chưa mở '
  + 'quyền cho mục ảnh đính kèm (collection "anhDinhKem") — nhờ IT mở quyền như các mục khác là xong.';

/** Bản thử: không đọc/ghi Firestore, mọi thứ nằm trong localStorage của máy đang chạy. */
const LA_BAN_THU =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_SANDBOX === '1';

export interface AnhDaLuu {
  ten: string;      // tên tệp hiển thị
  kieu: string;     // MIME sau khi nén (image/jpeg, hoặc kiểu gốc nếu không nén được)
  duLieu: string;   // nội dung ảnh dạng dataURL (base64)
  ngay: string;     // thời điểm lưu (ISO)
  nguoiThem?: string;
}

/** Mã document của một ảnh: gắn với hồ sơ để hai hồ sơ trùng tên tệp không đè nhau. */
export const maAnh = (projectId: string, tenTep: string): string =>
  `${projectId}__${tenTep}`.replace(/[^\w.\-À-ỹ]+/g, '_').slice(0, 180);

/** Đọc/ghi localStorage cho Bản thử. */
const doLocal = (): Record<string, AnhDaLuu> => {
  try { return JSON.parse(localStorage.getItem(KHOA_LOCAL) || '{}'); }
  catch { return {}; }
};
const ghiLocal = (map: Record<string, AnhDaLuu>) => localStorage.setItem(KHOA_LOCAL, JSON.stringify(map));

/**
 * Nén một ảnh về dataURL. Trả về kiểu + dữ liệu + số byte để bên gọi kiểm hạn.
 * Tệp KHÔNG phải ảnh (vd .pdf) thì giữ nguyên, chỉ đọc thành dataURL.
 */
export const nenAnh = (tep: File, maxCanh = 1600, chatLuong = 0.72): Promise<{ kieu: string; duLieu: string; bytes: number }> =>
  new Promise((giaiQuyet, tuChoi) => {
    const doc = new FileReader();
    doc.onerror = () => tuChoi(new Error('Không đọc được tệp.'));
    doc.onload = () => {
      const nguon = String(doc.result || '');
      if (!tep.type.startsWith('image/')) {
        giaiQuyet({ kieu: tep.type || 'application/octet-stream', duLieu: nguon, bytes: nguon.length });
        return;
      }
      const img = new Image();
      img.onerror = () => tuChoi(new Error('Tệp ảnh không đọc được.'));
      img.onload = () => {
        const tyLe = Math.min(1, maxCanh / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * tyLe));
        const h = Math.max(1, Math.round(img.height * tyLe));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { giaiQuyet({ kieu: tep.type, duLieu: nguon, bytes: nguon.length }); return; }
        // Nền trắng: ảnh PNG trong suốt chuyển sang JPEG mà không lót nền sẽ ra vệt đen.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        let ra = canvas.toDataURL('image/jpeg', chatLuong);
        // Vẫn quá hạn thì nén thêm 2 vòng nữa (giảm chất lượng rồi giảm kích thước).
        if (ra.length > HAN_BYTE) ra = canvas.toDataURL('image/jpeg', 0.55);
        if (ra.length > HAN_BYTE) {
          const c2 = document.createElement('canvas');
          c2.width = Math.round(w * 0.7);
          c2.height = Math.round(h * 0.7);
          const x2 = c2.getContext('2d');
          if (x2) {
            x2.fillStyle = '#ffffff';
            x2.fillRect(0, 0, c2.width, c2.height);
            x2.drawImage(img, 0, 0, c2.width, c2.height);
            ra = c2.toDataURL('image/jpeg', 0.5);
          }
        }
        giaiQuyet({ kieu: 'image/jpeg', duLieu: ra, bytes: ra.length });
      };
      img.src = nguon;
    };
    doc.readAsDataURL(tep);
  });

/** Lưu một ảnh. Trả về tên tệp đã lưu; quá hạn thì ném lỗi có câu tiếng Việt để hiện lên cho người dùng. */
export const luuAnh = async (
  projectId: string,
  tep: File,
  nguoiThem?: string,
): Promise<{ ten: string; bytes: number; luuTamTrenMay: boolean; loiKhac?: string }> => {
  const { kieu, duLieu, bytes } = await nenAnh(tep);
  if (bytes > HAN_BYTE) {
    throw new Error(`Ảnh "${tep.name}" sau khi nén vẫn còn ${Math.round(bytes / 1024)}KB — quá mức app lưu được (900KB). Nhờ chụp lại gọn hơn hoặc cắt bớt ảnh.`);
  }
  const ban: AnhDaLuu = {
    ten: tep.name,
    kieu,
    duLieu,
    ngay: new Date().toISOString(),
    nguoiThem,
  };
  const id = maAnh(projectId, tep.name);
  const ghiTamTrenMay = () => {
    const map = doLocal();
    map[id] = ban;
    ghiLocal(map);
  };

  if (LA_BAN_THU) {
    ghiTamTrenMay();
    return { ten: tep.name, bytes, luuTamTrenMay: false };
  }

  // ===== FIRESTORE CHƯA MỞ QUYỀN THÌ KHÔNG ĐỂ NGƯỜI DÙNG BỊ KẸT (chị Trâm báo 18/08/2026) =====
  // Chị Trâm gặp đúng câu lỗi gốc của Firebase: "Missing or insufficient permissions." — collection
  // `anhDinhKem` là collection MỚI, rules của project chưa cho ghi (xem việc cho IT ở đầu file).
  // Thay vì chặn hẳn, app GHI TẠM ảnh trên máy đang dùng để chị vẫn tải về được ngay, và trả cờ
  // `luuTamTrenMay` để giao diện nói rõ: ảnh này máy khác chưa xem được, cần IT mở quyền.
  try {
    await ghiBanGhiLe(COLLECTION, id, ban);
    return { ten: tep.name, bytes, luuTamTrenMay: false };
  } catch (loi) {
    const moTa = String((loi as Error)?.message || loi);
    ghiTamTrenMay();
    if (/permission|insufficient|PERMISSION_DENIED/i.test(moTa)) {
      return { ten: tep.name, bytes, luuTamTrenMay: true };
    }
    // Lỗi khác (mất mạng…) cũng đã ghi tạm trên máy — vẫn báo để biết chưa lên cloud.
    return { ten: tep.name, bytes, luuTamTrenMay: true, loiKhac: moTa };
  }
};

/** Đọc lại một ảnh đã lưu (chỉ gọi khi người dùng bấm tải về / xem). */
export const docAnh = async (projectId: string, tenTep: string): Promise<AnhDaLuu | null> => {
  const id = maAnh(projectId, tenTep);
  // Ưu tiên bản trên máy: gồm cả Bản thử VÀ những ảnh phải ghi tạm vì Firestore chưa mở quyền.
  const tranMay = doLocal()[id];
  if (tranMay) return tranMay;
  if (LA_BAN_THU) return null;
  try {
    return await docBanGhiLe<AnhDaLuu>(COLLECTION, id);
  } catch {
    return null;   // chưa mở quyền đọc thì coi như không có, giao diện sẽ báo rõ
  }
};

/** Có nội dung tệp để tải về hay không (ảnh khai từ trước bản này thì chỉ có tên, không có nội dung). */
export const coNoiDungAnh = async (projectId: string, tenTep: string): Promise<boolean> =>
  !!(await docAnh(projectId, tenTep))?.duLieu;

/** Tải ảnh về máy. Trả false nếu app không có nội dung tệp (ảnh khai từ trước bản này). */
export const taiAnhVe = async (projectId: string, tenTep: string): Promise<boolean> => {
  const ban = await docAnh(projectId, tenTep);
  if (!ban?.duLieu) return false;
  // dataURL → Blob → thẻ <a download>: cách này tải được cả tệp nặng, không vướng hạn độ dài URL.
  const [phanDau, base64] = ban.duLieu.split(',');
  const kieu = (phanDau.match(/data:([^;]+)/) || [])[1] || ban.kieu || 'application/octet-stream';
  const nhiPhan = atob(base64 || '');
  const mang = new Uint8Array(nhiPhan.length);
  for (let i = 0; i < nhiPhan.length; i += 1) mang[i] = nhiPhan.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([mang], { type: kieu }));
  const a = document.createElement('a');
  a.href = url;
  a.download = ban.ten || tenTep;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
};
