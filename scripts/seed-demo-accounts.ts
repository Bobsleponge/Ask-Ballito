/**
 * Creates dedicated demo accounts (admin / business / user) without modifying
 * any existing users. Idempotent — safe to re-run.
 *
 * Usage:
 *   npm run seed:demo-accounts
 */
import { createClient } from "@supabase/supabase-js";
import { DEMO_ACCOUNTS, type DemoAccountRole } from "../src/config/demo-accounts";

const DEMO_PASSWORD =
  process.env.DEMO_LOGIN_PASSWORD?.trim() || "AskBallitoDemo!2026";

const DEMO_EMAILS: Record<DemoAccountRole, string> = {
  admin: "admin@demo.askballito.local",
  business: "business@demo.askballito.local",
  user: "user@demo.askballito.local",
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Seeding demo accounts (existing users are left untouched)...\n");

  for (const account of DEMO_ACCOUNTS) {
    const email = DEMO_EMAILS[account.role];
    const { data: profileMatch } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    let userId = profileMatch?.id as string | undefined;

    if (userId) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        {
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: `Demo ${account.label}`,
            demo_role: account.role,
          },
        },
      );
      if (updateError) throw new Error(updateError.message);
      console.log(`↻ Updated password for ${email}`);
    } else {
      const { data: created, error: createError } =
        await supabase.auth.admin.createUser({
          email,
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: `Demo ${account.label}`,
            demo_role: account.role,
          },
        });
      if (createError) throw new Error(createError.message);
      userId = created.user.id;
      console.log(`+ Created ${email}`);
    }

    if (!userId) throw new Error(`Missing user id for ${email}`);

    // Profile is created by trigger; set flags only on these demo emails.
    if (account.role === "admin") {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_admin: true,
          full_name: "Demo Admin",
        })
        .eq("id", userId)
        .eq("email", email);
      if (error) throw new Error(`Admin profile update failed: ${error.message}`);
      console.log(`  → is_admin = true`);
    } else {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_admin: false,
          full_name: `Demo ${account.label}`,
        })
        .eq("id", userId)
        .eq("email", email);
      if (error) {
        throw new Error(`Profile update failed: ${error.message}`);
      }
    }

    if (account.role === "business") {
      await ensureBusinessMembership(supabase, userId);
    }
  }

  console.log("\nDemo accounts ready. Quick-login password:");
  console.log(`  ${DEMO_PASSWORD}`);
  console.log("\nEmails:");
  for (const a of DEMO_ACCOUNTS) {
    console.log(`  ${a.label.padEnd(10)} ${DEMO_EMAILS[a.role]}`);
  }
}

async function ensureBusinessMembership(
  // Untyped admin client is fine for one-off seed scripts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
) {
  const { data: existingMembership } = await supabase
    .from("business_members")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existingMembership) {
    console.log("  → already has business membership");
    return;
  }

  // Prefer a business that does not already have an active owner.
  const { data: businesses, error: bizError } = await supabase
    .from("businesses")
    .select("id, name")
    .neq("provider", "seed")
    .order("name", { ascending: true })
    .limit(50);

  if (bizError) {
    throw new Error(`Failed to load businesses: ${bizError.message}`);
  }

  if (!businesses?.length) {
    console.log(
      "  → no businesses found; claim one after ingest to unlock portal",
    );
    return;
  }

  for (const business of businesses as { id: string; name: string }[]) {
    const { data: owner } = await supabase
      .from("business_members")
      .select("id")
      .eq("business_id", business.id)
      .eq("role", "owner")
      .eq("status", "active")
      .maybeSingle();

    if (owner) continue;

    const { error: memberError } = await supabase
      .from("business_members")
      .insert({
        business_id: business.id,
        user_id: userId,
        role: "owner",
        status: "active",
      });

    if (memberError) {
      throw new Error(`Membership insert failed: ${memberError.message}`);
    }

    console.log(`  → owner of "${business.name}"`);
    return;
  }

  console.log(
    "  → all listed businesses already have owners; membership skipped",
  );
}

main().catch((err) => {
  console.error("Seed demo accounts failed:", err?.message ?? err);
  process.exit(1);
});
