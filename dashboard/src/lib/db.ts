import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalDb = globalThis as typeof globalThis & { dashboardDb?: PrismaClient };

export function getDb(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured.");
  if (!globalDb.dashboardDb) {
    globalDb.dashboardDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }
  return globalDb.dashboardDb;
}
