import type { PoolConfig } from "pg";

/** Build node-postgres options without letting URL SSL flags override the CA. */
export function databaseConnection(url: string, caCertificate?: string): PoolConfig {
  const parsed = new URL(url);
  if (!caCertificate?.trim()) {
    // pg 8 currently verifies these modes fully, but warns that pg 9 will not.
    if (["prefer", "require", "verify-ca"].includes(parsed.searchParams.get("sslmode") ?? "")) {
      parsed.searchParams.set("sslmode", "verify-full");
      return { connectionString: parsed.toString() };
    }
    return { connectionString: url };
  }

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
