import type { Commit } from "./types";

export type GraphRow = {
  /** Lane of this commit's node. */
  lane: number;
  /** Lanes with a line entering the row from above (they all end at the node or pass through). */
  incoming: number[];
  /** Lanes entering from above that end at this node (branches merging into it). */
  joining: number[];
  /** Lanes with a line leaving the row downwards. */
  outgoing: number[];
  /** Lanes that leave the node downwards: the first parent's lane plus merged parents. */
  parents: number[];
};

/**
 * Assigns each commit (newest first) to a vertical lane, the way commit graphs
 * in Git clients do: a lane waits for a specific commit, and a merge opens new
 * lanes for its additional parents.
 */
export function layoutGraph(commits: Commit[]): {
  rows: GraphRow[];
  width: number;
} {
  const lanes: (string | null)[] = [];
  let width = 1;
  const rows = commits.map((commit) => {
    const incoming = lanes.flatMap((sha, i) => (sha ? [i] : []));
    const waiting = lanes.flatMap((sha, i) => (sha === commit.sha ? [i] : []));
    const lane = waiting[0] ?? freeLane(lanes);
    const joining = waiting.filter((i) => i !== lane);
    for (const i of waiting) lanes[i] = null;

    // The first parent always continues this lane, so a branch's own history
    // stays straight; lanes waiting for the same commit converge on it later.
    const parents: number[] = [];
    commit.parents.forEach((sha, n) => {
      const existing = lanes.indexOf(sha);
      if (n === 0) {
        lanes[lane] = sha;
        parents.push(lane);
      } else if (existing !== -1) {
        parents.push(existing);
      } else {
        const free = freeLane(lanes);
        lanes[free] = sha;
        parents.push(free);
      }
    });
    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop();
    width = Math.max(width, lanes.length, lane + 1);
    const outgoing = lanes.flatMap((sha, i) => (sha ? [i] : []));
    return { lane, incoming, joining, outgoing, parents };
  });
  return { rows, width };
}

function freeLane(lanes: (string | null)[]) {
  const free = lanes.indexOf(null);
  if (free !== -1) return free;
  lanes.push(null);
  return lanes.length - 1;
}
