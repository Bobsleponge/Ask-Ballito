import { z } from "zod";

export const chatRoleSchema = z.enum(["user", "assistant", "system"]);

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
});

export type ChatRole = z.infer<typeof chatRoleSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
