import { ghiBanGhiLe, docBanGhiLe, fbAuth } from '../lib/firebase';

// ===== ẢNH ĐÍNH KÈM TẢI VỀ ĐƯỢC — NAY LƯU NỘI DUNG TRÊN CLOUDFLARE R2 (20/08/2026) =====
// "e có thể chuyển cái này thành tệp đc ko. sau c cần c tải về, vì khi c báo cáo mục tiêu c cần tải
//  ảnh này về làm bằng chứng á e." (chị Trâm, 18/08/2026)
//
// ĐỔI 20/08/2026 (Sếp yêu cầu: "anh muốn lưu ảnh sang R2, firebase chỉ lưu database"): bản đầu
// (18/08) lưu THẲNG nội dung ảnh nén (base64) vào document Firestore, giới hạn cứng 900KB/ảnh vì
// Firestore chỉ cho 1MB/document. Nay đổi sang lưu nội dung ảnh thật trên Cloudflare R2 (bucket
// riêng `hpcons-dauthau`, domain công khai `dauthau-img.hpcore.vn`), Firestore collection
// `anhDinhKem` CHỈ CÒN giữ metadata (đường dẫn + URL công khai) — không còn giới hạn 900KB, và
// giảm hẳn dung lượng đọc/ghi Firestore vì document giờ chỉ vài trăm byte thay vì hàng trăm KB.
//
// TƯƠNG THÍCH NGƯỢC: ảnh đã lưu TRƯỚC ngày 20/08/2026 vẫn còn field `duLieu` (base64) trong
// Firestore — `docAnh`/`taiAnhVe` vẫn đọc được các ảnh đó bình thường, không cần di chuyển lại.
//
// Luồng lưu ảnh mới: nén ảnh trong trình duyệt (giữ nguyên bước này — vẫn có ích dù không còn bị
// ép bởi hạn 1MB, vì ảnh nhỏ thì xem/tải nhanh hơn) → xin presigned URL từ server (xác thực bằng
// Firebase ID token) → PUT thẳng lên R2 (không qua Vercel function) → ghi metadata vào Firestore.
//
// 🔧 VIỆC CHO IT: KHÔNG cần thêm gì ở Firestore Rules cho R2 (R2 xác thực bằng Firebase ID token
// ở API route, không qua Firestore Rules). Firestore Rules cho collection `anhDinhKem` (metadata)
// vẫn cần như cũ — xem BANGIAO.md.

const COLLECTION = 'anhDinhKem';
const KHOA_LOCAL = 'erp_anh_dinh_kem';
const HAN_BYTE = 20 * 1024 * 1024;   // 20MB — giới hạn của route upload-url, không còn bị ép bởi 1MB Firestore

/** Câu nhắc dùng chung mọi nơi gọi luuAnh() khi Firestore/R2 chưa sẵn sàng — tránh 3 nơi ghi 3 kiểu. */
export const CAU_NHAC_CHUA_MO_QUYEN =
  'Đã lưu ảnh trên máy này và tải về được ngay. Nhưng máy khác CHƯA xem được vì Firestore chưa mở '
  + 'quyền cho mục ảnh đính kèm (collection "anhDinhKem") — nhờ IT mở quyền như các mục khác là xong.';

/** Bản thử: không đọc/ghi Firestore hay R2, mọi thứ nằm trong localStorage của máy đang chạy. */
const LA_BAN_THU =
  process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_SANDBOX === '1';

/** Bản ghi CŨ (trước 20/08/2026) — nội dung ảnh nằm thẳng trong document (base64). */
export interface AnhDaLuuCu {
  ten: string;
  kieu: string;
  duLieu: string;   // dataURL base64 — CHỈ còn ở ảnh lưu trước 20/08/2026
  ngay: string;
  nguoiThem?: string;
}

/** Bản ghi MỚI (từ 20/08/2026) — chỉ metadata, nội dung thật nằm trên R2. */
export interface AnhDaLuuMoi {
  ten: string;
  kieu: string;
  url: string;      // URL công khai để xem/tải trực tiếp (dauthau-img.hpcore.vn/...)
  path: string;      // key trong bucket R2 — dùng khi cần xoá
  ngay: string;
  nguoiThem?: string;
}

export type AnhDaLuu = AnhDaLuuCu | AnhDaLuuMoi;

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
 * Nén một ảnh về Blob. Trả về kiểu + Blob + số byte để bên gọi kiểm hạn.
 * Tệp KHÔNG phải ảnh (vd .pdf) thì giữ nguyên, không nén.
 */
const nenAnh = (tep: File, maxCanh = 1600, chatLuong = 0.72): Promise<{ kieu: string; blob: Blob; bytes: number }> =>
  new Promise((giaiQuyet, tuChoi) => {
    if (!tep.type.startsWith('image/')) {
      giaiQuyet({ kieu: tep.type || 'application/octet-stream', blob: tep, bytes: tep.size });
      return;
    }
    const doc = new FileReader();
    doc.onerror = () => tuChoi(new Error('Không đọc được tệp.'));
    doc.onload = () => {
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
        if (!ctx) { giaiQuyet({ kieu: tep.type, blob: tep, bytes: tep.size }); return; }
        // Nền trắng: ảnh PNG trong suốt chuyển sang JPEG mà không lót nền sẽ ra vệt đen.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) { giaiQuyet({ kieu: tep.type, blob: tep, bytes: tep.size }); return; }
            giaiQuyet({ kieu: 'image/jpeg', blob, bytes: blob.size });
          },
          'image/jpeg',
          chatLuong,
        );
      };
      img.src = String(doc.result || '');
    };
    doc.readAsDataURL(tep);
  });

