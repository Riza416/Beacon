// Introspect the live Postgres schema and emit a Supabase-compatible
// `Database` type, including FK Relationships so postgrest-js can detect
// ambiguous embeds at compile time.
//
// Usage: SB_CONNECTION_STRING="postgres://..." node scripts/gen-types.mjs > lib/database.types.ts
import pg from "pg";

const cs = process.env.SB_CONNECTION_STRING;
if (!cs) {
  console.error("Set SB_CONNECTION_STRING");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: cs,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// --- columns ---------------------------------------------------------------
const cols = (
  await client.query(`
    select c.table_name, c.column_name, c.data_type, c.udt_name,
           c.is_nullable, c.column_default
    from information_schema.columns c
    join information_schema.tables t
      on t.table_name = c.table_name and t.table_schema = c.table_schema
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
    order by c.table_name, c.ordinal_position
  `)
).rows;

// --- foreign keys ----------------------------------------------------------
const fks = (
  await client.query(`
    select
      tc.constraint_name,
      tc.table_name as source_table,
      kcu.column_name as source_column,
      ccu.table_name as target_table,
      ccu.column_name as target_column
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
    order by tc.table_name
  `)
).rows;

await client.end();

// --- pg type -> TS ---------------------------------------------------------
function tsType(dataType, udtName) {
  if (dataType === "ARRAY") {
    // udt like _text -> string[]
    const inner = udtName.replace(/^_/, "");
    return `${scalar(inner)}[]`;
  }
  return scalar(udtName || dataType);
}
function scalar(u) {
  switch (u) {
    case "uuid":
    case "text":
    case "varchar":
    case "bpchar":
    case "name":
    case "citext":
      return "string";
    case "int2":
    case "int4":
    case "int8":
    case "float4":
    case "float8":
    case "numeric":
      return "number";
    case "bool":
      return "boolean";
    case "timestamptz":
    case "timestamp":
    case "date":
    case "time":
    case "timetz":
      return "string";
    case "json":
    case "jsonb":
      return "Json";
    default:
      return "string";
  }
}

// group columns by table
const tables = {};
for (const c of cols) {
  (tables[c.table_name] ??= []).push(c);
}

const tableNames = Object.keys(tables).sort();

let out = "";
out += "// AUTO-GENERATED from the live schema by scripts/gen-types.mjs.\n";
out += "// Do not edit by hand — re-run the generator after a migration.\n\n";
out +=
  "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n\n";
out += "export type Database = {\n  public: {\n    Tables: {\n";

for (const t of tableNames) {
  const tcols = tables[t];
  out += `      ${t}: {\n`;

  // Row
  out += "        Row: {\n";
  for (const c of tcols) {
    const base = tsType(c.data_type, c.udt_name);
    const nullable = c.is_nullable === "YES" ? " | null" : "";
    out += `          ${c.column_name}: ${base}${nullable};\n`;
  }
  out += "        };\n";

  // Insert — nullable or defaulted columns optional
  out += "        Insert: {\n";
  for (const c of tcols) {
    const base = tsType(c.data_type, c.udt_name);
    const optional = c.is_nullable === "YES" || c.column_default !== null ? "?" : "";
    const nullable = c.is_nullable === "YES" ? " | null" : "";
    out += `          ${c.column_name}${optional}: ${base}${nullable};\n`;
  }
  out += "        };\n";

  // Update — everything optional
  out += "        Update: {\n";
  for (const c of tcols) {
    const base = tsType(c.data_type, c.udt_name);
    const nullable = c.is_nullable === "YES" ? " | null" : "";
    out += `          ${c.column_name}?: ${base}${nullable};\n`;
  }
  out += "        };\n";

  // Relationships
  const tfks = fks.filter((f) => f.source_table === t);
  if (tfks.length === 0) {
    out += "        Relationships: [];\n";
  } else {
    out += "        Relationships: [\n";
    for (const f of tfks) {
      out += "          {\n";
      out += `            foreignKeyName: "${f.constraint_name}";\n`;
      out += "            columns: [" + `"${f.source_column}"` + "];\n";
      out += "            isOneToOne: false;\n";
      out += `            referencedRelation: "${f.target_table}";\n`;
      out += "            referencedColumns: [" + `"${f.target_column}"` + "];\n";
      out += "          },\n";
    }
    out += "        ];\n";
  }

  out += "      };\n";
}

out += "    };\n    Views: { [_ in never]: never };\n";
out += "    Functions: { [_ in never]: never };\n";
out += "    Enums: { [_ in never]: never };\n";
out += "    CompositeTypes: { [_ in never]: never };\n";
out += "  };\n};\n";

process.stdout.write(out);
