import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "./firebase-admin";

/**
 * Rate-limit theo IP cho các API nghiệp vụ CÔNG KHAI (không có phiên đăng nhập đính
 * kèm) — filter/import dự án, danh sách vai trò. Vercel serverless không giữ bộ nhớ
 * ổn định giữa các lần gọi (mỗi request có thể rơi vào instance khác), nên phải lưu
 * bộ đếm ở Firestore thay vì biến trong RAM. Đếm theo cửa sổ cố định (fixed window),
 * chỉ đọc/ghi ĐÚNG 1 document theo id xác định — KHÔNG dùng where+orderBy nên
 * không cần composite index (bài học rút ra từ hpcons-quatang/hpcons-portal).
 */

const COLLECTION = "api_rate_limit";

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

function sanitizeKey(s: string): string {
  return s.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 200) || "unknown";
}

/** Lấy IP người gọi thật qua header Vercel forward — client đầu tiên trong chuỗi proxy. */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function checkRateLimit(
  routeKey: string,
  ip: string,
  opts: { windowSeconds: number; maxRequests: number },
): Promise<RateLimitResult> {
  const db = getAdminDb();
  const docId = `${sanitizeKey(routeKey)}__${sanitizeKey(ip)}`;
  const ref = db.collection(COLLECTION).doc(docId);
  const windowMs = opts.windowSeconds * 1000;
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as { windowStart: number; count: number }) : null;

    if (!data || now - data.windowStart > windowMs) {
      tx.set(ref, { windowStart: now, count: 1 });
      return { allowed: true };
    }

    if (data.count >= opts.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((data.windowStart + windowMs - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }

    tx.update(ref, { count: data.count + 1 });
    return { allowed: true };
  });
}

/**
 * Helper gọn cho route handler: trả về NextResponse 429 nếu vượt giới hạn, hoặc
 * null nếu còn được phép gọi tiếp (route tự xử lý logic chính khi nhận null).
 */
export async function rateLimitOrNull(
  req: NextRequest,
  routeKey: string,
  opts: { windowSeconds: number; maxRequests: number },
): Promise<NextResponse | null> {
  try {
    const ip = getClientIp(req);
    const result = await checkRateLimit(routeKey, ip, opts);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Quá nhiều yêu cầu, vui lòng thử lại sau." },
        { status: 429, headers: result.retryAfterSeconds ? { "Retry-After": String(result.retryAfterSeconds) } : undefined },
      );
    }
    return null;
  } catch (e) {
    // KHÔNG chặn thao tác chính nếu bản thân việc kiểm tra rate-limit gặp lỗi hạ tầng
    // (Firestore tạm gián đoạn...) — fail-open để tính năng chính không bị ảnh hưởng.
    console.error("[apiRateLimit] Lỗi kiểm tra rate-limit, cho qua:", e);
    return null;
  }
}
