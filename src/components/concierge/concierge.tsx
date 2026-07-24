"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useConversationStore } from "@/lib/store/conversation-store";
import { useChat } from "@/hooks/use-chat";
import { analytics } from "@/lib/analytics/events";
import { getBusinessByIdAction } from "@/lib/businesses/get-business-action";
import { AuthDialog } from "@/components/auth/auth-dialog";
import dynamic from "next/dynamic";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ResultsSheet } from "./results-sheet";
import { CommandMenu } from "./command-menu";
import { EmptyState } from "./empty-state";

const BusinessDetailSheet = dynamic(
  () =>
    import("./business-detail-sheet").then((m) => m.BusinessDetailSheet),
  { ssr: false },
);
import type { City } from "@/config/cities";
import type { BusinessResult } from "@/lib/schemas/business";
import {
  CHAT_RESET_EVENT,
  focusChatInput,
  openDiscoverRail,
  type ChatResetDetail,
} from "@/lib/chat/chat-ui";
import { pushRecentSearch } from "@/lib/discover/recent-searches";

function resolveSelectedBusiness(
  id: string | null,
  active: BusinessResult[],
  messages: { businesses?: BusinessResult[] }[],
  detail: BusinessResult | null,
): BusinessResult | null {
  if (!id) return null;
  if (detail?.id === id) return detail;
  const fromActive = active.find((b) => b.id === id);
  if (fromActive) return fromActive;
  for (const m of messages) {
    const hit = m.businesses?.find((b) => b.id === id);
    if (hit) return hit;
  }
  return null;
}

export function Concierge({
  city,
  sendMessage: sendMessageProp,
}: {
  city: City;
  /** Optional shared sender from CityWorkspace (rail + hero). */
  sendMessage?: (message: string) => void | Promise<void>;
}) {
  const chat = useChat(city.slug);
  const sendMessage = sendMessageProp ?? chat.sendMessage;
  const { retryRecommendations } = chat;
  const messages = useConversationStore((s) => s.messages);
  const hydrateForCity = useConversationStore((s) => s.hydrateForCity);
  const reset = useConversationStore((s) => s.reset);
  const authRequired = useConversationStore((s) => s.authRequired);
  const setAuthRequired = useConversationStore((s) => s.setAuthRequired);
  const error = useConversationStore((s) => s.error);
  const selectedBusinessId = useConversationStore((s) => s.selectedBusinessId);
  const detailBusiness = useConversationStore((s) => s.detailBusiness);
  const activeBusinesses = useConversationStore((s) => s.activeBusinesses);
  const selectBusiness = useConversationStore((s) => s.selectBusiness);
  const hasMessages = messages.length > 0;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const bizParam = searchParams.get("biz");
  const handledBootQuery = useRef<string | null>(null);

  const selected = useMemo(
    () =>
      resolveSelectedBusiness(
        selectedBusinessId,
        activeBusinesses,
        messages,
        detailBusiness,
      ),
    [selectedBusinessId, activeBusinesses, messages, detailBusiness],
  );

  useEffect(() => {
    hydrateForCity(city.slug);
    analytics.capture("app_opened", { city: city.slug });
  }, [city.slug, hydrateForCity]);

  useEffect(() => {
    const onReset = (e: Event) => {
      const detail = (e as CustomEvent<ChatResetDetail>).detail;
      if (detail?.city && detail.city !== city.slug) return;
      reset();
      analytics.capture("chat_reset", {
        city: city.slug,
        source: detail?.source ?? "new_chat",
      });
      if (bizParam) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("biz");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }
      requestAnimationFrame(() => focusChatInput());
    };
    window.addEventListener(CHAT_RESET_EVENT, onReset);
    return () => window.removeEventListener(CHAT_RESET_EVENT, onReset);
  }, [city.slug, reset, bizParam, searchParams, router, pathname]);

  // Header / About deep-links: ?new=1, ?discover=1, ?q=prompt
  useEffect(() => {
    const wantsNew = searchParams.get("new") === "1";
    const wantsDiscover = searchParams.get("discover") === "1";
    const qParam = searchParams.get("q")?.trim() ?? "";
    if (!wantsNew && !wantsDiscover && !qParam) {
      handledBootQuery.current = null;
      return;
    }

    const token = `${wantsNew ? "1" : "0"}:${wantsDiscover ? "1" : "0"}:${qParam}`;
    if (handledBootQuery.current === token) return;
    handledBootQuery.current = token;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    params.delete("discover");
    params.delete("q");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

    if (wantsNew && !qParam) {
      reset();
      analytics.capture("chat_reset", {
        city: city.slug,
        source: "new_chat",
      });
    }

    requestAnimationFrame(() => {
      if (qParam) {
        reset();
        pushRecentSearch(city.slug, qParam);
        void sendMessage(qParam);
        return;
      }
      focusChatInput();
      if (wantsDiscover) {
        openDiscoverRail();
      }
    });
  }, [searchParams, city.slug, reset, router, pathname, sendMessage]);

  useEffect(() => {
    if (!bizParam) return;
    if (selectedBusinessId === bizParam && selected) return;

    const existing = resolveSelectedBusiness(
      bizParam,
      useConversationStore.getState().activeBusinesses,
      useConversationStore.getState().messages,
      useConversationStore.getState().detailBusiness,
    );
    if (existing) {
      selectBusiness(bizParam, existing);
      return;
    }

    let cancelled = false;
    void (async () => {
      const result = await getBusinessByIdAction({
        id: bizParam,
        citySlug: city.slug,
      });
      if (cancelled) return;
      if (result.ok) {
        selectBusiness(result.data.id, result.data);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bizParam, city.slug, selectBusiness, selectedBusinessId, selected]);

  function onDetailOpenChange(open: boolean) {
    if (open) return;
    selectBusiness(null);
    if (bizParam) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("biz");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  function handleSend(message: string) {
    pushRecentSearch(city.slug, message);
    void sendMessage(message);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AuthDialog
        open={authRequired}
        onOpenChange={setAuthRequired}
        next={`/${city.slug}`}
        title="Sign in to keep chatting"
        description="You've used your free anonymous messages. Sign in to continue asking about Ballito."
      />

      <BusinessDetailSheet
        business={selected}
        open={Boolean(selectedBusinessId)}
        onOpenChange={onDetailOpenChange}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {hasMessages ? (
          <MessageList onRetry={retryRecommendations} />
        ) : (
          <EmptyState
            key={city.slug}
            city={city}
            onPick={handleSend}
            onSend={handleSend}
          />
        )}
      </div>

      {hasMessages ? (
        <div className="shrink-0 border-t border-border/70 bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <CommandMenu onPick={handleSend} />
              <ResultsSheet />
            </div>
            <ChatInput variant="docked" onSend={handleSend} />
            {error && authRequired ? (
              <p className="text-center text-xs text-amber-700 dark:text-amber-400">
                {error}
              </p>
            ) : null}
            <p className="text-center text-xs text-muted-foreground">
              Ask Ballito can make mistakes. Please verify important details.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
