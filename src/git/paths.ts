import type { FileChange, Hunk } from "./types";

export const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

export const dirName = (path: string) => {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
};

export const extension = (path: string) => {
  const name = fileName(path);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
};

export const lineStats = (hunks: Hunk[]) => {
  let added = 0,
    removed = 0;
  for (const hunk of hunks)
    for (const line of hunk.lines) {
      if (line.kind === "add") added++;
      else if (line.kind === "del") removed++;
    }
  return { added, removed };
};

export type SelectionState = "none" | "partial" | "all";

export function selectionOf(file: FileChange): SelectionState {
  if (!file.hunks.length) return file.staged ? "all" : "none";
  const staged = file.hunks.filter((h) => h.staged).length;
  return staged === 0
    ? "none"
    : staged === file.hunks.length
      ? "all"
      : "partial";
}
