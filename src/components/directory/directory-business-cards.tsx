"use client";

import { useRouter } from "next/navigation";
import { BusinessCard } from "@/components/concierge/business-card";
import type { BusinessResult } from "@/lib/schemas/business";

export function DirectoryBusinessCards({
  citySlug,
  businesses,
}: {
  citySlug: string;
  businesses: BusinessResult[];
}) {
  const router = useRouter();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {businesses.map((business, index) => (
        <BusinessCard
          key={business.id}
          business={business}
          index={index}
          onSelect={(b) => {
            router.push(`/${citySlug}?biz=${b.id}`);
          }}
        />
      ))}
    </div>
  );
}
