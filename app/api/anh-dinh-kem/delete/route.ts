import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/src/lib/firebase-admin";
import { deleteObject } from "@/src/lib/r2";
import { rateLimitOrNull } from "@/src/lib/apiRateLimit";

/**
 * Xoá 1 ảnh khỏi R2 — dùng khi người dùng bấm "Bỏ" ảnh vừa đính kèm (trước khi lưu hồ sơ).
 * Chỉ cho xoá trong phạm vi "anh-dinh-kem/" — không phải xoá object bất kỳ trong bucket.
 */
export async function POST(req: NextRequest) {
  const limited = await rateLimitOrNull(req, "anh_dinh_kem_delete", { windowSeconds: 60, maxRequests: 60 });
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

  const body = (await req.json().catch(() => ({}))) as { path?: string };
  const path = body.path?.trim();
  if (!path || !path.startsWith("anh-dinh-kem/")) {
    return NextResponse.json({ error: "Đường dẫn không hợp lệ." }, { status: 400 });
  }

  await deleteObject(path);
  return NextResponse.json({ ok: true });
}
