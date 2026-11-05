import { describe, expect, it } from "vitest";
import { GitHubApiError, type GitHubUser } from "../github/api";
import { GitHubPictures, HOURLY_LOOKUPS } from "./githubPictures";

const account = (login: string): GitHubUser => ({
  login,
  name: "Shown Name",
  avatarUrl: `https://avatars.example/${login}`,
});

/** A fake GitHub that answers by sha, and an in-memory localStorage. */
function setup(answers: Record<string, GitHubUser | null | number>) {
  const asked: string[] = [];
  const api = {
    async commitAuthor(repository: string, { sha }: { sha: string }) {
      asked.push(`${repository}@${sha}`);
      const answer = answers[sha];
      if (typeof answer === "number") throw new GitHubApiError(answer, "nope");
      return answer ?? null;
    },
  };
  const stored = new Map<string, string>();
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
  };
  let now = 1_000_000_000_000;
  const clock = {
    now: () => now,
    pass: (ms: number) => void (now += ms),
  };
  return { api, asked, storage, clock };
}

describe("GitHubPictures", () => {
  it("asks once per person, remembers the answer, and reads noreply addresses itself", async () => {
    const { api, asked, storage, clock } = setup({
      a1: account("ann"),
      b1: null,
    });
    const pictures = new GitHubPictures(api, storage, clock.now);
    await pictures.lookUp("team/game", [
      { email: "Ann@studio.dev", sha: "a1" },
      { email: "ann@studio.dev", sha: "a2" },
      { email: "bob@studio.dev", sha: "b1" },
      { email: "7+cleo@users.noreply.github.com", sha: "c1" },
    ]);
    expect(asked).toEqual(["team/game@a1", "team/game@b1"]);
    expect(pictures.account("ANN@studio.dev")).toMatchObject({
      login: "ann",
      // Commit authors carry no profile name; git's name is shown instead.
      name: null,
    });
    expect(pictures.account("bob@studio.dev")).toBeNull();
    expect(pictures.account("7+cleo@users.noreply.github.com")).toMatchObject({
      login: "cleo",
      avatarUrl: "https://avatars.githubusercontent.com/u/7?v=4",
    });

    // Another start of the app: answers come from storage.
    const again = new GitHubPictures(api, storage, clock.now);
    expect(again.account("ann@studio.dev")?.login).toBe("ann");
    await again.lookUp("team/game", [
      { email: "ann@studio.dev", sha: "a1" },
      { email: "bob@studio.dev", sha: "b1" },
    ]);
    expect(asked).toHaveLength(2);

    // A day later Bob is asked about again; Ann waits a month.
    clock.pass(25 * 3_600_000);
    await again.lookUp("team/game", [
      { email: "ann@studio.dev", sha: "a1" },
      { email: "bob@studio.dev", sha: "b1" },
    ]);
    expect(asked).toEqual(["team/game@a1", "team/game@b1", "team/game@b1"]);
  });

  it("backs off when rate limited, and stops asking about a repository out of reach", async () => {
    const { api, asked, storage, clock } = setup({ x: 403, gone: 404 });
    const pictures = new GitHubPictures(api, storage, clock.now);
    await pictures.lookUp("team/game", [
      { email: "a@x", sha: "x" },
      { email: "b@x", sha: "x" },
    ]);
    // The first answer says "too many requests": nothing more for an hour.
    expect(asked).toHaveLength(1);
    clock.pass(3_600_000);
    await pictures.lookUp("team/game", [{ email: "b@x", sha: "y" }]);
    expect(asked).toHaveLength(2);

    const people = Array.from({ length: 5 }, (_, i) => ({
      email: `p${i}@x`,
      sha: "gone",
    }));
    await pictures.lookUp("other/private", people);
    expect(asked.filter((a) => a.startsWith("other/"))).toHaveLength(3);
  });

  it("keeps to an hourly budget", async () => {
    const { api, asked, storage, clock } = setup({});
    const pictures = new GitHubPictures(api, storage, clock.now);
    const people = Array.from({ length: HOURLY_LOOKUPS + 10 }, (_, i) => ({
      email: `p${i}@x`,
      sha: `s${i}`,
    }));
    await pictures.lookUp("team/game", people);
    expect(asked).toHaveLength(HOURLY_LOOKUPS);
    clock.pass(3_600_001);
    await pictures.lookUp("team/game", people);
    expect(asked).toHaveLength(HOURLY_LOOKUPS + 10);
  });
});
