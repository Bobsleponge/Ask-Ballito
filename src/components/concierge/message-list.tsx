"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/lib/store/conversation-store";
import { AssistantReply } from "./assistant-reply";

export function MessageList({
  onRetry,
}: {
  onRetry?: (assistantMessageId: string) => void;
}) {
  const messages = useConversationStore((s) => s.messages);
  const status = useConversationStore((s) => s.status);
  const turnStartRef = useRef<HTMLDivElement>(null);
  const lastPinnedUserIdRef = useRef<string | null>(null);

  const latestUser = [...messages].reverse().find((m) => m.role === "user");
  const latestUserId = latestUser?.id ?? null;
  const busy = status === "thinking" || status === "streaming";

  const latestRetryableAssistantId = [...messages]
    .reverse()
    .find(
      (m) =>
        m.role === "assistant" &&
        Boolean(m.businesses?.length) &&
        !m.retryUsed &&
        !m.isRetry,
    )?.id;

  useEffect(() => {
    if (!latestUserId || latestUserId === lastPinnedUserIdRef.current) return;
    lastPinnedUserIdRef.current = latestUserId;
    turnStartRef.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [latestUserId]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-8">
      {messages.map((m) => {
        const isLatestUser = m.role === "user" && m.id === latestUserId;
        return (
          <div
            key={m.id}
            ref={isLatestUser ? turnStartRef : undefined}
            className="flex flex-col gap-3.5"
          >
            {m.role === "user" ? (
              <div className="flex justify-end">
                <div
                  className={cn(
                    "max-w-[min(36rem,92%)] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-3",
                    "text-[15px] leading-[1.55] tracking-[-0.01em] text-primary-foreground shadow-coastal",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ) : (
              <div className="flex justify-start">
                <AssistantReply
                  messageId={m.id}
                  content={m.content}
                  businesses={m.businesses}
                  composition={m.composition}
                  thinking={
                    !m.content && status !== "idle" && status !== "error"
                  }
                  streaming={
                    Boolean(m.content) &&
                    status === "streaming" &&
                    m.id === messages[messages.length - 1]?.id
                  }
                  showTryAgain={
                    Boolean(onRetry) &&
                    m.id === latestRetryableAssistantId &&
                    status === "idle"
                  }
                  tryAgainBusy={busy}
                  onTryAgain={
                    onRetry ? () => onRetry(m.id) : undefined
                  }
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
