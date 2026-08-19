import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, setDoc, deleteDoc, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

// Cấu hình Firebase của dự án (web config — không phải bí mật, an toàn khi nằm trong code).
// Project "hpcons-dauthau" — do Sếp tự tạo và quản lý (project cũ "app-bao-cao-tien-do-du-an"
// không thuộc quyền quản lý của Sếp nên đã chuyển hẳn sang project này).
//
// ╔══════════════════════════════════════════════════════════════════════════════════════════╗
// ║ ⚠️ TRƯỚC KHI GỬI BẢN CHO IT / DEPLOY PRODUCTION: khối config dưới đây PHẢI là           ║
// ║    projectId: 'hpcons-dauthau'.                                                          ║
// ║                                                                                          ║
// ║ Config nằm CỨNG trong code (không đọc từ .env), nên mỗi lần thử trên project Firebase    ║
// ║ khác (project test) là phải sửa trực tiếp ở đây — và rất dễ quên đổi lại. Gửi IT bản     ║
// ║ đang trỏ project test thì app production chạy trên dữ liệu rỗng, còn dữ liệu thật của    ║
// ║ Phòng vẫn nằm ở hpcons-dauthau: cả phòng mở app ra là thấy trắng.                        ║
// ║                                                                                          ║
// ║ Kiểm 1 câu trước khi bàn giao:  grep -n "projectId" src/lib/firebase.ts                  ║
// ╚══════════════════════════════════════════════════════════════════════════════════════════╝
const configProduction = {
  apiKey: 'AIzaSyDqvfIwBIC1Cnm5DNVbgJk2apn-SE1pLLg',
  authDomain: 'hpcons-dauthau.firebaseapp.com',
  projectId: 'hpcons-dauthau',
  storageBucket: 'hpcons-dauthau.firebasestorage.app',
  messagingSenderId: '232555333681',
  appId: '1:232555333681:web:a91c5fcd137035c50c6d10',
};

// Cho phép TRỎ SANG PROJECT KHÁC bằng 1 biến môi trường duy nhất, dùng cho bản DEMO trên web
// (project Firebase THỬ) mà không phải sửa code. KHÔNG khai biến này thì chạy y như cũ với
// project thật ở trên — nên IT triển khai production không cần làm gì thêm.
// Cách khai (Vercel → Environment Variables), dán JSON một dòng:
//   NEXT_PUBLIC_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}
const docConfigTuEnv = (): typeof configProduction | null => {
  const raw = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
  if (!raw) return null;
  try {
    const c = JSON.parse(raw);
    // Thiếu 1 trong 3 trường cốt lõi là config hỏng → thà dùng production còn hơn chạy nửa vời
    if (!c?.apiKey || !c?.projectId || !c?.appId) {
      console.error('[Firebase] NEXT_PUBLIC_FIREBASE_CONFIG thiếu apiKey/projectId/appId — dùng config production.');
      return null;
    }
    return {
      apiKey: c.apiKey,
      authDomain: c.authDomain || `${c.projectId}.firebaseapp.com`,
      projectId: c.projectId,
      storageBucket: c.storageBucket || `${c.projectId}.firebasestorage.app`,
      messagingSenderId: c.messagingSenderId || '',
      appId: c.appId,
    };
  } catch (e: any) {
    console.error('[Firebase] NEXT_PUBLIC_FIREBASE_CONFIG không phải JSON hợp lệ — dùng config production:', e?.message);
    return null;
  }
};

const firebaseConfig = docConfigTuEnv() || configProduction;

// ===== CONFIG PROJECT THỬ (app-bao-cao-tien-do-da-ver2) — chỉ dán vào biến trên khi cần chạy
//       NEXT_PUBLIC_DEV_CLOUD_TEST=1, XONG PHẢI ĐỔI LẠI khối production ở trên.
// const firebaseConfig = {
//   apiKey: 'AIzaSyAztEX0TNSNBKItcKZXlSHYe0JadrdMU3o',
//   authDomain: 'app-bao-cao-tien-do-da-ver2.firebaseapp.com',
//   projectId: 'app-bao-cao-tien-do-da-ver2',
//   storageBucket: 'app-bao-cao-tien-do-da-ver2.firebasestorage.app',
//   messagingSenderId: '697443458137',
//   appId: '1:697443458137:web:52f5af201000982097e548',
// };

