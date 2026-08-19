// ===== LUẬT ĐẶT MỌI BẢNG XỔ RA (chị Trâm chốt 18/08/2026) =====
// "sửa toàn bộ nhé em, cứ bấm vô biểu tượng thì trường dữ liệu xổ ra kế bên tay phải luôn cho nó gọn,
//  trường hợp biểu tượng nằm ở góc cùng bên phải thì xổ qua bên trái, nhưng tuyệt nhiên e đừng đè lên
//  biểu tượng e."
//
// Đây là MỘT NGUỒN DUY NHẤT cho mọi bảng nổi trong app (lịch chọn ngày, danh sách chọn người thực
// hiện, và các bảng thêm sau này) — để không chỗ nào đặt kiểu khác rồi lệch.
//
// Luật:
//   1. Mặc định đặt SÁT BÊN PHẢI biểu tượng vừa bấm, cách một khe nhỏ.
//   2. Không đủ chỗ bên phải → lật sang BÊN TRÁI, cũng cách một khe.
//   3. Hai bên đều không đủ (cửa sổ quá hẹp) → kẹp vào trong tầm nhìn, rồi ĐẨY XUỐNG DƯỚI biểu tượng
//      để tuyệt đối KHÔNG ĐÈ lên nó (nếu dưới cũng hết chỗ thì đẩy lên trên).
//   4. Mép trên thẳng với biểu tượng; tràn đáy thì kéo lên, luôn nằm trong tầm nhìn.
//
// Toạ độ trả về dùng cho `position: fixed` (bảng được đưa ra <body> bằng portal nên không bị khung
// cha có overflow cắt mất — xem mục #22 và #72).

export interface ViTriNoi {
  top: number;
  left: number;
}

const KHE = 6;    // khoảng cách giữa biểu tượng và bảng
const LE = 8;     // lề tối thiểu với mép cửa sổ

/**
 * Tính chỗ đặt bảng nổi.
 * @param neo     Ô/biểu tượng vừa bấm (đã getBoundingClientRect).
 * @param rongCss Bề rộng bảng theo CSS px.
 * @param caoCss  Chiều cao (tối đa) bảng theo CSS px.
 *
 * ⚠ PHẢI BÙ MỨC PHÓNG CHỮ CỦA APP (chị Trâm báo 18/08/2026: bảng vẫn đè lên biểu tượng).
 *
 * App phóng to/thu nhỏ bằng `zoom` đặt trên <body> (nút A-/A+ và Ctrl + lăn chuột — xem fontScale
 * trong App.tsx). Bảng nổi được đưa ra <body> bằng portal nên NẰM TRONG hệ toạ độ đã phóng:
 *   · getBoundingClientRect() trả về px THẬT trên màn hình (đã nhân mức phóng);
 *   · còn `style.left/top` mình đặt lại bị NHÂN THÊM mức phóng lần nữa khi vẽ.
 * Ở mức 95%, tính ra 671px thì màn hình vẽ ở 671 × 0,95 = 637px — lùi vào 34px và đè lên biểu tượng,
 * đúng như ảnh chị Trâm gửi. Nên: tính toàn bộ theo px THẬT, xong chia lại cho mức phóng.
 */
const mucPhong = (): number => {
  if (typeof document === 'undefined') return 1;
  const z = parseFloat(getComputedStyle(document.body).zoom || '1');
  return Number.isFinite(z) && z > 0 ? z : 1;
};

export const tinhViTriBangNoi = (neo: DOMRect, rongCss: number, caoCss: number): ViTriNoi => {
  const phong = mucPhong();
  // Bề rộng/cao THẬT trên màn hình = số CSS × mức phóng.
  const rong = rongCss * phong;
  const cao = caoCss * phong;
  const rongCuaSo = window.innerWidth;
  const caoCuaSo = window.innerHeight;

  // ----- Chiều ngang: ưu tiên bên phải, hết chỗ thì lật sang bên trái -----
  let left = neo.right + KHE;
  let deBienNgang = false;
  if (left + rong > rongCuaSo - LE) {
    const trai = neo.left - rong - KHE;
    if (trai >= LE) {
      left = trai;
    } else {
      // Cả hai bên đều không đủ chỗ: kẹp vào trong tầm nhìn và nhớ là đang đè ngang.
      left = Math.max(LE, Math.min(rongCuaSo - rong - LE, neo.left));
      deBienNgang = true;
    }
  }

  // ----- Chiều dọc: mép trên thẳng với biểu tượng, tràn đáy thì kéo lên -----
  let top = neo.top;
  if (deBienNgang) {
    // Đang chồng theo chiều ngang → PHẢI tách theo chiều dọc để không đè lên biểu tượng.
    top = neo.bottom + KHE;
    if (top + cao > caoCuaSo - LE) {
      const tren = neo.top - cao - KHE;
      top = tren >= LE ? tren : Math.max(LE, caoCuaSo - cao - LE);
    }
  } else if (top + cao > caoCuaSo - LE) {
    top = Math.max(LE, caoCuaSo - cao - LE);
  }
  if (top < LE) top = LE;

  // Đổi từ px THẬT về hệ toạ độ đã phóng để đặt vào style.left/top cho đúng chỗ.
  return { top: Math.round(top / phong), left: Math.round(left / phong) };
};
