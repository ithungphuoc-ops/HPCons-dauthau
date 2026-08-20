import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

/**
 * Lưu ảnh báo cáo / kết quả công việc trên Cloudflare R2 (tương thích S3) — Firestore chỉ lưu
 * metadata (đường dẫn `path` + URL công khai `url`), không lưu nội dung ảnh (base64) nữa.
 * Trình duyệt PUT thẳng lên R2 bằng presigned URL (không qua Vercel function) để đỡ tốn băng
 * thông serverless — xem app/api/anh-dinh-kem/upload-url/route.ts.
 *
 * Bucket `hpcons-dauthau` RIÊNG cho app này (Sếp tạo 20/08/2026), domain công khai gắn sẵn
 * `dauthau-img.hpcore.vn` — không dùng chung bucket với app khác (mỗi app 1 bucket, giống mô
 * hình mỗi app 1 project Firebase riêng).
 */

let client: S3Client | undefined;

function getR2Client(): S3Client {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID;
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
  return client;
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("Thiếu R2_BUCKET_NAME.");
  return bucket;
}

/** URL công khai để hiển thị/tải ảnh — cần R2_PUBLIC_BASE_URL (domain custom đã gắn bucket). */
export function publicUrlForPath(path: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) throw new Error("Thiếu R2_PUBLIC_BASE_URL.");
  return `${base.replace(/\/$/, "")}/${path}`;
}

/**
 * Sinh presigned PUT URL để trình duyệt tải thẳng ảnh lên R2 (hết hạn sau 5 phút).
 * `projectId` gộp vào đường dẫn để ảnh của từng hồ sơ nằm gọn một thư mục, dễ dọn dẹp sau này
 * nếu hồ sơ bị xoá (chưa tự động dọn — xem ghi chú ở deleteObject).
 */
export async function createUploadUrl(
  projectId: string,
  originalFileName: string,
  contentType: string,
): Promise<{ path: string; uploadUrl: string; publicUrl: string }> {
  const ext = originalFileName.includes(".") ? originalFileName.split(".").pop() : "jpg";
  const maProjectSach = (projectId || "khac").replace(/[^\w.-]+/g, "_").slice(0, 80);
  const path = `anh-dinh-kem/${maProjectSach}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: path,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getR2Client(), command, { expiresIn: 300 });
  return { path, uploadUrl, publicUrl: publicUrlForPath(path) };
}

/** Xoá 1 ảnh khỏi R2. Bỏ qua lỗi (không chặn thao tác chính) — ảnh mồ côi dọn thủ công sau. */
export async function deleteObject(path: string): Promise<void> {
  try {
    await getR2Client().send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: path }));
  } catch {
    // Không chặn luồng chính nếu xoá ảnh thất bại.
  }
}

/** Presigned GET URL (dự phòng khi domain public chưa gắn kịp hoặc cần link riêng tư ngắn hạn). */
export async function createDownloadUrl(path: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getBucketName(), Key: path });
  return getSignedUrl(getR2Client(), command, { expiresIn: 300 });
}
