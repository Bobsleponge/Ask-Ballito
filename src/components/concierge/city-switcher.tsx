"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics/events";
import { CITIES, type City } from "@/config/cities";

export function CitySwitcher({ current }: { current: City }) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <MapPin className="size-4" />
          <span className="font-medium">{current.name}</span>
          <ChevronsUpDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Choose a city</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CITIES.map((city) => (
          <DropdownMenuItem
            key={city.slug}
            disabled={!city.enabled}
            onSelect={() => {
              if (city.slug === current.slug) return;
              analytics.capture("city_changed", { from: current.slug, to: city.slug });
              router.push(`/${city.slug}`);
            }}
            className="flex items-center justify-between"
          >
            <span>{city.name}</span>
            {city.slug === current.slug ? (
              <Check className="size-4" />
            ) : !city.enabled ? (
              <span className="text-xs text-muted-foreground">Soon</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
