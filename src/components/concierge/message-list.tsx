"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/lib/store/conversation-store";
import { AssistantReply } from "./assistant-reply";

export function MessageList() {
  const messages = useConversationStore((s) => s.messages);
  const status = useConversationStore((s) => s.status);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      {messages.map((m) => (
        <div key={m.id} className="flex flex-col gap-3">
          {m.role === "user" ? (
            <div className="flex justify-end">
              <div
                className={cn(
                  "max-w-[32rem] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-3",
                  "text-[15px] leading-[1.55] tracking-[-0.01em] text-primary-foreground",
                )}
              >
                {m.content}
              </div>
            </div>
          ) : (
            <div className="flex justify-start">
              <AssistantReply
                content={m.content}
                businesses={m.businesses}
                thinking={
                  !m.content &&
                  status !== "idle" &&
                  status !== "error"
                }
              />
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
