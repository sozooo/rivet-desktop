import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { GitResult } from "./git/cli/runner";

/** A repository found on this computer that can be added in one click. */
export type FoundRepository = {
  name: string;
  path: string;
  source: "Unity Hub" | "SourceGit" | "Projects folder";
  branch: string;
  unity?: string;
};

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
}

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
  async clone() {},
  async init() {},
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
      throw new Error(
        message.includes("Could not start git")
          ? "This folder doesn't exist."
          : message.includes("not a git repository")
            ? "This folder is not a Git repository yet. Use Create new to start one here."
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
};

export const platform: Platform = isTauri() ? desktopPlatform : browserPlatform;
