"use client";

import { useRef, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  deleteGalleryImageAction,
  uploadGalleryImageAction,
} from "@/lib/business-portal/actions";
import { publicMediaUrl } from "@/lib/business-portal/media-url";

export function GalleryManager({
  businessId,
  images,
}: {
  businessId: string;
  images: { id: string; path: string; caption: string | null }[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.set("businessId", businessId);
            fd.set("file", file);
            startTransition(async () => {
              const result = await uploadGalleryImageAction(fd);
              if (!result.ok) toast.error(result.error);
              else {
                toast.success("Photo added");
                router.refresh();
              }
            });
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || images.length >= 12}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? "Uploading…" : "Add gallery photo"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Up to 12 photos · JPEG/PNG/WebP · max 5MB each
        </p>
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">No gallery photos yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img) => {
            const url = publicMediaUrl(img.path);
            return (
              <div
                key={img.id}
                className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
              >
                {url ? (
                  <Image
                    src={url}
                    alt={img.caption ?? ""}
                    fill
                    className="object-cover"
                    sizes="320px"
                  />
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-2 right-2"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteGalleryImageAction({
                        businessId,
                        imageId: img.id,
                      });
                      if (!result.ok) toast.error(result.error);
                      else {
                        toast.success("Removed");
                        router.refresh();
                      }
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
