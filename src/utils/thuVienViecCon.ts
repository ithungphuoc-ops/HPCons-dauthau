import { Project, ProjectTask } from '../types';

// ===== THƯ VIỆN TÊN VIỆC CON (chị Trâm — góp ý #62, 18/08/2026) =====
// "công việc con mỗi dự án các bạn tạo e đưa thành thư viện, rồi mỗi lần các bạn bấm khởi tạo công
//  việc, thì e cho gợi ý lên đó tên 2 công việc con thường xuyên xuất hiện nhất, sau khi các bạn bấm
//  vô thêm công việc mới thì xổ ra danh sách tên thường xuất hiện cho các bạn chọn, rồi sửa trực tiếp
//  các tên đó trên thanh công cụ luôn, sau đó mới bấm thêm công việc"
//
// Thư viện KHÔNG phải một bảng khai tay: nó được đếm lại từ chính việc con của mọi hồ sơ đang có,
// nên phòng làm càng nhiều thì gợi ý càng đúng, và không ai phải bảo trì danh mục.
//
// Cách gộp tên: so theo tên đã bỏ dấu cách thừa + không phân biệt chữ hoa/thường, nhưng HIỆN LẠI
// bản viết hoa/thường xuất hiện nhiều nhất để không bị "bóc tách khối lượng" lẫn "Bóc Tách Khối Lượng".
// Bỏ qua các việc do app tự tách khi chia một việc cho nhiều người (tên có dạng "Tên — Người thực
// hiện"), vì đó không phải tên việc do người dùng đặt.

export interface TenViecConThuongDung {
  /** Tên hiển thị (bản viết hoa/thường phổ biến nhất). */
  ten: string;
  /** Số lần tên này xuất hiện trong các hồ sơ. */
  soLan: number;
}

/** Chuẩn hoá để so trùng: bỏ dấu cách thừa, về chữ thường. */
const khoaSoTrung = (ten: string) => ten.trim().replace(/\s+/g, ' ').toLowerCase();

/** Đi hết cây việc con (kể cả việc con của việc con). */
const duyetCay = (tasks: ProjectTask[] | undefined, nhan: (t: ProjectTask, capDo: number) => void, capDo = 0) => {
  (tasks || []).forEach(t => {
    nhan(t, capDo);
    duyetCay(t.subtasks, nhan, capDo + 1);
  });
};

/**
 * Dựng thư viện tên việc con từ toàn bộ hồ sơ, sắp theo SỐ LẦN XUẤT HIỆN giảm dần
 * (bằng nhau thì theo bảng chữ cái để thứ tự ổn định, không nhảy mỗi lần render).
 */
export const dungThuVienTenViecCon = (projects: Project[]): TenViecConThuongDung[] => {
  // khoá so trùng → { tổng số lần, số lần của từng cách viết }
  const dem = new Map<string, { soLan: number; cachViet: Map<string, number> }>();

  projects.forEach(p => {
    duyetCay(p.tasks, (t, capDo) => {
      const ten = (t.name || '').trim().replace(/\s+/g, ' ');
      if (!ten) return;
      // Việc do app tự tách cho từng người: tên dạng "Tên việc — Nguyễn Văn A" ở cấp con.
      if (capDo > 0 && / — /.test(ten)) return;
      const khoa = khoaSoTrung(ten);
      const o = dem.get(khoa) || { soLan: 0, cachViet: new Map<string, number>() };
      o.soLan += 1;
      o.cachViet.set(ten, (o.cachViet.get(ten) || 0) + 1);
      dem.set(khoa, o);
    });
  });

  return Array.from(dem.values())
    .map(o => {
      // Cách viết phổ biến nhất; bằng nhau thì lấy bản đầu tiên gặp (Map giữ thứ tự chèn).
      let ten = '';
      let nhieuNhat = -1;
      o.cachViet.forEach((n, t) => { if (n > nhieuNhat) { nhieuNhat = n; ten = t; } });
      return { ten, soLan: o.soLan };
    })
    .sort((a, b) => b.soLan - a.soLan || a.ten.localeCompare(b.ten, 'vi'));
};
