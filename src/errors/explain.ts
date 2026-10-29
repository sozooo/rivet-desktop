import { fileName } from "../git/paths";
import type { Key, Params } from "../i18n/i18n";

/** What Rivet can offer next to an explanation; the screen decides which ones it can run. */
export type ErrorAction =
  "retry" | "sync" | "signIn" | "identity" | "installGit" | "trust";

export type Explanation = {
  key: Key;
  params?: Params;
  action?: ErrorAction;
};

type Rule = {
  test: RegExp;
  key: Key;
  action?: ErrorAction;
  params?: (message: string) => Params;
  /** Used instead of `key` when a parameter couldn't be read from the message. */
  fallback?: Key;
};

/** The text of anything thrown: git's stderr, an OS message, or our own. */
export const errorText = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).trim();

/** Up to three file names git lists on lines that start with a tab. */
function listedFiles(message: string): Params {
  const listed = message
    .split("\n")
    .filter((line) => line.startsWith("\t"))
    .map((line) => fileName(line.trim()));
  return {
    files: listed.slice(0, 3).join(", ") + (listed.length > 3 ? ", …" : ""),
  };
}

/** The first path a matching line quotes, as a file name. */
const quoted = (pattern: RegExp) => (message: string) => {
  const line = message.split("\n").find((l) => pattern.test(l)) ?? "";
  const path =
    line
      .match(/'([^']+)'|"([^"]+)"/)
      ?.slice(1)
      .find(Boolean) ??
    line.match(/file (.+?): /)?.[1] ??
    "";
  return { file: fileName(path) };
};

const busy =
  /unable to unlink|Unlink of file|Deletion of directory|unable to create file .+: (Permission denied|Invalid argument)|^error: open\(".+"\): Permission denied|cannot create directory at '.+': Permission denied|being used by another process|Device or resource busy/m;

