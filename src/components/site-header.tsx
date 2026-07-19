import Link from "next/link";
import { CitySwitcher } from "@/components/concierge/city-switcher";
import { UserMenu, type SessionUser } from "@/components/user-menu";
import { siteConfig } from "@/config/site";
import type { City } from "@/config/cities";

export function SiteHeader({
  city,
  user,
}: {
  city: City;
  user: SessionUser | null;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-1">
          <Link href={`/${city.slug}`} className="font-semibold tracking-tight">
            {siteConfig.name}
          </Link>
          <span className="mx-1 text-muted-foreground">/</span>
          <CitySwitcher current={city} />
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/${city.slug}/explore`}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Explore
          </Link>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
