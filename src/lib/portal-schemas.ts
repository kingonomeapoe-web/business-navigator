import { z } from "zod";

export const projectIdSchema = z.object({ projectId: z.string().uuid() });

export const saveResponsesSchema = projectIdSchema.extend({
  entries: z
    .array(
      z.object({
        key: z.string().min(1).max(80),
        section: z.string().min(1).max(40),
        value: z.string().max(8000),
      }),
    )
    .min(1)
    .max(60),
});

export const registerAssetSchema = projectIdSchema.extend({
  category: z.string().min(1).max(40),
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive(),
  storagePath: z.string().min(5).max(400),
});

export const assetIdSchema = z.object({ assetId: z.string().uuid() });

export const notificationIdSchema = z.object({ id: z.string().uuid() });
