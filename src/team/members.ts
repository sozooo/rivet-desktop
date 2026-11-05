import {
  activityFor,
  personKey,
  type ActiveBranch,
  type BranchActivity,
  type BranchAuthor,
} from "../git/activity";
import type { GitHubUser } from "../github/api";

/** Someone who worked on a branch, and whether that's the person using Rivet. */
export type Member = BranchAuthor & { key: string; you: boolean };

/**
 * Addresses that mean "me", lower-cased: git's user.email, and the signed-in
 * GitHub account's noreply addresses (Rivet suggests one for commits).
 */
export function myEmails(
  gitEmail: string,
  github: GitHubUser | null | undefined,
): Set<string> {
  const emails = [gitEmail];
  if (github) {
    if (github.id)
      emails.push(`${github.id}+${github.login}@users.noreply.github.com`);
    emails.push(`${github.login}@users.noreply.github.com`);
  }
  return new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean));
}

/** A branch's people: teammates by most recent work, then me. */
export function membersOf(
  branch: ActiveBranch | undefined,
  mine: Set<string>,
): Member[] {
  const members = (branch?.authors ?? []).map((author) => {
    const key = personKey(author);
    return { ...author, key, you: mine.has(key) };
  });
  return [...members.filter((m) => !m.you), ...members.filter((m) => m.you)];
}

export type TeamSummary = {
  /** The current branch's activity, if anyone saved versions there. */
  branch: ActiveBranch | undefined;
  /** Who worked on the current branch. */
  here: Member[];
  /** Teammates who worked only on other branches, each once, latest first. */
  elsewhere: Member[];
  /** How many other branches those teammates worked on. */
  elsewhereBranches: number;
  /** Branches to list: the current one first, then by most recent work. */
  branches: ActiveBranch[];
  /** Someone besides me worked anywhere: without that there's nothing to show. */
  anyone: boolean;
};

export function summarize(
  activity: BranchActivity,
  current: string,
  mine: Set<string>,
): TeamSummary {
  const branch = activityFor(activity, current);
  const here = membersOf(branch, mine);
  const seen = new Set(here.map((m) => m.key));
  const others = activity.branches.filter((b) => b !== branch);
  const elsewhere: Member[] = [];
  // Branches come most recent first, so each teammate's first sighting is their latest.
  for (const other of others)
    for (const member of membersOf(other, mine))
      if (!member.you && !seen.has(member.key)) {
        seen.add(member.key);
        elsewhere.push(member);
      }
  const away = new Set(elsewhere.map((m) => m.key));
  return {
    branch,
    here,
    elsewhere,
    elsewhereBranches: others.filter((b) =>
      b.authors.some((a) => away.has(personKey(a))),
    ).length,
    branches: branch ? [branch, ...others] : others,
    anyone: activity.branches.some((b) =>
      b.authors.some((a) => !mine.has(personKey(a))),
    ),
  };
}
