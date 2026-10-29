import { describe, expect, it } from "vitest";
import { MockBackend } from "../git/mock/MockBackend";
import {
  CHECK_EVERY,
  CHECK_ON_FOCUS,
  broughtNew,
  canCheck,
  nextCheck,
} from "./backgroundFetch";

describe("background fetch", () => {
  it("waits longer after each failure, up to an hour", () => {
    expect(nextCheck(0, 0, CHECK_EVERY)).toBe(CHECK_EVERY);
    expect(nextCheck(0, 0, CHECK_ON_FOCUS)).toBe(CHECK_ON_FOCUS);
    expect(nextCheck(0, 1, CHECK_ON_FOCUS)).toBe(2 * CHECK_EVERY);
    expect(nextCheck(0, 2, CHECK_EVERY)).toBe(4 * CHECK_EVERY);
    expect(nextCheck(0, 9, CHECK_EVERY)).toBe(60 * 60_000);
  });

  it("stays out of the way of merges, dialogs and repositories without a remote", async () => {
    const snapshot = await new MockBackend("sample").snapshot();
    expect(canCheck(snapshot, false)).toBe(true);
    expect(canCheck(snapshot, true)).toBe(false);
    expect(canCheck(undefined, false)).toBe(false);
    expect(canCheck(await new MockBackend("empty").snapshot(), false)).toBe(
      false,
    );
    const merge = { kind: "merge", message: "", mine: "", theirs: "" } as const;
    expect(canCheck({ ...snapshot, operation: merge }, false)).toBe(false);
  });

  it("speaks up only when the fetch brought commits", async () => {
    const git = new MockBackend("sample");
    const before = await git.snapshot();
    expect(broughtNew(before, before)).toBe(false);
    await git.fetch();
    expect(broughtNew(before, await git.snapshot())).toBe(true);
    // Another branch's count says nothing about this one.
    const other = { ...before, sync: { ...before.sync, upstream: "origin/x" } };
    expect(broughtNew(other, await git.snapshot())).toBe(false);
  });
});
