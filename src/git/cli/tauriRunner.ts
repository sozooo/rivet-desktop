import { Channel, invoke } from "@tauri-apps/api/core";
import { CancelledError } from "../cancel";
import type { ProgressSource } from "../progress";
import type { GitResult, GitRunner } from "./runner";

/** Names runs that can be cancelled, for `git_cancel`. */
let runs = 0;

const join = (root: string, path: string) =>
  /^([a-zA-Z]:)?[\\/]/.test(path)
    ? path
    : `${root.replace(/[\\/]+$/, "")}/${path}`;

export function tauriRunner(root: string): GitRunner {
  return {
    async text(args, stdin, options) {
      const { onLine, signal } = options ?? {};
      if (!onLine && !signal)
        return invoke<GitResult>("git_text", {
          cwd: root,
          args,
          stdin: stdin ?? null,
          background: options?.background ?? false,
        });
      if (signal?.aborted) throw new CancelledError();
      const channel = new Channel<{
        source: ProgressSource;
        lines: string[];
      }>();
      channel.onmessage = ({ source, lines }) =>
        onLine && lines.forEach((line) => onLine(source, line));
      const cancelId = signal ? `${Date.now()}-${++runs}` : null;
      const cancel = () => void invoke("git_cancel", { id: cancelId });
      signal?.addEventListener("abort", cancel);
      try {
        const { cancelled, ...result } = await invoke<
          GitResult & { cancelled: boolean }
        >("git_progress", {
          cwd: root,
          args,
          background: options?.background ?? false,
          cancelId,
          onProgress: channel,
        });
        if (cancelled) throw new CancelledError();
        return result;
      } finally {
        signal?.removeEventListener("abort", cancel);
      }
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
