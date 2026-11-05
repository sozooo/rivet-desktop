import type { Person } from "./types";

/**
 * Git knows nothing about who is working where right now, so "working on a
 * branch" means "saved versions there in the last this many days".
 */
export const ACTIVITY_DAYS = 14;

/**
 * How far back "who worked on a branch" goes, for whose branch it is even
 * when it has been quiet for a while. Backends read history this far once,
 * and every shorter window comes from that.
 */
export const HISTORY_DAYS = 365;

export const DAY = 86_400_000;

/** Worked somewhere within ACTIVITY_DAYS: around now, not long ago. */
export const isRecent = (last: number, now = Date.now()) =>
  last >= now - ACTIVITY_DAYS * DAY;

/** One commit, as far as activity goes: who saved it and when. */
export type ActivityCommit = {
  sha: string;
  name: string;
  email: string;
  /** Unix time in milliseconds. */
  date: number;
  /** A server branch has it, so the hosting service knows it too. */
  pushed: boolean;
};

/** Someone who saved versions on a branch recently. */
export type BranchAuthor = Person & {
  /** How many versions they saved there in the window. */
  commits: number;
  /** When they saved their latest one, Unix ms. */
  last: number;
  /** Their latest commit there that is on the server: GitHub can say whose account it is. */
  pushedSha?: string;
};

export type ActiveBranch = {
  /**
   * What switching takes: the local branch, or the server's ("origin/x") when
   * this computer has no copy.
   */
  name: string;
  /** Every branch name this stands for, e.g. "feature/x" and "origin/feature/x". */
  refs: string[];
  /**
   * The default branch counts all its recent commits; a shared one like dev,
   * those the default branch doesn't have; every other branch, those neither
   * has.
   */
  isBase: boolean;
  commits: number;
  last: number;
  /** Most recent first. */
  authors: BranchAuthor[];
};

export type BranchActivity = {
  /** Start of the window, Unix ms. */
  since: number;
  days: number;
  /** The default branch's name without the remote ("main"), or null when there is none. */
  base: string | null;
  /** Branches with activity in the window, most recent first. */
  branches: ActiveBranch[];
  /** The main remote's address, for finding people's pictures on GitHub. */
  remoteUrl: string | null;
};

/** People are told apart by email, ignoring case; without one, by name. */
export const personKey = ({ name, email }: Person) =>
  email.trim().toLowerCase() || `name:${name.trim()}`;

/**
 * Groups commits by person, newest activity first. Each person keeps the name
 * from their latest commit, since people fix typos in their names.
 */
export function groupAuthors(commits: ActivityCommit[]): BranchAuthor[] {
  const people = new Map<string, BranchAuthor>();
  for (const commit of [...commits].sort((a, b) => b.date - a.date)) {
    const key = personKey(commit);
    const known = people.get(key);
    if (!known) {
      people.set(key, {
        name: commit.name,
        email: commit.email,
        commits: 1,
        last: commit.date,
        ...(commit.pushed && { pushedSha: commit.sha }),
      });
      continue;
    }
    known.commits++;
    if (commit.pushed && !known.pushedSha) known.pushedSha = commit.sha;
  }
  return [...people.values()];
}

export type BranchCommits = {
  name: string;
  refs: string[];
  isBase: boolean;
  commits: ActivityCommit[];
};

/** Turns each branch's commits into who worked there; quiet branches drop out. */
export function groupActivity({
  since,
  days,
  base,
  remoteUrl,
  branches,
}: Omit<BranchActivity, "branches"> & {
  branches: BranchCommits[];
}): BranchActivity {
  return {
    since,
    days,
    base,
    remoteUrl,
    branches: branches
      .map(({ name, refs, isBase, commits }) => {
        const seen = new Set<string>();
        const recent = commits.filter(
          (c) => c.date >= since && !seen.has(c.sha) && seen.add(c.sha),
        );
        const authors = groupAuthors(recent);
        return {
          name,
          refs,
          isBase,
          commits: recent.length,
          last: authors[0]?.last ?? 0,
          authors,
        };
      })
      .filter((branch) => branch.commits > 0)
      .sort((a, b) => b.last - a.last || a.name.localeCompare(b.name)),
  };
}

/** The activity of a branch by any of its names ("feature/x" or "origin/feature/x"). */
export const activityFor = (
  activity: BranchActivity | undefined,
  name: string,
) => activity?.branches.find((b) => b.name === name || b.refs.includes(name));
