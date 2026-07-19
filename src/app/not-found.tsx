import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DEFAULT_CITY_SLUG } from "@/config/cities";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-muted-foreground">
        That city or page is not available yet.
      </p>
      <Button asChild>
        <Link href={`/${DEFAULT_CITY_SLUG}`}>Go to Ballito</Link>
      </Button>
    </div>
  );
}
