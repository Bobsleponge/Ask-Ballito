/**
 * Applies SQL migrations in supabase/migrations (in filename order) to the
 * database at SUPABASE_DB_URL.
 *
 * Usage:
 *   npm run migrate
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

async function main() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error("SUPABASE_DB_URL is not set in .env.local.");
    process.exit(1);
  }

  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const isLocal =
    url.includes("127.0.0.1") ||
    url.includes("localhost") ||
    url.includes("@db:");
  const client = new Client({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  console.log(`Connected. Applying ${files.length} migration(s)...`);

  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    process.stdout.write(`- ${file} ... `);
    await client.query(sql);
    console.log("done");
  }

  await client.end();
  console.log("All migrations applied successfully.");
}

main().catch((err) => {
  console.error("\nMigration failed:", err?.message ?? err);
  process.exit(1);
});