export const fbApp = initializeApp(firebaseConfig);
export const fsDb = getFirestore(fbApp);
export const fbAuth = getAuth(fbApp);

// ===== Xác thực Firebase (Email/Password) =====
// Tài khoản Firebase dùng "email kỹ thuật" suy ra từ tên đăng nhập — người dùng không cần biết.
export const AUTH_EMAIL_DOMAIN = '@hpcons-erp.app';
export const authEmailFor = (username: string): string =>
  username.trim().toLowerCase().replace(/\s+/g, '') + AUTH_EMAIL_DOMAIN;

/** Lắng nghe trạng thái đăng nhập Firebase (đăng nhập/đăng xuất, kể cả phiên lưu sẵn). */
export const watchAuth = (cb: (user: User | null) => void): Unsubscribe => onAuthStateChanged(fbAuth, cb);

/** Đăng nhập bằng Custom Token do cầu nối SSO App Tổng (/api/auth/hpcore-session) cấp. */
export const signInWithHpcoreToken = (token: string): Promise<void> =>
  signInWithCustomToken(fbAuth, token).then(() => undefined);

/** projectId Firebase đang chạy — để App.tsx chặn chế độ thử-cloud nếu đang trỏ project THẬT. */
export const projectIdDangChay = (): string => fbApp.options.projectId || '';

/** Project Firebase chứa dữ liệu THẬT của Phòng — không được đem ra thử nghiệm ghi/xóa. */
export const PROJECT_THAT = 'hpcons-dauthau';

/**
 * Đăng nhập ẨN DANH — chỉ dùng cho chế độ thử-cloud trên máy cá nhân (NEXT_PUBLIC_DEV_CLOUD_TEST),
 * nơi SSO App Tổng không chạy được vì cookie phiên chỉ gửi tới subdomain hpcore.vn.
 * Cần bật Anonymous sign-in trong Firebase Console của project THỬ (đừng bật ở project thật).
 */
export const signInAnonymouslyFb = (): Promise<void> =>
  signInAnonymously(fbAuth).then(() => undefined);

/** Đăng xuất khỏi Firebase Auth — dùng khi rời app, phiên đăng nhập thật nằm ở App Tổng. */
export const signOutFb = (): Promise<void> => signOut(fbAuth);

// Firestore không nhận giá trị `undefined` — làm sạch object trước khi ghi
const sanitize = <T,>(item: T): T => JSON.parse(JSON.stringify(item));

// ===== BỘ NHỚ ĐỆM BẢN CLOUD — ĐỂ CHỈ GHI PHẦN THỰC SỰ ĐỔI (chị Trâm lo chi phí, 18/08/2026) =====
// Trước đây mỗi lần lưu là app: (1) getDocs đọc TOÀN BỘ collection, rồi (2) set() LẠI MỌI bản ghi
// dù chỉ đổi đúng một hồ sơ. Phòng vài chục người, mỗi thao tác nhỏ sinh ra hàng trăm lượt
// đọc/ghi, và mỗi lượt ghi còn bắn về TẤT CẢ máy đang mở qua onSnapshot → nhân thêm lần nữa.
// Đó là đường nhanh nhất để vượt hạn mức Firestore (app trắng dữ liệu) và đội tiền.
//
// Nay giữ một bản sao (id → JSON) của những gì cloud đang có, cập nhật liên tục từ chính
// onSnapshot, nên lúc ghi chỉ cần so để biết bản nào đổi:
//   · Bản ghi KHÔNG đổi  → bỏ qua hoàn toàn (0 lượt ghi).
//   · Bản ghi mới/đã sửa → ghi đúng bản đó.
//   · Bản ghi bị xoá     → xoá đúng bản đó.
// Không còn getDocs khi lưu, nên cũng hết phần đọc thừa.
const banSaoCloud: Record<string, Map<string, string>> = {};

