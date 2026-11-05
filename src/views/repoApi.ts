import type { OpContext, OperationId } from "../dialogs/operations";
import type { GitBackend } from "../git/backend";
import type { RepoSnapshot } from "../git/types";
import type { Rewrites } from "../openApps/openApps";
import type { Repository } from "../repositories";

/** The workspace's own commands, which search offers as actions. */
export type WorkspaceCommand =
  "fetch" | "history" | "branches" | "settings" | "shortcuts" | "theme";

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
  /** Opens History on one commit. */
  showCommit: (sha: string) => void;
  /**
   * Switches to a local or server branch as the branch menu does: asks first
   * only when there are unsaved changes.
   */
  switchBranch: (target: string) => void;
  /**
   * Why syncing and switching branches have to wait (a merge to finish, or
   * an operation under way), or null when they can go ahead.
   */
  blocked: string | null;
  /** Runs one of the workspace's own commands. */
  command: (id: WorkspaceCommand) => void;
};
