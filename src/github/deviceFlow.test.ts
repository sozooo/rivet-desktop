import { describe, expect, it } from "vitest";
import {
  pollForToken,
  requestDeviceCode,
  SignInError,
  type DeviceCode,
  type Fetch,
} from "./deviceFlow";

type Reply = Record<string, unknown> | Error | Response;

/** A GitHub stand-in that answers requests from a queue and records them. */
function fakeGitHub(...replies: Reply[]) {
  const requests: { url: string; body: URLSearchParams; init?: RequestInit }[] =
    [];
  const fetch: Fetch = async (url, init) => {
    requests.push({ url, init, body: new URLSearchParams(String(init?.body)) });
    const reply = replies.shift();
    if (!reply) throw new Error(`Unexpected request to ${url}`);
    if (reply instanceof Error) throw reply;
    if (reply instanceof Response) return reply;
    return new Response(JSON.stringify(reply), { status: 200 });
  };
  return { fetch, requests };
}

/** Time that only moves when the poller sleeps. */
function fakeClock() {
  let time = 0;
  const waits: number[] = [];
  return {
    waits,
    now: () => time,
    sleep: async (ms: number) => {
      waits.push(ms);
      time += ms;
    },
  };
}

const code: DeviceCode = {
  deviceCode: "device-123",
  userCode: "WDJB-MJHT",
  verificationUri: "https://github.com/login/device",
  interval: 5,
  expiresAt: 900_000,
};

const reason = (promise: Promise<unknown>) =>
  promise.then(
    () => "resolved",
    (error) => (error instanceof SignInError ? error.reason : error),
  );

describe("requestDeviceCode", () => {
  it("asks for repo and read:user and reads GitHub's answer", async () => {
    const github = fakeGitHub({
      device_code: "device-123",
      user_code: "WDJB-MJHT",
      verification_uri: "https://github.com/login/device",
      expires_in: 899,
      interval: 5,
    });
    expect(await requestDeviceCode(github.fetch, "client-1", 1_000)).toEqual({
      deviceCode: "device-123",
      userCode: "WDJB-MJHT",
      verificationUri: "https://github.com/login/device",
      interval: 5,
      expiresAt: 1_000 + 899_000,
    });
    const [request] = github.requests;
    expect(request.url).toBe("https://github.com/login/device/code");
    expect(request.init?.method).toBe("POST");
    expect(request.init?.headers).toMatchObject({ Accept: "application/json" });
    expect(Object.fromEntries(request.body)).toEqual({
      client_id: "client-1",
      scope: "repo read:user",
    });
  });

  it("says when GitHub doesn't know the client ID", async () => {
    const github = fakeGitHub(
      new Response('{"error":"Not Found"}', { status: 404 }),
    );
    expect(await reason(requestDeviceCode(github.fetch, "nope"))).toBe(
      "not-configured",
    );
  });

  it("says when the OAuth App has Device Flow turned off", async () => {
    const github = fakeGitHub(
      new Response('{"error":"device_flow_disabled"}', { status: 400 }),
    );
    expect(await reason(requestDeviceCode(github.fetch, "client-1"))).toBe(
      "disabled",
    );
  });

  it("reports an unreachable GitHub as a network problem", async () => {
    const github = fakeGitHub(new TypeError("Failed to fetch"));
    expect(await reason(requestDeviceCode(github.fetch, "client-1"))).toBe(
      "network",
    );
  });
});

describe("pollForToken", () => {
  it("waits the interval between polls until the code is approved", async () => {
    const github = fakeGitHub(
      { error: "authorization_pending" },
      { error: "authorization_pending" },
      { access_token: "gho_secret", token_type: "bearer", scope: "repo" },
    );
    const clock = fakeClock();
    expect(await pollForToken(github.fetch, "client-1", code, clock)).toBe(
      "gho_secret",
    );
    expect(clock.waits).toEqual([5000, 5000, 5000]);
    expect(github.requests).toHaveLength(3);
    expect(github.requests[0].url).toBe(
      "https://github.com/login/oauth/access_token",
    );
    expect(Object.fromEntries(github.requests[0].body)).toEqual({
      client_id: "client-1",
      device_code: "device-123",
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });
  });

  it("slows down to the interval GitHub asks for", async () => {
    const github = fakeGitHub(
      { error: "slow_down", interval: 10 },
      { error: "authorization_pending" },
      { access_token: "gho_secret" },
    );
    const clock = fakeClock();
    await pollForToken(github.fetch, "client-1", code, clock);
    expect(clock.waits).toEqual([5000, 10000, 10000]);
  });

  it("adds five seconds on slow_down without a new interval", async () => {
    const github = fakeGitHub(
      { error: "slow_down" },
      { error: "slow_down" },
      { access_token: "gho_secret" },
    );
    const clock = fakeClock();
    await pollForToken(github.fetch, "client-1", code, clock);
    expect(clock.waits).toEqual([5000, 10000, 15000]);
  });

  it("stops when GitHub says the code expired", async () => {
    const github = fakeGitHub(
      { error: "authorization_pending" },
      { error: "expired_token" },
    );
    expect(
      await reason(pollForToken(github.fetch, "client-1", code, fakeClock())),
    ).toBe("expired");
  });

  it("stops by itself once the code's lifetime is over", async () => {
    const pending = Array.from({ length: 500 }, () => ({
      error: "authorization_pending",
    }));
    const github = fakeGitHub(...pending);
    const short = { ...code, expiresAt: 12_000 };
    expect(
      await reason(pollForToken(github.fetch, "client-1", short, fakeClock())),
    ).toBe("expired");
    // Polled at 5 s and 10 s; at 15 s the code is gone, so no third request.
    expect(github.requests).toHaveLength(2);
  });

  it("stops when the person declines on GitHub", async () => {
    const github = fakeGitHub({ error: "access_denied" });
    expect(
      await reason(pollForToken(github.fetch, "client-1", code, fakeClock())),
    ).toBe("denied");
  });

  it("rides out a short network blip", async () => {
    const github = fakeGitHub(
      new TypeError("Failed to fetch"),
      new TypeError("Failed to fetch"),
      { access_token: "gho_secret" },
    );
    expect(
      await pollForToken(github.fetch, "client-1", code, fakeClock()),
    ).toBe("gho_secret");
  });

  it("gives up after three network failures in a row", async () => {
    const offline = () => new TypeError("Failed to fetch");
    const github = fakeGitHub(offline(), offline(), offline(), {
      access_token: "never reached",
    });
    expect(
      await reason(pollForToken(github.fetch, "client-1", code, fakeClock())),
    ).toBe("network");
    expect(github.requests).toHaveLength(3);
  });

  it("explains other errors with GitHub's description", async () => {
    const github = fakeGitHub({
      error: "incorrect_device_code",
      error_description: "The device_code provided is not valid.",
    });
    const error = await pollForToken(
      github.fetch,
      "client-1",
      code,
      fakeClock(),
    ).catch((e) => e);
    expect(error).toBeInstanceOf(SignInError);
    expect(error.reason).toBe("unexpected");
    expect(error.message).toBe("The device_code provided is not valid.");
  });

  it("stops polling when cancelled", async () => {
    const github = fakeGitHub({ access_token: "too late" });
    const controller = new AbortController();
    const polling = pollForToken(github.fetch, "client-1", code, {
      signal: controller.signal,
    });
    controller.abort();
    await expect(polling).rejects.toMatchObject({ name: "AbortError" });
    expect(github.requests).toHaveLength(0);
  });
});
