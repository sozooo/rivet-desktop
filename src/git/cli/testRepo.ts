// Test helpers: real git repositories in a temporary folder, driven from Node.
import { spawn as start, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { GitResult, GitRunner, RunOptions } from "./runner";

const root = mkdtempSync(join(tmpdir(), "rivet-test-"));
// Keep the user's global and system git settings (signing, hooks, autocrlf) out of the tests.
const globalConfig = join(root, "gitconfig");
writeFileSync(
  globalConfig,
  "[user]\n\tname = Test User\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n",
);
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: globalConfig,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
};

export function git(cwd: string, ...args: string[]) {
  const result = spawnSync("git", ["-c", "core.quotepath=false", ...args], {
    cwd,
    env,
    encoding: "buffer",
  });
  if (result.status !== 0)
    throw new Error(`git ${args.join(" ")}: ${result.stderr.toString()}`);
  return result.stdout.toString();
}

let counter = 0;
export function makeRepo(name = "repo") {
  const dir = join(root, `${name}-${counter++}`);
  mkdirSync(dir, { recursive: true });
  git(dir, "init", "-q");
  return dir;
}

export function write(dir: string, path: string, content: string | Uint8Array) {
  const full = join(dir, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** What src-tauri/src/git.rs adds for background runs. */
const backgroundEnv = {
  GIT_ASKPASS: "",
  SSH_ASKPASS_REQUIRE: "never",
  GCM_INTERACTIVE: "never",
};

let progressFiles = 0;

/**
 * What src-tauri/src/progress.rs does: pass stderr on line by line (a line
 * redrawn after \r is progress only), and follow git-lfs's progress file.
 */
function streamed(
  cwd: string,
  args: string[],
  background: boolean,
  onLine: NonNullable<RunOptions["onLine"]>,
): Promise<GitResult> {
  const progressFile = join(root, `lfs-progress-${progressFiles++}.log`);
  return new Promise((resolve, reject) => {
    const child = start(
      "git",
      ["-c", "core.quotepath=false", "-c", "color.ui=false", ...args],
      {
        cwd,
        env: {
          ...(background ? { ...env, ...backgroundEnv } : env),
          GIT_LFS_PROGRESS: progressFile,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const stdout: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    let line = "",
      kept = "",
      afterCr: string | null = null;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      for (const char of chunk) {
        if (afterCr !== null && char === "\n") {
          kept += `${afterCr}\n`;
          afterCr = null;
          continue;
        }
        afterCr = null;
        if (char !== "\n" && char !== "\r") {
          line += char;
          continue;
        }
        const text = line.trimEnd();
        line = "";
        if (char === "\n") kept += `${text}\n`;
        else afterCr = text;
        if (text) onLine("git", text);
      }
    });
    let offset = 0,
      partial = "";
    const follow = () => {
      try {
        const data = readFileSync(progressFile);
        partial += data.subarray(offset).toString("utf8");
        offset = data.length;
      } catch {
        return;
      }
      const end = partial.lastIndexOf("\n");
      if (end < 0) return;
      for (const text of partial.slice(0, end).split("\n"))
        if (text.trim()) onLine("lfs", text.trimEnd());
      partial = partial.slice(end + 1);
    };
    const timer = setInterval(follow, 50);
    child.on("error", (error) => {
      clearInterval(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearInterval(timer);
      follow();
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: kept + line,
      });
    });
  });
}

export function nodeRunner(cwd: string): GitRunner {
  const spawn = (args: string[], stdin?: string, background = false) =>
    spawnSync(
      "git",
      ["-c", "core.quotepath=false", "-c", "color.ui=false", ...args],
      {
        cwd,
        env: background ? { ...env, ...backgroundEnv } : env,
        input: stdin === undefined ? undefined : Buffer.from(stdin, "utf8"),
        encoding: "buffer",
      },
    );
  return {
    async text(args, stdin, options) {
      if (options?.onLine)
        return streamed(cwd, args, !!options.background, options.onLine);
      const r = spawn(args, stdin, options?.background);
      return {
        code: r.status ?? -1,
        stdout: r.stdout.toString("utf8"),
        stderr: r.stderr.toString("utf8"),
      };
    },
    async bytes(args) {
      const r = spawn(args);
      if (r.status !== 0) throw new Error(r.stderr.toString());
      return new Uint8Array(r.stdout);
    },
    async readWorktree(path) {
      try {
        return new Uint8Array(readFileSync(join(cwd, path)));
      } catch {
        return null;
      }
    },
    async modifiedTime(path) {
      try {
        return statSync(resolve(cwd, path)).mtimeMs;
      } catch {
        return null;
      }
    },
    async fileSizes(paths) {
      return paths.map((path) => {
        try {
          return statSync(join(cwd, path)).size;
        } catch {
          return null;
        }
      });
    },
    async writeWorktree(path, text) {
      writeFileSync(join(cwd, path), text);
    },
  };
}

export function cleanup() {
  rmSync(root, { recursive: true, force: true });
}
