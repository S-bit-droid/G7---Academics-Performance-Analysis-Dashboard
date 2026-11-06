import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "academic-files";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Map([
  ["application/pdf", "pdf"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["text/plain", "txt"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
]);

export async function storePrivateFile(file: File, scope: string) {
  if (!file.size || file.size > MAX_BYTES) throw new Error("Choose a file between 1 byte and 2 MB.");
  const extension = ALLOWED.get(file.type);
  if (!extension || !file.name.toLowerCase().endsWith(`.${extension}`) && !(extension === "jpg" && file.name.toLowerCase().endsWith(".jpeg"))) {
    throw new Error("Use a PDF, PNG, JPG, TXT or DOCX file.");
  }
  const storage = createAdminClient().storage;
  const { data: bucket, error: lookupError } = await storage.getBucket(BUCKET);
  if (!bucket) {
    if (lookupError && lookupError.message && !/not found/i.test(lookupError.message)) throw new Error("File storage is unavailable.");
    const { error } = await storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: [...ALLOWED.keys()] });
    if (error && !/already exists/i.test(error.message)) throw new Error("Could not prepare private file storage.");
  }
  const path = `${scope}/${randomUUID()}.${extension}`;
  const { error } = await storage.from(BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) throw new Error("File upload failed. Please try again.");
  return path;
}

export async function privateFileUrl(path: string) {
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, 60, { download: true });
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
