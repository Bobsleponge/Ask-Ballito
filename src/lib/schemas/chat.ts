import { z } from "zod";

/** Client-supplied history roles only — never accept `system` from the wire. */
export const chatRoleSchema = z.enum(["user", "assistant"]);

export const chatMessageSchema = z.object({
  role: chatRoleSchema,
  content: z.string().min(1).max(4000),
});

export const chatRequestSchema = z.object({
  city: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Invalid city slug"),
  message: z.string().min(1, "Message is required").max(2000),
  conversationId: z.string().uuid().optional(),
  history: z.array(chatMessageSchema).max(20).optional(),
  /** Business ids already shown — omitted from the next recommendation set. */
  excludeBusinessIds: z.array(z.string().min(1).max(128)).max(50).optional(),
  /** Client retry for a fresh list (same ask, different options). */
  retry: z.boolean().optional(),
});

export type ChatRole = z.infer<typeof chatRoleSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
