import { z } from "zod";

export const emailCaptureSchema = z.object({
  token: z.string().uuid(),
  email: z.string().trim().min(5).max(200).email(),
  consent: z.boolean(),
  marketingOptIn: z.boolean().optional(),
});

export const accessTokenSchema = z.object({
  accessToken: z.string().regex(/^[a-f0-9]{32,96}$/),
});

export const acceptQuoteSchema = accessTokenSchema.extend({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().max(200).email(),
});

export const startPaymentSchema = accessTokenSchema.extend({
  plan: z.enum(["deposit", "full"]),
});

export const sendQuoteSchema = z.object({ token: z.string().uuid() });

export const mockPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  outcome: z.enum(["succeeded", "failed"]).default("succeeded"),
});
