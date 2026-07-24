"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createBusinessSpecialAction,
  updateBusinessSpecialAction,
} from "@/lib/business-portal/actions";
import { parseRecurrence } from "@/lib/business-portal/special-live";
import { publicMediaUrl } from "@/lib/business-portal/media-url";
import type {
  BusinessSpecialKind,
  BusinessSpecialScheduleType,
  BusinessSpecialStatus,
  Json,
} from "@/types/database";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function SpecialForm({
  businessId,
  mode,
  initial,
}: {
  businessId: string;
  mode: "create" | "edit";
  initial?: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    kind: string;
    discount_label: string | null;
    terms: string | null;
    cta_url: string | null;
    schedule_type: string;
    starts_at: string | null;
    ends_at: string | null;
    valid_from: string | null;
    valid_until: string | null;
    recurrence: Json | null;
    image_path: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const existingRecurrence = parseRecurrence(initial?.recurrence);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<BusinessSpecialStatus>(
    (initial?.status as BusinessSpecialStatus) ?? "draft",
  );
  const [kind, setKind] = useState<BusinessSpecialKind>(
    (initial?.kind as BusinessSpecialKind) ?? "deal",
  );
  const [discountLabel, setDiscountLabel] = useState(
    initial?.discount_label ?? "",
  );
  const [terms, setTerms] = useState(initial?.terms ?? "");
  const [ctaUrl, setCtaUrl] = useState(initial?.cta_url ?? "");
  const [scheduleType, setScheduleType] = useState<BusinessSpecialScheduleType>(
    (initial?.schedule_type as BusinessSpecialScheduleType) ?? "one_time",
  );
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.ends_at));
  const [validFrom, setValidFrom] = useState(toDateInput(initial?.valid_from));
  const [validUntil, setValidUntil] = useState(
    toDateInput(initial?.valid_until),
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    existingRecurrence?.daysOfWeek ?? [5],
  );
  const [startTime, setStartTime] = useState(
    existingRecurrence?.startTime ?? "17:00",
  );
  const [endTime, setEndTime] = useState(existingRecurrence?.endTime ?? "19:00");
  const [image, setImage] = useState<File | null>(null);
  const [clearImage, setClearImage] = useState(false);
  const imageUrl =
    !clearImage && initial?.image_path
      ? publicMediaUrl(initial.image_path)
      : null;

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("businessId", businessId);
    formData.set("title", title);
    formData.set("description", description);
    formData.set("status", status);
    formData.set("kind", kind);
    formData.set("discountLabel", discountLabel);
    formData.set("terms", terms);
    formData.set("ctaUrl", ctaUrl);
    formData.set("scheduleType", scheduleType);
    formData.set("startsAt", startsAt);
    formData.set("endsAt", endsAt);
    formData.set("validFrom", validFrom ? `${validFrom}T00:00` : "");
    formData.set("validUntil", validUntil ? `${validUntil}T23:59` : "");
    formData.set("daysOfWeek", daysOfWeek.join(","));
    formData.set("startTime", startTime);
    formData.set("endTime", endTime);
    formData.set("timezone", "Africa/Johannesburg");
    formData.set("clearImage", clearImage ? "true" : "false");
    if (image) formData.set("image", image);
    if (mode === "edit" && initial) formData.set("specialId", initial.id);

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createBusinessSpecialAction(formData)
          : await updateBusinessSpecialAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "create" ? "Special created" : "Special updated");
      router.push(`/business/dashboard/${businessId}/specials`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kind">Type</Label>
          <select
            id="kind"
            className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as BusinessSpecialKind)}
          >
            <option value="deal">Deal</option>
            <option value="happy_hour">Happy hour</option>
            <option value="event">Event</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as BusinessSpecialStatus)}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="discount">Discount label</Label>
          <Input
            id="discount"
            value={discountLabel}
            onChange={(e) => setDiscountLabel(e.target.value)}
            placeholder="2-for-1, 20% off…"
            maxLength={40}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cta">CTA / booking URL</Label>
          <Input
            id="cta"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            placeholder="https://"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="terms">Terms</Label>
          <Textarea
            id="terms"
            rows={2}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Fine print, exclusions…"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <Label>Schedule</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={scheduleType === "one_time" ? "default" : "outline"}
            onClick={() => setScheduleType("one_time")}
          >
            One-time
          </Button>
          <Button
            type="button"
            size="sm"
            variant={scheduleType === "recurring" ? "default" : "outline"}
            onClick={() => setScheduleType("recurring")}
          >
            Weekly recurring
          </Button>
        </div>

        {scheduleType === "one_time" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="starts">Starts</Label>
              <Input
                id="starts"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ends">Ends</Label>
              <Input
                id="ends"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, day) => (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant={daysOfWeek.includes(day) ? "default" : "outline"}
                  onClick={() => toggleDay(day)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startTime">Daily start</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Daily end</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validFrom">Valid from</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validUntil">Valid until</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Times use Africa/Johannesburg.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="image">Image</Label>
        {imageUrl ? (
          <div className="relative mb-2 h-32 w-48 overflow-hidden rounded-md border">
            <Image src={imageUrl} alt="" fill className="object-cover" />
          </div>
        ) : null}
        <Input
          id="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            setImage(e.target.files?.[0] ?? null);
            setClearImage(false);
          }}
        />
        {initial?.image_path ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setClearImage(true);
              setImage(null);
            }}
          >
            Remove image
          </Button>
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        {pending
          ? "Saving…"
          : mode === "create"
            ? "Create special"
            : "Save special"}
      </Button>
    </form>
  );
}
