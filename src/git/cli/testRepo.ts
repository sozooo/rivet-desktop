// Test helpers: real git repositories in a temporary folder, driven from Node.
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { GitRunner } from "./runner";

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

export function nodeRunner(cwd: string): GitRunner {
  const spawn = (args: string[], stdin?: string) =>
    spawnSync(
      "git",
      ["-c", "core.quotepath=false", "-c", "color.ui=false", ...args],
      {
        cwd,
        env,
        input: stdin === undefined ? undefined : Buffer.from(stdin, "utf8"),
        encoding: "buffer",
      },
    );
  return {
    async text(args, stdin) {
      const r = spawn(args, stdin);
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
        return statSync(join(cwd, path)).mtimeMs;
      } catch {
        return null;
      }
    },
  };
}

export function cleanup() {
  rmSync(root, { recursive: true, force: true });
}
