"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { UserMenu, type SessionUser } from "@/components/user-menu";
import { siteConfig } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ADMIN_NAV: {
  href: string;
  label: string;
  exact?: boolean;
}[] = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/business-claims", label: "Business claims" },
  { href: "/admin/search-quality", label: "Search quality" },
  { href: "/admin/ai-usage", label: "AI usage" },
];

export function AdminHeader({ user }: { user: SessionUser }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <Shield className="size-4 shrink-0 text-zinc-300" />
            <span className="truncate">{siteConfig.name}</span>
          </Link>
          <Badge
            variant="outline"
            className="border-zinc-600 bg-zinc-900 text-zinc-200"
          >
            Admin
          </Badge>
        </div>

        <nav className="hidden items-center gap-1 sm:flex">
          {ADMIN_NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
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
            className="hidden text-sm text-zinc-400 transition-colors hover:text-zinc-100 md:inline"
          >
            Back to site
          </Link>
          <UserMenu user={user} isAdmin />
        </div>
      </div>
    </header>
  );
}
