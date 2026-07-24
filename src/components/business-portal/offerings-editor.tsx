"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  analyseOfferingsForSearchAction,
  bulkCreateMenuItemsAction,
  clearMenuItemImageAction,
  createMenuItemAction,
  deleteMenuItemAction,
  extractMenuFromFileAction,
  reorderMenuItemsAction,
  updateBusinessServicesKeywordsAction,
  updateMenuItemAction,
  uploadMenuItemImageAction,
} from "@/lib/business-portal/actions";
import type { BusinessMenuItemInput } from "@/lib/schemas/business-offerings";
import type { OfferingsStudySuggestion } from "@/lib/schemas/offerings-study";
import { publicMediaUrl } from "@/lib/business-portal/media-url";

export type OfferingsMenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  category: string | null;
  image_path: string | null;
  sort_order: number;
};

export function OfferingsEditor({
  businessId,
  services: initialServices,
  keywords: initialKeywords,
  menuItems: initialMenuItems,
  directoryServices = [],
}: {
  businessId: string;
  services: string[];
  keywords: string[];
  menuItems: OfferingsMenuItem[];
  directoryServices?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [services, setServices] = useState(initialServices);
  const [keywords, setKeywords] = useState(initialKeywords);
  const [items, setItems] = useState(initialMenuItems);
  const [serviceDraft, setServiceDraft] = useState("");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [importDraft, setImportDraft] = useState<BusinessMenuItemInput[] | null>(
    null,
  );
  const [suggestions, setSuggestions] =
    useState<OfferingsStudySuggestion | null>(null);
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
  });

  const grouped = useMemo(() => {
    const map = new Map<string, OfferingsMenuItem[]>();
    for (const item of items) {
      const key = item.category?.trim() || "Uncategorized";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [items]);

  function refresh() {
    router.refresh();
  }

  function addChip(
    draft: string,
    list: string[],
    setList: (v: string[]) => void,
    setDraft: (v: string) => void,
  ) {
    const value = draft.trim();
    if (!value) return;
    if (list.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    if (list.length >= 40) {
      toast.error("At most 40 items");
      return;
    }
    setList([...list, value]);
    setDraft("");
  }

  function mergeUnique(existing: string[], incoming: string[]): string[] {
    const out = [...existing];
    for (const raw of incoming) {
      const v = raw.trim();
      if (!v) continue;
      if (out.some((s) => s.toLowerCase() === v.toLowerCase())) continue;
      if (out.length >= 40) break;
      out.push(v);
    }
    return out;
  }

  function applySuggestions(next: OfferingsStudySuggestion) {
    setSuggestions(next);
    setServices((prev) => mergeUnique(prev, next.services));
    setKeywords((prev) => mergeUnique(prev, next.keywords));
  }

  function saveServicesKeywords() {
    startTransition(async () => {
      const result = await updateBusinessServicesKeywordsAction({
        businessId,
        services,
        keywords,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Services & keywords saved — search will use these");
      setSuggestions(null);
      refresh();
    });
  }

  function analyseForSearch(draftItems?: BusinessMenuItemInput[]) {
    startTransition(async () => {
      const result = await analyseOfferingsForSearchAction({
        businessId,
        items: draftItems?.length ? draftItems : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      applySuggestions(result.data);
      const n =
        result.data.services.length + result.data.keywords.length;
      toast.success(
        `Suggested ${n} search terms — review chips, then save`,
      );
    });
  }

  function applyPaste() {
    const parsed = parseBulkPaste(pasteText);
    if (parsed.length === 0) {
      toast.error("No items found. Use: Name | Price | Category");
      return;
    }
    setImportDraft(parsed);
    analyseForSearch(parsed);
  }

  function commitImportDraft() {
    if (!importDraft?.length) return;
    startTransition(async () => {
      const result = await bulkCreateMenuItemsAction({
        businessId,
        items: importDraft,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Added ${result.data.count} items`);
      setImportDraft(null);
      setPasteText("");
      refresh();
    });
  }

  function onImportFile(file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.set("businessId", businessId);
    fd.set("file", file);
    startTransition(async () => {
      const result = await extractMenuFromFileAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setImportDraft(result.data.items);
      if (
        result.data.suggestions.services.length > 0 ||
        result.data.suggestions.keywords.length > 0
      ) {
        applySuggestions(result.data.suggestions);
        toast.success(
          `Extracted ${result.data.items.length} items and search suggestions — review below`,
        );
      } else {
        toast.success(
          `Extracted ${result.data.items.length} items — review below`,
        );
      }
    });
  }

  function saveNewItem() {
    if (!newItem.name.trim()) {
      toast.error("Name is required");
      return;
    }
    startTransition(async () => {
      const result = await createMenuItemAction({
        businessId,
        ...newItem,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Item added");
      setNewItem({ name: "", description: "", price: "", category: "" });
      refresh();
    });
  }

  function moveItem(id: string, dir: -1 | 1) {
    const idx = items.findIndex((i) => i.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= items.length) return;
    const next = [...items];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setItems(next);
    startTransition(async () => {
      const result = await reorderMenuItemsAction({
        businessId,
        orderedIds: next.map((i) => i.id),
      });
      if (!result.ok) toast.error(result.error);
      else refresh();
    });
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Services & keywords</h2>
            <p className="text-sm text-muted-foreground">
              Improve matching when people ask Ask Ballito. Import a menu or
              analyse your offerings and we suggest terms from what you actually
              offer — any industry.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => analyseForSearch(importDraft ?? undefined)}
          >
            <Sparkles className="size-4" />
            Analyse for search
          </Button>
        </div>
        {suggestions ? (
          <div className="rounded-md border border-dashed bg-muted/40 p-3 text-sm">
            <p className="font-medium">Suggested from your offerings</p>
            {suggestions.summary ? (
              <p className="mt-1 text-muted-foreground">{suggestions.summary}</p>
            ) : (
              <p className="mt-1 text-muted-foreground">
                New chips were added above. Remove any that do not fit, then
                save.
              </p>
            )}
          </div>
        ) : null}
        <ChipField
          id="services"
          label="Services"
          values={services}
          draft={serviceDraft}
          onDraftChange={setServiceDraft}
          onAdd={() =>
            addChip(serviceDraft, services, setServices, setServiceDraft)
          }
          onRemove={(v) => setServices(services.filter((s) => s !== v))}
          highlight={suggestions?.services}
        />
        {directoryServices.length > 0 ? (
          <div className="rounded-md border border-dashed p-3">
            <p className="mb-2 text-xs text-muted-foreground">
              From directory (read-only)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {directoryServices.map((s) => (
                <Badge key={s} variant="secondary" className="font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        <ChipField
          id="keywords"
          label="Search keywords"
          values={keywords}
          draft={keywordDraft}
          onDraftChange={setKeywordDraft}
          onAdd={() =>
            addChip(keywordDraft, keywords, setKeywords, setKeywordDraft)
          }
          onRemove={(v) => setKeywords(keywords.filter((k) => k !== v))}
          highlight={suggestions?.keywords}
        />
        <Button type="button" disabled={pending} onClick={saveServicesKeywords}>
          Save services & keywords
        </Button>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Import menu / options</h2>
          <p className="text-sm text-muted-foreground">
            Paste a list, or upload a menu photo/PDF. We extract items and study
            them for search keywords — review before saving.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="paste">Bulk paste</Label>
            <Textarea
              id="paste"
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Burger | R85 | Mains\nGel manicure | R280 | Nails"}
            />
            <Button type="button" variant="outline" onClick={applyPaste}>
              Parse paste
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="menu-file">Photo or PDF</Label>
            <Input
              id="menu-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => onImportFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              JPEG/PNG/WebP or PDF (text-based). Max 10MB.
            </p>
          </div>
        </div>

        {importDraft ? (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Review draft ({importDraft.length})
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setImportDraft(null)}
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={commitImportDraft}
                >
                  Add all to menu
                </Button>
              </div>
            </div>
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {importDraft.map((item, i) => (
                <li
                  key={`${item.name}-${i}`}
                  className="flex flex-wrap gap-2 border-b pb-2"
                >
                  <span className="font-medium">{item.name}</span>
                  {item.price ? (
                    <span className="text-muted-foreground">{item.price}</span>
                  ) : null}
                  {item.category ? (
                    <Badge variant="outline">{item.category}</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Menu / service options</h2>
          <p className="text-sm text-muted-foreground">
            Add items with optional price, category, and photo.
          </p>
        </div>

        <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
          <Input
            placeholder="Name"
            value={newItem.name}
            onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))}
          />
          <Input
            placeholder="Category"
            value={newItem.category}
            onChange={(e) =>
              setNewItem((n) => ({ ...n, category: e.target.value }))
            }
          />
          <Input
            placeholder="Price"
            value={newItem.price}
            onChange={(e) =>
              setNewItem((n) => ({ ...n, price: e.target.value }))
            }
          />
          <Input
            placeholder="Description"
            value={newItem.description}
            onChange={(e) =>
              setNewItem((n) => ({ ...n, description: e.target.value }))
            }
          />
          <Button
            type="button"
            className="sm:col-span-2"
            disabled={pending}
            onClick={saveNewItem}
          >
            <Plus className="size-4" />
            Add item
          </Button>
        </div>

        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No menu items yet.</p>
        ) : (
          grouped.map(([category, catItems]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {category}
              </h3>
              {catItems.map((item) => (
                <MenuItemRow
                  key={item.id}
                  businessId={businessId}
                  item={item}
                  pending={pending}
                  onMoveUp={() => moveItem(item.id, -1)}
                  onMoveDown={() => moveItem(item.id, 1)}
                  onChanged={refresh}
                  startTransition={startTransition}
                />
              ))}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function MenuItemRow({
  businessId,
  item,
  pending,
  onMoveUp,
  onMoveDown,
  onChanged,
  startTransition,
}: {
  businessId: string;
  item: OfferingsMenuItem;
  pending: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChanged: () => void;
  startTransition: (fn: () => void) => void;
}) {
  const [draft, setDraft] = useState({
    name: item.name,
    description: item.description ?? "",
    price: item.price ?? "",
    category: item.category ?? "",
  });
  const imageUrl = publicMediaUrl(item.image_path);

  return (
    <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[80px_1fr_auto]">
      <div className="relative flex size-20 items-center justify-center overflow-hidden rounded-md bg-muted">
        {imageUrl ? (
          <Image src={imageUrl} alt="" fill className="object-cover" />
        ) : (
          <Upload className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <Input
          value={draft.category}
          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
          placeholder="Category"
        />
        <Input
          value={draft.price}
          onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
          placeholder="Price"
        />
        <Input
          value={draft.description}
          onChange={(e) =>
            setDraft((d) => ({ ...d, description: e.target.value }))
          }
          placeholder="Description"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await updateMenuItemAction({
                businessId,
                itemId: item.id,
                ...draft,
              });
              if (!result.ok) toast.error(result.error);
              else {
                toast.success("Saved");
                onChanged();
              }
            })
          }
        >
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/jpeg,image/png,image/webp";
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.set("businessId", businessId);
              fd.set("itemId", item.id);
              fd.set("file", file);
              startTransition(async () => {
                const result = await uploadMenuItemImageAction(fd);
                if (!result.ok) toast.error(result.error);
                else {
                  toast.success("Image uploaded");
                  onChanged();
                }
              });
            };
            input.click();
          }}
        >
          Photo
        </Button>
        {item.image_path ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              startTransition(async () => {
                const result = await clearMenuItemImageAction({
                  businessId,
                  itemId: item.id,
                });
                if (!result.ok) toast.error(result.error);
                else onChanged();
              })
            }
          >
            Clear photo
          </Button>
        ) : null}
        <div className="flex gap-1">
          <Button type="button" size="icon" variant="ghost" onClick={onMoveUp}>
            <ArrowUp className="size-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={onMoveDown}>
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() =>
              startTransition(async () => {
                const result = await deleteMenuItemAction({
                  businessId,
                  itemId: item.id,
                });
                if (!result.ok) toast.error(result.error);
                else {
                  toast.success("Deleted");
                  onChanged();
                }
              })
            }
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChipField({
  id,
  label,
  values,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
  highlight,
}: {
  id: string;
  label: string;
  values: string[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
  highlight?: string[];
}) {
  const highlightSet = useMemo(() => {
    if (!highlight?.length) return new Set<string>();
    return new Set(highlight.map((h) => h.toLowerCase()));
  }, [highlight]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => {
            const isNew = highlightSet.has(value.toLowerCase());
            return (
              <Badge
                key={value}
                variant={isNew ? "default" : "secondary"}
                className="gap-1 pr-1 font-normal"
              >
                {value}
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-muted"
                  onClick={() => onRemove(value)}
                  aria-label={`Remove ${value}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder="Type and press Enter"
        />
        <Button type="button" variant="outline" onClick={onAdd}>
          Add
        </Button>
      </div>
    </div>
  );
}

function parseBulkPaste(text: string): BusinessMenuItemInput[] {
  const items: BusinessMenuItemInput[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split("|").map((p) => p.trim());
    const name = parts[0];
    if (!name) continue;
    items.push({
      name,
      price: parts[1] ?? "",
      category: parts[2] ?? "",
      description: parts[3] ?? "",
    });
  }
  return items;
}