// So sánh phải ỔN ĐỊNH: JSON.stringify giữ nguyên thứ tự khoá của object, mà dữ liệu đọc từ
// Firestore thường có thứ tự khoá khác bản dựng trong máy → cùng nội dung vẫn ra chuỗi khác nhau
// và app tưởng "đã đổi", ghi lại thừa. Hàm này sắp xếp khoá trước khi so.
const chuoiOnDinh = (v: unknown): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(chuoiOnDinh).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${chuoiOnDinh(o[k])}`).join(',')}}`;
};

/** Kết quả một lần đồng bộ — App dùng để ghi log/đo lượng ghi. */
export interface KetQuaGhi {
  ghi: number;      // số bản ghi thực sự phải ghi lên cloud
  xoa: number;      // số bản ghi bị xoá
  boQua: number;    // số bản ghi KHÔNG đổi nên bỏ qua (tiết kiệm được)
  doTuDau: boolean; // true = lần đầu chưa có bản sao, phải đọc collection một lượt
}

// ===== HÀNG ĐỢI GHI TUẦN TỰ THEO TỪNG COLLECTION (18/08/2026) =====
// IT báo đã sửa đúng lỗi này ở bản đang chạy trên App Tổng, nên ghi lại đây cho khớp:
//
// GỐC LỖI: bấm "Lưu hồ sơ" liên tục 2–3 lần thật nhanh thì nhiều lệnh ghi chạy CHỒNG nhau. Mỗi lệnh
// tính phần chênh lệch dựa trên `banSaoCloud` ở thời điểm nó bắt đầu, mà bản sao đó chỉ được cập nhật
// SAU KHI commit xong. Mạng không đều nên lệnh bắt đầu TRƯỚC (mang dữ liệu cũ hơn) có thể commit
// XONG SAU → ghi đè mất kết quả mới nhất, kể cả bước Kanban vừa chuyển cũng bị đè về cũ, và KHÔNG
// báo lỗi gì nên không ai biết.
//
// CÁCH SỬA: mỗi collection có một hàng đợi riêng — lệnh ghi sau luôn CHỜ lệnh trước xong hẳn. Nhờ vậy
// lệnh sau mới tính phần chênh lệch trên bản sao ĐÃ CẬP NHẬT, và thứ tự ghi đúng thứ tự người bấm nên
// kết quả cuối cùng luôn là dữ liệu mới nhất. Một lệnh lỗi thì hàng đợi vẫn chạy tiếp (không nghẽn).
const hangDoiGhi: Record<string, Promise<unknown>> = {};

/**
 * Đồng bộ danh sách bản ghi lên một collection — CHỈ GHI PHẦN ĐỔI, và GHI TUẦN TỰ.
 * Giữ nguyên cách gọi cũ: truyền cả mảng, hàm tự lo phần chênh lệch.
 */
export function pushCollection<T extends { id: string }>(colName: string, items: T[]): Promise<KetQuaGhi> {
  const truoc = hangDoiGhi[colName] || Promise.resolve();
  const ketQua = truoc.catch(() => undefined).then(() => ghiMotLuot(colName, items));
  // Lưu bản đã "bọc catch" vào hàng đợi: lệnh sau chỉ cần biết lệnh trước ĐÃ XONG, không cần biết
  // nó thành công hay thất bại — nếu không, một lần lỗi mạng sẽ làm rơi mọi lần lưu sau đó.
  hangDoiGhi[colName] = ketQua.catch(() => undefined);
  return ketQua;
}

