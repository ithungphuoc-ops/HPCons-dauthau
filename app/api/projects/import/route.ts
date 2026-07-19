import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";

// 2. SECURE EXCEL IMPORT & VALIDATION API
// Nhận danh sách dự án + nhân sự HIỆN CÓ trực tiếp từ trình duyệt (nguồn thật là Firebase/state
// client) để merge — không đọc/ghi file trên server vì ổ đĩa server (Vercel) chỉ đọc.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileData } = body;
    if (!fileData) {
      return NextResponse.json({ error: "Không tìm thấy dữ liệu tệp được tải lên." }, { status: 400 });
    }

    const activeState: any[] = Array.isArray(body.projects) ? body.projects : [];

    // Parse Excel spreadsheet base64
    const buffer = Buffer.from(fileData, "base64");
    // raw:true stops the CSV parser from converting "2/6/2026" to a US-style date; we parse day-first ourselves
    const workbook = xlsx.read(buffer, { type: "buffer", raw: true });

    if (workbook.SheetNames.length === 0) {
      throw new Error("Tệp Excel không chứa bất kỳ trang tính nào.");
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (rawRows.length <= 1) {
      throw new Error("Trang tính rỗng hoặc chỉ có dòng tiêu đề mà không có hàng dữ liệu.");
    }

    const headerRow = rawRows[0];
    if (!headerRow || headerRow.length === 0) {
      throw new Error("Không thể tìm thấy dòng tiêu đề trong trang tính.");
    }

    // Validation Engine: Dynamic header mapping
    // Supports both the internal HP-CONS template and "Template 2" exported by the sales team
    // (Mã DA, Tên dự án, Chủ đầu tư, Quốc tịch, KCN, Tỉnh/TP, Loại công trình, Hình thức,
    //  Giai đoạn, Trạng thái, Diện tích đất, Mức ưu tiên, NV phụ trách, Ngày tạo)
    const mappings = {
      projectId: -1,
      tenDuAn: -1,
      hangMuc: -1,
      moTa: -1,
      ngayBatDau: -1,
      soNgayDuKien: -1,
      quanLyId: -1,
      thucHienId: -1,
      chuDauTu: -1,
      quocTich: -1,
      khuCongNghiep: -1,
      tinhThanh: -1,
      loaiCongTrinh: -1,
      hinhThucXayDung: -1,
      giaiDoanDuAn: -1,
      tinhTrangDuAn: -1,
      dienTichDat: -1,
      mucUuTien: -1,
      nvPhuTrach: -1,
      ngayTao: -1,
      task1: -1,
      task2: -1,
      task3: -1,
      task4: -1
    };

    headerRow.forEach((col: any, idx: number) => {
      if (!col) return;
      const s = col.toString().trim().toLowerCase();
      // Money columns (Giá trị ước tính / Giá trị HĐ / DT đã thu / Quy mô) are confidential and intentionally never imported
      if (s.includes("giá trị") || s.includes("gia tri") || s.includes("doanh thu") || s.includes("đã thu") || s.includes("budget") || s.includes("quy mô") || s.includes("quy mo")) return;
      if (s.includes("mã dự án") || s.includes("mã da") || s.includes("project_id") || s.includes("project id") || s.includes("ma du an") || s.includes("ma da")) mappings.projectId = idx;
      else if (s.includes("tên dự án") || s.includes("project_name") || s.includes("project name") || s.includes("ten du an")) mappings.tenDuAn = idx;
      else if (s.includes("chủ đầu tư") || s.includes("chu dau tu") || s === "cđt" || s.includes("investor")) mappings.chuDauTu = idx;
      else if (s.includes("quốc tịch") || s.includes("quoc tich")) mappings.quocTich = idx;
      else if (s.includes("kcn") || s.includes("khu công nghiệp") || s.includes("khu cong nghiep")) mappings.khuCongNghiep = idx;
      else if (s.includes("tỉnh") || s.includes("tinh/tp")) mappings.tinhThanh = idx;
      else if (s.includes("loại công trình") || s.includes("loai cong trinh")) mappings.loaiCongTrinh = idx;
      else if (s.includes("giai đoạn") || s.includes("giai doan")) mappings.giaiDoanDuAn = idx;
      else if (s.includes("trạng thái") || s.includes("trang thai")) mappings.tinhTrangDuAn = idx;
      else if (s.includes("diện tích") || s.includes("dien tich")) mappings.dienTichDat = idx;
      else if (s.includes("ưu tiên") || s.includes("uu tien") || s.includes("priority")) mappings.mucUuTien = idx;
      else if (s.includes("phụ trách") || s.includes("phu trach")) mappings.nvPhuTrach = idx;
      else if (s.includes("ngày tạo") || s.includes("ngay tao") || s.includes("created")) mappings.ngayTao = idx;
      else if (s.includes("hình thức") && !s.includes("đấu thầu") && !s.includes("báo giá")) mappings.hinhThucXayDung = idx;
      else if (s.includes("hạng mục") || s.includes("category") || s.includes("hang muc")) mappings.hangMuc = idx;
      else if (s.includes("mô tả") || s.includes("description") || s.includes("mo ta")) mappings.moTa = idx;
      else if (s.includes("ngày bắt đầu") || s.includes("start_date") || s.includes("start date") || s.includes("ngay bat dau")) mappings.ngayBatDau = idx;
      else if (s.includes("ngày dự kiến") || s.includes("số ngày") || s.includes("timeline") || s.includes("so ngay") || s.includes("thời gian") || s.includes("duration")) mappings.soNgayDuKien = idx;
      else if (s.includes("quản lý") || s.includes("manager") || s.includes("quan ly")) mappings.quanLyId = idx;
      else if (s.includes("thực hiện") || s.includes("staff") || s.includes("thuc hien")) mappings.thucHienId = idx;
      else if (s.includes("nghiên cứu") || s.includes("sơ bộ") || s.includes("task 1") || s.includes("task1") || s.includes("mục 1")) mappings.task1 = idx;
      else if (s.includes("bóc tách") || s.includes("mepf") || s.includes("task 2") || s.includes("task2") || s.includes("mục 2")) mappings.task2 = idx;
      else if (s.includes("đơn giá") || s.includes("vật tư") || s.includes("task 3") || s.includes("task3") || s.includes("mục 3")) mappings.task3 = idx;
      else if (s.includes("phê duyệt") || s.includes("đóng gói") || s.includes("task 4") || s.includes("task4") || s.includes("mục 4")) mappings.task4 = idx;
    });

    const missingHeaders: string[] = [];
    if (mappings.tenDuAn === -1) missingHeaders.push("Tên Dự Án (Project Name)");
    if (mappings.ngayBatDau === -1 && mappings.ngayTao === -1) missingHeaders.push("Ngày Bắt Đầu hoặc Ngày Tạo (Start/Created Date)");

    if (missingHeaders.length > 0) {
      throw new Error(`Cấu trúc tệp không hợp lệ! Thiếu các cột tiêu đề bắt buộc: ${missingHeaders.join(", ")}`);
    }

    // Resolve "NV phụ trách" names against the staff list gửi kèm từ trình duyệt
    const staffLookup: any[] = Array.isArray(body.staff) ? body.staff : [];
    const findStaffIdByName = (name: string): string | undefined => {
      const n = name.trim().toLowerCase();
      if (!n) return undefined;
      const hit = staffLookup.find((st: any) => {
        const full = (st.hoTen || "").toLowerCase();
        return full && (full === n || full.includes(n) || n.includes(full));
      });
      return hit?.id;
    };

    // Individual row-by-row structure validation
    const validationErrors: { row: number; col: string; val: any; msg: string }[] = [];
    const validProjectsToImport: any[] = [];

    for (let idx = 1; idx < rawRows.length; idx++) {
      const row = rawRows[idx];
      // Skip completely empty rows
      if (!row || row.length === 0 || row.every(cell => cell === undefined || cell === null || cell === "")) {
        continue;
      }

      const getVal = (colIndex: number) => {
        if (colIndex === -1 || colIndex >= row.length) return undefined;
        return row[colIndex];
      };

      const rawTen = getVal(mappings.tenDuAn);
      // Template 2 has no "Ngày bắt đầu" — fall back to the sales "Ngày tạo" column
      const rawNgayBatDau = getVal(mappings.ngayBatDau) !== undefined ? getVal(mappings.ngayBatDau) : getVal(mappings.ngayTao);
      const rawSoNgay = getVal(mappings.soNgayDuKien);
      const rawId = getVal(mappings.projectId);

      const rowNum = idx + 1; // 1-indexed spreadsheet rows

      // 1. Project Name validation
      if (!rawTen || rawTen.toString().trim() === "") {
        validationErrors.push({ row: rowNum, col: "Tên Dự Án", val: rawTen, msg: "Tên dự án thầu là bắt buộc và không được để trống." });
      }

      // 2. Start date validation
      let formattedDate = "";
      if (!rawNgayBatDau) {
        validationErrors.push({ row: rowNum, col: "Ngày Bắt Đầu", val: rawNgayBatDau, msg: "Ngày bắt đầu thực hiện hồ sơ thầu là bắt buộc." });
      } else {
        if (typeof rawNgayBatDau === "number") {
          // Convert Excel serial date
          const utcDays = Math.floor(rawNgayBatDau - 25569);
          const dateVal = new Date(utcDays * 86400 * 1000);
          if (isNaN(dateVal.getTime())) {
            validationErrors.push({ row: rowNum, col: "Ngày Bắt Đầu", val: rawNgayBatDau, msg: "Định dạng ngày Excel không thể phân tích." });
          } else {
            const y = dateVal.getUTCFullYear();
            const m = String(dateVal.getUTCMonth() + 1).padStart(2, "0");
            const d = String(dateVal.getUTCDate()).padStart(2, "0");
            formattedDate = `${y}-${m}-${d}`;
          }
        } else {
          const cleanStr = rawNgayBatDau.toString().trim();
          // Vietnamese business files are day-first: 2/6/2026 = ngày 2 tháng 6, also dd-mm-yy
          const vnMatch = cleanStr.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
          if (vnMatch) {
            const d = parseInt(vnMatch[1]);
            const mo = parseInt(vnMatch[2]);
            let y = parseInt(vnMatch[3]);
            if (y < 100) y += 2000;
            if (mo < 1 || mo > 12 || d < 1 || d > 31) {
              validationErrors.push({ row: rowNum, col: "Ngày Bắt Đầu", val: rawNgayBatDau, msg: "Ngày bắt đầu sai định dạng (Vui lòng dùng ngày/tháng/năm)." });
            } else {
              formattedDate = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            }
          } else {
            const dateVal = new Date(cleanStr);
            if (isNaN(dateVal.getTime())) {
              validationErrors.push({ row: rowNum, col: "Ngày Bắt Đầu", val: rawNgayBatDau, msg: "Ngày bắt đầu sai định dạng (Vui lòng sử dụng YYYY-MM-DD, ngày/tháng/năm hoặc định dạng ngày Excel)." });
            } else {
              const y = dateVal.getFullYear();
              const m = String(dateVal.getMonth() + 1).padStart(2, "0");
              const d = String(dateVal.getDate()).padStart(2, "0");
              formattedDate = `${y}-${m}-${d}`;
            }
          }
        }
      }

      // 4. Timeline / Số ngày dự kiến validation (positive integer, defaults to 10 when the file has no duration column)
      let daysNum = 10;
      if (mappings.soNgayDuKien !== -1 && rawSoNgay !== undefined && rawSoNgay !== null && rawSoNgay !== "") {
        daysNum = Number(rawSoNgay);
        if (isNaN(daysNum) || !Number.isInteger(daysNum) || daysNum <= 0) {
          validationErrors.push({ row: rowNum, col: "Số Ngày Dự Kiến", val: rawSoNgay, msg: "Thời gian thực hiện dự kiến phải là một số nguyên dương đại diện cho số ngày." });
        }
      }

      // 5. Category validation — khi tệp không có cột hạng mục, suy ra từ Giai đoạn của kinh doanh
      const rawGiaiDoanCat = (getVal(mappings.giaiDoanDuAn) || "").toString().trim().toLowerCase();
      const defaultCat = (rawGiaiDoanCat.includes("thiết kế") || rawGiaiDoanCat.includes("báo giá")) ? "Báo giá chi tiết" : "Khái toán";
      let cat = (getVal(mappings.hangMuc) || defaultCat).toString().trim();
      const validCats = ["Báo giá chi tiết", "Khái toán", "Báo giá phát sinh", "Cải tạo", "Thiết kế kỹ thuật", "Lập hồ sơ thầu"];
      if (!validCats.includes(cat)) {
        validationErrors.push({ row: rowNum, col: "Hạng Mục", val: cat, msg: `Hạng mục thầu không hợp lệ. Chỉ chấp nhận các loại: ${validCats.join(", ")}` });
      }

      // If no critical errors on this row, build the official object
      if (validationErrors.length === 0) {
        const pId = rawId ? rawId.toString().trim() : `2026.${String(activeState.length + validProjectsToImport.length + 1).padStart(2, "0")}`;
        const newId = `P${Math.floor(100 + Math.random() * 900)}`;

        const startDateObj = new Date(formattedDate);
        const endDateObj = new Date(startDateObj.getTime() + daysNum * 24 * 60 * 60 * 1000);
        const endFormatted = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, "0")}-${String(endDateObj.getDate()).padStart(2, "0")}`;

        const parseTaskStatus = (rawVal: any) => {
          if (rawVal === undefined || rawVal === null) return false;
          const s = rawVal.toString().trim().toLowerCase();
          return s === "✔" || s === "1" || s === "true" || s === "xong" || s === "hoàn thành" || s === "yes" || s === "completed" || s === "100" || s === "100%";
        };

        const t1Done = parseTaskStatus(getVal(mappings.task1));
        const t2Done = parseTaskStatus(getVal(mappings.task2));
        const t3Done = parseTaskStatus(getVal(mappings.task3));
        const t4Done = parseTaskStatus(getVal(mappings.task4));

        let calculatedTienDoBoPhan = 0;
        if (t1Done) calculatedTienDoBoPhan += 25;
        if (t2Done) calculatedTienDoBoPhan += 40;
        if (t3Done) calculatedTienDoBoPhan += 20;
        if (t4Done) calculatedTienDoBoPhan += 15;

        // Template 2 sales fields (money columns deliberately never read)
        const nvName = (getVal(mappings.nvPhuTrach) || "").toString().trim();
        const matchedStaffId = findStaffIdByName(nvName);
        const thucHien = getVal(mappings.thucHienId)?.toString().trim() || matchedStaffId || "S003";

        const rawDienTich = (getVal(mappings.dienTichDat) || "").toString().replace(/[^\d.]/g, "");
        const dienTichNum = rawDienTich ? Number(rawDienTich) : undefined;

        const rawUuTien = getVal(mappings.mucUuTien);
        const uuTienNum = (rawUuTien !== undefined && rawUuTien !== null && rawUuTien !== "" && !isNaN(Number(rawUuTien))) ? Number(rawUuTien) : undefined;

        const rawTinhTrang = (getVal(mappings.tinhTrangDuAn) || "").toString().toLowerCase();
        const tinhTrang = rawTinhTrang.includes("trúng") ? "Đã trúng thầu"
          : rawTinhTrang.includes("rớt") ? "Rớt thầu"
          : (rawTinhTrang.includes("ngưng") || rawTinhTrang.includes("dừng")) ? "Ngưng triển khai"
          : "Đang triển khai";

        const rawGiaiDoan = (getVal(mappings.giaiDoanDuAn) || "").toString().toLowerCase();
        const giaiDoan = rawGiaiDoan.includes("chưa") ? "Chưa tiếp cận"
          : rawGiaiDoan.includes("tiền khả thi") ? "Tiếp cận & Tiền khả thi"
          : rawGiaiDoan ? "Thiết kế & Báo giá"
          : undefined;

        const rawHinhThucXD = (getVal(mappings.hinhThucXayDung) || "").toString().toLowerCase();
        const hinhThucXD = rawHinhThucXD.includes("cải tạo") ? "Cải tạo"
          : rawHinhThucXD.includes("sửa") ? "Sửa chữa"
          : rawHinhThucXD.includes("mở rộng") ? "Mở rộng"
          : "Xây mới";

        validProjectsToImport.push({
          id: newId,
          projectId: pId,
          tenDuAn: rawTen.toString().trim(),
          quanLyId: getVal(mappings.quanLyId)?.toString().trim() || "S001",
          thucHienId: thucHien,
          thucHienIds: [thucHien],
          chuDauTu: (getVal(mappings.chuDauTu) || "").toString().trim() || undefined,
          quocTich: (getVal(mappings.quocTich) || "").toString().trim() || undefined,
          khuCongNghiep: (getVal(mappings.khuCongNghiep) || "").toString().trim() || undefined,
          tinhThanh: (getVal(mappings.tinhThanh) || "").toString().trim() || undefined,
          loaiCongTrinh: (getVal(mappings.loaiCongTrinh) || "").toString().trim() || undefined,
          hinhThucXayDung: hinhThucXD,
          giaiDoanDuAn: giaiDoan,
          tinhTrangDuAn: tinhTrang,
          dienTichDat: dienTichNum,
          mucUuTien: uuTienNum,
          hangMuc: cat,
          moTa: (getVal(mappings.moTa) || "").toString().trim() || `Hồ sơ thầu hạng mục ${cat} cho dự án ${rawTen.toString().trim()}`,
          ngayBatDau: formattedDate,
          soNgayDuKien: daysNum,
          ngayHoanThanhDuKienGoc: endFormatted,
          ngayHoanThanhDuKienHienTai: endFormatted,
          tienDoBoPhan: calculatedTienDoBoPhan,
          tienDoPhong: calculatedTienDoBoPhan,
          delayLogs: [],
          tasks: [
            { id: `T${newId}1`, name: "Nghiên cứu hồ sơ thầu & Thiết kế sơ bộ", weight: 25, isCompleted: t1Done, completedAt: t1Done ? formattedDate : undefined },
            { id: `T${newId}2`, name: "Bóc tách khối lượng BOQ Kiến trúc & MEPF", weight: 40, isCompleted: t2Done, completedAt: t2Done ? formattedDate : undefined },
            { id: `T${newId}3`, name: "Xây dựng đơn giá chi tiết & Áp giá vật tư", weight: 20, isCompleted: t3Done, completedAt: t3Done ? formattedDate : undefined },
            { id: `T${newId}4`, name: "Phê duyệt tờ trình thầu & Đóng gói hồ sơ", weight: 15, isCompleted: t4Done, completedAt: t4Done ? formattedDate : undefined }
          ],
          trangThai: calculatedTienDoBoPhan === 100 ? "HOAN_THANH_DUNG_HAN" : "DANG_THUC_HIEN",
          comments: []
        });
      }
    }

    // VALIDATION EXCEPTION: không sửa gì cả — trả lỗi để client giữ nguyên state hiện tại (không có gì để rollback vì chưa từng ghi)
    if (validationErrors.length > 0) {
      return NextResponse.json({
        status: "error",
        errors: validationErrors,
        message: `Lỗi kiểm tra cấu trúc dữ liệu thầu (${validationErrors.length} lỗi form). Giao dịch đấu thầu đã bị ROLLBACK hoàn toàn để bảo toàn dữ liệu gốc.`
      }, { status: 400 });
    }

    // COMMIT TRANSACTION
    // Merge by Mã dự án: rows already in the database update sales info (keeping progress/tasks), the rest append
    const committedState = [...activeState];
    let addedCount = 0;
    let updatedCount = 0;
    for (const np of validProjectsToImport) {
      const existIdx = committedState.findIndex((e: any) =>
        e.projectId && np.projectId &&
        e.projectId.toString().trim().toLowerCase() === np.projectId.toString().trim().toLowerCase()
      );
      if (existIdx >= 0) {
        const cur = committedState[existIdx];
        committedState[existIdx] = {
          ...cur,
          tenDuAn: np.tenDuAn || cur.tenDuAn,
          chuDauTu: np.chuDauTu || cur.chuDauTu,
          quocTich: np.quocTich || cur.quocTich,
          khuCongNghiep: np.khuCongNghiep || cur.khuCongNghiep,
          tinhThanh: np.tinhThanh || cur.tinhThanh,
          loaiCongTrinh: np.loaiCongTrinh || cur.loaiCongTrinh,
          hinhThucXayDung: np.hinhThucXayDung || cur.hinhThucXayDung,
          giaiDoanDuAn: np.giaiDoanDuAn || cur.giaiDoanDuAn,
          tinhTrangDuAn: np.tinhTrangDuAn || cur.tinhTrangDuAn,
          dienTichDat: np.dienTichDat !== undefined ? np.dienTichDat : cur.dienTichDat,
          mucUuTien: np.mucUuTien !== undefined ? np.mucUuTien : cur.mucUuTien
        };
        updatedCount++;
      } else {
        committedState.push(np);
        addedCount++;
      }
    }

    return NextResponse.json({
      status: "success",
      count: validProjectsToImport.length,
      message: `Đã nhập thành công ${validProjectsToImport.length} hồ sơ thầu (${addedCount} thêm mới, ${updatedCount} cập nhật theo Mã DA)! Trình duyệt sẽ đồng bộ danh sách mới lên Firebase.`,
      projects: committedState
    });

  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      error: error.message,
      message: `Lỗi xử lý tệp nhập thầu: ${error.message}. Dữ liệu hiện tại không bị ảnh hưởng.`
    }, { status: 400 });
  }
}
