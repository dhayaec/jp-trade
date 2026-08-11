import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { getEnv } from '@/lib/env';

/**
 * Prisma 7 requires a driver adapter (connection URLs no longer come from
 * the schema). `PrismaPg` wraps a `pg` pool configured from DATABASE_URL.
 *
 * The client is constructed lazily on first use so that importing this module
 * never triggers env parsing — keeps the CI `next build` step (which sets no
 * DATABASE_URL) green until a page actually queries the database.
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: getEnv().DATABASE_URL });
  return new PrismaClient({ adapter });
}

/** Get the process-wide Prisma client singleton, creating it on first use. */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}
