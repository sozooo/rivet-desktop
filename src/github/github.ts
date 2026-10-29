import { invoke, isTauri } from "@tauri-apps/api/core";
import { fetch as httpFetch } from "@tauri-apps/plugin-http";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  fetchRepositories,
  fetchUser,
  GitHubApiError,
  type GitHubRepository,
  type GitHubUser,
} from "./api";
import { githubClientId, githubConfigured } from "./config";
import { demoRepositories, demoUser } from "./demo";
import {
  delay,
  pollForToken,
  requestDeviceCode,
  type DeviceCode,
} from "./deviceFlow";

/**
 * Sign-in to GitHub and the account's repositories. The desktop build reaches GitHub through
 * Tauri's HTTP plugin (GitHub doesn't allow CORS) and keeps the token in the OS keychain; the
 * browser build signs in to a demo account.
 */
export interface GitHub {
  /** False in a desktop build without an OAuth client ID, where sign-in can't work. */
  available: boolean;
  /** The account signed in on this computer, or null. */
  restore(): Promise<GitHubUser | null>;
  requestCode(): Promise<DeviceCode>;
  /** Waits until the code is approved on github.com, then remembers the account. */
  completeSignIn(code: DeviceCode, signal: AbortSignal): Promise<GitHubUser>;
  signOut(): Promise<void>;
  repositories(): Promise<GitHubRepository[]>;
  /** Opens a github.com page in the system browser. */
  openPage(url: string): Promise<void>;
}

/** The signed-in token, in memory only; between runs it lives in the keychain. */
let token: string | null = null;

async function forget() {
  token = null;
  await invoke("github_account_forget");
}

const desktopGitHub: GitHub = {
  available: githubConfigured,
  async restore() {
    const account = await invoke<{ login: string; token: string } | null>(
      "github_account_load",
    );
    if (!account) return null;
    token = account.token;
    try {
      return await fetchUser(httpFetch, account.token);
    } catch (error) {
      // Revoked on github.com: forget it here too.
      if (error instanceof GitHubApiError && error.status === 401) {
        await forget();
        return null;
      }
      // Offline: still signed in, just without the profile.
      return { login: account.login, name: null, avatarUrl: "" };
    }
  },
  requestCode: () => requestDeviceCode(httpFetch, githubClientId),
  async completeSignIn(code, signal) {
    const granted = await pollForToken(httpFetch, githubClientId, code, {
      signal,
    });
    const user = await fetchUser(httpFetch, granted);
    await invoke("github_account_save", { login: user.login, token: granted });
    token = granted;
    return user;
  },
  signOut: forget,
  async repositories() {
    if (!token) throw new Error("Not signed in to GitHub.");
    return fetchRepositories(httpFetch, token);
  },
  openPage: (url) => openUrl(url),
};

const demoSession = "rivet.demoGitHub";
/** Opening "GitHub" in the demo approves the code. */
let approveDemo: (() => void) | undefined;

const browserGitHub: GitHub = {
  available: true,
  async restore() {
    return sessionStorage.getItem(demoSession) ? demoUser : null;
  },
  async requestCode() {
    await delay(500);
    return {
      deviceCode: "demo",
      userCode: "RVT3-K7QX",
      verificationUri: "https://github.com/login/device",
      interval: 1,
      expiresAt: Date.now() + 900_000,
    };
  },
  async completeSignIn(_code, signal) {
    await new Promise<void>((resolve, reject) => {
      approveDemo = resolve;
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
    });
    await delay(1800, signal);
    sessionStorage.setItem(demoSession, "1");
    return demoUser;
  },
  async signOut() {
    sessionStorage.removeItem(demoSession);
  },
  async repositories() {
    await delay(700);
    return demoRepositories();
  },
  async openPage() {
    approveDemo?.();
  },
};

export const github: GitHub = isTauri() ? desktopGitHub : browserGitHub;
