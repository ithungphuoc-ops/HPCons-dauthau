// ===== SỐ LẦN ĐÃ GỬI CHỦ ĐẦU TƯ (chị Trâm — góp ý #11) =====
// "Vì các gói thầu đều đang thực hiện dang dở khi app được tạo, nên đề xuất có thêm chỗ để khai
//  thủ công số lần đã gửi CĐT để ghi nhớ."
//
// CÁCH LÀM: giữ NGUYÊN `guiCDTLogs` (nhật ký app tự ghi mỗi lần TP kéo thẻ 4 → 5) và thêm một con
// số KHAI TAY `soLanGuiCDTTruocApp` = số lần đã gửi TRƯỚC KHI dùng app.
//
// ⚠ KHÔNG cộng con số khai tay vào trường `lan` của từng bản ghi nhật ký: `lan` đang được dùng để
// khớp VÒNG làm việc (`chiTietTheoVong` tìm `g.lan === vòng`), đổi nó là lệch hết báo cáo theo vòng.
// Vì vậy con số khai tay chỉ cộng vào lúc HIỂN THỊ — dùng đúng 3 hàm dưới đây ở mọi chỗ đếm lần gửi.

type HoSoGui = {
  soLanGuiCDTTruocApp?: number;
  guiCDTLogs?: { lan: number }[];
};

/** Số lần đã gửi CĐT do người dùng khai tay (trước khi có app). Dữ liệu cũ / bỏ trống = 0. */
export const soLanGuiTruocApp = (p?: HoSoGui | null): number => {
  const n = Number(p?.soLanGuiCDTTruocApp);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** TỔNG số lần đã gửi CĐT = khai tay + số lần app tự ghi nhận. Đây là con số để hiển thị/báo cáo. */
export const tongSoLanGuiCDT = (p?: HoSoGui | null): number =>
  soLanGuiTruocApp(p) + (p?.guiCDTLogs?.length || 0);

/** Nhãn số lần cho MỘT bản ghi nhật ký: lần thứ mấy tính cả các lần khai tay. */
export const nhanLanGui = (p: HoSoGui | null | undefined, lan: number): number =>
  soLanGuiTruocApp(p) + lan;

/** Lần gửi KẾ TIẾP (dùng cho hộp xác nhận trước khi kéo 4 → 5). */
export const lanGuiKeTiep = (p?: HoSoGui | null): number => tongSoLanGuiCDT(p) + 1;
