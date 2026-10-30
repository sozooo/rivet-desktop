// A minimal Git LFS server for tests and manual checks: the batch API with
// basic transfers, objects kept in memory. git-lfs reports no transfer progress
// for a plain folder remote, so progress needs a server like this one.
//
// Run it on its own for the desktop app (Node 23.6+ strips the types):
//   node src/git/cli/lfsTestServer.ts 8899 2000000
// listens on port 8899 and sends about 2 MB per second; point a repository at
// it with `.lfsconfig`: [lfs] url = http://127.0.0.1:8899/
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { pathToFileURL } from "node:url";

type BatchObject = { oid: string; size: number };

export type LfsServer = {
  /** The `lfs.url` to configure, ending with a slash. */
  url: string;
  close(): Promise<void>;
};

/** `bytesPerSecond` slows downloads and uploads so progress can be watched. */
export function startLfsServer(
  port = 0,
  bytesPerSecond = 0,
): Promise<LfsServer> {
  const objects = new Map<string, Buffer>();
  const json = "application/vnd.git-lfs+json";
  const server: Server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const body = async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(chunk as Buffer);
        if (bytesPerSecond) await pause((chunk as Buffer).length);
      }
      return Buffer.concat(chunks);
    };
    const pause = (bytes: number) =>
      new Promise((resolve) =>
        setTimeout(resolve, (bytes / bytesPerSecond) * 1000),
      );
    const href = (oid: string) =>
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/objects/${oid}`;

    if (request.method === "POST" && url.pathname.endsWith("/objects/batch")) {
      const batch = JSON.parse((await body()).toString()) as {
        operation: "download" | "upload";
        objects: BatchObject[];
      };
      response.writeHead(200, { "Content-Type": json });
      response.end(
        JSON.stringify({
          transfer: "basic",
          objects: batch.objects.map(({ oid, size }) => {
            const stored = objects.has(oid);
            if (batch.operation === "upload")
              return stored
                ? { oid, size }
                : { oid, size, actions: { upload: { href: href(oid) } } };
            return stored
              ? { oid, size, actions: { download: { href: href(oid) } } }
              : { oid, size, error: { code: 404, message: "Not found" } };
          }),
        }),
      );
      return;
    }
    if (request.method === "POST" && url.pathname.endsWith("/locks/verify")) {
      response.writeHead(200, { "Content-Type": json });
      response.end(JSON.stringify({ ours: [], theirs: [] }));
      return;
    }
    const oid = url.pathname.match(/^\/objects\/([0-9a-f]{64})$/)?.[1];
    if (oid && request.method === "PUT") {
      objects.set(oid, await body());
      response.writeHead(200);
      response.end();
      return;
    }
    if (oid && request.method === "GET" && objects.has(oid)) {
      const data = objects.get(oid)!;
      response.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": data.length,
      });
      const step = bytesPerSecond ? Math.max(16384, bytesPerSecond / 10) : 0;
      if (!step) return void response.end(data);
      for (let at = 0; at < data.length; at += step) {
        response.write(data.subarray(at, at + step));
        await pause(Math.min(step, data.length - at));
      }
      response.end();
      return;
    }
    response.writeHead(404, { "Content-Type": json });
    response.end(JSON.stringify({ message: "Not found" }));
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`,
        close: () => new Promise((done) => server.close(() => done())),
      }),
    ),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [port = "8899", rate = "0"] = process.argv.slice(2);
  startLfsServer(Number(port), Number(rate)).then(({ url }) =>
    console.log(`Git LFS test server at ${url}`),
  );
}
