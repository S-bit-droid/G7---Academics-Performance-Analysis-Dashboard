import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Prisma CLI uses a direct connection; application requests use the pooler.
    url: process.env.DIRECT_URL ?? "postgresql://localhost:5432/dashboard",
  },
});
