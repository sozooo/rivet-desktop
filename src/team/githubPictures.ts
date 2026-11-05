// Teammates' GitHub accounts (login and picture), found through the commits
// they pushed. Kept in localStorage, so a person is looked up about once a
// month; asked one at a time, and far below GitHub's 5,000 requests an hour.
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { DAY, personKey, type BranchActivity } from "../git/activity";
import {
  GitHubApiError,
  githubRepository,
  noreplyAccount,
  type GitHubUser,
} from "../github/api";
import { github, type GitHub } from "../github/github";

const STORAGE_KEY = "rivet.team.github";
const HOUR = 3_600_000;
/** A found account rarely changes its picture's address. */
const KEEP_FOUND = 30 * DAY;
/** Someone GitHub didn't know may add the address to their account. */
const KEEP_MISSING = DAY;
/** Lookups an hour, at most: a big team's first visit, and then hardly any. */
export const HOURLY_LOOKUPS = 60;
/** Not-found answers in a row after which a repository counts as out of reach. */
const OUT_OF_REACH = 3;
const MAX_ENTRIES = 500;

type Entry = { user: GitHubUser | null; at: number };
type Person = { email: string; sha: string };

/** The lookups' state; one per app, and a fresh one per test. */
export class GitHubPictures {
  private entries: Record<string, Entry>;
  private version = 0;
  private listeners = new Set<() => void>();
  private pending = new Set<string>();
  private queue: Promise<void> = Promise.resolve();
  private recent: number[] = [];
  private pausedUntil = 0;
  private misses = new Map<string, number>();

  constructor(
    private api: Pick<GitHub, "commitAuthor">,
    private storage: Pick<Storage, "getItem" | "setItem"> | null,
    private now = () => Date.now(),
  ) {
    try {
      this.entries = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "{}") ?? {};
    } catch {
      this.entries = {};
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };
  getVersion = () => this.version;

  private fresh(entry: Entry | undefined) {
    return (
      !!entry &&
      this.now() - entry.at < (entry.user ? KEEP_FOUND : KEEP_MISSING)
    );
  }

  /** The account for an author email, if known; noreply addresses say it themselves. */
  account(email: string): GitHubUser | null {
    return (
      noreplyAccount(email) ??
      this.entries[personKey({ name: "", email })]?.user ??
      null
    );
  }

  /** Asks about people not asked about lately; resolves once the queue is done. */
  lookUp(repository: string, people: Person[]) {
    for (const person of people) {
      const key = personKey({ name: "", email: person.email });
      if (
        !person.email.trim() ||
        noreplyAccount(person.email) ||
        this.pending.has(key) ||
        this.fresh(this.entries[key])
      )
        continue;
      this.pending.add(key);
      this.queue = this.queue.then(() =>
        this.lookUpOne(repository, key, person).finally(() =>
          this.pending.delete(key),
        ),
      );
    }
    return this.queue;
  }

  private async lookUpOne(repository: string, key: string, person: Person) {
    const now = this.now();
    this.recent = this.recent.filter((at) => now - at < HOUR);
    if (
      now < this.pausedUntil ||
      this.recent.length >= HOURLY_LOOKUPS ||
      (this.misses.get(repository) ?? 0) >= OUT_OF_REACH
    )
      return;
    this.recent.push(now);
    try {
      const user = await this.api.commitAuthor(repository, person);
      this.misses.set(repository, 0);
      this.remember(key, user);
    } catch (error) {
      if (!(error instanceof GitHubApiError))
        // Offline, most likely: try again in a while.
        this.pausedUntil = this.now() + 5 * 60_000;
      else if (error.status === 404 || error.status === 422) {
        // The commit isn't there, or the repository is out of this account's reach.
        this.misses.set(repository, (this.misses.get(repository) ?? 0) + 1);
        this.remember(key, null);
      }
      // Rate limited (403, 429) or signed out (401): leave GitHub alone for a while.
      else this.pausedUntil = this.now() + HOUR;
    }
  }

  private remember(key: string, user: GitHubUser | null) {
    this.entries[key] = {
      user: user && { ...user, name: null },
      at: this.now(),
    };
    const kept = Object.entries(this.entries)
      .sort(([, a], [, b]) => b.at - a.at)
      .slice(0, MAX_ENTRIES);
    this.entries = Object.fromEntries(kept);
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {}
    this.version++;
    this.listeners.forEach((listener) => listener());
  }
}

const shared = new GitHubPictures(
  github,
  typeof localStorage === "undefined" ? null : localStorage,
);

/**
 * Pictures for the people in `activity`, when signed in to GitHub and the
 * project's server is GitHub; otherwise none, and nothing is asked.
 * Returns a lookup by author email.
 */
export function useGitHubPictures(
  activity: BranchActivity | undefined,
  signedIn: GitHubUser | null | undefined,
  mine: Set<string>,
) {
  const repository = activity?.remoteUrl
    ? githubRepository(activity.remoteUrl)
    : null;
  const enabled = !!signedIn && !!repository;
  const version = useSyncExternalStore(shared.subscribe, shared.getVersion);

  useEffect(() => {
    if (!enabled || !activity) return;
    const people = new Map<string, Person>();
    for (const branch of activity.branches)
      for (const author of branch.authors) {
        const key = personKey(author);
        if (author.pushedSha && !mine.has(key) && !people.has(key))
          people.set(key, { email: author.email, sha: author.pushedSha });
      }
    shared.lookUp(repository!, [...people.values()]);
  }, [enabled, repository, activity, mine]);

  const own = signedIn?.avatarUrl ? signedIn : null;
  return useCallback(
    (email: string): GitHubUser | null => {
      if (!enabled) return null;
      if (own && mine.has(personKey({ name: "", email }))) return own;
      return shared.account(email);
    },
    // `version` changes when an answer arrives.
    [enabled, own, mine, version],
  );
}
