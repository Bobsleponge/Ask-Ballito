import type { LucideIcon } from "lucide-react";
import {
  Utensils,
  Waves,
  Users,
  Coffee,
  Home,
  Cross,
  Sparkles,
  Calendar,
  Map,
  Briefcase,
  Cloud,
  Bookmark,
  Bell,
} from "lucide-react";
import type { DiscoverIconId } from "@/config/discover";

const ICON_MAP: Record<DiscoverIconId, LucideIcon> = {
  utensils: Utensils,
  waves: Waves,
  users: Users,
  coffee: Coffee,
  home: Home,
  cross: Cross,
  sparkles: Sparkles,
  calendar: Calendar,
  map: Map,
  briefcase: Briefcase,
  cloud: Cloud,
  bookmark: Bookmark,
  bell: Bell,
};

export function discoverIcon(id: DiscoverIconId): LucideIcon {
  return ICON_MAP[id] ?? Sparkles;
}
