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
function buildHistoryForRequest(excludeMessageIds?: Set<string>): ChatMessage[] {
  return useConversationStore
    .getState()
    .messages.filter((m) => m.content.trim().length > 0)
    .filter((m) => !excludeMessageIds?.has(m.id))
    .slice(-16)
    .map((m) => ({
      role: m.role,
      content: stripBizMarkers(m.content)
        .trim()
        .slice(0, HISTORY_CONTENT_MAX),
    }))
    .filter((m) => m.content.length > 0);
}

function collectShownBusinessIds(): string[] {
  const ids = new Set<string>();
  for (const m of useConversationStore.getState().messages) {
    for (const b of m.businesses ?? []) {
      ids.add(b.id);
    }
  }
  return [...ids];
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

async function streamChatResponse(opts: {
  citySlug: string;
  message: string;
  history: ChatMessage[];
  assistantId: string;
  userId?: string;
  excludeBusinessIds?: string[];
  retry?: boolean;
}) {
  const store = useConversationStore.getState();
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      city: opts.citySlug,
      message: opts.message,
      history: opts.history,
      excludeBusinessIds: opts.excludeBusinessIds,
      retry: opts.retry,
    }),
  });

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };

    if (res.status === 401 && body.code === "auth_required") {
      const removeIds = [opts.assistantId];
      if (opts.userId) removeIds.unshift(opts.userId);
      store.removeMessages(removeIds);
      store.setAuthRequired(true);
      store.setError(body.error ?? "Sign in to continue chatting.");
      store.setStatus("idle");
      analytics.capture("auth_required_shown", { city: opts.citySlug });
      return;
    }

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
          opts.assistantId,
          meta.businesses,
          composition,
        );
        store.setActiveResults(meta.businesses, composition);
        if (meta.businesses.length > 0) {
          analytics.capture("recommendation_shown", {
            count: meta.businesses.length,
            city: opts.citySlug,
            strategy: composition?.strategy ?? "ranked_list",
            sections: composition?.sections.length ?? 0,
            retry: Boolean(opts.retry),
          });
        }
      } else if (evt.event === "delta") {
        const { text } = JSON.parse(evt.data) as { text: string };
        store.appendToMessage(opts.assistantId, text);
        store.setStatus("streaming");
      } else if (evt.event === "error") {
        const { message: errMsg } = JSON.parse(evt.data) as {
          message: string;
        };
        throw new Error(errMsg);
      }
    }
  }

  const assistant = useConversationStore
    .getState()
    .messages.find((m) => m.id === opts.assistantId);
  if (assistant && !assistant.content.trim()) {
    store.appendToMessage(
      opts.assistantId,
      "I couldn't generate a reply. Please try again.",
    );
  }

  store.setStatus("idle");
  analytics.capture("chat_response_received", {
    city: opts.citySlug,
    retry: Boolean(opts.retry),
  });
}

export function useChat(citySlug: string) {
  const sendMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      const store = useConversationStore.getState();
      if (store.status === "thinking" || store.status === "streaming") return;

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
        await streamChatResponse({
          citySlug,
          message: trimmed,
          history,
          assistantId,
          userId,
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Something went wrong.";
        const existing = useConversationStore
          .getState()
          .messages.find((m) => m.id === assistantId)?.content;
        useConversationStore.getState().appendToMessage(
          assistantId,
          existing?.trim()
            ? "\n\n(Sorry, I hit an error.)"
            : "Sorry, I hit an error. Please try again.",
        );
        useConversationStore.getState().setError(msg);
        useConversationStore.getState().setStatus("error");
        analytics.capture("error_shown", { area: "chat", message: msg });
      }
    },
    [citySlug],
  );

  /**
   * Once per recommendation reply: fresh options excluding everything already shown.
   */
  const retryRecommendations = useCallback(
    async (assistantMessageId: string) => {
      const store = useConversationStore.getState();
      if (store.status === "thinking" || store.status === "streaming") return;

      const messages = store.messages;
      const assistantIdx = messages.findIndex(
        (m) => m.id === assistantMessageId,
      );
      if (assistantIdx < 0) return;

      const assistant = messages[assistantIdx]!;
      if (
        assistant.role !== "assistant" ||
        assistant.retryUsed ||
        assistant.isRetry ||
        !assistant.businesses?.length
      ) {
        return;
      }

      let userMessage: string | null = null;
      for (let i = assistantIdx - 1; i >= 0; i--) {
        if (messages[i]?.role === "user") {
          userMessage = messages[i]!.content;
          break;
        }
      }
      if (!userMessage?.trim()) return;

      const excludeBusinessIds = collectShownBusinessIds();
      store.patchMessage(assistantMessageId, { retryUsed: true });

      const retryAssistantId = uid();
      store.addMessage({
        id: retryAssistantId,
        role: "assistant",
        content: "",
        isRetry: true,
      });
      store.setStatus("thinking");
      store.setError(null);

      analytics.capture("recommendation_retry", {
        city: citySlug,
        excluded: excludeBusinessIds.length,
      });

      // History without the previous assistant answer — same ask, fresh options.
      const history = buildHistoryForRequest(
        new Set([assistantMessageId, retryAssistantId]),
      );

      try {
        await streamChatResponse({
          citySlug,
          message: userMessage.trim(),
          history,
          assistantId: retryAssistantId,
          excludeBusinessIds,
          retry: true,
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Something went wrong.";
        const existing = useConversationStore
          .getState()
          .messages.find((m) => m.id === retryAssistantId)?.content;
        useConversationStore.getState().appendToMessage(
          retryAssistantId,
          existing?.trim()
            ? "\n\n(Sorry, I hit an error.)"
            : "Sorry, I couldn't find different options. Please try a new question.",
        );
        useConversationStore.getState().setError(msg);
        useConversationStore.getState().setStatus("error");
        analytics.capture("error_shown", {
          area: "chat_retry",
          message: msg,
        });
      }
    },
    [citySlug],
  );

  return { sendMessage, retryRecommendations };
}
