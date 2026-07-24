import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-background/80">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}. Local recommendations,
          not legal or medical advice.
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/cookies" className="hover:text-foreground">
            Cookies
          </Link>
        </nav>
      </div>
    </footer>
  );
}
