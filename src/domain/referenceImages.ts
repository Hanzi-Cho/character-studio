import { z } from "zod";
export const ReferenceImageSchema = z
  .object({
    name: z.string().min(1).max(100),
    dataUrl: z
      .string()
      .max(1_400_000)
      .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict()
  .refine(({ dataUrl }) => {
    const data = dataUrl.split(",")[1];
    return dataUrl.startsWith("data:image/png;")
      ? data.startsWith("iVBORw0KGgo")
      : data.startsWith("/9j/");
  }, "PNG 또는 JPEG 이미지가 필요합니다.");
export const ReferenceImagesSchema = z.array(ReferenceImageSchema).max(4);
export type ReferenceImage = z.infer<typeof ReferenceImageSchema>;