/** Chuyển Blob → dataURL (chỉ dùng cho nhánh Bản thử/localStorage, không dùng khi ghi R2). */
const blobSangDataUrl = (blob: Blob): Promise<string> =>
  new Promise((giaiQuyet, tuChoi) => {
    const r = new FileReader();
    r.onerror = () => tuChoi(new Error('Không đọc được dữ liệu ảnh.'));
    r.onload = () => giaiQuyet(String(r.result || ''));
    r.readAsDataURL(blob);
  });

/** Lưu một ảnh. Trả về tên tệp đã lưu; quá hạn thì ném lỗi có câu tiếng Việt để hiện lên cho người dùng. */
export const luuAnh = async (
  projectId: string,
  tep: File,
  nguoiThem?: string,
): Promise<{ ten: string; bytes: number; luuTamTrenMay: boolean; loiKhac?: string }> => {
  const { kieu, blob, bytes } = await nenAnh(tep);
  if (bytes > HAN_BYTE) {
    throw new Error(`Ảnh "${tep.name}" sau khi nén vẫn còn ${Math.round(bytes / 1024 / 1024)}MB — quá mức app lưu được (${HAN_BYTE / 1024 / 1024}MB). Nhờ chụp lại gọn hơn hoặc cắt bớt ảnh.`);
  }
  const id = maAnh(projectId, tep.name);

  const ghiTamTrenMay = async () => {
    const map = doLocal();
    map[id] = { ten: tep.name, kieu, duLieu: await blobSangDataUrl(blob), ngay: new Date().toISOString(), nguoiThem };
    ghiLocal(map);
  };

  if (LA_BAN_THU) {
    await ghiTamTrenMay();
    return { ten: tep.name, bytes, luuTamTrenMay: false };
  }

  // ===== R2 CHƯA SẴN SÀNG (mất mạng, chưa đăng nhập, token hết hạn...) THÌ KHÔNG ĐỂ NGƯỜI DÙNG
  // BỊ KẸT ===== Thay vì chặn hẳn, app GHI TẠM ảnh trên máy đang dùng để vẫn tải về được ngay, và
  // trả cờ `luuTamTrenMay` để giao diện nói rõ: ảnh này máy khác chưa xem được.
  try {
    const idToken = await fbAuth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Chưa đăng nhập.');

    const resUrl = await fetch('/api/anh-dinh-kem/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ projectId, fileName: tep.name, contentType: kieu, fileSize: bytes }),
    });
    if (!resUrl.ok) throw new Error((await resUrl.json().catch(() => ({})))?.error || `Lỗi xin URL tải lên (${resUrl.status}).`);
    const { path, uploadUrl, publicUrl } = await resUrl.json();

    const resPut = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': kieu }, body: blob });
    if (!resPut.ok) throw new Error(`Tải ảnh lên R2 thất bại (${resPut.status}).`);

    const ban: AnhDaLuuMoi = { ten: tep.name, kieu, url: publicUrl, path, ngay: new Date().toISOString(), nguoiThem };
    await ghiBanGhiLe(COLLECTION, id, ban);
    return { ten: tep.name, bytes, luuTamTrenMay: false };
  } catch (loi) {
    const moTa = String((loi as Error)?.message || loi);
    await ghiTamTrenMay();
    return { ten: tep.name, bytes, luuTamTrenMay: true, loiKhac: /Chưa đăng nhập/i.test(moTa) ? undefined : moTa };
  }
};

/** Đọc lại một ảnh đã lưu (chỉ gọi khi người dùng bấm tải về / xem). */
export const docAnh = async (projectId: string, tenTep: string): Promise<AnhDaLuu | null> => {
  const id = maAnh(projectId, tenTep);
  // Ưu tiên bản trên máy: gồm cả Bản thử VÀ những ảnh phải ghi tạm vì R2/Firestore chưa sẵn sàng.
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
export const coNoiDungAnh = async (projectId: string, tenTep: string): Promise<boolean> => {
  const ban = await docAnh(projectId, tenTep);
  return !!ban && ('url' in ban ? !!ban.url : !!ban.duLieu);
};

/** Tải ảnh về máy. Trả false nếu app không có nội dung tệp (ảnh khai từ trước bản này). */
export const taiAnhVe = async (projectId: string, tenTep: string): Promise<boolean> => {
  const ban = await docAnh(projectId, tenTep);
  if (!ban) return false;

  let blob: Blob;
  let kieu: string;
  if ('url' in ban && ban.url) {
    // Ảnh mới (từ 20/08/2026): nội dung thật nằm trên R2, tải qua URL công khai.
    const res = await fetch(ban.url);
    if (!res.ok) return false;
    blob = await res.blob();
    kieu = ban.kieu || blob.type || 'application/octet-stream';
  } else if ('duLieu' in ban && ban.duLieu) {
    // Ảnh cũ (trước 20/08/2026): nội dung base64 nằm thẳng trong Firestore/localStorage.
    const [phanDau, base64] = ban.duLieu.split(',');
    kieu = (phanDau.match(/data:([^;]+)/) || [])[1] || ban.kieu || 'application/octet-stream';
    const nhiPhan = atob(base64 || '');
    const mang = new Uint8Array(nhiPhan.length);
    for (let i = 0; i < nhiPhan.length; i += 1) mang[i] = nhiPhan.charCodeAt(i);
    blob = new Blob([mang], { type: kieu });
  } else {
    return false;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ban.ten || tenTep;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
};
