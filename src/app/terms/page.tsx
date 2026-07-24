import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <p className="text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          Home
        </Link>
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">Terms of Use</h1>
      <p className="text-muted-foreground">Last updated: 21 July 2026.</p>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Service</h2>
        <p className="text-muted-foreground">
          Ask Ballito is an AI concierge for local discovery. Recommendations
          may be incomplete or incorrect. Always verify critical details
          (hours, prices, medical or legal advice) with the business directly.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Accounts</h2>
        <p className="text-muted-foreground">
          You are responsible for activity under your account. Do not abuse the
          service (spam, scraping, prompt attacks, or attempts to bypass rate
          limits). We may suspend chat or accounts that harm the service or
          other users.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Business listings</h2>
        <p className="text-muted-foreground">
          Claiming a business requires accurate self-attestation and admin
          review. Owners must keep listing content lawful and accurate.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Liability</h2>
        <p className="text-muted-foreground">
          The service is provided as-is without warranties. To the extent
          permitted by law, we are not liable for losses arising from reliance
          on AI recommendations or third-party business information.
        </p>
      </section>
    </main>
  );
}
