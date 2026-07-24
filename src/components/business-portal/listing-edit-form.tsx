"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateBusinessListingAction } from "@/lib/business-portal/actions";
import { VERTICALS } from "@/config/verticals";
import {
  getListingFieldsForVertical,
  listingVerticalLabel,
  type ListingField,
} from "@/config/vertical-listing-fields";
import type { HoursOverride } from "@/lib/schemas/business-profile";
import type { BusinessAttributes } from "@/lib/schemas/business-attributes";

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export function ListingEditForm({
  businessId,
  tagline,
  description,
  phone,
  website,
  hoursOverride,
  attributes,
  listingVertical,
  businessVerticals,
  directoryDescription,
  directoryPhone,
  directoryWebsite,
  directoryName,
  directoryAddress,
}: {
  businessId: string;
  tagline: string;
  description: string;
  phone: string;
  website: string;
  hoursOverride: HoursOverride | null;
  attributes: BusinessAttributes;
  listingVertical: string | null;
  /** Verticals tagged on the directory listing (metadata.verticals). */
  businessVerticals: string[];
  directoryDescription: string;
  directoryPhone: string;
  directoryWebsite: string;
  directoryName: string;
  directoryAddress: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    tagline,
    description,
    phone,
    website,
  });
  const [hours, setHours] = useState<HoursOverride>(hoursOverride ?? {});
  const [attrs, setAttrs] = useState<BusinessAttributes>(attributes);

  const verticalOptions = useMemo(
    () => VERTICALS.map((v) => v.slug),
    [],
  );

  const defaultVertical =
    (listingVertical && verticalOptions.includes(listingVertical)
      ? listingVertical
      : null) ??
    businessVerticals.find((slug) => verticalOptions.includes(slug)) ??
    verticalOptions[0] ??
    "restaurants";

  const [selectedVertical, setSelectedVertical] = useState(defaultVertical);

  const fields = getListingFieldsForVertical(selectedVertical);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateBusinessListingAction({
        businessId,
        ...form,
        hoursOverride: Object.keys(hours).length ? hours : null,
        attributes: attrs,
        listingVertical: selectedVertical,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Listing updated");
      router.refresh();
    });
  }

  function setBooleanAttr(key: string, checked: boolean) {
    setAttrs((a) => ({
      ...a,
      [key]: checked ? true : null,
    }));
  }

  function setEnumAttr(key: string, value: string) {
    setAttrs((a) => ({
      ...a,
      [key]: value || null,
    }));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="space-y-4">
        <div>
          <h3 className="font-medium">About</h3>
          <p className="text-sm text-muted-foreground">
            Name and address come from the directory and stay read-only.
          </p>
        </div>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">{directoryName}</p>
          <p className="text-muted-foreground">
            {directoryAddress || "No address on file"}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={form.tagline}
            onChange={(e) =>
              setForm((f) => ({ ...f, tagline: e.target.value }))
            }
            placeholder="Short line under your name"
            maxLength={160}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={5}
            placeholder={
              directoryDescription || "Tell visitors about your business"
            }
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-medium">Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              placeholder={directoryPhone || "+27 …"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={form.website}
              onChange={(e) =>
                setForm((f) => ({ ...f, website: e.target.value }))
              }
              placeholder={directoryWebsite || "https://"}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="font-medium">Hours override</h3>
          <p className="text-sm text-muted-foreground">
            Optional. When set, these replace directory hours on Ask Ballito.
          </p>
        </div>
        <div className="space-y-2">
          {WEEKDAYS.map((day) => {
            const row = hours[day] ?? {};
            return (
              <div
                key={day}
                className="grid grid-cols-[100px_auto_1fr_1fr] items-center gap-2 text-sm"
              >
                <span className="capitalize">{day}</span>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={Boolean(row.closed)}
                    onChange={(e) =>
                      setHours((h) => ({
                        ...h,
                        [day]: { ...row, closed: e.target.checked },
                      }))
                    }
                  />
                  Closed
                </label>
                <Input
                  type="time"
                  disabled={Boolean(row.closed)}
                  value={row.open ?? ""}
                  onChange={(e) =>
                    setHours((h) => ({
                      ...h,
                      [day]: { ...row, open: e.target.value, closed: false },
                    }))
                  }
                />
                <Input
                  type="time"
                  disabled={Boolean(row.closed)}
                  value={row.close ?? ""}
                  onChange={(e) =>
                    setHours((h) => ({
                      ...h,
                      [day]: { ...row, close: e.target.value, closed: false },
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="font-medium">What you offer</h3>
          <p className="text-sm text-muted-foreground">
            Fields match your business type. Change the type if the directory
            tagged you incorrectly — you can edit these anytime.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="listing-type">Listing type</Label>
          <select
            id="listing-type"
            className="flex h-9 w-full max-w-xs rounded-md border bg-transparent px-3 text-sm"
            value={selectedVertical}
            onChange={(e) => setSelectedVertical(e.target.value)}
          >
            {verticalOptions.map((slug) => (
              <option key={slug} value={slug}>
                {listingVerticalLabel(slug)}
                {businessVerticals.includes(slug) ? " (directory)" : ""}
              </option>
            ))}
          </select>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No specific fields for this type yet.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((field) => (
              <ListingFieldControl
                key={field.key}
                field={field}
                attrs={attrs}
                onBoolean={setBooleanAttr}
                onEnum={setEnumAttr}
              />
            ))}
          </div>
        )}
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save listing"}
      </Button>
    </form>
  );
}

function ListingFieldControl({
  field,
  attrs,
  onBoolean,
  onEnum,
}: {
  field: ListingField;
  attrs: BusinessAttributes;
  onBoolean: (key: string, checked: boolean) => void;
  onEnum: (key: string, value: string) => void;
}) {
  if (field.type === "enum") {
    const raw = attrs[field.key as keyof BusinessAttributes];
    const value = typeof raw === "string" ? raw : "";
    return (
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`attr-${field.key}`}>{field.label}</Label>
        {field.help ? (
          <p className="text-xs text-muted-foreground">{field.help}</p>
        ) : null}
        <select
          id={`attr-${field.key}`}
          className="flex h-9 w-full max-w-xs rounded-md border bg-transparent px-3 text-sm"
          value={value}
          onChange={(e) => onEnum(field.key, e.target.value)}
        >
          <option value="">Not set</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={attrs[field.key as keyof BusinessAttributes] === true}
        onChange={(e) => onBoolean(field.key, e.target.checked)}
      />
      <span>
        <span className="font-medium">{field.label}</span>
        {field.help ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {field.help}
          </span>
        ) : null}
      </span>
    </label>
  );
}
