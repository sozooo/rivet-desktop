import type { OpContext, OperationId } from "../dialogs/operations";
import type { GitBackend } from "../git/backend";
import type { RepoSnapshot } from "../git/types";
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
  ) => Promise<RepoSnapshot | null>;
  openOperation: (id: OperationId, context?: Partial<OpContext>) => void;
  /** Gets others' work and sends ours: simple mode's one button. */
  sync: () => Promise<void>;
  /** Opens Changes, on one file's row when given (an asset's path stands for its .meta too). */
  showChanges: (path?: string) => void;
  /** Opens History on the commits that changed one file. */
  showFileHistory: (path: string) => void;
};
