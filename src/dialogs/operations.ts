import type { GitBackend } from "../git/backend";
import { branchLabel } from "../git/branches";
import { shortSha } from "../git/paths";
import type {
  Commit,
  FileChange,
  OperationKind,
  StashEntry,
  SyncState,
} from "../git/types";
import { fileName } from "../git/paths";
import type { Key, Params } from "../i18n/i18n";
import { restoreDraft } from "../views/changes/draft";

export type OpContext = {
  branch: string;
  branches: string[];
  sync: SyncState;
  /** The branch picked in the Branches view. */
  target?: string;
  /** How many files have unsaved changes. */
  changes?: number;
  commit?: Commit;
  stash?: StashEntry;
  /** Display name for the stash (its message, or a friendlier default). */
  stashName?: string;
  file?: FileChange;
  /** More files that go with `file`, such as its Unity .meta file. */
  extraPaths?: string[];
  /** A merge, rebase or cherry-pick under way. */
  operation?: OperationKind;
  /** Where an undone commit's message goes back to the form. */
  repositoryId?: string;
  /** Files to put back, each from the revision that still has it. */
  restore?: { path: string; revision: string }[];
};

type Translate = (key: Key, params?: Params) => string;

/**
 * A Git operation shown in a dialog. Its texts live in the dictionaries under
 * "op.<id>.title", ".describe", ".confirm" and ".done"; `params` fills them in.
 */
export type Operation = {
  params: (c: OpContext, t: Translate, input: string) => Params;
  command: (c: OpContext, input: string) => string;
  danger?: boolean;
  /** Something to read before going ahead. */
  warning?: (c: OpContext, t: Translate) => string | null;
  /** A text field shown in the dialog, e.g. the new branch name. */
  input?: {
    label: Key;
    placeholder: string;
    sanitize: (value: string) => string;
    problem: (value: string, c: OpContext) => Key | null;
  };
  /** Absent for operations Rivet only explains for now. */
  run?: (backend: GitBackend, c: OpContext, input: string) => Promise<unknown>;
};

const definitions = {
  "switch-branch": {
    params: (c) => ({
      branch: c.branch,
      target: branchLabel(c.target ?? "", c.branches),
    }),
    command: (c) =>
      c.branches.includes(c.target!)
        ? `git switch ${c.target}`
        : `git switch --track ${c.target}`,
    warning: (c, t) =>
      c.changes
        ? t("op.switch-branch.changes", {
            count: c.changes,
            target: branchLabel(c.target ?? "", c.branches),
          })
        : null,
    run: (b, c) => b.switchBranch(c.target!),
  },
  "new-branch": {
    params: (c, _, name) => ({ branch: c.branch, name: name.trim() }),
    command: (_, name) => `git branch ${name || "<name>"}`,
    input: {
      label: "op.new-branch.label",
      placeholder: "feature/branch-name",
      sanitize: (v) => v.replace(/[^a-zA-Z0-9/_.-]/g, ""),
      problem: (v, c) =>
        !v.trim()
          ? "op.new-branch.empty"
          : c.branches.includes(v.trim())
            ? "op.new-branch.exists"
            : null,
    },
    run: (b, _, name) => b.createBranch(name.trim()),
  },
  pull: {
    params: (c, t) => ({
      count: c.sync.behind,
      upstream: c.sync.upstream ?? "",
      branch: c.branch,
      how: t(c.sync.ahead ? "op.pull.merge" : "op.pull.forward"),
    }),
    command: (c) => `git pull --no-rebase origin ${c.branch}`,
    run: (b) => b.pull(),
  },
  push: {
    params: (c) => ({
      count: c.sync.ahead,
      branch: c.branch,
      upstream: c.sync.upstream ?? "origin",
    }),
    command: (c) => `git push origin ${c.branch}`,
    warning: (c, t) =>
      c.sync.tooLarge?.length
        ? t("op.push.tooLarge", {
            count: c.sync.tooLarge.length,
            files: c.sync.tooLarge.map((f) => fileName(f.path)).join(", "),
          })
        : null,
    run: (b) => b.push(),
  },
  "abort-operation": {
    params: () => ({}),
    command: (c) => `git ${c.operation ?? "merge"} --abort`,
    danger: true,
    run: (b) => b.abortOperation(),
  },
  "discard-file": {
    params: (c) => ({ path: c.file?.path ?? "" }),
    command: (c) =>
      c.file?.status === "added"
        ? `git rm --force -- ${c.file.path}`
        : `git restore --source=HEAD --staged --worktree -- ${c.file?.path}`,
    danger: true,
    run: async (b, c) => {
      for (const path of [c.file!.path, ...(c.extraPaths ?? [])])
        await b.discard(path);
    },
  },
  "undo-commit": {
    params: (c) => ({ summary: c.commit?.summary ?? "", branch: c.branch }),
    command: () => "git reset --soft HEAD~1",
    run: async (b, c) => {
      const message = await b.undoLastCommit();
      if (c.repositoryId) restoreDraft(c.repositoryId, message);
    },
  },
  "restore-file": {
    params: (c) => ({
      path: c.file?.path ?? "",
      name: fileName(c.file?.path ?? ""),
      sha: shortSha(c.commit?.sha ?? ""),
      summary: c.commit?.summary ?? "",
    }),
    command: (c) =>
      (c.restore ?? [])
        .map(
          (r) => `git restore --source=${r.revision} --worktree -- ${r.path}`,
        )
        .join("\n"),
    danger: true,
    run: async (b, c) => {
      for (const { path, revision } of c.restore ?? [])
        await b.restoreFile(path, revision);
    },
  },
  "drop-stash": {
    params: (c) => ({
      name: c.stashName ?? c.stash?.message ?? "",
      count: c.stash?.fileCount ?? 0,
    }),
    command: (c) => `git stash drop stash@{${c.stash?.index}}`,
    danger: true,
    run: (b, c) => b.stashDrop(c.stash!.index),
  },
  merge: {
    params: (c) => ({ branch: c.branch, target: c.target ?? "" }),
    command: (c) => `git merge ${c.target}`,
  },
  rebase: {
    params: (c) => ({ branch: c.branch, target: c.target ?? "" }),
    command: (c) => `git rebase ${c.target}`,
  },
  checkout: {
    params: (c) => ({ sha: shortSha(c.commit?.sha ?? "") }),
    command: (c) => `git switch --detach ${c.commit?.sha}`,
  },
  "cherry-pick": {
    params: (c) => ({ sha: shortSha(c.commit?.sha ?? ""), branch: c.branch }),
    command: (c) => `git cherry-pick ${c.commit?.sha}`,
  },
  revert: {
    params: (c) => ({ sha: shortSha(c.commit?.sha ?? ""), branch: c.branch }),
    command: (c) => `git revert ${c.commit?.sha}`,
  },
} satisfies Record<string, Operation>;

export type OperationId = keyof typeof definitions;
export const operations: Record<OperationId, Operation> = definitions;

/** Dictionary key for one of an operation's texts. */
export const opKey = (
  id: OperationId,
  part: "title" | "describe" | "confirm" | "done",
) => `op.${id}.${part}` as Key;
