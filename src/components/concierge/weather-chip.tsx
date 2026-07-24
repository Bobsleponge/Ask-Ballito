"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type WeatherMood = "sunny" | "cloudy" | "rain" | "night";

export interface WeatherChipData {
  summary: string;
  conditionText: string;
  conditionType: string | null;
  temperatureC: number | null;
  isRainingNow: boolean;
  isDaytime: boolean | null;
  outdoorBias: "favor_outdoor" | "favor_indoor" | "neutral";
}

function moodFromWeather(data: WeatherChipData): WeatherMood {
  if (data.isRainingNow || data.outdoorBias === "favor_indoor") return "rain";
  if (data.isDaytime === false) return "night";
  const t = `${data.conditionType ?? ""} ${data.conditionText}`.toLowerCase();
  if (/\b(cloud|overcast|fog|mist|haze)\b/.test(t)) return "cloudy";
  if (/\b(rain|shower|storm|thunder|drizzle)\b/.test(t)) return "rain";
  return "sunny";
}

function WeatherScene({
  mood,
  reduceMotion,
}: {
  mood: WeatherMood;
  reduceMotion: boolean;
}) {
  if (mood === "rain") {
    return (
      <span className="relative size-7 shrink-0 overflow-hidden" aria-hidden>
        <motion.span
          className="absolute inset-x-1 top-1 h-3 rounded-full bg-muted-foreground/35"
          animate={reduceMotion ? undefined : { x: [0, 2, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className="absolute top-3 h-2 w-0.5 rounded-full bg-aqua/80"
            style={{ left: `${22 + i * 16}%` }}
            animate={
              reduceMotion
                ? { opacity: 0.7 }
                : { y: [0, 14], opacity: [0.15, 1, 0.15] }
            }
            transition={{
              duration: 0.85,
              repeat: Infinity,
              delay: i * 0.14,
              ease: "easeIn",
            }}
          />
        ))}
      </span>
    );
  }

  if (mood === "cloudy") {
    return (
      <span className="relative size-7 shrink-0" aria-hidden>
        <motion.span
          className="absolute top-2 left-1 h-2.5 w-5 rounded-full bg-muted-foreground/30"
          animate={reduceMotion ? undefined : { x: [0, 3, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className="absolute top-3.5 left-2.5 h-3 w-6 rounded-full bg-muted-foreground/45"
          animate={reduceMotion ? undefined : { x: [0, -2.5, 0] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </span>
    );
  }

  if (mood === "night") {
    return (
      <span className="relative size-7 shrink-0" aria-hidden>
        <motion.span
          className="absolute top-1.5 left-2 size-4 rounded-full bg-aqua/70 shadow-[0_0_10px_oklch(0.72_0.09_195/0.45)]"
          animate={reduceMotion ? undefined : { rotate: [0, 8, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className="absolute top-1.5 left-3.5 size-3.5 rounded-full bg-card"
          aria-hidden
        />
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute size-0.5 rounded-full bg-aqua"
            style={{
              top: `${18 + i * 18}%`,
              right: `${14 + (i % 2) * 20}%`,
            }}
            animate={
              reduceMotion
                ? { opacity: 0.7 }
                : { opacity: [0.25, 1, 0.25], scale: [0.8, 1.2, 0.8] }
            }
            transition={{
              duration: 1.8 + i * 0.3,
              repeat: Infinity,
              delay: i * 0.35,
            }}
          />
        ))}
      </span>
    );
  }

  return (
    <span className="relative size-7 shrink-0" aria-hidden>
      <motion.span
        className="absolute inset-0"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="absolute top-1/2 left-1/2 h-2.5 w-0.5 origin-bottom rounded-full bg-amber-400/70"
            style={{
              transform: `translate(-50%, -100%) rotate(${i * 45}deg) translateY(-5px)`,
            }}
          />
        ))}
      </motion.span>
      <motion.span
        className="absolute top-1/2 left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_12px_oklch(0.85_0.14_85/0.55)]"
        animate={reduceMotion ? undefined : { scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </span>
  );
}

export function WeatherChip({
  citySlug,
  className,
}: {
  citySlug: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const [data, setData] = useState<WeatherChipData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void (async () => {
      try {
        const res = await fetch(
          `/api/weather?city=${encodeURIComponent(citySlug)}`,
        );
        if (!res.ok) {
          if (!cancelled) setStatus("error");
          return;
        }
        const json = (await res.json()) as WeatherChipData;
        if (!cancelled) {
          setData(json);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [citySlug]);

  const mood = useMemo(
    () => (data ? moodFromWeather(data) : "sunny"),
    [data],
  );

  if (status === "error") return null;

  if (status === "loading" || !data) {
    return (
      <div
        className={cn(
          "hidden h-9 w-[6.5rem] items-center gap-2 rounded-xl border border-border/60 bg-card/70 px-2.5 sm:flex",
          className,
        )}
        aria-hidden
      >
        <span className="size-7 animate-pulse rounded-full bg-muted/80" />
        <span className="h-3 flex-1 animate-pulse rounded bg-muted/80" />
      </div>
    );
  }

  const temp =
    data.temperatureC != null ? `${Math.round(data.temperatureC)}°` : null;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "hidden h-9 max-w-[11.5rem] items-center gap-1.5 overflow-hidden rounded-xl border border-border/60 bg-card/80 px-2 shadow-coastal backdrop-blur-sm sm:flex",
        "ring-1 ring-ocean/5",
        className,
      )}
      title={data.summary}
      aria-label={`Weather: ${data.summary}`}
    >
      <WeatherScene mood={mood} reduceMotion={reduceMotion} />
      <div className="min-w-0 leading-tight">
        {temp ? (
          <p className="font-heading text-sm font-semibold tabular-nums tracking-tight text-foreground">
            {temp}
          </p>
        ) : null}
        <p className="truncate text-[10px] font-medium text-muted-foreground">
          {data.conditionText}
        </p>
      </div>
    </motion.div>
  );
}