async function ghiMotLuot<T extends { id: string }>(colName: string, items: T[]): Promise<KetQuaGhi> {
  const moiNhat = new Map<string, string>();
  const banGhi = new Map<string, T>();
  items.forEach((i) => {
    if (!i?.id) return;   // id rỗng làm doc() ném lỗi và kéo sập cả lô
    const sach = sanitize(i);
    moiNhat.set(i.id, chuoiOnDinh(sach));
    banGhi.set(i.id, sach);
  });

  // Chưa có bản sao (máy vừa mở, chưa kịp nhận snapshot) → đọc một lượt để biết cloud đang có gì.
  let cu = banSaoCloud[colName];
  const doTuDau = !cu;
  if (!cu) {
    cu = new Map<string, string>();
    const dangCo = await getDocs(collection(fsDb, colName));
    dangCo.docs.forEach((d) => cu!.set(d.id, chuoiOnDinh(d.data())));
    banSaoCloud[colName] = cu;
  }

  const ghi: Array<(b: ReturnType<typeof writeBatch>) => void> = [];
  let soGhi = 0, soXoa = 0, soBoQua = 0;
  cu.forEach((_, id) => {
    if (!moiNhat.has(id)) { ghi.push((b) => b.delete(doc(fsDb, colName, id))); soXoa += 1; }
  });
  moiNhat.forEach((json, id) => {
    if (cu!.get(id) === json) { soBoQua += 1; return; }   // y hệt bản trên cloud → khỏi ghi
    ghi.push((b) => b.set(doc(fsDb, colName, id), banGhi.get(id) as object));
    soGhi += 1;
  });

  if (ghi.length === 0) return { ghi: 0, xoa: 0, boQua: soBoQua, doTuDau };

  // Firestore chỉ cho TỐI ĐA 500 phép ghi mỗi writeBatch. Trước đây dồn hết vào 1 batch: khôi phục
  // bản sao lưu nhiều hồ sơ là commit trượt SẠCH, cloud giữ nguyên dữ liệu cũ nên người dùng
  // tưởng "khôi phục không được".
  const CO_LO = 450;
  for (let i = 0; i < ghi.length; i += CO_LO) {
    const batch = writeBatch(fsDb);
    ghi.slice(i, i + CO_LO).forEach((apply) => apply(batch));
    await batch.commit();
  }
  banSaoCloud[colName] = moiNhat;   // ghi xong thì bản sao chính là dữ liệu vừa gửi
  return { ghi: soGhi, xoa: soXoa, boQua: soBoQua, doTuDau };
}

/**
 * Lắng nghe realtime một collection. Trả về hàm hủy đăng ký.
 * onData nhận (items, isEmpty) — isEmpty=true khi collection chưa có dữ liệu trên cloud.
 * onError (tùy chọn) để App báo ra MÀN HÌNH — chỉ ghi console là người dùng chỉ thấy app
 * trắng dữ liệu mà không biết vì sao (hay gặp nhất: Rules chặn, hoặc mạng chặn Firestore).
 */
// ===== ĐỌC / GHI MỘT BẢN GHI LẺ =====
// pushCollection gửi CẢ mảng nên không dùng được cho ảnh: mỗi lần lưu là đẩy lại toàn bộ ảnh (mỗi
// ảnh cả trăm KB). Ba hàm dưới làm việc trên ĐÚNG một document, dùng cho ảnh đính kèm: ghi khi thêm
// ảnh, và chỉ đọc khi người dùng bấm tải về (không đọc lúc mở danh sách hồ sơ — giữ đúng mục 38 về
// giảm chi phí Firestore).
export async function ghiBanGhiLe(colName: string, id: string, duLieu: object): Promise<void> {
  await setDoc(doc(fsDb, colName, id), duLieu);
}

export async function docBanGhiLe<T>(colName: string, id: string): Promise<T | null> {
  const d = await getDoc(doc(fsDb, colName, id));
  return d.exists() ? (d.data() as T) : null;
}

export async function xoaBanGhiLe(colName: string, id: string): Promise<void> {
  await deleteDoc(doc(fsDb, colName, id));
}

export function subscribeCollection<T>(
  colName: string,
  onData: (items: T[], isEmpty: boolean) => void,
  onError?: (colName: string, message: string) => void
): Unsubscribe {
  return onSnapshot(
    collection(fsDb, colName),
    (snap) => {
      // Cập nhật bản sao cloud từ chính snapshot → lần ghi sau chỉ cần so, không phải đọc lại.
      const ban = new Map<string, string>();
      snap.docs.forEach((d) => ban.set(d.id, chuoiOnDinh(d.data())));
      banSaoCloud[colName] = ban;
      const items = snap.docs.map((d) => d.data() as T);
      onData(items, snap.empty);
    },
    (err) => {
      console.error(`[Firebase] Lỗi lắng nghe collection "${colName}" (kiểm tra Rules trên Firebase Console):`, err.message);
      onError?.(colName, err.message);
    }
  );
}

/** Thu nhỏ ảnh đại diện về tối đa 256px (JPEG) để doc Firestore luôn dưới giới hạn 1MB */
export function downscaleImage(dataUrl: string, maxSize = 256): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
