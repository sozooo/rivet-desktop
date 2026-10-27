import { extension, selectionOf, type SelectionState } from "./paths";
import type { FileChange, FileStatus } from "./types";

/**
 * A row in the Changes list: an asset together with its Unity `.meta` file.
 * Either part may be missing — a `.meta` change alone means import settings
 * changed, or a folder was added or removed.
 */
export type FileGroup = { path: string; file?: FileChange; meta?: FileChange };

export function groupWithMeta(files: FileChange[]): FileGroup[] {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const groups: FileGroup[] = [];
  for (const f of files) {
    if (f.path.endsWith(".meta")) {
      const asset = f.path.slice(0, -".meta".length);
      // Grouped with its asset when that changed too.
      if (!byPath.has(asset)) groups.push({ path: asset, meta: f });
    } else {
      groups.push({
        path: f.path,
        file: f,
        meta: byPath.get(`${f.path}.meta`),
      });
    }
  }
  return groups;
}

export const groupFiles = (g: FileGroup) =>
  [g.file, g.meta].filter((f): f is FileChange => !!f);

/** The file to show in the diff: the asset, or the `.meta` when only it changed. */
export const primaryFile = (g: FileGroup) => (g.file ?? g.meta)!;

export const groupStatus = (g: FileGroup): FileStatus => primaryFile(g).status;

export function groupSelection(g: FileGroup): SelectionState {
  const states = groupFiles(g).map(selectionOf);
  if (states.every((s) => s === "all")) return "all";
  if (states.every((s) => s === "none")) return "none";
  return "partial";
}

/** What a `.meta`-only change means, as a dictionary key; null for ordinary files. */
export function metaOnlyNote(
  g: FileGroup,
): "meta.newFolder" | "meta.folderRemoved" | "meta.importSettings" | null {
  if (g.file || !g.meta) return null;
  const folder = extension(g.path) === "";
  if (folder && g.meta.status === "added") return "meta.newFolder";
  if (folder && g.meta.status === "deleted") return "meta.folderRemoved";
  return "meta.importSettings";
}