/** Checked in order; the first match wins, so specific rules come before broad ones. */
const rules: Rule[] = [
  {
    test: /Git is not installed/,
    key: "error.gitMissing",
    action: "installGit",
  },
  {
    test: /Could not start git in|cannot change to '.+': No such file/,
    key: "error.folderMissing",
  },
  { test: /not a git repository/, key: "error.notRepository" },
  {
    test: /detected dubious ownership|is owned by someone else/,
    key: "error.dubiousOwnership",
    action: "trust",
    params: (m) => ({
      path: m.match(/repository at '([^']+)'/)?.[1] ?? "",
    }),
  },
  {
    test: /Author identity unknown|Committer identity unknown|Please tell me who you are|unable to auto-detect email address|empty ident name/,
    key: "error.identity",
    action: "identity",
  },
  // LFS missing makes git say the remote "hung up", so it goes before the network rules.
  {
    test: /'lfs' is not a git command|'git-lfs' was not found|git-lfs: command not found|git-lfs.*(not found|not installed)/i,
    key: "lfs.missing",
    action: "installGit",
  },
  {
    test: /GH001: Large files detected|exceeds GitHub's file size limit/,
    key: "error.tooLarge",
    params: (m) => ({
      files: [...m.matchAll(/File (.+?) is [\d.]+ MB; this exceeds/g)]
        .map((match) => fileName(match[1]))
        .join(", "),
    }),
    fallback: "error.tooLargeAny",
  },
  {
    test: /GH006: Protected branch|protected branch hook declined/,
    key: "error.protectedBranch",
  },
  {
    test: /! \[rejected\].*\((fetch first|non-fast-forward)\)|Updates were rejected because/,
    key: "error.pushRejected",
    action: "sync",
  },
  {
    test: /Permission denied \(publickey/,
    key: "error.sshKey",
  },
  { test: /Host key verification failed/, key: "error.sshHost" },
  {
    test: /terminal prompts disabled|could not read (Username|Password) for/,
    key: "error.authPrompt",
    action: "signIn",
  },
  {
    test: /Authentication failed|Invalid username or (password|token)|HTTP Basic: Access denied|password authentication (is not supported|was removed)|Authentication required|returned error: 401/i,
    key: "error.auth",
    action: "signIn",
  },
  {
    test: /Permission to .+ denied to|Write access to repository not granted|returned error: 403/,
    key: "error.noAccess",
  },
  {
    test: /Repository not found|repository '.+' not found|repository '.+' does not exist/,
    key: "error.notFound",
  },
  {
    test: /'origin' does not appear to be a git repository|No configured push destination/,
    key: "error.noRemote",
  },
  {
    test: /SSL certificate problem|certificate verify failed|InitializeSecurityContext failed/i,
    key: "error.certificate",
  },
  {
    // A handshake that fails right away usually means a network that answers for any
    // address (a captive portal, some providers' DNS) or a firewall in the way.
    test: /Could not resolve host|Could not resolve hostname|Network is unreachable|No such host is known|Could not resolve proxy|Couldn't connect to server|Connection refused|failed to receive handshake|SSL\/TLS connection failed|SSL_ERROR_SYSCALL/i,
    key: "error.offline",
    action: "retry",
  },
  {
    test: /timed out|Timed out/,
    key: "error.timeout",
    action: "retry",
  },
  {
    test: /RPC failed|early EOF|remote end hung up unexpectedly|Connection was reset|Connection reset by peer|unexpected disconnect/i,
    key: "error.connectionLost",
    action: "retry",
  },
  {
    test: /index\.lock': File exists|\.lock': File exists|Another git process seems to be running/,
    key: "error.locked",
    action: "retry",
  },
  {
    test: /No space left on device|not enough space on the disk|Disk quota exceeded/i,
    key: "error.diskFull",
    action: "retry",
  },
  { test: /Filename too long|path too long/i, key: "error.pathTooLong" },
  {
    test: /could not create work tree dir|could not create leading directories|could not create directory/,
    key: "error.noPermission",
  },
  {
    test: busy,
    key: "error.fileBusy",
    action: "retry",
    params: quoted(busy),
    fallback: "error.filesBusy",
  },
  {
    test: /smudge filter lfs failed|clean filter 'lfs' failed|external filter 'git-lfs filter-process' failed|Smudge error/,
    key: "error.lfsFilter",
    action: "retry",
  },
  {
    test: /would be overwritten by checkout|before you switch branches/,
    key: "error.localChangesSwitch",
    params: listedFiles,
  },
  {
    test: /would be overwritten by merge/,
    key: "error.localChanges",
    params: listedFiles,
  },
  {
    test: /destination path '.+' already exists and is not an empty directory/,
    key: "error.destinationExists",
    params: (m) => ({ name: m.match(/destination path '([^']+)'/)?.[1] ?? "" }),
  },
  {
    test: /refusing to merge unrelated histories/,
    key: "error.unrelatedHistories",
  },
  {
    test: /couldn't find remote ref|no such ref was fetched/,
    key: "error.noRemoteBranch",
  },
  { test: /You are not currently on a branch/, key: "error.detached" },
  { test: /still has conflict markers/, key: "conflict.markers" },
  {
    test: /Finish or cancel the merge first|You have not concluded your merge|is not possible because you have unmerged files/,
    key: "top.syncMerging",
  },
  { test: /There is nothing to commit/, key: "error.nothingToCommit" },
];

/** Plain words for git, LFS and OS failures people run into; null for the rest. */
export function explainError(message: string): Explanation | null {
  const rule = rules.find((r) => r.test.test(message));
  if (!rule) return null;
  const params = rule.params?.(message);
  const unread = params && Object.values(params).some((value) => value === "");
  return {
    key: unread ? (rule.fallback ?? rule.key) : rule.key,
    ...(params && !unread && { params }),
    ...(rule.action &&
      !(unread && rule.action === "trust") && { action: rule.action }),
  };
}
