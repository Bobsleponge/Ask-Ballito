import "server-only";
import { detectFileType } from "@/lib/security/detect-file-type";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

const PUBLIC_BUCKET = "business-media";
const PRIVATE_BUCKET = "business-media-private";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PDF_TYPE = "application/pdf";
const SIGNED_URL_TTL_SECONDS = 15 * 60;

export type MediaKind =
  | "logo"
  | "hero"
  | "special"
  | "menu_item"
  | "menu_import"
  | "gallery";

const LIMITS: Record<MediaKind, number> = {
  logo: 2 * 1024 * 1024,
  hero: 5 * 1024 * 1024,
  special: 5 * 1024 * 1024,
  menu_item: 5 * 1024 * 1024,
  menu_import: 10 * 1024 * 1024,
  gallery: 5 * 1024 * 1024,
};

function isPrivateKind(kind: MediaKind): boolean {
  return kind === "menu_import";
}

function bucketFor(kind: MediaKind): string {
  return isPrivateKind(kind) ? PRIVATE_BUCKET : PUBLIC_BUCKET;
}

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === PDF_TYPE) return "pdf";
  return "jpg";
}

/** Public CDN URL for public-bucket objects (logo/hero/gallery/etc.). */
export function publicMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("private:")) return null;
  const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`;
}

/**
 * Resolve a display URL. Private menu-import paths (`private:…`) get a short-lived signed URL.
 */
export async function resolveMediaUrl(
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("private:")) {
    const objectPath = path.slice("private:".length);
    return signedPrivateMediaUrl(objectPath);
  }
  return publicMediaUrl(path);
}

export async function signedPrivateMediaUrl(
  objectPath: string,
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(objectPath, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export class BusinessMediaService {
  async upload(params: {
    businessId: string;
    kind: MediaKind;
    file: File;
    specialId?: string;
    menuItemId?: string;
  }): Promise<string> {
    const { businessId, kind, file, specialId, menuItemId } = params;

    if (file.size > LIMITS[kind]) {
      throw new Error(
        `File too large (max ${Math.round(LIMITS[kind] / (1024 * 1024))}MB)`,
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = detectFileType(buffer);

    if (!mime) {
      throw new Error(
        kind === "menu_import"
          ? "Only JPEG, PNG, WebP, or PDF allowed for menu import"
          : "Only JPEG, PNG, or WebP images are allowed",
      );
    }

    if (kind === "menu_import") {
      if (!IMAGE_TYPES.has(mime) && mime !== PDF_TYPE) {
        throw new Error("Only JPEG, PNG, WebP, or PDF allowed for menu import");
      }
    } else if (!IMAGE_TYPES.has(mime)) {
      throw new Error("Only JPEG, PNG, or WebP images are allowed");
    }

    const ext = extForMime(mime);
    const path = buildPath({
      businessId,
      kind,
      ext,
      specialId,
      menuItemId,
    });

    const admin = createAdminClient();
    const bucket = bucketFor(kind);

    if (kind === "logo" || kind === "hero") {
      const prefixes = [
        `${businessId}/${kind}.jpg`,
        `${businessId}/${kind}.png`,
        `${businessId}/${kind}.webp`,
      ];
      await admin.storage.from(PUBLIC_BUCKET).remove(prefixes);
    }

    const { error } = await admin.storage.from(bucket).upload(path, buffer, {
      contentType: mime,
      upsert: true,
    });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    // Private objects are stored with a prefix so callers know to use signed URLs.
    return isPrivateKind(kind) ? `private:${path}` : path;
  }

  async remove(path: string | null | undefined): Promise<void> {
    if (!path) return;
    const admin = createAdminClient();
    if (path.startsWith("private:")) {
      await admin.storage
        .from(PRIVATE_BUCKET)
        .remove([path.slice("private:".length)]);
      return;
    }
    await admin.storage.from(PUBLIC_BUCKET).remove([path]);
  }

  /** Delete a private import shortly after study (lifecycle cleanup). */
  async removeAfterStudy(path: string | null | undefined): Promise<void> {
    await this.remove(path);
  }
}

function buildPath(params: {
  businessId: string;
  kind: MediaKind;
  ext: string;
  specialId?: string;
  menuItemId?: string;
}): string {
  const { businessId, kind, ext, specialId, menuItemId } = params;
  switch (kind) {
    case "special":
      return `${businessId}/specials/${specialId ?? crypto.randomUUID()}.${ext}`;
    case "menu_item":
      return `${businessId}/menu/${menuItemId ?? crypto.randomUUID()}.${ext}`;
    case "menu_import":
      return `${businessId}/imports/${crypto.randomUUID()}.${ext}`;
    case "gallery":
      return `${businessId}/gallery/${crypto.randomUUID()}.${ext}`;
    default:
      return `${businessId}/${kind}.${ext}`;
  }
}

export const businessMediaService = new BusinessMediaService();
