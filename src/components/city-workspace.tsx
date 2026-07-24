"use client";

import { useCallback } from "react";
import { SiteHeader } from "@/components/site-header";
import { DiscoverRail } from "@/components/concierge/discover-rail";
import { Concierge } from "@/components/concierge/concierge";
import type { City } from "@/config/cities";
import type { SessionUser } from "@/components/user-menu";
import { useChat } from "@/hooks/use-chat";
import { pushRecentSearch } from "@/lib/discover/recent-searches";

export function CityWorkspace({
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
  const { sendMessage } = useChat(city.slug);

  const onPick = useCallback(
    (prompt: string) => {
      pushRecentSearch(city.slug, prompt);
      void sendMessage(prompt);
    },
    [city.slug, sendMessage],
  );

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <SiteHeader
        city={city}
        user={user}
        isAdmin={isAdmin}
        hasBusiness={hasBusiness}
      />
      <div className="flex min-h-0 flex-1 items-stretch">
        <DiscoverRail city={city} onPick={onPick} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Concierge city={city} sendMessage={sendMessage} />
        </main>
      </div>
    </div>
  );
}
