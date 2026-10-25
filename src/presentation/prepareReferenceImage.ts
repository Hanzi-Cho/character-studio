import {
  ReferenceImageSchema,
  type ReferenceImage,
} from "../domain/referenceImages.js";
/** Decode and re-encode locally: bounded dimensions, no EXIF or original file sent. */
export async function prepareReferenceImage(
  file: File,
): Promise<ReferenceImage> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 10_000_000
  )
    throw new Error("10MB 이하 PNG·JPEG·WebP 이미지를 선택해 주세요.");
  const bitmap = await createImageBitmap(file);
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 40_000_000
    )
      throw new Error("이미지 해상도가 너무 큽니다.");
    const ratio = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return ReferenceImageSchema.parse({
      name: file.name.slice(0, 100),
      dataUrl: canvas.toDataURL("image/jpeg", 0.85),
    });
  } finally {
    bitmap.close();
  }
}
