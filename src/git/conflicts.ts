import type { FileChange, FileStatus, Operation, Revision } from "./types";

export const isConflicted = (file: FileChange) =>
  !!file.conflict && !file.conflict.resolution;

/** Conflicted files still waiting for a decision. */
export const unresolved = (files: FileChange[]) => files.filter(isConflicted);

/**
 * Where to read my version and theirs. Git keeps an open conflict in the index
 * as stage 2 ("ours") and stage 3 ("theirs"); a rebase replays my commits onto
 * theirs, so there the stages swap. Once resolved, the stages are gone and the
 * operation's commits stand in.
 */
export function conflictRevisions(
  file: FileChange,
  operation: Operation | null,
): { before: Revision; after: Revision } {
  if (file.conflict?.resolution && operation)
    return { before: operation.mine, after: operation.theirs };
  return operation?.kind === "rebase"
    ? { before: ":3", after: ":2" }
    : { before: ":2", after: ":3" };
}

/** A status that compares my version with theirs, so previews know which sides exist. */
export function conflictStatus(mine: boolean, theirs: boolean): FileStatus {
  if (mine && theirs) return "modified";
  return theirs ? "added" : "deleted";
}
