import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";

/**
 * WEBHOOK KÝ HMAC GIỮA APP ĐẤU THẦU ↔ APP THIẾT KẾ (OpenSpec change `lien-ket-thiet-ke-dau-thau`,
 * Sếp duyệt 26/09/2026)
 *
 * CHÉP NGUYÊN thuật toán của App Thiết kế (repo Task-Manager-TK-HPcons_R02:
 * `src/lib/webhook-envelope.ts`, `src/lib/webhook-receiver.ts`, `functions/src/webhook-sender.ts`) —
 * pattern đó đã chạy thật với Phòng Kinh doanh từ 17/07/2026. CỐ Ý chép chứ không import chéo repo:
 * hai app là hai dự án deploy độc lập. Đổi thuật toán ở một bên thì PHẢI đổi bên kia, không thì
 * mọi chữ ký đều lệch.
 *
 * ===== HỢP ĐỒNG =====
 *   Header x-webhook-signature = hex(HMAC-SHA256(secret, rawBody))
 *          x-webhook-timestamp = event.timestamp
 *   Lệch quá 5 phút → không hợp lệ (chống gửi lại gói cũ).
 *
 * ===== THÊM SO VỚI BẢN THIẾT KẾ =====
 * Chữ ký chỉ ký trên THÂN, không ký header timestamp. Nên nếu chỉ kiểm header (như bản gốc), kẻ
 * bắt được một gói cũ có thể giữ nguyên thân + chữ ký, chỉ sửa header timestamp thành "bây giờ"
 * là qua được bước chống replay. Bên này BẮT BUỘC header timestamp phải BẰNG `timestamp` trong
 * thân (đã được chữ ký bảo vệ) — xem `kiemTimestampKhopThan`.
 */

const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // 5 phút — chống replay

export interface WebhookEvent<T = unknown> {
  event_id: string;
  /** Namespace dạng "<thuc_the>.<hanh_dong>", ví dụ "du_an.cap_nhat" */
  event_type: string;
  source_app: string;
  /** ISO8601 */
  timestamp: string;
  data: T;
}

export function createEvent<T>(eventType: string, sourceApp: string, data: T): WebhookEvent<T> {
  return {
    event_id: randomUUID(),
    event_type: eventType,
    source_app: sourceApp,
    timestamp: new Date().toISOString(),
    data,
  };
}

export interface SignedWebhookRequest {
  body: string;
  headers: {
    "Content-Type": string;
    "x-webhook-signature": string;
    "x-webhook-timestamp": string;
  };
}

/**
 * Ký trên ĐÚNG chuỗi JSON sẽ gửi đi (không phải object) — bên nhận ký lại raw body nhận được;
 * parse rồi stringify lại có thể lệch khoảng trắng/thứ tự key khiến chữ ký không khớp.
 */
export function signWebhookEvent(event: WebhookEvent, secret: string): SignedWebhookRequest {
  const body = JSON.stringify(event);
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  return {
    body,
    headers: {
      "Content-Type": "application/json",
      "x-webhook-signature": signature,
      "x-webhook-timestamp": event.timestamp,
    },
  };
}

// CỐ Ý không dùng union phân biệt ({valid:true} | {valid:false; reason}) như bản Thiết kế:
// tsconfig dự án này để strict:false nên TypeScript không thu hẹp kiểu theo `valid` (cùng lý do
// ghi ở src/lib/webhookAuth.ts).
export type VerifyResult = { valid: boolean; reason?: string };

/**
 * Kiểm chữ ký HMAC-SHA256 trên RAW body (chuỗi thô, chưa JSON.parse) + timestamp không quá cũ.
 * Giống hệt `verifyWebhookSignature` bên App Thiết kế.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
): VerifyResult {
  if (!signature || !timestamp) {
    return { valid: false, reason: "Thiếu header chữ ký hoặc timestamp" };
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  let sigBuf: Buffer;
  let expBuf: Buffer;
  try {
    sigBuf = Buffer.from(signature, "hex");
    expBuf = Buffer.from(expected, "hex");
  } catch {
    return { valid: false, reason: "Chữ ký không đúng định dạng hex" };
  }
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: "Chữ ký không khớp" };
  }

  const ts = new Date(timestamp).getTime();
  if (Number.isNaN(ts)) {
    return { valid: false, reason: "Timestamp không hợp lệ" };
  }
  const skew = Math.abs(Date.now() - ts);
  if (skew > MAX_TIMESTAMP_SKEW_MS) {
    return {
      valid: false,
      reason: `Timestamp lệch quá ${MAX_TIMESTAMP_SKEW_MS / 1000}s so với hiện tại (chống replay)`,
    };
  }

  return { valid: true };
}

/** Header timestamp phải BẰNG `timestamp` trong thân — xem mục "THÊM SO VỚI BẢN THIẾT KẾ". */
export function kiemTimestampKhopThan(headerTimestamp: string | null, bodyTimestamp: unknown): VerifyResult {
  if (typeof bodyTimestamp !== "string" || !headerTimestamp || headerTimestamp !== bodyTimestamp) {
    return { valid: false, reason: "Header x-webhook-timestamp không khớp timestamp trong thân" };
  }
  return { valid: true };
}

/**
 * Gộp cả hai bước cho bên NHẬN: chữ ký + 5 phút, rồi timestamp header == thân.
 * Thân không parse được JSON → không hợp lệ (chữ ký đúng mà thân hỏng thì cũng không dùng được).
 */
export function kiemGoiWebhook(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
): VerifyResult {
  const kq = verifyWebhookSignature(rawBody, signature, timestamp, secret);
  if (!kq.valid) return kq;
  let than: unknown;
  try {
    than = JSON.parse(rawBody);
  } catch {
    return { valid: false, reason: "Thân không phải JSON hợp lệ" };
  }
  return kiemTimestampKhopThan(timestamp, (than as { timestamp?: unknown } | null)?.timestamp);
}
