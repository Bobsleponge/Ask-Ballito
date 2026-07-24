/**
 * Shared Sentry event scrubbing for server, edge, and client.
 * Strips request bodies, auth headers, cookies, and common PII patterns
 * from messages / breadcrumbs so chat/auth content is less likely to leak.
 */

const REDACTED = "[Filtered]";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT_RE =
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const MAGIC_LINK_TOKEN_RE = /[?&](token|code|access_token|refresh_token)=[^&\s]+/gi;

function scrubString(value: string): string {
  return value
    .replace(BEARER_RE, `Bearer ${REDACTED}`)
    .replace(JWT_RE, REDACTED)
    .replace(MAGIC_LINK_TOKEN_RE, (match) =>
      match.replace(/=[^&\s]+/, `=${REDACTED}`),
    )
    .replace(EMAIL_RE, REDACTED);
}

function scrubUnknown(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED;
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) {
    return value.map((item) => scrubUnknown(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const lower = key.toLowerCase();
      if (
        lower.includes("password") ||
        lower.includes("secret") ||
        lower.includes("authorization") ||
        lower.includes("cookie") ||
        lower === "email" ||
        lower === "data" ||
        lower === "body" ||
        lower === "request" ||
        lower === "headers"
      ) {
        out[key] = REDACTED;
        continue;
      }
      out[key] = scrubUnknown(child, depth + 1);
    }
    return out;
  }
  return value;
}

/** Minimal event shape compatible with Sentry Event across runtimes. */
type ScrubbableSentryEvent = {
  message?: string;
  request?: {
    data?: unknown;
    cookies?: unknown;
    headers?: Record<string, string> | unknown;
    query_string?: unknown;
    [key: string]: unknown;
  };
  user?: {
    email?: string | null;
    ip_address?: string | null;
    username?: string | null;
    [key: string]: unknown;
  } | null;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: {
    values?: Array<{ message?: string; data?: Record<string, unknown> }>;
  };
  exception?: {
    values?: Array<{ value?: string; type?: string }>;
  };
  [key: string]: unknown;
};

/**
 * Mutates and returns a Sentry event with PII-heavy fields removed/redacted.
 * Safe to use as `beforeSend` from server, edge, and browser configs.
 */
export function scrubSentryEvent<T extends object>(event: T): T | null {
  const e = event as ScrubbableSentryEvent;

  if (e.message) {
    e.message = scrubString(e.message);
  }

  if (e.exception?.values) {
    for (const ex of e.exception.values) {
      if (ex.value) ex.value = scrubString(ex.value);
    }
  }

  if (e.user) {
    e.user = {
      ...e.user,
      email: e.user.email ? REDACTED : e.user.email,
      ip_address: e.user.ip_address ? REDACTED : e.user.ip_address,
      username: e.user.username ? REDACTED : e.user.username,
    };
  }

  if (e.request) {
    const headers = e.request.headers;
    let scrubbedHeaders: Record<string, string> | undefined;
    if (headers && typeof headers === "object" && !Array.isArray(headers)) {
      scrubbedHeaders = {};
      for (const [k, v] of Object.entries(headers as Record<string, string>)) {
        const lower = k.toLowerCase();
        if (
          lower === "authorization" ||
          lower === "cookie" ||
          lower === "set-cookie" ||
          lower === "x-supabase-auth" ||
          lower.includes("token")
        ) {
          scrubbedHeaders[k] = REDACTED;
        } else if (typeof v === "string") {
          scrubbedHeaders[k] = scrubString(v);
        } else {
          scrubbedHeaders[k] = REDACTED;
        }
      }
    }

    e.request = {
      ...e.request,
      data: undefined,
      cookies: undefined,
      query_string: undefined,
      headers: scrubbedHeaders ?? REDACTED,
    };
  }

  if (e.extra) {
    e.extra = scrubUnknown(e.extra) as Record<string, unknown>;
  }

  if (e.contexts) {
    e.contexts = scrubUnknown(e.contexts) as Record<string, unknown>;
  }

  if (e.breadcrumbs?.values) {
    for (const crumb of e.breadcrumbs.values) {
      if (crumb.message) crumb.message = scrubString(crumb.message);
      if (crumb.data) {
        crumb.data = scrubUnknown(crumb.data) as Record<string, unknown>;
      }
    }
  }

  return event;
}
