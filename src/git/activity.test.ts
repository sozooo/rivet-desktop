import { describe, expect, it } from "vitest";
import {
  activityFor,
  groupActivity,
  groupAuthors,
  personKey,
  type ActivityCommit,
} from "./activity";

const commit = (
  sha: string,
  name: string,
  email: string,
  date: number,
  pushed = true,
): ActivityCommit => ({ sha, name, email, date, pushed });

describe("groupAuthors", () => {
  it("counts each person once by email, with their latest name", () => {
    const authors = groupAuthors([
      commit("a", "Ann S.", "ann@x.dev", 100),
      commit("b", "Bob", "bob@x.dev", 300),
      commit("c", "Ann Smith", "ANN@x.dev ", 200),
      commit("d", "Ann", "ann@x.dev", 50, false),
    ]);
    expect(authors).toEqual([
      {
        name: "Bob",
        email: "bob@x.dev",
        commits: 1,
        last: 300,
        pushedSha: "b",
      },
      {
        name: "Ann Smith",
        email: "ANN@x.dev ",
        commits: 3,
        last: 200,
        pushedSha: "c",
      },
    ]);
  });

  it("finds the latest commit on the server, and tells apart people without an email by name", () => {
    const authors = groupAuthors([
      commit("a", "Me", "me@x.dev", 300, false),
      commit("b", "Me", "me@x.dev", 200),
      commit("c", "Me", "me@x.dev", 100),
      commit("d", "Unity Bot", "", 250, false),
      commit("e", "Build Bot", "", 240, false),
    ]);
    expect(authors.map((a) => [a.name, a.commits, a.pushedSha])).toEqual([
      ["Me", 3, "b"],
      ["Unity Bot", 1, undefined],
      ["Build Bot", 1, undefined],
    ]);
    expect(personKey({ name: "Unity Bot", email: " " })).toBe("name:Unity Bot");
  });
});

describe("groupActivity", () => {
  it("keeps branches with work in the window, most recent first", () => {
    const activity = groupActivity({
      since: 100,
      days: 14,
      base: "main",
      remoteUrl: null,
      branches: [
        {
          name: "main",
          refs: ["main", "origin/main"],
          isBase: true,
          commits: [
            commit("m1", "Bob", "bob@x", 150),
            commit("m0", "Bob", "bob@x", 90),
          ],
        },
        {
          name: "origin/art",
          refs: ["origin/art"],
          isBase: false,
          // The same commit seen through two tips counts once.
          commits: [
            commit("a1", "Mira", "mira@x", 400),
            commit("a1", "Mira", "mira@x", 400),
            commit("a0", "Dana", "dana@x", 120),
          ],
        },
        {
          name: "old",
          refs: ["old"],
          isBase: false,
          commits: [commit("o1", "Kai", "kai@x", 50)],
        },
      ],
    });
    expect(
      activity.branches.map((b) => [
        b.name,
        b.commits,
        b.last,
        b.authors.length,
      ]),
    ).toEqual([
      ["origin/art", 2, 400, 2],
      ["main", 1, 150, 1],
    ]);
    expect(activityFor(activity, "main")?.isBase).toBe(true);
    expect(activityFor(activity, "origin/main")?.name).toBe("main");
    expect(activityFor(activity, "art")).toBeUndefined();
    expect(activityFor(undefined, "main")).toBeUndefined();
  });
});
