import { Channel, invoke } from "@tauri-apps/api/core";
import type { ProgressSource } from "../progress";
import type { GitResult, GitRunner } from "./runner";

const join = (root: string, path: string) =>
  /^([a-zA-Z]:)?[\\/]/.test(path)
    ? path
    : `${root.replace(/[\\/]+$/, "")}/${path}`;

export function tauriRunner(root: string): GitRunner {
  return {
    text(args, stdin, options) {
      const onLine = options?.onLine;
      if (!onLine)
        return invoke<GitResult>("git_text", {
          cwd: root,
          args,
          stdin: stdin ?? null,
          background: options?.background ?? false,
        });
      const channel = new Channel<{
        source: ProgressSource;
        lines: string[];
      }>();
      channel.onmessage = ({ source, lines }) =>
        lines.forEach((line) => onLine(source, line));
      return invoke<GitResult>("git_progress", {
        cwd: root,
        args,
        background: options.background ?? false,
        onProgress: channel,
      });
    },
    bytes: async (args) =>
      new Uint8Array(
        await invoke<ArrayBuffer>("git_bytes", { cwd: root, args }),
      ),
    readWorktree: async (path) => {
      try {
        return new Uint8Array(
          await invoke<ArrayBuffer>("read_worktree_file", { root, path }),
        );
      } catch {
        return null;
      }
    },
    modifiedTime: (path) =>
      invoke<number | null>("modified_time", { path: join(root, path) }),
    fileSizes: (paths) =>
      invoke<(number | null)[]>("file_sizes", { root, paths }),
    writeWorktree: (path, text) =>
      invoke("write_worktree_file", { root, path, text }),
  };
}
