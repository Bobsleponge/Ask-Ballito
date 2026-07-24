import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { CITIES } from "@/config/cities";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "");
  const staticPaths = ["", "/privacy", "/terms", "/cookies"];
  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${base}${path || "/"}`,
    lastModified: new Date(),
  }));

  for (const city of CITIES.filter((c) => c.enabled)) {
    entries.push(
      { url: `${base}/${city.slug}`, lastModified: new Date() },
      { url: `${base}/${city.slug}/about`, lastModified: new Date() },
      { url: `${base}/${city.slug}/explore`, lastModified: new Date() },
    );
  }

  return entries;
}
