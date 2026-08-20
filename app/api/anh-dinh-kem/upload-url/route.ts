import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/src/lib/firebase-admin";
import { createUploadUrl } from "@/src/lib/r2";
import { rateLimitOrNull } from "@/src/lib/apiRateLimit";

// Ảnh báo cáo/kết quả công việc chuyển sang lưu trên Cloudflare R2 (20/08/2026, Sếp yêu cầu:
// "muốn lưu ảnh sang R2, firebase chỉ lưu database") — trước đây nội dung ảnh nén base64 nằm
// thẳng trong document Firestore (giới hạn 1MB/document, chi phí đọc/ghi cao hơn cần thiết).
// Route này chỉ SINH presigned URL — trình duyệt PUT thẳng lên R2 (xem src/lib/r2.ts), không đưa
// nội dung ảnh qua Vercel function, đỡ tốn băng thông/thời gian thực thi serverless.
//
// Xác thực: yêu cầu Firebase ID token hợp lệ của CHÍNH project hpcons-dauthau (client đã đăng
// nhập qua SSO ở app/api/auth/hpcore-session) — khớp mức bảo mật đang có của Firestore Rules
// (`allow read, write: if request.auth != null`), không siết chặt hơn hay lỏng hơn.

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB — rộng rãi hơn hẳn hạn 900KB cũ khi còn lưu trong Firestore

interface Body {
  projectId?: string;
  fileName?: string;
  contentType?: string;
  fileSize?: number;
}

export async function POST(req: NextRequest) {
  const limited = await rateLimitOrNull(req, "anh_dinh_kem_upload_url", { windowSeconds: 60, maxRequests: 60 });
  if (limited) return limited;

  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) {
    return NextResponse.json({ error: "Thiếu token xác thực." }, { status: 401 });
  }

  try {
    await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Token không hợp lệ hoặc đã hết hạn." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.fileName || !body.contentType) {
    return NextResponse.json({ error: "Thiếu fileName/contentType." }, { status: 400 });
  }
  if (typeof body.fileSize === "number" && body.fileSize > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Tệp vượt quá ${MAX_UPLOAD_BYTES / 1024 / 1024}MB, vui lòng chọn tệp nhỏ hơn.` },
      { status: 400 },
    );
  }

  try {
    const result = await createUploadUrl(body.projectId || "khac", body.fileName, body.contentType);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[api/anh-dinh-kem/upload-url] Lỗi tạo presigned URL:", err);
    return NextResponse.json({ error: err?.message || "Tạo URL tải lên thất bại." }, { status: 500 });
  }
}
