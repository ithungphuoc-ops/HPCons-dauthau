import { NextRequest, NextResponse } from "next/server";

// 1. DATE RANGE FILTER API
// Lọc dự án đang thực hiện/đấu thầu trong khoảng start_date..end_date (YYYY-MM-DD).
// Nhận danh sách dự án HIỆN CÓ trực tiếp từ trình duyệt (nguồn thật là Firebase/state client) —
// không đọc file trên server vì ổ đĩa server (Vercel) chỉ đọc và không phản ánh dữ liệu thật.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { start_date, end_date } = body;
    let projects = Array.isArray(body.projects) ? body.projects : [];

    if (start_date && end_date) {
      const start = new Date(start_date as string);
      const end = new Date(end_date as string);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        projects = projects.filter((p: any) => {
          const pStart = new Date(p.ngayBatDau);
          const pEnd = new Date(p.ngayHoanThanhDuKienHienTai || p.ngayHoanThanhDuKienGoc);
          // Overlap: project interval overlaps with [start, end]
          return pStart <= end && pEnd >= start;
        });
      }
    }

    return NextResponse.json(projects);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
