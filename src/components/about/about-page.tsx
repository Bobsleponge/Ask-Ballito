"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAboutContent } from "@/config/about";
import type { City } from "@/config/cities";
import { cn } from "@/lib/utils";

function chatPromptHref(citySlug: string, prompt: string) {
  return `/${citySlug}?q=${encodeURIComponent(prompt)}`;
}

export function AboutPage({ city }: { city: City }) {
  const copy = getAboutContent(city.name);
  const chatHref = `/${city.slug}`;
  const claimHref = `/${city.slug}/business/claim`;

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.08, 1]);
  const heroFade = useTransform(scrollYProgress, [0, 0.7], [1, 0.35]);

  return (
    <div className="flex flex-1 flex-col overflow-x-hidden">
      {/* Hero — full-bleed coastal plane, brand-first */}
      <section
        ref={heroRef}
        className="relative isolate min-h-[100svh] overflow-hidden"
      >
        <motion.div
          style={{ y: imageY, scale: imageScale }}
          className="absolute inset-0 will-change-transform"
        >
          <Image
            src="/images/about-hero.jpg"
            alt={`Coastline near ${city.name}`}
            fill
            priority
            className="object-cover object-[center_40%]"
            sizes="100vw"
          />
        </motion.div>

        <div
          className="absolute inset-0 bg-gradient-to-t from-[oklch(0.18_0.05_240)] via-[oklch(0.22_0.05_230/0.55)] to-[oklch(0.45_0.06_210/0.15)]"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent"
          aria-hidden
        />

        <motion.div
          style={{ opacity: heroFade }}
          className="relative mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col justify-end px-4 pb-24 pt-28 sm:px-8 sm:pb-28"
        >
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-heading text-sm font-semibold tracking-[0.28em] text-aqua uppercase sm:text-base"
          >
            {copy.brand}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="font-heading mt-5 max-w-[14ch] text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.95] font-semibold tracking-tight text-white"
          >
            {copy.headline.split("\n").map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-md text-base text-white/80 sm:text-lg"
          >
            {copy.support}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Button
              asChild
              size="lg"
              className="h-12 rounded-xl px-6 text-base shadow-coastal-lg"
            >
              <Link href={chatHref}>
                {copy.heroCtaPrimary}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="h-12 rounded-xl px-5 text-base text-white hover:bg-white/10 hover:text-white"
            >
              <Link href={claimHref}>{copy.heroCtaSecondary}</Link>
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* How it works — large numbers, open layout */}
      <section className="relative bg-background px-4 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {copy.howItWorks.title}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {copy.howItWorks.support}
            </p>
          </motion.div>

          <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
            {copy.howItWorks.steps.map((step, i) => (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="relative"
              >
                <span
                  className="font-heading block text-[4.5rem] leading-none font-semibold tracking-tighter text-aqua/35 sm:text-[5.5rem]"
                  aria-hidden
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-heading mt-4 text-xl font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {step.body}
                </p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* Capabilities — alternating coastal bands */}
      <section className="relative overflow-hidden bg-ocean px-4 py-20 text-primary-foreground sm:px-8 sm:py-28">
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-[28rem] rounded-full bg-aqua/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 size-[22rem] rounded-full bg-[oklch(0.55_0.08_220/0.35)] blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              {copy.capabilities.title}
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/75">
              {copy.capabilities.support}
            </p>
          </motion.div>

          <ul className="mt-16 grid gap-6 sm:grid-cols-2">
            {copy.capabilities.items.map((item, i) => (
              <motion.li
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <Link
                  href={chatPromptHref(city.slug, item.example)}
                  className={cn(
                    "group flex h-full flex-col justify-between rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-sm",
                    "transition-colors duration-300 hover:border-aqua/40 hover:bg-white/10",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua",
                  )}
                >
                  <div>
                    <h3 className="font-heading text-xl font-semibold">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-primary-foreground/70">
                      {item.body}
                    </p>
                  </div>
                  <p className="font-heading mt-8 flex items-start gap-2 text-sm text-aqua">
                    <span className="line-clamp-2 flex-1 italic">
                      “{item.example}”
                    </span>
                    <ArrowUpRight className="mt-0.5 size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </p>
                </Link>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      {/* Try asking — interactive prompt runway */}
      <section className="hero-atmosphere px-4 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {copy.tryAsking.title}
            </h2>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              {copy.tryAsking.support}
            </p>
          </motion.div>

          <ul className="mt-12 flex flex-col gap-3">
            {copy.tryAsking.prompts.map((prompt, i) => (
              <motion.li
                key={prompt}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Link
                  href={chatPromptHref(city.slug, prompt)}
                  className={cn(
                    "group flex items-center justify-between gap-4 border-b border-border/80 py-5",
                    "transition-colors hover:border-primary/40",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <span className="font-heading text-lg text-foreground transition-colors group-hover:text-primary sm:text-xl md:text-2xl">
                    {prompt}
                  </span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 transition-all group-hover:opacity-100 sm:opacity-100 sm:bg-transparent sm:text-primary sm:group-hover:bg-primary sm:group-hover:text-primary-foreground">
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      {/* Locals + businesses — split strip, no promo cards */}
      <section className="grid lg:grid-cols-2">
        <div className="flex flex-col justify-between bg-sand/70 px-4 py-16 sm:px-8 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45 }}
            className="mx-auto w-full max-w-lg"
          >
            <p className="text-xs font-semibold tracking-[0.2em] text-ocean uppercase">
              For people
            </p>
            <h2 className="font-heading mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {copy.forLocals.title}
            </h2>
            <p className="mt-4 text-muted-foreground">{copy.forLocals.support}</p>
            <ul className="mt-8 space-y-3">
              {copy.forLocals.points.map((point) => (
                <li
                  key={point}
                  className="flex gap-3 text-sm text-foreground sm:text-base"
                >
                  <span
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-ocean"
                    aria-hidden
                  />
                  {point}
                </li>
              ))}
            </ul>
            <Link
              href={chatHref}
              className="font-heading mt-10 inline-flex items-center gap-2 text-base font-semibold text-primary transition-colors hover:text-ocean"
            >
              Start asking
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </div>

        <div className="flex flex-col justify-between bg-primary px-4 py-16 text-primary-foreground sm:px-8 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="mx-auto w-full max-w-lg"
          >
            <p className="text-xs font-semibold tracking-[0.2em] text-aqua uppercase">
              For businesses
            </p>
            <h2 className="font-heading mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {copy.forBusinesses.title}
            </h2>
            <p className="mt-4 text-primary-foreground/75">
              {copy.forBusinesses.support}
            </p>
            <ul className="mt-8 space-y-3">
              {copy.forBusinesses.points.map((point) => (
                <li
                  key={point}
                  className="flex gap-3 text-sm sm:text-base"
                >
                  <span
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-aqua"
                    aria-hidden
                  />
                  {point}
                </li>
              ))}
            </ul>
            <Link
              href={claimHref}
              className="font-heading mt-10 inline-flex items-center gap-2 text-base font-semibold text-aqua transition-colors hover:text-white"
            >
              {copy.forBusinesses.cta}
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Closing — shoreline CTA */}
      <section className="relative isolate overflow-hidden px-4 py-24 sm:px-8 sm:py-32">
        <Image
          src="/images/about-hero.jpg"
          alt=""
          fill
          className="object-cover object-[center_70%] opacity-40"
          sizes="100vw"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-[oklch(0.2_0.05_240)] via-[oklch(0.25_0.06_230/0.92)] to-[oklch(0.28_0.05_220/0.85)]"
          aria-hidden
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="relative mx-auto max-w-3xl text-center"
        >
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            {copy.closing.title}
          </h2>
          <p className="mt-4 text-lg text-white/75">{copy.closing.support}</p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="mt-10 h-12 rounded-xl px-8 text-base shadow-coastal-lg"
          >
            <Link href={chatHref}>
              {copy.closing.cta}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </motion.div>
      </section>
    </div>
  );
}
