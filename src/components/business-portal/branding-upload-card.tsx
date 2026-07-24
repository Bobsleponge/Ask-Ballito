"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  clearBusinessBrandingAction,
  uploadBusinessBrandingAction,
} from "@/lib/business-portal/actions";

export function BrandingUploadCard({
  businessId,
  kind,
  title,
  hint,
  currentUrl,
  aspectClass,
}: {
  businessId: string;
  kind: "logo" | "hero";
  title: string;
  hint: string;
  currentUrl: string | null;
  aspectClass: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);

  function onFileChange(file: File | undefined) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.set("businessId", businessId);
    formData.set("kind", kind);
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadBusinessBrandingAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        setPreview(null);
        return;
      }
      toast.success(`${title} updated`);
      router.refresh();
    });
  }

  const displayUrl = preview ?? currentUrl;

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className={`relative overflow-hidden rounded-lg bg-muted ${aspectClass}`}>
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt=""
            fill
            className="object-cover"
            sizes="400px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No image yet
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? "Uploading…" : currentUrl ? "Replace" : "Upload"}
        </Button>
        {currentUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await clearBusinessBrandingAction({
                  businessId,
                  kind,
                });
                if (!result.ok) toast.error(result.error);
                else {
                  setPreview(null);
                  toast.success(`${title} removed`);
                  router.refresh();
                }
              })
            }
          >
            Remove
          </Button>
        ) : null}
        <Label className="text-xs font-normal text-muted-foreground">
          JPEG, PNG or WebP · {kind === "logo" ? "max 2MB" : "max 5MB"}
        </Label>
      </div>
    </div>
  );
}
