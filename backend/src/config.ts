import "dotenv/config";
import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
    message: "DATABASE_URL must be a PostgreSQL connection string from Supabase, not the Supabase HTTPS project URL"
  }),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32),
  NIMIQ_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  NIMIQ_RPC_URL: z.string().url().optional().or(z.literal("")),
  RED_PACKET_ESCROW_ADDRESS: z.string().min(1).optional().or(z.literal("")),
  RED_PACKET_PRIVATE_KEY: z.string().trim().regex(/^[0-9a-fA-F]{64}$/).optional().or(z.literal(""))
});

export const config = configSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  SESSION_SECRET: process.env.SESSION_SECRET,
  NIMIQ_NETWORK: process.env.NIMIQ_NETWORK,
  NIMIQ_RPC_URL: process.env.NIMIQ_RPC_URL,
  RED_PACKET_ESCROW_ADDRESS: process.env.RED_PACKET_ESCROW_ADDRESS,
  RED_PACKET_PRIVATE_KEY: process.env.RED_PACKET_PRIVATE_KEY
});
