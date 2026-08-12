import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer auto-loads .env; load it explicitly (Node 20.12+).
if (existsSync('.env')) process.loadEnvFile?.();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Fallback keeps `prisma validate` green before a DATABASE_URL is set;
    // real commands (migrate, generate) resolve the actual env value.
    url: process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost:5432/db',
  },
  migrations: {
    path: 'prisma/migrations',
    // Seed command run by `prisma db seed` / `pnpm db:seed`. `node --import tsx`
    // resolves the tsx loader from node_modules without relying on PATH.
    seed: 'node --import tsx prisma/seed.ts',
  },
});
