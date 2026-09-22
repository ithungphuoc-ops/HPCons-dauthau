// ===== KHUNG NHẬP LIỆU DỰNG SẴN (chị Trâm chốt 19/09/2026) =====
// "Khi chị bấm vô dấu cộng chỗ dự án, em cho chị 2 trường cố định này: 01. Info / 02. Design /
//  03. Updating information" (chị sửa lại ngữ pháp 19/09/2026) và "cho chị sẵn 2 dòng:
//  01. BOQ / 02. Subcontractors".
//
// CỐ Ý điền THẲNG vào ô chứ không để ở placeholder: placeholder biến mất ngay khi gõ chữ đầu
// tiên, nên người nhập mất luôn cái khung phải theo. Điền sẵn thì họ gõ nội dung vào sau dấu hai
// chấm, và mọi hồ sơ trong phòng đọc lên cùng một bố cục.
//
// Chỉ điền khi ô ĐANG TRỐNG — hồ sơ đã có chữ thì tuyệt đối không đụng vào, ghi đè mô tả người
// khác đã viết là mất dữ liệu thật.

/** Mô tả dự án — khai ở hồ sơ DỰ ÁN (dấu + trong bảng Danh mục, hoặc Tạo thủ công). */
export const MAU_MO_TA_DU_AN = '01. Info:\n02. Design:\n03. Updating information:';

/** Kết quả công việc cấp Phòng — Trưởng phòng ghi khi chốt tiến độ Phòng. */
export const MAU_KET_QUA_PHONG = '01. BOQ:\n02. Subcontractors:';

/** Trả về mẫu nếu giá trị hiện tại rỗng (hoặc chỉ toàn khoảng trắng), ngược lại giữ nguyên. */
export const dungMauNeuTrong = (giaTri: string | undefined, mau: string): string =>
  (giaTri || '').trim() ? (giaTri as string) : mau;

/** Ô chỉ còn đúng cái khung, người dùng chưa điền gì → coi như bỏ trống, đừng lưu khung rỗng. */
export const chiLaKhungTrong = (giaTri: string | undefined, mau: string): boolean => {
  const sach = (s: string) => s.replace(/\s+/g, ' ').trim();
  return sach(giaTri || '') === sach(mau);
};
