import { unresolved } from "./conflicts";
import type { RepoSnapshot } from "./types";

/** Why the latest commit can't be taken back. */
export type UndoBlocker = "moved" | "merging" | "first" | "merge" | "pushed";

/**
 * Null when the latest commit (the one with `sha`, if given) can be undone:
 * an ordinary commit that nobody else has yet.
 */
export function undoBlocker(
  snapshot: RepoSnapshot,
  sha?: string,
): UndoBlocker | null {
  const [head] = snapshot.commits;
  if (head && sha && head.sha !== sha) return "moved";
  if (snapshot.operation || unresolved(snapshot.files).length) return "merging";
  if (!head?.parents.length) return "first";
  if (head.parents.length > 1) return "merge";
  const { upstream, ahead } = snapshot.sync;
  // A remote branch already at this commit counts as shared, too.
  const onRemote = head.refs?.some((r) => snapshot.branches.remote.includes(r));
  if ((upstream && !ahead) || onRemote) return "pushed";
  return null;
}
