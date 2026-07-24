"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  Store,
  Images,
  Tag,
  Users,
  UserRound,
  Settings,
  UtensilsCrossed,
} from "lucide-react";
import { UserMenu, type SessionUser } from "@/components/user-menu";
import { siteConfig } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function businessIdFromPath(pathname: string): string | null {
  const match = pathname.match(
    /^\/business\/dashboard\/([0-9a-f-]{36})(?:\/|$)/i,
  );
  return match?.[1] ?? null;
}

export function BusinessPortalHeader({
  user,
  businessNames = {},
  fallbackBusinessId,
  isAdmin = false,
}: {
  user: SessionUser;
  /** Map of businessId → display name for multi-business owners. */
  businessNames?: Record<string, string>;
  fallbackBusinessId?: string | null;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const businessId = businessIdFromPath(pathname) ?? fallbackBusinessId ?? null;
  const businessName =
    (businessId ? businessNames[businessId] : null) ??
    (fallbackBusinessId ? businessNames[fallbackBusinessId] : null) ??
    null;
  const base = businessId
    ? `/business/dashboard/${businessId}`
    : "/business/dashboard";

  const nav = businessId
    ? [
        { href: base, label: "Overview", icon: LayoutDashboard, exact: true },
        { href: `${base}/listing`, label: "Listing", icon: Store },
        { href: `${base}/offerings`, label: "Offerings", icon: UtensilsCrossed },
        { href: `${base}/branding`, label: "Branding", icon: Images },
        { href: `${base}/specials`, label: "Specials", icon: Tag },
        { href: `${base}/team`, label: "Team", icon: Users },
        { href: `${base}/profile`, label: "Profile", icon: UserRound },
        { href: `${base}/settings`, label: "Settings", icon: Settings },
      ]
    : [{ href: base, label: "Overview", icon: LayoutDashboard, exact: true }];

  return (
    <header className="sticky top-0 z-40 border-b border-teal-900/40 bg-teal-950 text-teal-50">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/business/dashboard"
            className="flex min-w-0 items-center gap-2 font-semibold tracking-tight"
          >
            <Building2 className="size-4 shrink-0 text-teal-300" />
            <span className="truncate">
              {businessName?.trim() || siteConfig.name}
            </span>
          </Link>
          <Badge
            variant="outline"
            className="shrink-0 border-teal-700 bg-teal-900 text-teal-100"
          >
            Business
          </Badge>
        </div>

        <nav className="hidden items-center gap-0.5 xl:flex">
          {nav.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-teal-900 text-white"
                    : "text-teal-200/80 hover:bg-teal-900/70 hover:text-teal-50",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/ballito"
            className="hidden text-sm text-teal-200/80 transition-colors hover:text-teal-50 md:inline"
          >
            Back to site
          </Link>
          <UserMenu user={user} isAdmin={isAdmin} hasBusiness />
        </div>
      </div>

      {businessId ? (
        <div className="border-t border-teal-900/50 xl:hidden">
          <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 py-2">
            {nav.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs",
                    active
                      ? "bg-teal-900 text-white"
                      : "text-teal-200/80",
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
