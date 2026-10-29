import type { RepoSnapshot } from "./types";

/** "origin/feature/x" → "feature/x": the name a server branch gets on this computer. */
export const localName = (remote: string) =>
  remote.slice(remote.indexOf("/") + 1);

/** Branches on the server that this computer has no copy of yet, one per name. */
export function remoteOnly({ local, remote }: RepoSnapshot["branches"]) {
  const seen = new Set(local);
  return remote.filter((name) => {
    const short = localName(name);
    if (seen.has(short)) return false;
    seen.add(short);
    return true;
  });
}

/** How a branch reads once switched to: server branches drop their remote. */
export const branchLabel = (target: string, local: string[]) =>
  local.includes(target) ? target : localName(target);
