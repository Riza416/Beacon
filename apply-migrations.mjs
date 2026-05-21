import pg from "pg";
import fs from "node:fs";

const password = process.env.SB_DB_PASSWORD;
const ref = process.env.SB_PROJECT_REF;
if (!process.env.SB_CONNECTION_STRING && (!password || !ref)) {
  console.error("Set SB_CONNECTION_STRING, or both SB_DB_PASSWORD and SB_PROJECT_REF");
  process.exit(1);
}

// Try direct DB connection (IPv4 may not be available on free tier)
const cs = process.env.SB_CONNECTION_STRING
  || `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
console.log("connecting:", cs.replace(/:[^:@]+@/, ":***@"));

const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node apply-beacon-migrations.mjs <file1.sql> [file2.sql] ...");
  process.exit(1);
}

await client.connect();
console.log("connected");

for (const file of files) {
  const sql = fs.readFileSync(file, "utf8");
  console.log(`applying ${file} (${sql.length} bytes)...`);
  try {
    await client.query(sql);
    console.log(`  ok`);
  } catch (e) {
    console.error(`  failed:`, e.message);
    process.exit(1);
  }
}

await client.end();
console.log("done");
