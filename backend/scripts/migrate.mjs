import { readFile } from "node:fs/promises";
import "dotenv/config";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Check backend/.env.");
}

const sql = await readFile(new URL("../sql/001_initial_schema.sql", import.meta.url), "utf8");
const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  await pool.query(sql);
  console.log("Database migration applied successfully.");
} finally {
  await pool.end();
}