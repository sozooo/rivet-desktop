// Who saved versions on which branch recently, from two git commands: the
// branch tips (for-each-ref) and every recent commit on any branch (one log).
// Branch membership is worked out here by walking parents, so big projects
// with many branches still need just those two runs.
import type { ActivityCommit, BranchCommits } from "../activity";

export const ACTIVITY_REFS_FORMAT = "%(refname)%00%(symref)%00%(objectname)";
/** Mailmapped author, so one person with two spellings counts once. */
export const ACTIVITY_LOG_FORMAT = "%H%x00%P%x00%aN%x00%aE%x00%ct";
/** Enough for a year of a busy team; older commits past it just go uncounted. */
export const ACTIVITY_LOG_LIMIT = 20_000;

/** A branch tip: local ("feature/x") or a remote's copy ("origin/feature/x"). */
export type ActivityRef = {
  ref: string;
  /** The remote it belongs to, or null for a local branch. */
  remote: string | null;
  /** The name without the remote: what local and server copies share. */
  branch: string;
  tip: string;
};

export function parseActivityRefs(output: string) {
  const refs: ActivityRef[] = [];
  /** Each remote's default branch, from refs/remotes/<remote>/HEAD. */
  const heads = new Map<string, string>();
  for (const line of output.split("\n")) {
    const [name, symref = "", tip = ""] = line.trim().split("\0");
    if (name.startsWith("refs/heads/")) {
      const branch = name.slice("refs/heads/".length);
      refs.push({ ref: branch, remote: null, branch, tip });
    } else if (name.startsWith("refs/remotes/")) {
      const ref = name.slice("refs/remotes/".length);
      const slash = ref.indexOf("/");
      if (slash < 1) continue;
      const remote = ref.slice(0, slash);
      const branch = ref.slice(slash + 1);
      const prefix = `refs/remotes/${remote}/`;
      if (branch === "HEAD") {
        if (symref.startsWith(prefix))
          heads.set(remote, symref.slice(prefix.length));
      } else refs.push({ ref, remote, branch, tip });
    }
  }
  return { refs, heads };
}

/** "remote.origin.url https://…" lines from `git config --get-regexp`. */
export function parseRemoteUrls(output: string) {
  const urls = new Map<string, string>();
  for (const line of output.split("\n")) {
    const match = line.trim().match(/^remote\.(.+)\.url\s+(.+)$/);
    if (match && !urls.has(match[1])) urls.set(match[1], match[2]);
  }
  return urls;
}

/** The remote that counts: origin when there is one, as clones name it. */
export function mainRemote(refs: ActivityRef[], urls: Map<string, string>) {
  const remotes = [
    ...urls.keys(),
    ...refs.map((r) => r.remote).filter((r): r is string => !!r),
  ];
  return remotes.includes("origin") ? "origin" : (remotes[0] ?? null);
}

/** The branch the others branch off: the server's default, else main or master. */
export function defaultBranch(
  refs: ActivityRef[],
  heads: Map<string, string>,
  remote: string | null,
) {
  const head = remote ? heads.get(remote) : undefined;
  if (head) return head;
  const names = new Set(refs.map((r) => r.branch));
  return ["main", "master"].find((name) => names.has(name)) ?? null;
}

/**
 * Branches a team shares besides the default one: many teams work on dev and
 * bring it into main now and then. Other branches are cut from these, so what
 * these hold isn't the other branches' own work.
 */
export const SHARED_BRANCHES = ["dev", "develop", "development"];

type LogCommit = {
  parents: string[];
  name: string;
  email: string;
  date: number;
};

export function parseActivityLog(output: string) {
  const commits = new Map<string, LogCommit>();
  for (const line of output.split("\n")) {
    const [sha, parents, name, email, time] = line.trim().split("\0");
    if (!sha || time === undefined) continue;
    commits.set(sha, {
      parents: parents ? parents.split(" ") : [],
      name,
      email,
      date: Number(time) * 1000,
    });
  }
  return commits;
}

/**
 * Splits recent commits into branches. The log holds only recent commits, so
 * walking parents from a tip stops where the window does: older commits have
 * no newer ancestors. The default branch gets all it reaches; a shared branch
 * like dev, what the default branch doesn't reach; any other branch, what
 * neither does. Merges keep the walk going but aren't counted.
 */
export function branchCommits(
  refs: ActivityRef[],
  log: Map<string, LogCommit>,
  base: string | null,
): BranchCommits[] {
  const reach = (tips: string[]) => {
    const seen = new Set<string>();
    const stack = tips.filter((tip) => log.has(tip));
    while (stack.length) {
      const sha = stack.pop()!;
      if (seen.has(sha)) continue;
      seen.add(sha);
      for (const parent of log.get(sha)!.parents)
        if (log.has(parent) && !seen.has(parent)) stack.push(parent);
    }
    return seen;
  };
  const tipsOf = (list: ActivityRef[]) => list.map((r) => r.tip);
  const shared = (branch: string) =>
    branch === base || SHARED_BRANCHES.includes(branch);
  const inBase = reach(tipsOf(refs.filter((r) => r.branch === base)));
  const inShared = reach(tipsOf(refs.filter((r) => shared(r.branch))));
  const pushed = reach(tipsOf(refs.filter((r) => r.remote)));

  // One entry per branch name, local copy and server copies together, as the branch menu has them.
  const byBranch = new Map<string, ActivityRef[]>();
  for (const ref of [...refs].sort(
    (a, b) => Number(!!a.remote) - Number(!!b.remote),
  ))
    byBranch.set(ref.branch, [...(byBranch.get(ref.branch) ?? []), ref]);

  const result: BranchCommits[] = [];
  for (const [branch, members] of byBranch) {
    const tips = tipsOf(members).filter((tip) => log.has(tip));
    if (!tips.length) continue;
    const isBase = branch === base;
    // What the branches it was cut from hold isn't its own work.
    const taken = isBase ? null : shared(branch) ? inBase : inShared;
    const commits: ActivityCommit[] = [];
    for (const sha of reach(tips)) {
      const commit = log.get(sha)!;
      if (commit.parents.length > 1 || taken?.has(sha)) continue;
      commits.push({
        sha,
        name: commit.name,
        email: commit.email,
        date: commit.date,
        pushed: pushed.has(sha),
      });
    }
    result.push({
      name: members[0].ref,
      refs: members.map((r) => r.ref),
      isBase,
      commits,
    });
  }
  return result;
}
