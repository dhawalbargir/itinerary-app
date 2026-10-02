import { get, put, type BlobAccessType } from "@vercel/blob";

/** Vercel Blob stores are either public or private; we learn which on the first upload and remember it. */
let knownAccess: BlobAccessType | null = (process.env.BLOB_ACCESS as BlobAccessType) || null;

export async function putFile(pathname: string, body: Blob, contentType: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set. Create a Blob store in Vercel → Storage and redeploy.");
  }
  const order: BlobAccessType[] = knownAccess ? [knownAccess] : ["private", "public"];
  let firstError: unknown = null;
  for (const access of order) {
    try {
      const res = await put(pathname, body, { access, contentType, addRandomSuffix: true });
      knownAccess = access;
      return { url: res.url, pathname: res.pathname, access };
    } catch (err) {
      firstError ??= err;
      console.warn(`[blob] put with access=${access} failed:`, err instanceof Error ? err.message : err);
    }
  }
  throw new Error(`Could not store the file: ${firstError instanceof Error ? firstError.message : String(firstError)}`);
}

export async function readFile(url: string, access: string) {
  const res = await get(url, { access: access === "private" ? "private" : "public" });
  if (!res || res.statusCode !== 200) throw new Error("Could not load the stored file.");
  return {
    stream: res.stream,
    contentType: res.blob.contentType,
    size: res.blob.size,
    bytes: async () => new Response(res.stream).arrayBuffer(),
  };
}
