/**
 * Cross-component chat UI helpers (header, rail, concierge).
 */

export const CHAT_RESET_EVENT = "ask-ballito:chat-reset";
export const CHAT_FOCUS_EVENT = "ask-ballito:chat-focus";
export const DISCOVER_RAIL_EVENT = "ask-ballito:discover-rail";

export type ChatResetSource = "logo" | "new_chat" | "rail";

export interface ChatResetDetail {
  city: string;
  source: ChatResetSource;
}

export function requestChatReset(detail: ChatResetDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ChatResetDetail>(CHAT_RESET_EVENT, { detail }),
  );
}

export function focusChatInput() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHAT_FOCUS_EVENT));
  const el = document.querySelector<HTMLTextAreaElement>("[data-chat-input]");
  el?.focus({ preventScroll: false });
}

export function openDiscoverRail() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DISCOVER_RAIL_EVENT, { detail: { open: true } }),
  );
}

export function toggleDiscoverRail() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DISCOVER_RAIL_EVENT, { detail: { toggle: true } }),
  );
}

export function closeDiscoverRail() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DISCOVER_RAIL_EVENT, { detail: { open: false } }),
  );
}

export function scrollToHeroSection(id: string) {
  if (typeof window === "undefined") return;
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}
