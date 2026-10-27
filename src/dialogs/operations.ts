import type { GitBackend } from "../git/backend";
import type { Commit, FileChange, StashEntry, SyncState } from "../git/types";

export type OpContext = {
  branch: string;
  branches: string[];
  sync: SyncState;
  /** The branch picked in the Branches view. */
  target?: string;
  commit?: Commit;
  stash?: StashEntry;
  file?: FileChange;
};

export type Operation = {
  title: string;
  describe: (c: OpContext) => string;
  command: (c: OpContext, input: string) => string;
  confirm: string;
  danger?: boolean;
  /** A text field shown in the dialog, e.g. the new branch name. */
  input?: {
    label: string;
    placeholder: string;
    sanitize: (value: string) => string;
    problem: (value: string, c: OpContext) => string | null;
  };
  /** Absent for operations the demo only previews. */
  run?: (backend: GitBackend, c: OpContext, input: string) => Promise<unknown>;
  done?: (c: OpContext, input: string) => string;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const definitions = {
  "switch-branch": {
    title: "Switch branch",
    describe: (c) =>
      `Switch from ${c.branch} to ${c.target}. Uncommitted changes come with you.`,
    command: (c) => `git switch ${c.target}`,
    confirm: "Switch branch",
    run: (b, c) => b.switchBranch(c.target!),
    done: (c) => `Switched to ${c.target}.`,
  },
  "new-branch": {
    title: "New branch",
    describe: (c) =>
      `Create a branch from the latest commit on ${c.branch}. You stay on ${c.branch}.`,
    command: (_, name) => `git branch ${name || "<name>"}`,
    confirm: "Create branch",
    input: {
      label: "Branch name",
      placeholder: "feature/branch-name",
      sanitize: (v) => v.replace(/[^a-zA-Z0-9/_.-]/g, ""),
      problem: (v, c) =>
        !v.trim()
          ? "Enter a name."
          : c.branches.includes(v.trim())
            ? "A branch with this name already exists."
            : null,
    },
    run: (b, _, name) => b.createBranch(name.trim()),
    done: (_, name) => `Created ${name.trim()}.`,
  },
  pull: {
    title: "Pull",
    describe: (c) =>
      `Bring ${plural(c.sync.behind, "commit")} from ${c.sync.upstream} into ${c.branch}. ` +
      (c.sync.ahead
        ? "Your branch also has unpublished commits, so Git joins both histories with a merge commit. Nothing is rebased."
        : "Your branch moves forward to include them."),
    command: (c) => `git pull --no-rebase origin ${c.branch}`,
    confirm: "Pull",
    run: (b) => b.pull(),
    done: () => "Pulled the latest commits.",
  },
  push: {
    title: "Push",
    describe: (c) =>
      `Publish ${plural(c.sync.ahead, "commit")} from ${c.branch} to ${c.sync.upstream}.`,
    command: (c) => `git push origin ${c.branch}`,
    confirm: "Push",
    run: (b) => b.push(),
    done: () => "Pushed. The remote is up to date.",
  },
  "discard-file": {
    title: "Discard changes",
    describe: (c) =>
      `Throw away every change to ${c.file?.path}, including parts selected for the commit. This can't be undone.`,
    command: (c) =>
      c.file?.status === "added"
        ? `git rm --force -- ${c.file.path}`
        : `git restore --source=HEAD --staged --worktree -- ${c.file?.path}`,
    confirm: "Discard changes",
    danger: true,
    run: (b, c) => b.discard(c.file!.path),
    done: (c) => `Discarded changes to ${c.file?.path}.`,
  },
  "drop-stash": {
    title: "Delete stash",
    describe: (c) =>
      `Delete "${c.stash?.message}" with ${plural(c.stash?.fileCount ?? 0, "file")}. This can't be undone.`,
    command: (c) => `git stash drop stash@{${c.stash?.index}}`,
    confirm: "Delete stash",
    danger: true,
    run: (b, c) => b.stashDrop(c.stash!.index),
    done: () => "Stash deleted.",
  },
  merge: {
    title: "Merge",
    describe: (c) => `Merge ${c.target} into your current branch, ${c.branch}.`,
    command: (c) => `git merge ${c.target}`,
    confirm: "Merge",
  },
  rebase: {
    title: "Rebase",
    describe: (c) =>
      `Replay the commits of ${c.branch} on top of ${c.target}. Their identifiers will change.`,
    command: (c) => `git rebase ${c.target}`,
    confirm: "Rebase",
  },
  checkout: {
    title: "Check out commit",
    describe: (c) =>
      `Look at the project exactly as it was at ${c.commit?.sha}. You will not be on a branch until you switch back.`,
    command: (c) => `git switch --detach ${c.commit?.sha}`,
    confirm: "Check out",
  },
  "cherry-pick": {
    title: "Cherry-pick",
    describe: (c) =>
      `Copy the changes of ${c.commit?.sha} onto ${c.branch} as a new commit.`,
    command: (c) => `git cherry-pick ${c.commit?.sha}`,
    confirm: "Cherry-pick",
  },
  revert: {
    title: "Revert",
    describe: (c) =>
      `Add a new commit on ${c.branch} that undoes ${c.commit?.sha}. History stays intact.`,
    command: (c) => `git revert ${c.commit?.sha}`,
    confirm: "Revert",
  },
} satisfies Record<string, Operation>;

export type OperationId = keyof typeof definitions;
export const operations: Record<OperationId, Operation> = definitions;
