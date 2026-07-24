/**
 * Applies pending SQL migrations in supabase/migrations (filename order).
 * Tracks applied files in public.schema_migrations (created by 0019).
 *
 * Usage:
 *   npm run migrate
 *   CONFIRM_PROD=1 npm run migrate   # required for non-local databases
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

function isLocalDbUrl(url: string): boolean {
  return (
    url.includes("127.0.0.1") ||
    url.includes("localhost") ||
    url.includes("@db:")
  );
}

function describeHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname || "(unknown host)";
  } catch {
    const match = url.match(/@([^/:]+)/);
    return match?.[1] ?? "(unparseable host)";
  }
}

async function ensureLedger(client: Client): Promise<void> {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("SUPABASE_DB_URL is not set in .env.local.");
    process.exit(1);
  }

  const local = isLocalDbUrl(url);
  const host = describeHost(url);
  console.log(`Target database host: ${host} (${local ? "local" : "remote"})`);

  if (!local && process.env.CONFIRM_PROD !== "1") {
    console.error(
      "Refusing to migrate a non-local database without CONFIRM_PROD=1.\n" +
        "Re-run: CONFIRM_PROD=1 npm run migrate",
    );
    process.exit(1);
  }

  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  await ensureLedger(client);

  const { rows: appliedRows } = await client.query<{ filename: string }>(
    "select filename from public.schema_migrations",
  );
  const applied = new Set(appliedRows.map((r) => r.filename));

  // Bootstrap: if ledger empty but schema already exists, stamp all but latest.
  if (applied.size === 0 && files.length > 0) {
    const { rows: biz } = await client.query<{ n: string }>(
      `select to_regclass('public.businesses')::text as n`,
    );
    if (biz[0]?.n) {
      console.log(
        "Ledger empty on existing DB — stamping prior migrations as applied (except newest).",
      );
      for (const file of files.slice(0, -1)) {
        await client.query(
          "insert into public.schema_migrations (filename) values ($1) on conflict do nothing",
          [file],
        );
        applied.add(file);
      }
    }
  }

  const pending = files.filter((f) => !applied.has(f));
  console.log(
    `Connected. ${pending.length} pending of ${files.length} migration(s)...`,
  );

  if (pending.length === 0) {
    console.log("Nothing to apply.");
    await client.end();
    return;
  }

  for (const file of pending) {
    const sql = readFileSync(join(dir, file), "utf8");
    process.stdout.write(`- ${file} ... `);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (filename) values ($1)",
        [file],
      );
      await client.query("commit");
      console.log("done");
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }

  await client.end();
  console.log("Pending migrations applied successfully.");
}

main().catch((err) => {
  console.error("\nMigration failed:", err?.message ?? err);
  process.exit(1);
});
