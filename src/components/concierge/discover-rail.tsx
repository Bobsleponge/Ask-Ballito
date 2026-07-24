"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  SquarePen,
  Compass,
  Calendar,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DISCOVER_CATEGORIES,
  FUTURE_NAV_ITEMS,
} from "@/config/discover";
import type { City } from "@/config/cities";
import { discoverIcon } from "./discover-icons";
import {
  DISCOVER_RAIL_EVENT,
  requestChatReset,
} from "@/lib/chat/chat-ui";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "ask-ballito:rail-collapsed";

function RailBody({
  city,
  collapsed,
  onPick,
  onNavigate,
}: {
  city: City;
  collapsed: boolean;
  onPick: (prompt: string) => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const aboutHref = `/${city.slug}/about`;
  const aboutActive = pathname === aboutHref;

  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <Link
        href={aboutHref}
        onClick={onNavigate}
        className={cn(
          "flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          aboutActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          collapsed && "justify-center px-0",
        )}
        title="About"
        aria-current={aboutActive ? "page" : undefined}
      >
        <Home className="size-4 shrink-0 opacity-80" />
        {!collapsed ? <span>About</span> : null}
      </Link>

      <Button
        type="button"
        className={cn(
          "mt-1 h-10 justify-start gap-2 rounded-xl shadow-coastal",
          collapsed && "justify-center px-0",
        )}
        onClick={() => {
          requestChatReset({ city: city.slug, source: "rail" });
          onNavigate?.();
        }}
        aria-label="New chat"
      >
        <SquarePen className="size-4 shrink-0" />
        {!collapsed ? <span>New chat</span> : null}
      </Button>

      <div className="mt-4">
        {!collapsed ? (
          <p className="mb-2 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Discover
          </p>
        ) : null}
        <nav className="flex flex-col gap-0.5" aria-label="Categories">
          {DISCOVER_CATEGORIES.map((cat) => {
            const Icon = discoverIcon(cat.icon);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  onPick(cat.prompt);
                  onNavigate?.();
                }}
                className={cn(
                  "flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium text-sidebar-foreground transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  collapsed && "justify-center px-0",
                )}
                title={cat.label}
                aria-label={cat.label}
              >
                <Icon className="size-4 shrink-0 opacity-80" />
                {!collapsed ? <span>{cat.label}</span> : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-4 flex flex-col gap-0.5">
        {!collapsed ? (
          <p className="mb-2 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Explore
          </p>
        ) : null}
        <Link
          href={`/${city.slug}/explore`}
          onClick={onNavigate}
          className={cn(
            "flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium text-sidebar-foreground transition-colors",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed && "justify-center px-0",
          )}
          title="Explore Ballito"
        >
          <Compass className="size-4 shrink-0 opacity-80" />
          {!collapsed ? <span>Explore {city.name}</span> : null}
        </Link>
        <button
          type="button"
          onClick={() => {
            onPick(`What's on this weekend in ${city.name}?`);
            onNavigate?.();
          }}
          className={cn(
            "flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium text-sidebar-foreground transition-colors",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            collapsed && "justify-center px-0",
          )}
          title="Nearby events"
        >
          <Calendar className="size-4 shrink-0 opacity-80" />
          {!collapsed ? <span>Nearby events</span> : null}
        </button>
      </div>

      <div className="mt-auto border-t border-sidebar-border pt-3">
        {!collapsed ? (
          <p className="mb-2 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Coming soon
          </p>
        ) : null}
        <div className="flex flex-col gap-0.5">
          {FUTURE_NAV_ITEMS.map((item) => {
            const Icon = discoverIcon(item.icon);
            return (
              <div
                key={item.id}
                className={cn(
                  "flex min-h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm text-muted-foreground/70",
                  collapsed && "justify-center px-0",
                )}
                title={`${item.label} — coming soon`}
                aria-disabled
              >
                <Icon className="size-4 shrink-0 opacity-50" />
                {!collapsed ? (
                  <span className="flex items-center gap-2">
                    {item.label}
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                      Soon
                    </span>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * In-flow discover column — always pushes main content; never a fixed overlay.
 * Below lg: closed by default (w-0), menu toggles it open beside the page.
 * lg+: always visible; collapse control switches full ↔ icons.
 */
export function DiscoverRail({
  city,
  onPick,
}: {
  city: City;
  onPick: (prompt: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      try {
        setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
      } catch {
        // ignore
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onRail = (e: Event) => {
      const detail = (e as CustomEvent<{ open?: boolean; toggle?: boolean }>)
        .detail;
      if (detail?.toggle) {
        setMobileOpen((v) => !v);
        return;
      }
      if (detail?.open === false) {
        setMobileOpen(false);
        return;
      }
      setMobileOpen(true);
    };
    window.addEventListener(DISCOVER_RAIL_EVENT, onRail);
    return () => window.removeEventListener(DISCOVER_RAIL_EVENT, onRail);
  }, []);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const widthClass = collapsed ? "w-[72px]" : "w-[260px]";

  return (
    <aside
      className={cn(
        "relative z-0 flex min-h-0 shrink-0 flex-col self-stretch overflow-hidden bg-sidebar transition-[width] duration-200",
        // < lg: in-flow slide — open pushes main; closed takes no width.
        mobileOpen
          ? cn("border-r border-sidebar-border", widthClass)
          : "w-0 border-0",
        // lg+: always docked (overrides the mobile w-0).
        "lg:border-r lg:border-sidebar-border",
        collapsed ? "lg:w-[72px]" : "lg:w-[260px]",
      )}
      aria-label="Discover"
    >
      <div
        className={cn(
          "flex h-full min-h-0 flex-col",
          collapsed ? "w-[72px]" : "w-[260px]",
        )}
      >
        <div className="flex shrink-0 items-center justify-end border-b border-sidebar-border px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-lg max-lg:hidden"
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-lg lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <ChevronLeft className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RailBody
            city={city}
            collapsed={collapsed}
            onPick={onPick}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      </div>
    </aside>
  );
}
