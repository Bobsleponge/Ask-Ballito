import type { BusinessSpecialRow, Json } from "@/types/database";

export type SpecialRecurrence = {
  frequency: "weekly";
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  timezone: string;
};

export function parseRecurrence(raw: Json | null | undefined): SpecialRecurrence | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (rec.frequency !== "weekly") return null;
  const days = Array.isArray(rec.daysOfWeek)
    ? rec.daysOfWeek.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6)
    : [];
  if (days.length === 0) return null;
  const startTime = typeof rec.startTime === "string" ? rec.startTime : "00:00";
  const endTime = typeof rec.endTime === "string" ? rec.endTime : "23:59";
  const timezone =
    typeof rec.timezone === "string" && rec.timezone
      ? rec.timezone
      : "Africa/Johannesburg";
  return { frequency: "weekly", daysOfWeek: days, startTime, endTime, timezone };
}

/**
 * Whether a special should show as live on Ask Ballito right now.
 */
export function isSpecialLive(
  special: Pick<
    BusinessSpecialRow,
    | "status"
    | "schedule_type"
    | "starts_at"
    | "ends_at"
    | "valid_from"
    | "valid_until"
    | "recurrence"
  >,
  now: Date = new Date(),
): boolean {
  if (special.status !== "active") return false;

  if (special.schedule_type === "recurring") {
    const recurrence = parseRecurrence(special.recurrence);
    if (!recurrence) return false;

    if (special.valid_from && now.getTime() < new Date(special.valid_from).getTime()) {
      return false;
    }
    if (special.valid_until && now.getTime() > new Date(special.valid_until).getTime()) {
      return false;
    }

    const parts = getZonedParts(now, recurrence.timezone);
    if (!recurrence.daysOfWeek.includes(parts.dayOfWeek)) return false;

    const minutes = parts.hour * 60 + parts.minute;
    const start = parseHm(recurrence.startTime);
    const end = parseHm(recurrence.endTime);
    if (start == null || end == null) return false;
    if (start <= end) return minutes >= start && minutes <= end;
    // Overnight window (e.g. 22:00–02:00)
    return minutes >= start || minutes <= end;
  }

  // one_time
  if (special.starts_at && now.getTime() < new Date(special.starts_at).getTime()) {
    return false;
  }
  if (special.ends_at && now.getTime() > new Date(special.ends_at).getTime()) {
    return false;
  }
  return true;
}

/** Upcoming: active but not live yet (one-time future start, or recurring outside hours). */
export function isSpecialUpcoming(
  special: Pick<
    BusinessSpecialRow,
    | "status"
    | "schedule_type"
    | "starts_at"
    | "ends_at"
    | "valid_from"
    | "valid_until"
    | "recurrence"
  >,
  now: Date = new Date(),
): boolean {
  if (special.status !== "active") return false;
  if (isSpecialLive(special, now)) return false;

  if (special.schedule_type === "recurring") {
    if (special.valid_until && now.getTime() > new Date(special.valid_until).getTime()) {
      return false;
    }
    return true;
  }

  if (special.ends_at && now.getTime() > new Date(special.ends_at).getTime()) {
    return false;
  }
  return Boolean(
    special.starts_at && now.getTime() < new Date(special.starts_at).getTime(),
  );
}

function parseHm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function getZonedParts(
  date: Date,
  timeZone: string,
): { dayOfWeek: number; hour: number; minute: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = fmt.formatToParts(date);
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const map: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return { dayOfWeek: map[weekday] ?? 0, hour, minute };
  } catch {
    return {
      dayOfWeek: date.getDay(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }
}
