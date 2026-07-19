"use client";

import { useCallback } from "react";
import { useConversationStore } from "@/lib/store/conversation-store";
import { analytics } from "@/lib/analytics/events";
import type { BusinessResult } from "@/lib/schemas/business";
import type { ChatMessage } from "@/lib/schemas/chat";
import type { CompositionPayload } from "@/services/composition/types";
import { stripBizMarkers } from "@/lib/chat/parse-assistant-blocks";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const HISTORY_CONTENT_MAX = 4000;

/** Prior turns only — non-empty, capped so Zod history validation never fails. */
function buildHistoryForRequest(): ChatMessage[] {
  return useConversationStore
    .getState()
    .messages.filter((m) => m.content.trim().length > 0)
    .slice(-16)
    .map((m) => ({
      role: m.role,
      content: stripBizMarkers(m.content)
        .trim()
        .slice(0, HISTORY_CONTENT_MAX),
    }))
    .filter((m) => m.content.length > 0);
}

interface SseEvent {
  event: string;
  data: string;
}

function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    const lines = part.split("\n");
    let event = "message";
    let data = "";
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    events.push({ event, data });
  }
  return { events, rest };
}

export function useChat(citySlug: string) {
  const store = useConversationStore();

  const sendMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      const status = useConversationStore.getState().status;
      if (status === "thinking" || status === "streaming") return;

      // Capture prior turns before adding the new user/assistant placeholders.
      const history = buildHistoryForRequest();

      const userId = uid();
      const assistantId = uid();

      store.addMessage({ id: userId, role: "user", content: trimmed });
      store.addMessage({ id: assistantId, role: "assistant", content: "" });
      store.setStatus("thinking");
      store.setError(null);
      analytics.capture("chat_message_sent", {
        city: citySlug,
        historyLength: history.length,
      });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: citySlug,
            message: trimmed,
            history,
          }),
        });

        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = parseSseChunk(buffer);
          buffer = rest;

          for (const evt of events) {
            if (evt.event === "meta") {
              const meta = JSON.parse(evt.data) as {
                businesses: BusinessResult[];
                composition?: CompositionPayload | null;
              };
              const composition = meta.composition ?? null;
              store.setMessageResults(
                assistantId,
                meta.businesses,
                composition,
              );
              store.setActiveResults(meta.businesses, composition);
              if (meta.businesses.length > 0) {
                analytics.capture("recommendation_shown", {
                  count: meta.businesses.length,
                  city: citySlug,
                  strategy: composition?.strategy ?? "ranked_list",
                  sections: composition?.sections.length ?? 0,
                });
              }
            } else if (evt.event === "delta") {
              const { text } = JSON.parse(evt.data) as { text: string };
              store.appendToMessage(assistantId, text);
              store.setStatus("streaming");
            } else if (evt.event === "error") {
              const { message: errMsg } = JSON.parse(evt.data) as {
                message: string;
              };
              throw new Error(errMsg);
            }
          }
        }

        // Drop empty assistant bubbles so they never pollute follow-up history.
        const assistant = useConversationStore
          .getState()
          .messages.find((m) => m.id === assistantId);
        if (assistant && !assistant.content.trim()) {
          store.appendToMessage(
            assistantId,
            "I couldn't generate a reply. Please try again.",
          );
        }

        store.setStatus("idle");
        analytics.capture("chat_response_received", { city: citySlug });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        const existing = useConversationStore
          .getState()
          .messages.find((m) => m.id === assistantId)?.content;
        store.appendToMessage(
          assistantId,
          existing?.trim()
            ? "\n\n(Sorry, I hit an error.)"
            : "Sorry, I hit an error. Please try again.",
        );
        store.setError(msg);
        store.setStatus("error");
        analytics.capture("error_shown", { area: "chat", message: msg });
      }
    },
    [citySlug, store],
  );

  return { sendMessage };
}
