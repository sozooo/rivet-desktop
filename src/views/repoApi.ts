import type { OpContext, OperationId } from "../dialogs/operations";
import type { GitBackend } from "../git/backend";
import type { RepoSnapshot } from "../git/types";
import type { Rewrites } from "../openApps/openApps";
import type { Repository } from "../repositories";

/** What every view gets from the workspace for the open repository. */
export type RepoApi = {
  repository: Repository;
  /** Sample data rather than a repository on disk. */
  demo: boolean;
  snapshot: RepoSnapshot;
  backend: GitBackend;
  /** Runs a change, reports failures, and returns the refreshed snapshot (null on failure). */
  act: (
    action: (backend: GitBackend) => Promise<unknown>,
    success?: string,
    /** What "Try again" runs instead of the action, when there are steps around it. */
    again?: () => unknown,
  ) => Promise<RepoSnapshot | null>;
  openOperation: (id: OperationId, context?: Partial<OpContext>) => void;
  /** Gets others' work and sends ours: simple mode's one button. */
  sync: () => Promise<void>;
  /**
   * Call before rewriting files on disk: when Unity or Blender has some of
   * them open, asks the user to save first. Resolves whether to go ahead.
   */
  askBeforeRewrite: (rewrites: Rewrites) => Promise<boolean>;
  /** Opens Changes, on one file's row when given (an asset's path stands for its .meta too). */
  showChanges: (path?: string) => void;
  /** Opens History on the commits that changed one file. */
  showFileHistory: (path: string) => void;
  /**
   * Switches branches as the top bar's branch menu does: straight away, or
   * asking first when there are unsaved changes. Check `switchBlocked` first.
   */
  switchBranch: (target: string) => void;
  /** Why switching has to wait right now (a merge, another operation), or null. */
  switchBlocked: string | null;
};
