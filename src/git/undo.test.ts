import { describe, expect, it } from "vitest";
import { MockBackend } from "./mock/MockBackend";
import type { RepoSnapshot } from "./types";
import { undoBlocker } from "./undo";

const sample = () => new MockBackend("sample").snapshot();
const withHead = (s: RepoSnapshot, parents: string[], refs?: string[]) => ({
  ...s,
  commits: [{ ...s.commits[0], parents, refs }, ...s.commits.slice(1)],
});

describe("undoBlocker", () => {
  it("allows an ordinary commit that isn't pushed", async () => {
    const s = await sample();
    expect(undoBlocker(s)).toBeNull();
    expect(undoBlocker(s, s.commits[0].sha)).toBeNull();
    expect(undoBlocker(s, s.commits[1].sha)).toBe("moved");
  });

  it("explains every case it refuses", async () => {
    const s = await sample();
    expect(undoBlocker({ ...s, sync: { ...s.sync, ahead: 0 } })).toBe("pushed");
    const noUpstream = { ...s, sync: { ...s.sync, upstream: null } };
    expect(undoBlocker(noUpstream)).toBeNull();
    expect(undoBlocker(withHead(noUpstream, ["b"], ["origin/main"]))).toBe(
      "pushed",
    );
    expect(undoBlocker(withHead(s, ["b", "c"]))).toBe("merge");
    expect(undoBlocker(withHead(s, []))).toBe("first");
    expect(undoBlocker({ ...s, commits: [] })).toBe("first");
    const merge = { kind: "merge", message: "", mine: "", theirs: "" } as const;
    expect(undoBlocker({ ...s, operation: merge })).toBe("merging");
  });
});
