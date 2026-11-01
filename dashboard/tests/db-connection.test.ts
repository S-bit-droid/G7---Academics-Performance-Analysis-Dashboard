import assert from "node:assert/strict";
import test from "node:test";
import { databaseConnection } from "../src/lib/db-connection";

const pooledUrl = "postgresql://user:password@pooler.example:6543/postgres?pgbouncer=true&sslmode=require";

test("database connection keeps the provided URL when no CA is configured", () => {
  assert.deepEqual(databaseConnection(pooledUrl), { connectionString: pooledUrl });
});

test("database connection verifies the CA without URL SSL flags overriding it", () => {
  const connection = databaseConnection(pooledUrl, "-----BEGIN CERTIFICATE-----\\nexample\\n-----END CERTIFICATE-----");
  const url = new URL(connection.connectionString!);
  assert.equal(url.searchParams.get("pgbouncer"), "true");
  assert.equal(url.searchParams.has("sslmode"), false);
  assert.deepEqual(connection.ssl, {
    ca: "-----BEGIN CERTIFICATE-----\nexample\n-----END CERTIFICATE-----",
    rejectUnauthorized: true,
  });
});
