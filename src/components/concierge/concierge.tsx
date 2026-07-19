"use client";

import { useEffect } from "react";
import { SquarePen } from "lucide-react";
import { useConversationStore } from "@/lib/store/conversation-store";
import { useChat } from "@/hooks/use-chat";
import { analytics } from "@/lib/analytics/events";
import { Button } from "@/components/ui/button";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ResultsSheet } from "./results-sheet";
import { CommandMenu } from "./command-menu";
import { EmptyState } from "./empty-state";
import type { City } from "@/config/cities";

export function Concierge({ city }: { city: City }) {
  const { sendMessage } = useChat(city.slug);
  const messages = useConversationStore((s) => s.messages);
  const hydrateForCity = useConversationStore((s) => s.hydrateForCity);
  const reset = useConversationStore((s) => s.reset);
  const hasMessages = messages.length > 0;

  // Restore this city's in-session chat (sessionStorage). Do not wipe on remount.
  useEffect(() => {
    hydrateForCity(city.slug);
    analytics.capture("app_opened", { city: city.slug });
  }, [city.slug, hydrateForCity]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col overflow-y-auto">
        {hasMessages ? (
          <MessageList />
        ) : (
          <EmptyState city={city} onPick={sendMessage} />
        )}
      </div>

      <div className="border-t bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <CommandMenu onPick={sendMessage} />
              {hasMessages ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => {
                    reset();
                    analytics.capture("chat_reset", { city: city.slug });
                  }}
                >
                  <SquarePen className="size-4" />
                  New chat
                </Button>
              ) : null}
            </div>
            <ResultsSheet />
          </div>
          <ChatInput onSend={sendMessage} />
          <p className="text-center text-xs text-muted-foreground">
            Ask Ballito can make mistakes. Please verify important details.
          </p>
        </div>
      </div>
    </div>
  );
}
