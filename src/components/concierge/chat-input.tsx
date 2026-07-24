"use client";

import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useConversationStore } from "@/lib/store/conversation-store";
import { CHAT_FOCUS_EVENT } from "@/lib/chat/chat-ui";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  message: z.string().min(1).max(2000),
});

type FormValues = z.infer<typeof formSchema>;

export function ChatInput({
  onSend,
  placeholder,
  variant = "docked",
}: {
  onSend: (message: string) => void;
  placeholder?: string;
  variant?: "docked" | "hero";
}) {
  const status = useConversationStore((s) => s.status);
  const busy = status === "thinking" || status === "streaming";
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { message: "" },
  });
  const messageValue = useWatch({ control: form.control, name: "message" });
  const { ref: registerRef, ...registerRest } = form.register("message");

  useEffect(() => {
    const onFocus = () => {
      textareaRef.current?.focus();
    };
    window.addEventListener(CHAT_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(CHAT_FOCUS_EVENT, onFocus);
  }, []);

  function submit(values: FormValues) {
    if (busy) return;
    onSend(values.message);
    form.reset({ message: "" });
  }

  const hero = variant === "hero";

  return (
    <form
      onSubmit={form.handleSubmit(submit)}
      className={cn("relative mx-auto w-full", hero ? "max-w-2xl" : "max-w-3xl")}
    >
      <Textarea
        {...registerRest}
        ref={(el) => {
          registerRef(el);
          textareaRef.current = el;
        }}
        data-chat-input
        placeholder={
          placeholder ??
          (hero
            ? "Ask anything about Ballito…"
            : "What would you like to discover today?")
        }
        className={cn(
          "resize-none border-border/80 bg-card shadow-coastal transition-[box-shadow,border-color] duration-200",
          "focus-visible:border-ring focus-visible:shadow-coastal-lg focus-visible:ring-2 focus-visible:ring-ring/40",
          hero
            ? "min-h-[72px] rounded-2xl px-4 py-4 pr-16 text-base md:min-h-[80px]"
            : "max-h-40 min-h-[56px] rounded-2xl pr-14 text-base",
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            form.handleSubmit(submit)();
          }
        }}
      />
      <Button
        type="submit"
        size="icon"
        disabled={busy || !messageValue?.trim()}
        className={cn(
          "absolute rounded-xl shadow-coastal transition-transform duration-150 active:scale-95",
          hero ? "right-3 bottom-3 size-11" : "right-2.5 bottom-2.5 size-9",
        )}
        aria-label="Send message"
      >
        <ArrowUp className={hero ? "size-5" : "size-4"} />
      </Button>
    </form>
  );
}
