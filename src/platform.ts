import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { demoFlags } from "./demoFlags";
import { errorSamples } from "./errors/samples";
import type { TransferOptions } from "./git/backend";
import { CliBackend } from "./git/cli/CliBackend";
import type { GitResult } from "./git/cli/runner";
import { tauriRunner } from "./git/cli/tauriRunner";
import {
  clone,
  IncompleteClone,
  resumeClone,
  type CloneFolders,
} from "./git/cli/transfers";
import { demoTransfers } from "./git/mock/simulate";

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
  /**
   * Downloads a repository, Git LFS files included, reporting how far it got.
   * Stopped or failed before git finished, it leaves no folder behind (if it
   * made it). Once the project can be opened, a broken or stopped LFS
   * download rejects with IncompleteClone, as does an earlier attempt's
   * project found in the folder: `resumeClone` downloads the rest.
   */
  clone(
    url: string,
    destination: string,
    transfer?: TransferOptions,
  ): Promise<void>;
  /** Downloads the Git LFS files a clone didn't get to. */
  resumeClone(destination: string, transfer?: TransferOptions): Promise<void>;
  /** Creates a repository; in a Unity project, with Unity's .gitignore. */
  init(destination: string): Promise<void>;
  gitVersions(): Promise<GitVersions>;
  /** Downloads Rivet's own Git, for a computer without a suitable one. */
  installGit(
    onProgress: (received: number, total: number) => void,
  ): Promise<void>;
  /** From the global (or system) git settings. */
  identity(): Promise<Identity>;
  /** Saves the name and email in the global git settings. */
  setIdentity(identity: Identity): Promise<void>;
  /** Lets git open a repository that belongs to another Windows user. */
  trustFolder(path: string): Promise<void>;
  /** Opens a page in the default browser. */
  openWebPage(url: string): Promise<void>;
  /** Shows a repository file in Explorer, or its folder when the file is gone. */
  revealFile(root: string, path: string): Promise<void>;
}

/** The browser demo pretends, following the switches in its address. */
let demoGitInstalled = false;
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
  async clone(_url, destination, transfer) {
    const sample = errorSamples.find(
      (s) => s.id === demoFlags.fail && s.at === "clone",
    );
    if (sample) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      throw new Error(sample.stderr);
    }
    // Stopping during the art download leaves a project that can be opened.
    const art = await demoTransfers.clone(transfer ?? {});
    try {
      await art();
    } catch (error) {
      throw new IncompleteClone(destination, error);
    }
  },
  async resumeClone(_destination, transfer) {
    await demoTransfers.lfsPull(transfer ?? {});
  },
  async init() {},
  async gitVersions() {
    if (demoGitInstalled) return { git: "2.56.0", lfs: "3.8.1" };
    if (demoFlags.git === "missing" || demoFlags.git === "offline")
      return { git: null, lfs: null };
    return {
      git: demoFlags.git === "old" ? "2.25.1" : "2.51.0",
      lfs: demoFlags.lfs === "missing" ? null : "3.7.0",
    };
  },
  async installGit(onProgress) {
    const total = 45_717_731;
    for (let received = 0; received < total; received += total / 30) {
      onProgress(received, total);
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (demoFlags.git === "offline" && received > total / 3)
        throw new Error(
          "Could not download https://github.com/…: error sending request: dns error: No such host is known. (os error 11001)",
        );
    }
    onProgress(total, total);
    await new Promise((resolve) => setTimeout(resolve, 600));
    demoGitInstalled = true;
  },
  async identity() {
    return demoIdentity;
  },
  async setIdentity(identity) {
    demoIdentity = identity;
  },
  async trustFolder() {},
  async revealFile() {},
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

const cloneFolders: CloneFolders = {
  create: (path) => invoke<boolean>("clone_folder_create", { path }),
  finish: (path, discard) =>
    invoke<void>("clone_folder_finish", { path, discard }),
};

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
  clone: (url, destination, transfer) =>
    clone(tauriRunner, cloneFolders, url, destination, transfer),
  resumeClone: (destination, transfer) =>
    resumeClone(tauriRunner(destination), transfer),
  async init(destination) {
    await git(".", ["init", "-b", "main", "--", destination]);
    // Unity's Library, Temp and the like must never get into the first version.
    await new CliBackend(tauriRunner(destination)).ignoreUnityGenerated();
  },
  async installGit(onProgress) {
    const channel = new Channel<{ received: number; total: number }>();
    channel.onmessage = ({ received, total }) => onProgress(received, total);
    await invoke("install_git", { onProgress: channel });
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
  async revealFile(root, path) {
    const full = [root.replace(/[\\/]+$/, ""), ...path.split("/")].join("\\");
    const exists = await invoke<number | null>("modified_time", { path: full });
    // A deleted file can't be shown, so its folder is.
    await revealItemInDir(
      exists === null ? full.slice(0, full.lastIndexOf("\\")) : full,
    );
  },
};

export const platform: Platform = isTauri() ? desktopPlatform : browserPlatform;
