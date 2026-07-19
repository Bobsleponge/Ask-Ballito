"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useConversationStore } from "@/lib/store/conversation-store";

const formSchema = z.object({
  message: z.string().min(1).max(2000),
});

type FormValues = z.infer<typeof formSchema>;

export function ChatInput({
  onSend,
  placeholder,
}: {
  onSend: (message: string) => void;
  placeholder?: string;
}) {
  const status = useConversationStore((s) => s.status);
  const busy = status === "thinking" || status === "streaming";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { message: "" },
  });
  const messageValue = useWatch({ control: form.control, name: "message" });

  function submit(values: FormValues) {
    if (busy) return;
    onSend(values.message);
    form.reset({ message: "" });
  }

  return (
    <form
      onSubmit={form.handleSubmit(submit)}
      className="relative mx-auto w-full max-w-3xl"
    >
      <Textarea
        {...form.register("message")}
        placeholder={
          placeholder ?? "Ask about restaurants, services, things to do…"
        }
        className="max-h-40 min-h-[56px] resize-none rounded-2xl pr-14"
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
        className="absolute bottom-2.5 right-2.5 size-9 rounded-xl"
        aria-label="Send message"
      >
        <ArrowUp className="size-4" />
      </Button>
    </form>
  );
}
