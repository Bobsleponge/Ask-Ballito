import type { User } from "@supabase/supabase-js";
import type { SessionUser } from "@/components/user-menu";

export function toSessionUser(user: User | null): SessionUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    name:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
  };
}
