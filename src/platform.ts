import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { demoFlags } from "./demoFlags";
import { errorSamples } from "./errors/samples";
import type { GitResult } from "./git/cli/runner";

/** A repository found on this computer that can be added in one click. */
export type FoundRepository = {
  name: string;
  path: string;
  source: "Unity Hub" | "SourceGit" | "Projects folder";
  branch: string;
  unity?: string;
};

/** Installed versions, e.g. "2.51.0"; null when the tool isn't installed. */
export type GitVersions = { git: string | null; lfs: string | null };

/** The name and email commits are signed with; empty strings when not set. */
export type Identity = { name: string; email: string };

/**
 * Operating-system services. The desktop build opens a native folder dialog,
 * finds repositories from Unity Hub and SourceGit, and runs git; the browser
 * build returns sample data and pretends.
 */
export interface Platform {
  /** True in the desktop app, where repositories are real. */
  desktop: boolean;
  pickFolder(): Promise<string | null>;
  discoverRepositories(): Promise<FoundRepository[]>;
  /** The root of the repository containing `path`; rejects when there is none. */
  repositoryRoot(path: string): Promise<string>;
  clone(url: string, destination: string): Promise<void>;
  init(destination: string): Promise<void>;
  gitVersions(): Promise<GitVersions>;
  /** From the global (or system) git settings. */
  identity(): Promise<Identity>;
  /** Saves the name and email in the global git settings. */
  setIdentity(identity: Identity): Promise<void>;
  /** Lets git open a repository that belongs to another Windows user. */
  trustFolder(path: string): Promise<void>;
  /** Opens a page in the default browser. */
  openWebPage(url: string): Promise<void>;
}

/** The browser demo pretends, following the switches in its address. */
let demoIdentity: Identity =
  demoFlags.identity === "empty"
    ? { name: "", email: "" }
    : { name: "Alex Morgan", email: "alex@kinetic.studio" };

const browserPlatform: Platform = {
  desktop: false,
  async pickFolder() {
    return "D:\\Projects\\kinetic-art";
  },
  async discoverRepositories() {
    return [
      {
        name: "kinetic-art",
        path: "D:\\Projects\\kinetic-art",
        source: "Unity Hub",
        branch: "main",
        unity: "6000.0.32f1",
      },
      {
        name: "kinetic",
        path: "D:/Projects/kinetic",
        source: "Unity Hub",
        branch: "feature/player-movement",
        unity: "6000.0.32f1",
      },
      {
        name: "tiny-tanks",
        path: "D:\\Projects\\tiny-tanks",
        source: "Projects folder",
        branch: "main",
        unity: "2022.3.48f1",
      },
      {
        name: "shader-lab",
        path: "D:\\Work\\shader-lab",
        source: "SourceGit",
        branch: "develop",
      },
    ];
  },
  async repositoryRoot(path) {
    return path;
  },
  async clone() {
    const sample = errorSamples.find(
      (s) => s.id === demoFlags.fail && s.at === "clone",
    );
    if (sample) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      throw new Error(sample.stderr);
    }
  },
  async init() {},
  async gitVersions() {
    if (demoFlags.git === "missing") return { git: null, lfs: null };
    return {
      git: demoFlags.git === "old" ? "2.25.1" : "2.51.0",
      lfs: demoFlags.lfs === "missing" ? null : "3.7.0",
    };
  },
  async identity() {
    return demoIdentity;
  },
  async setIdentity(identity) {
    demoIdentity = identity;
  },
  async trustFolder() {},
  async openWebPage(url) {
    window.open(url, "_blank", "noopener");
  },
};

/** Runs git outside any repository (clone, init) or in a folder being checked. */
async function git(cwd: string, args: string[]) {
  const result = await invoke<GitResult>("git_text", {
    cwd,
    args,
    stdin: null,
  });
  if (result.code !== 0)
    throw new Error(result.stderr.trim() || `git ${args[0]} failed`);
  return result.stdout.trim();
}

/** Output of a git command, or null when it fails or git can't start. */
const gitOutput = (args: string[]) => git(".", args).catch(() => null);

/** A global setting, falling back to the system-wide one Git for Windows' installer may set. */
async function configValue(key: string) {
  return (
    (await gitOutput(["config", "--global", "--get", key])) ||
    (await gitOutput(["config", "--system", "--get", key])) ||
    ""
  );
}

const toWindowsPath = (path: string) => path.replace(/\//g, "\\");

const desktopPlatform: Platform = {
  desktop: true,
  async pickFolder() {
    const folder = await open({ directory: true, multiple: false });
    return typeof folder === "string" ? folder : null;
  },
  discoverRepositories: () => invoke("discover_repositories"),
  async repositoryRoot(path) {
    try {
      return toWindowsPath(await git(path, ["rev-parse", "--show-toplevel"]));
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      // Codes the setup screen translates; other messages are git's own.
      throw new Error(
        message.includes("Could not start git")
          ? "folder-missing"
          : message.includes("not a git repository")
            ? "not-a-repository"
            : message,
      );
    }
  },
  async clone(url, destination) {
    await git(".", ["clone", "--", url, destination]);
  },
  async init(destination) {
    await git(".", ["init", "-b", "main", "--", destination]);
  },
  async gitVersions() {
    const [gitText, lfsText] = await Promise.all([
      gitOutput(["--version"]),
      gitOutput(["lfs", "version"]),
    ]);
    return {
      git: gitText?.match(/\d+\.\d+(\.\d+)?/)?.[0] ?? null,
      lfs: lfsText?.match(/git-lfs\/(\d[^\s]*)/)?.[1] ?? null,
    };
  },
  async identity() {
    const [name, email] = await Promise.all([
      configValue("user.name"),
      configValue("user.email"),
    ]);
    return { name, email };
  },
  async setIdentity({ name, email }) {
    await git(".", ["config", "--global", "user.name", name]);
    await git(".", ["config", "--global", "user.email", email]);
  },
  async trustFolder(path) {
    await git(".", ["config", "--global", "--add", "safe.directory", path]);
  },
  openWebPage: (url) => openUrl(url),
};

export const platform: Platform = isTauri() ? desktopPlatform : browserPlatform;
