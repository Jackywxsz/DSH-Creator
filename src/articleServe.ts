import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

import { findFreePort } from "./subtitle.ts";

const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

export function resolveArticleFile(root: string, urlPath: string): string | undefined {
  let rel = urlPath.split("?")[0] ?? "";
  try {
    rel = decodeURIComponent(rel);
  } catch {
    return undefined;
  }
  rel = rel.replace(/^\/+/, "");
  if (rel === "" || rel.includes("\0")) return undefined;
  const base = resolve(root);
  const candidate = resolve(base, rel);
  if (candidate !== base && !candidate.startsWith(base + sep)) return undefined;
  const mime = IMAGE_MIME[extname(candidate).toLowerCase()];
  if (mime === undefined) return undefined;
  return candidate;
}

export async function startArticleServer(root: string): Promise<{
  origin: string;
  close: () => void;
}> {
  const port = await findFreePort(9000, 9099);
  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405);
      response.end();
      return;
    }
    const file = resolveArticleFile(root, request.url ?? "/");
    if (file === undefined) {
      response.writeHead(404);
      response.end();
      return;
    }
    void stat(file).then((info) => {
      if (!info.isFile()) {
        response.writeHead(404);
        response.end();
        return;
      }
      const mime = IMAGE_MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
      response.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": info.size,
        "Cache-Control": "private, max-age=3600",
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      createReadStream(file).pipe(response);
    }, () => {
      response.writeHead(404);
      response.end();
    });
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => { resolveListen(); });
  });
  server.unref();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => {
      server.close();
    },
  };
}
