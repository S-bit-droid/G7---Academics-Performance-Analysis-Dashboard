import type { PoolConfig } from "pg";

/** Build node-postgres options without letting URL SSL flags override the CA. */
export function databaseConnection(url: string, caCertificate?: string): PoolConfig {
  if (!caCertificate?.trim()) return { connectionString: url };

  const parsed = new URL(url);
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) {
    parsed.searchParams.delete(key);
  }
  return {
    connectionString: parsed.toString(),
    ssl: {
      ca: caCertificate.replace(/\\n/g, "\n").trim(),
      rejectUnauthorized: true,
    },
  };
}
