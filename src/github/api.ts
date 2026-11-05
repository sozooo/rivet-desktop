import type { Fetch } from "./deviceFlow";

export type GitHubUser = {
  /** The account number, for the private noreply email; unknown offline. */
  id?: number;
  login: string;
  name: string | null;
  /** Empty when unknown, e.g. offline; show initials instead. */
  avatarUrl: string;
};

export type GitHubRepository = {
  id: number;
  /** "owner/name" */
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  description: string | null;
  /** Milliseconds since the epoch. */
  updatedAt: number;
  cloneUrl: string;
};

export class GitHubApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const api = "https://api.github.com";
/** 20 pages of 100 is plenty; it also stops a misbehaving `Link` header from looping. */
const maxPages = 20;

async function get(fetch: Fetch, url: string, token: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new GitHubApiError(
      response.status,
      String(body?.message ?? `HTTP ${response.status}`),
    );
  }
  return response;
}

/** The `rel="next"` URL of a GitHub `Link` header, if there is one. */
export function nextPage(link: string | null): string | null {
  for (const part of link?.split(",") ?? []) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?next"?/);
    if (match) return match[1];
  }
  return null;
}

/** GitHub's JSON, loosely typed: only the fields Rivet reads are converted. */
type Json = any;

export function toUser(raw: Json): GitHubUser {
  return {
    ...(raw.id && { id: Number(raw.id) }),
    login: String(raw.login),
    name: raw.name ? String(raw.name) : null,
    avatarUrl: raw.avatar_url ? String(raw.avatar_url) : "",
  };
}

export function toRepository(raw: Json): GitHubRepository {
  return {
    id: Number(raw.id),
    fullName: String(raw.full_name),
    name: String(raw.name),
    owner: String(raw.owner?.login ?? String(raw.full_name).split("/")[0]),
    private: Boolean(raw.private),
    description: raw.description ? String(raw.description) : null,
    updatedAt: Date.parse(raw.updated_at ?? raw.pushed_at) || 0,
    cloneUrl: String(raw.clone_url),
  };
}

export async function fetchUser(fetch: Fetch, token: string) {
  return toUser(await (await get(fetch, `${api}/user`, token)).json());
}

/**
 * Every repository the account can reach: its own, ones it collaborates on, and its
 * organisations' (GitHub's default affiliation), most recently updated first.
 */
export async function fetchRepositories(
  fetch: Fetch,
  token: string,
): Promise<GitHubRepository[]> {
  const seen = new Map<number, GitHubRepository>();
  let url: string | null = `${api}/user/repos?per_page=100&sort=updated`;
  for (let page = 0; url && page < maxPages; page++) {
    const response = await get(fetch, url, token);
    const items: Json[] = await response.json();
    // Pages can shift while a repository is pushed to; keep the first copy.
    for (const item of items) {
      const repository = toRepository(item);
      if (!seen.has(repository.id)) seen.set(repository.id, repository);
    }
    url = nextPage(response.headers.get("link"));
  }
  return [...seen.values()];
}

/**
 * The clone URL with the login in it, so Git Credential Manager uses this account's token
 * even when it also holds other GitHub accounts.
 */
export const cloneUrlFor = (repository: GitHubRepository, login: string) =>
  repository.cloneUrl.replace(
    /^https:\/\/github\.com\//,
    `https://${encodeURIComponent(login)}@github.com/`,
  );

/**
 * "owner/name" of a repository on github.com, from any address git accepts for it
 * (HTTPS with or without a login, SSH, scp-style), or null for anything else.
 */
export function githubRepository(remoteUrl: string): string | null {
  const match = remoteUrl
    .trim()
    .match(
      /^(?:https?:\/\/(?:[^@/]+@)?github\.com\/|(?:ssh:\/\/)?git@github\.com[:/])([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i,
    );
  return match ? `${match[1]}/${match[2]}` : null;
}

/**
 * The account behind a GitHub noreply address, without asking GitHub:
 * "123+login@users.noreply.github.com", or the older "login@users.noreply.github.com".
 */
export function noreplyAccount(email: string): GitHubUser | null {
  const match = email
    .trim()
    .match(/^(?:(\d+)\+)?([\w-]+)@users\.noreply\.github\.com$/i);
  if (!match) return null;
  const [, id, login] = match;
  return {
    ...(id && { id: Number(id) }),
    login,
    name: null,
    avatarUrl: id
      ? `https://avatars.githubusercontent.com/u/${id}?v=4`
      : `https://github.com/${login}.png`,
  };
}

/**
 * The GitHub account a commit's author email belongs to, or null when GitHub
 * doesn't know the address. One light request: the commit list starting at it,
 * one item long, without files.
 */
export async function fetchCommitAuthor(
  fetch: Fetch,
  token: string,
  repository: string,
  sha: string,
): Promise<GitHubUser | null> {
  const response = await get(
    fetch,
    `${api}/repos/${repository}/commits?sha=${encodeURIComponent(sha)}&per_page=1`,
    token,
  );
  const [item]: Json[] = await response.json();
  return item?.author?.login ? toUser(item.author) : null;
}
