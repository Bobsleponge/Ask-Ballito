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
  /** Business catalog for the latest assistant turn. */
  activeBusinesses: BusinessResult[];
  activeComposition: CompositionPayload | null;
  selectedBusinessId: string | null;

  hydrateForCity: (citySlug: string) => void;
  addMessage: (message: UiMessage) => void;
  appendToMessage: (id: string, delta: string) => void;
  setMessageResults: (
    id: string,
    businesses: BusinessResult[],
    composition: CompositionPayload | null,
  ) => void;
  setStatus: (status: ChatStatus) => void;
  setError: (error: string | null) => void;
  setActiveResults: (
    businesses: BusinessResult[],
    composition: CompositionPayload | null,
  ) => void;
  selectBusiness: (id: string | null) => void;
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
  activeBusinesses: [],
  activeComposition: null,
  selectedBusinessId: null,

  hydrateForCity: (citySlug) => {
    const prev = get().citySlug;
    if (prev === citySlug && get().messages.length > 0) return;

    const saved = loadPersistedChat(citySlug);
    set({
      citySlug,
      messages: saved?.messages ?? [],
      activeBusinesses: saved?.activeBusinesses ?? [],
      activeComposition: saved?.activeComposition ?? null,
      selectedBusinessId: null,
      status: "idle",
      error: null,
    });
  },

  addMessage: (message) =>
    set((s) => {
      const next = { ...s, messages: [...s.messages, message] };
      syncPersist(next);
      return { messages: next.messages };
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

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),

  setActiveResults: (activeBusinesses, activeComposition) =>
    set((s) => {
      syncPersist({ ...s, activeBusinesses, activeComposition });
      return { activeBusinesses, activeComposition };
    }),

  selectBusiness: (selectedBusinessId) => set({ selectedBusinessId }),

  reset: () => {
    const citySlug = get().citySlug;
    if (citySlug) clearPersistedChat(citySlug);
    set({
      messages: [],
      status: "idle",
      error: null,
      activeBusinesses: [],
      activeComposition: null,
      selectedBusinessId: null,
    });
  },
}));
