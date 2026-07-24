import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookies",
};

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <p className="text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          Home
        </Link>
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">Cookie notice</h1>
      <p className="text-muted-foreground">Last updated: 21 July 2026.</p>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Essential</h2>
        <p className="text-muted-foreground">
          Authentication and session cookies from Supabase keep you signed in
          and secure the app. These are required for the service to work.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Analytics</h2>
        <p className="text-muted-foreground">
          When configured, PostHog may set cookies or local storage to
          understand product usage. You can block analytics cookies via your
          browser settings; core chat still works.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">More detail</h2>
        <p className="text-muted-foreground">
          See our{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>{" "}
          for how personal information is processed.
        </p>
      </section>
    </main>
  );
}
