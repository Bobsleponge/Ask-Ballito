"use client";

import { create } from "zustand";
import type { BusinessResult } from "@/lib/schemas/business";
import type { CompositionPayload } from "@/services/composition/types";

export type ChatStatus = "idle" | "thinking" | "streaming" | "error";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  businesses?: BusinessResult[];
  composition?: CompositionPayload;
  /** User already used Try again on this recommendation reply. */
  retryUsed?: boolean;
  /** This reply is itself a Try again result (no further Try again). */
  isRetry?: boolean;
}

interface PersistedChat {
  citySlug: string;
  messages: UiMessage[];
  activeBusinesses: BusinessResult[];
  activeComposition: CompositionPayload | null;
}

function storageKey(citySlug: string) {
  return `ask-ballito:chat:${citySlug}`;
}

export function loadPersistedChat(citySlug: string): PersistedChat | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(citySlug));
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedChat;
    if (data.citySlug !== citySlug || !Array.isArray(data.messages)) return null;
    return {
      ...data,
      activeComposition: data.activeComposition ?? null,
    };
  } catch {
    return null;
  }
}

export function persistChat(
  citySlug: string,
  messages: UiMessage[],
  activeBusinesses: BusinessResult[],
  activeComposition: CompositionPayload | null,
) {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedChat = {
      citySlug,
      messages,
      activeBusinesses,
      activeComposition,
    };
    sessionStorage.setItem(storageKey(citySlug), JSON.stringify(payload));
  } catch {
    // quota / private mode — ignore
  }
}

export function clearPersistedChat(citySlug: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(citySlug));
  } catch {
    // ignore
  }
}

interface ConversationState {
  citySlug: string | null;
  messages: UiMessage[];
  status: ChatStatus;
  error: string | null;
  /** Open the sign-in dialog after anonymous chat quota is exhausted. */
  authRequired: boolean;
  /** Business catalog for the latest assistant turn. */
  activeBusinesses: BusinessResult[];
  activeComposition: CompositionPayload | null;
  selectedBusinessId: string | null;
  /** Cached business for deep links not already in active results. */
  detailBusiness: BusinessResult | null;

  hydrateForCity: (citySlug: string) => void;
  addMessage: (message: UiMessage) => void;
  removeMessages: (ids: string[]) => void;
  appendToMessage: (id: string, delta: string) => void;
  setMessageResults: (
    id: string,
    businesses: BusinessResult[],
    composition: CompositionPayload | null,
  ) => void;
  /** Append businesses into one section of an assistant reply (Load more). */
  appendSectionBusinesses: (
    messageId: string,
    sectionId: string,
    businesses: BusinessResult[],
  ) => void;
  patchMessage: (id: string, patch: Partial<UiMessage>) => void;
  setStatus: (status: ChatStatus) => void;
  setError: (error: string | null) => void;
  setAuthRequired: (authRequired: boolean) => void;
  setActiveResults: (
    businesses: BusinessResult[],
    composition: CompositionPayload | null,
  ) => void;
  selectBusiness: (id: string | null, business?: BusinessResult | null) => void;
  reset: () => void;
}

function syncPersist(s: ConversationState) {
  if (s.citySlug) {
    persistChat(
      s.citySlug,
      s.messages,
      s.activeBusinesses,
      s.activeComposition,
    );
  }
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  citySlug: null,
  messages: [],
  status: "idle",
  error: null,
  authRequired: false,
  activeBusinesses: [],
  activeComposition: null,
  selectedBusinessId: null,
  detailBusiness: null,

  hydrateForCity: (citySlug) => {
    const prev = get().citySlug;
    if (prev === citySlug) return;

    const saved = loadPersistedChat(citySlug);
    set({
      citySlug,
      messages: saved?.messages ?? [],
      activeBusinesses: saved?.activeBusinesses ?? [],
      activeComposition: saved?.activeComposition ?? null,
      selectedBusinessId: null,
      detailBusiness: null,
      status: "idle",
      error: null,
      authRequired: false,
    });
  },

  addMessage: (message) =>
    set((s) => {
      const next = { ...s, messages: [...s.messages, message] };
      syncPersist(next);
      return { messages: next.messages };
    }),

  removeMessages: (ids) =>
    set((s) => {
      const idSet = new Set(ids);
      const messages = s.messages.filter((m) => !idSet.has(m.id));
      syncPersist({ ...s, messages });
      return { messages };
    }),

  appendToMessage: (id, delta) =>
    set((s) => {
      const messages = s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + delta } : m,
      );
      syncPersist({ ...s, messages });
      return { messages };
    }),

  setMessageResults: (id, businesses, composition) =>
    set((s) => {
      const messages = s.messages.map((m) =>
        m.id === id
          ? {
              ...m,
              businesses,
              composition: composition ?? undefined,
            }
          : m,
      );
      syncPersist({ ...s, messages });
      return { messages };
    }),

  appendSectionBusinesses: (messageId, sectionId, incoming) =>
    set((s) => {
      const msg = s.messages.find((m) => m.id === messageId);
      if (!msg || incoming.length === 0) return {};

      const byId = new Map((msg.businesses ?? []).map((b) => [b.id, b]));
      for (const b of incoming) byId.set(b.id, b);
      const businesses = [...byId.values()];
      const newIds = incoming.map((b) => b.id);

      let composition = msg.composition;
      if (composition?.sections?.length) {
        const hasSection = composition.sections.some((sec) => sec.id === sectionId);
        composition = {
          ...composition,
          sections: hasSection
            ? composition.sections.map((section) => {
                if (section.id !== sectionId) return section;
                const seen = new Set(section.businessIds);
                const merged = [
                  ...section.businessIds,
                  ...newIds.filter((id) => !seen.has(id)),
                ];
                return { ...section, businessIds: merged };
              })
            : [
                ...composition.sections,
                {
                  id: sectionId,
                  title: "More options",
                  subtitle: null,
                  kind: "list" as const,
                  businessIds: newIds,
                },
              ],
        };
      }

      const messages = s.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              businesses,
              ...(composition ? { composition } : {}),
            }
          : m,
      );
      const isLatest =
        s.messages.length > 0 &&
        s.messages[s.messages.length - 1]?.id === messageId;
      const next = {
        ...s,
        messages,
        ...(isLatest
          ? {
              activeBusinesses: businesses,
              activeComposition: composition ?? s.activeComposition,
            }
          : {}),
      };
      syncPersist(next);
      return {
        messages,
        ...(isLatest
          ? {
              activeBusinesses: businesses,
              activeComposition: composition ?? null,
            }
          : {}),
      };
    }),

  patchMessage: (id, patch) =>
    set((s) => {
      const messages = s.messages.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      );
      syncPersist({ ...s, messages });
      return { messages };
    }),

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setAuthRequired: (authRequired) => set({ authRequired }),

  setActiveResults: (activeBusinesses, activeComposition) =>
    set((s) => {
      syncPersist({ ...s, activeBusinesses, activeComposition });
      return { activeBusinesses, activeComposition };
    }),

  selectBusiness: (selectedBusinessId, business = null) =>
    set({
      selectedBusinessId,
      detailBusiness: selectedBusinessId
        ? (business ?? get().detailBusiness)
        : null,
    }),

  reset: () => {
    const citySlug = get().citySlug;
    if (citySlug) clearPersistedChat(citySlug);
    set({
      messages: [],
      status: "idle",
      error: null,
      authRequired: false,
      activeBusinesses: [],
      activeComposition: null,
      selectedBusinessId: null,
      detailBusiness: null,
    });
  },
}));
