// Serves the bare repositories in a folder over smart HTTP through
// `git http-backend`, slowed down so that transfers take a while: for tests
// that cancel a clone, fetch or push half-way, and for manual checks.
//
// Run it on its own for the desktop app (Node 23.6+ strips the types):
//   node src/git/cli/gitHttpTestServer.ts 8898 D:\scratch\remotes 1500000
// serves D:\scratch\remotes\art.git as http://127.0.0.1:8898/art.git at
// about 1.5 MB per second. Pushing works too.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { pathToFileURL } from "node:url";

/** Ends a backend with what it started; on Windows `git` is a launcher. */
function stop(backend: ChildProcess) {
  if (backend.exitCode !== null || !backend.pid) return;
  if (process.platform === "win32")
    spawnSync("taskkill", ["/T", "/F", "/PID", String(backend.pid)]);
  else backend.kill();
}

export type GitHttpServer = {
  /** The server's address, ending with a slash; append "name.git". */
  url: string;
  close(): Promise<void>;
};

/** `bytesPerSecond` slows down what the server sends; 0 sends at once. */
export function startGitHttpServer(
  root: string,
  port = 0,
  bytesPerSecond = 0,
): Promise<GitHttpServer> {
  const pause = (bytes: number) =>
    new Promise((resolve) =>
      setTimeout(resolve, bytesPerSecond ? (bytes / bytesPerSecond) * 1000 : 0),
    );
  const running = new Set<ChildProcess>();
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const backend = spawn("git", ["http-backend"], {
      env: {
        ...process.env,
        GIT_PROJECT_ROOT: root,
        GIT_HTTP_EXPORT_ALL: "1",
        PATH_INFO: decodeURIComponent(url.pathname),
        QUERY_STRING: url.search.slice(1),
        REQUEST_METHOD: request.method ?? "GET",
        CONTENT_TYPE: request.headers["content-type"] ?? "",
        CONTENT_LENGTH: request.headers["content-length"] ?? "",
        HTTP_CONTENT_ENCODING: request.headers["content-encoding"] ?? "",
        GIT_PROTOCOL: String(request.headers["git-protocol"] ?? ""),
        REMOTE_ADDR: "127.0.0.1",
        // With a user, http-backend accepts pushes.
        REMOTE_USER: "tester",
      },
    });
    running.add(backend);
    backend.on("exit", () => running.delete(backend));
    // A client that went away (a cancelled clone) ends the backend too.
    response.on("close", () => {
      if (!response.writableFinished) stop(backend);
    });
    response.on("error", () => {});
    backend.on("error", () => response.destroy());
    backend.stdin.on("error", () => {});
    // What a push sends is read at the same pace.
    request.on("data", (chunk: Buffer) => {
      request.pause();
      backend.stdin.write(chunk);
      pause(chunk.length).then(() => request.resume());
    });
    request.on("end", () => backend.stdin.end());
    let head = Buffer.alloc(0);
    let started = false;
    let queue = Promise.resolve();
    backend.stdout.on("data", (chunk: Buffer) => {
      if (!started) {
        head = Buffer.concat([head, chunk]);
        const end = head.indexOf("\r\n\r\n");
        if (end < 0) return;
        let status = 200;
        const headers: Record<string, string> = {};
        for (const line of head.subarray(0, end).toString().split("\r\n")) {
          const at = line.indexOf(":");
          const key = line.slice(0, at);
          const value = line.slice(at + 1).trim();
          if (key.toLowerCase() === "status") status = parseInt(value, 10);
          else headers[key] = value;
        }
        response.writeHead(status, headers);
        started = true;
        chunk = head.subarray(end + 4);
      }
      backend.stdout.pause();
      queue = queue.then(async () => {
        if (response.destroyed) return;
        response.write(chunk);
        await pause(chunk.length);
        backend.stdout.resume();
      });
    });
    backend.stdout.on("end", () =>
      queue.then(() => {
        if (!started) response.writeHead(500);
        response.end();
      }),
    );
    backend.stderr.resume();
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`,
        close: () =>
          new Promise((done) => {
            running.forEach(stop);
            server.closeAllConnections();
            server.close(() => done());
          }),
      }),
    ),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [port = "8898", root = ".", rate = "0"] = process.argv.slice(2);
  startGitHttpServer(root, Number(port), Number(rate)).then(({ url }) =>
    console.log(`git over HTTP at ${url} for the bare repositories in ${root}`),
  );
}
