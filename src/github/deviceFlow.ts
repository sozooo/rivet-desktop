/**
 * GitHub's OAuth Device Flow: Rivet asks for a short code, the person enters it on github.com,
 * and Rivet polls until GitHub hands over a token. No client secret is involved.
 * https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */

/** The part of `fetch` GitHub calls need: Tauri's HTTP plugin on the desktop, a fake in tests. */
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export type DeviceCode = {
  deviceCode: string;
  /** What the person types on github.com, like "WDJB-MJHT". */
  userCode: string;
  verificationUri: string;
  /** Seconds to wait between polls. */
  interval: number;
  /** When the code stops working, in milliseconds since the epoch. */
  expiresAt: number;
};

/** Why sign-in stopped; the sign-in dialog explains each one. */
export type SignInFailure =
  | "expired"
  | "denied"
  | "not-configured"
  | "disabled"
  | "network"
  | "unexpected";

export class SignInError extends Error {
  constructor(
    readonly reason: SignInFailure,
    message: string = reason,
  ) {
    super(message);
  }
}

export const scopes = "repo read:user";
const deviceCodeUrl = "https://github.com/login/device/code";
const tokenUrl = "https://github.com/login/oauth/access_token";
const grantType = "urn:ietf:params:oauth:grant-type:device_code";
/** Polls that may fail on the network in a row before sign-in gives up. */
const networkRetries = 3;

type Body = Record<string, unknown>;

async function post(fetch: Fetch, url: string, params: Record<string, string>) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });
  } catch (error) {
    throw new SignInError("network", String(error));
  }
  // GitHub answers an unknown client ID with 404.
  if (response.status === 404) throw new SignInError("not-configured");
  const body: Body = await response.json().catch(() => ({}));
  if (!response.ok && !body.error)
    throw new SignInError("unexpected", `HTTP ${response.status}`);
  return body;
}

function failure(body: Body) {
  switch (body.error) {
    case "expired_token":
      return new SignInError("expired");
    case "access_denied":
      return new SignInError("denied");
    case "device_flow_disabled":
      return new SignInError("disabled");
    case "incorrect_client_credentials":
    case "Not Found":
      return new SignInError("not-configured");
    default:
      return new SignInError(
        "unexpected",
        String(body.error_description ?? body.error ?? "no token"),
      );
  }
}

export async function requestDeviceCode(
  fetch: Fetch,
  clientId: string,
  now = Date.now(),
): Promise<DeviceCode> {
  const body = await post(fetch, deviceCodeUrl, {
    client_id: clientId,
    scope: scopes,
  });
  if (
    typeof body.device_code !== "string" ||
    typeof body.user_code !== "string"
  )
    throw failure(body);
  return {
    deviceCode: body.device_code,
    userCode: body.user_code,
    verificationUri: String(
      body.verification_uri ?? "https://github.com/login/device",
    ),
    interval: Number(body.interval) || 5,
    expiresAt: now + (Number(body.expires_in) || 900) * 1000,
  };
}

/** Resolves after `ms`, or rejects with the signal's reason once it aborts. */
export function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/**
 * Polls until the person approves the code and returns the access token. Waits `interval`
 * between polls and longer when GitHub says `slow_down`; gives up when the code expires,
 * the person declines, or GitHub can't be reached several times in a row.
 */
export async function pollForToken(
  fetch: Fetch,
  clientId: string,
  code: DeviceCode,
  {
    signal,
    sleep = delay,
    now = Date.now,
  }: {
    signal?: AbortSignal;
    sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
    now?: () => number;
  } = {},
): Promise<string> {
  let interval = code.interval;
  let networkFailures = 0;
  for (;;) {
    await sleep(interval * 1000, signal);
    signal?.throwIfAborted();
    if (now() >= code.expiresAt) throw new SignInError("expired");
    let body: Body;
    try {
      body = await post(fetch, tokenUrl, {
        client_id: clientId,
        device_code: code.deviceCode,
        grant_type: grantType,
      });
      networkFailures = 0;
    } catch (error) {
      if (
        error instanceof SignInError &&
        error.reason === "network" &&
        ++networkFailures < networkRetries
      )
        continue;
      throw error;
    }
    if (typeof body.access_token === "string" && body.access_token)
      return body.access_token;
    if (body.error === "authorization_pending") continue;
    if (body.error === "slow_down") {
      // GitHub says how long to wait now; without it the spec adds five seconds.
      interval = Number(body.interval) || interval + 5;
      continue;
    }
    throw failure(body);
  }
}
