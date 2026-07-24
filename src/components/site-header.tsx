"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, SquarePen, Compass, Store } from "lucide-react";
import { CitySwitcher } from "@/components/concierge/city-switcher";
import { WeatherChip } from "@/components/concierge/weather-chip";
import { UserMenu, type SessionUser } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { siteConfig } from "@/config/site";
import type { City } from "@/config/cities";
import {
  toggleDiscoverRail,
  requestChatReset,
  type ChatResetSource,
} from "@/lib/chat/chat-ui";
import { cn } from "@/lib/utils";

function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-coastal",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none">
        <path
          d="M4 14c2.5-1 4.5-4 8-4s5.5 3 8 4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M5 17c2-0.6 3.5-2.2 7-2.2s5 1.6 7 2.2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
        />
        <circle cx="12" cy="8" r="1.5" fill="currentColor" opacity="0.9" />
      </svg>
    </span>
  );
}

function isChatHomePath(pathname: string | null, citySlug: string): boolean {
  if (!pathname) return false;
  const base = `/${citySlug}`;
  return pathname === base || pathname === `${base}/`;
}

export function SiteHeader({
  city,
  user,
  isAdmin = false,
  hasBusiness = false,
}: {
  city: City;
  user: SessionUser | null;
  isAdmin?: boolean;
  hasBusiness?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const onChatHome = isChatHomePath(pathname, city.slug);
  const chatHomeHref = `/${city.slug}`;

  function goToNewChat(source: ChatResetSource) {
    if (onChatHome) {
      requestChatReset({ city: city.slug, source });
      return;
    }
    // Explore / claim / etc. have no Concierge listener — navigate home + reset.
    router.push(`${chatHomeHref}?new=1`);
  }

  function openDiscover() {
    if (onChatHome) {
      toggleDiscoverRail();
      return;
    }
    router.push(`${chatHomeHref}?discover=1`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-2 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 lg:hidden"
            aria-label="Open discover menu"
            onClick={openDiscover}
          >
            <Menu className="size-5" />
          </Button>

          <button
            type="button"
            onClick={() => goToNewChat("logo")}
            className="group flex min-h-10 items-center gap-2 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${siteConfig.name} — start a new chat`}
          >
            <BrandMark />
            <span className="font-heading text-base font-semibold tracking-tight text-foreground">
              {siteConfig.name}
            </span>
          </button>

          <span className="hidden text-muted-foreground/50 sm:inline" aria-hidden>
            /
          </span>
          <div className="hidden sm:block">
            <CitySwitcher current={city} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <WeatherChip citySlug={city.slug} />
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5 rounded-xl px-3 shadow-coastal"
            onClick={() => goToNewChat("new_chat")}
            aria-label="New chat"
          >
            <SquarePen className="size-4" />
            <span className="hidden sm:inline">New chat</span>
          </Button>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            <Link
              href={`/${city.slug}/explore`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Compass className="size-4" />
              Explore
            </Link>
            <Link
              href={`/${city.slug}/business/claim`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Store className="size-4" />
              Claim
            </Link>
            {hasBusiness ? (
              <Link
                href="/business/dashboard"
                className="inline-flex h-9 items-center rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Dashboard
              </Link>
            ) : null}
            {isAdmin ? (
              <Link
                href="/admin"
                className="inline-flex h-9 items-center rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Admin
              </Link>
            ) : null}
          </nav>

          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 rounded-xl"
                  aria-label="More navigation"
                >
                  <Compass className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/${city.slug}/explore`}>Explore</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${city.slug}/business/claim`}>
                    Claim business
                  </Link>
                </DropdownMenuItem>
                {hasBusiness ? (
                  <DropdownMenuItem asChild>
                    <Link href="/business/dashboard">Dashboard</Link>
                  </DropdownMenuItem>
                ) : null}
                {isAdmin ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">Admin</Link>
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 sm:hidden">
                  <CitySwitcher current={city} />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <UserMenu user={user} isAdmin={isAdmin} hasBusiness={hasBusiness} />
        </div>
      </div>
    </header>
  );
}
