import { describe, expect, it } from "vitest";
import {
  cloneUrlFor,
  fetchRepositories,
  fetchUser,
  GitHubApiError,
  nextPage,
  toRepository,
} from "./api";
import type { Fetch } from "./deviceFlow";

const raw = (id: number, fullName: string, extra: object = {}) => ({
  id,
  name: fullName.split("/")[1],
  full_name: fullName,
  owner: { login: fullName.split("/")[0] },
  private: false,
  description: null,
  updated_at: "2026-10-01T12:00:00Z",
  clone_url: `https://github.com/${fullName}.git`,
  ...extra,
});

/** Serves pages by URL and records the requests. */
function fakeApi(pages: Record<string, { body: unknown; link?: string }>) {
  const requests: { url: string; headers: Record<string, string> }[] = [];
  const fetch: Fetch = async (url, init) => {
    requests.push({ url, headers: init?.headers as Record<string, string> });
    const page = pages[url];
    if (!page) return new Response('{"message":"Not Found"}', { status: 404 });
    return new Response(JSON.stringify(page.body), {
      status: 200,
      headers: page.link ? { Link: page.link } : {},
    });
  };
  return { fetch, requests };
}

const first = "https://api.github.com/user/repos?per_page=100&sort=updated";
const second =
  "https://api.github.com/user/repos?per_page=100&sort=updated&page=2";

describe("nextPage", () => {
  it("finds the next page among the links", () => {
    expect(
      nextPage(
        `<${second}>; rel="next", <https://api.github.com/user/repos?page=5>; rel="last"`,
      ),
    ).toBe(second);
  });

  it("returns null on the last page", () => {
    expect(
      nextPage(`<https://api.github.com/user/repos?page=1>; rel="prev"`),
    ).toBeNull();
    expect(nextPage(null)).toBeNull();
  });
});

describe("toRepository", () => {
  it("keeps what the list shows", () => {
    expect(
      toRepository(
        raw(7, "kinetic-studio/kinetic", {
          private: true,
          description: "A physics puzzle game",
        }),
      ),
    ).toEqual({
      id: 7,
      fullName: "kinetic-studio/kinetic",
      name: "kinetic",
      owner: "kinetic-studio",
      private: true,
      description: "A physics puzzle game",
      updatedAt: Date.parse("2026-10-01T12:00:00Z"),
      cloneUrl: "https://github.com/kinetic-studio/kinetic.git",
    });
  });

  it("treats an empty description as none", () => {
    expect(toRepository(raw(1, "a/b", { description: "" })).description).toBe(
      null,
    );
  });
});

describe("fetchRepositories", () => {
  it("follows pagination and asks with the token", async () => {
    const api = fakeApi({
      [first]: {
        body: [raw(1, "me/art"), raw(2, "studio/game")],
        link: `<${second}>; rel="next"`,
      },
      [second]: { body: [raw(3, "me/old")] },
    });
    const list = await fetchRepositories(api.fetch, "gho_token");
    expect(list.map((r) => r.fullName)).toEqual([
      "me/art",
      "studio/game",
      "me/old",
    ]);
    expect(api.requests.map((r) => r.url)).toEqual([first, second]);
    expect(api.requests[0].headers).toMatchObject({
      Authorization: "Bearer gho_token",
      Accept: "application/vnd.github+json",
    });
  });

  it("lists a repository once even if pages shift under it", async () => {
    const api = fakeApi({
      [first]: {
        body: [raw(1, "me/art"), raw(2, "studio/game")],
        link: `<${second}>; rel="next"`,
      },
      [second]: { body: [raw(2, "studio/game"), raw(3, "me/old")] },
    });
    const list = await fetchRepositories(api.fetch, "gho_token");
    expect(list.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("stops after twenty pages", async () => {
    const api = fakeApi({});
    const endless: Fetch = async (url, init) => {
      await api.fetch(url, init);
      return new Response("[]", {
        headers: { Link: `<${url}&more>; rel="next"` },
      });
    };
    await fetchRepositories(endless, "gho_token");
    expect(api.requests).toHaveLength(20);
  });

  it("reports a revoked token with its status", async () => {
    const revoked: Fetch = async () =>
      new Response('{"message":"Bad credentials"}', { status: 401 });
    const error = await fetchRepositories(revoked, "gho_old").catch((e) => e);
    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error.status).toBe(401);
    expect(error.message).toBe("Bad credentials");
  });
});

describe("fetchUser", () => {
  it("reads the id, login, name and picture", async () => {
    const api = fakeApi({
      "https://api.github.com/user": {
        body: {
          id: 48213077,
          login: "alexkim-art",
          name: null,
          avatar_url: "https://avatars.githubusercontent.com/u/1",
        },
      },
    });
    expect(await fetchUser(api.fetch, "gho_token")).toEqual({
      id: 48213077,
      login: "alexkim-art",
      name: null,
      avatarUrl: "https://avatars.githubusercontent.com/u/1",
    });
  });
});

describe("cloneUrlFor", () => {
  it("puts the login in the URL so Git Credential Manager picks this account", () => {
    expect(
      cloneUrlFor(toRepository(raw(1, "studio/game")), "alexkim-art"),
    ).toBe("https://alexkim-art@github.com/studio/game.git");
  });
});
