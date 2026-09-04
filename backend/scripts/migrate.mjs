import { readdir, readFile } from "node:fs/promises";
import "dotenv/config";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Check backend/.env.");
}

const migrationDirectory = new URL("../sql/", import.meta.url);
const migrationFiles = (await readdir(migrationDirectory))
  .filter((file) => /^\d+_.+\.sql$/.test(file))
  .sort();
const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  for (const file of migrationFiles) {
    await pool.query(await readFile(new URL(file, migrationDirectory), "utf8"));
  }
  console.log("Database migration applied successfully.");
} finally {
  await pool.end();
}