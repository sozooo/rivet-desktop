import { describe, expect, it } from "vitest";
import {
  ACTIVITY_DAYS,
  DAY,
  groupActivity,
  type ActivityCommit,
} from "../git/activity";
import { membersOf, myEmails, summarize } from "./members";

const commit = (
  sha: string,
  name: string,
  date: number,
  email = `${name.toLowerCase()}@studio.dev`,
): ActivityCommit => ({ sha, name, email, date, pushed: true });

/** feature: Ann, me and Bob; main: Bob and Cleo; art: Dana; sketch: only me. */
const activity = groupActivity({
  since: 0,
  days: 14,
  base: "main",
  remoteUrl: null,
  branches: [
    {
      name: "feature",
      refs: ["feature", "origin/feature"],
      isBase: false,
      commits: [
        commit("f1", "Ann", 500),
        commit("f2", "Me", 600, "ME@studio.dev"),
        commit("f3", "Bob", 300),
      ],
    },
    {
      name: "main",
      refs: ["main", "origin/main"],
      isBase: true,
      commits: [commit("m1", "Bob", 450), commit("m2", "Cleo", 400)],
    },
    {
      name: "origin/art",
      refs: ["origin/art"],
      isBase: false,
      commits: [commit("a1", "Dana", 350)],
    },
    {
      name: "sketch",
      refs: ["sketch"],
      isBase: false,
      commits: [commit("s1", "Me", 700, "me@studio.dev")],
    },
  ],
});

describe("myEmails", () => {
  it("knows me by git's email and the GitHub account's noreply addresses", () => {
    expect(
      myEmails(" Me@Studio.dev ", {
        id: 42,
        login: "me-art",
        name: null,
        avatarUrl: "",
      }),
    ).toEqual(
      new Set([
        "me@studio.dev",
        "42+me-art@users.noreply.github.com",
        "me-art@users.noreply.github.com",
      ]),
    );
    expect(myEmails("", null)).toEqual(new Set());
  });
});

describe("summarize", () => {
  const mine = myEmails("me@studio.dev", null);

  it("puts teammates first and me last on a branch", () => {
    expect(
      membersOf(
        activity.branches.find((b) => b.name === "feature"),
        mine,
      ).map((m) => [m.name, m.you]),
    ).toEqual([
      ["Ann", false],
      ["Bob", false],
      ["Me", true],
    ]);
    expect(membersOf(undefined, mine)).toEqual([]);
  });

  it("puts those who worked there only long ago after me", () => {
    // Two weeks after 400: Ann and I count as lately, Bob as long ago.
    const now = 400 + ACTIVITY_DAYS * DAY;
    expect(
      membersOf(
        activity.branches.find((b) => b.name === "feature"),
        mine,
        now,
      ).map((m) => [m.name, m.recent]),
    ).toEqual([
      ["Ann", true],
      ["Me", true],
      ["Bob", false],
    ]);
  });

  it("splits people into this branch and the others", () => {
    const team = summarize(activity, "feature", mine);
    expect(team.branch?.name).toBe("feature");
    expect(team.here.map((m) => m.name)).toEqual(["Ann", "Bob", "Me"]);
    // Bob is here already; my own sketch doesn't count as someone elsewhere.
    expect(team.elsewhere.map((m) => m.name)).toEqual(["Cleo", "Dana"]);
    expect(team.elsewhereBranches).toBe(2);
    expect(team.branches.map((b) => b.name)).toEqual([
      "feature",
      "sketch",
      "main",
      "origin/art",
    ]);
    expect(team.anyone).toBe(true);
  });

  it("finds the current branch by its server name too, and copes with nobody there", () => {
    expect(summarize(activity, "art", mine).branch).toBeUndefined();
    const onArt = summarize(
      {
        ...activity,
        branches: activity.branches.filter((b) => b.name === "origin/art"),
      },
      "origin/art",
      mine,
    );
    expect(onArt.here.map((m) => m.name)).toEqual(["Dana"]);
    expect(onArt.elsewhere).toEqual([]);

    const quiet = summarize(activity, "release", mine);
    expect(quiet.here).toEqual([]);
    expect(quiet.elsewhere.map((m) => m.name)).toEqual([
      "Ann",
      "Bob",
      "Cleo",
      "Dana",
    ]);
    expect(quiet.elsewhereBranches).toBe(3);
  });

  it("has nothing to show when only I worked", () => {
    const solo = {
      ...activity,
      branches: activity.branches.filter((b) => b.name === "sketch"),
    };
    expect(summarize(solo, "sketch", mine).anyone).toBe(false);
  });
});
