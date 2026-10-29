import type { Key } from "../i18n/i18n";

/** Where a failure happens: a backend method, cloning, or opening the repository. */
export type FailurePoint =
  "fetch" | "pull" | "push" | "commit" | "switchBranch" | "snapshot" | "clone";

export type ErrorSample = {
  id: string;
  /** What git, git-lfs or Windows printed. */
  stderr: string;
  /** The explanation it should get; null for messages Rivet can't explain. */
  key: Key | null;
  /** Where the browser demo's `?fail=<id>` makes it happen. */
  at: FailurePoint;
};

const github = "https://github.com/kinetic-studio/kinetic.git";
const sshRead = `fatal: Could not read from remote repository.

Please make sure you have the correct access rights
and the repository exists.`;

/** Real messages, collected from git for Windows 2.4x, git-lfs 3.x and GitHub. */
export const errorSamples: ErrorSample[] = [
  {
    id: "offline",
    at: "fetch",
    key: "error.offline",
    stderr: `fatal: unable to access '${github}/': Could not resolve host: github.com`,
  },
  {
    id: "offline-connect",
    at: "pull",
    key: "error.offline",
    stderr: `fatal: unable to access '${github}/': Failed to connect to github.com port 443 after 2071 ms: Couldn't connect to server`,
  },
  {
    id: "offline-ssh",
    at: "fetch",
    key: "error.offline",
    stderr: `ssh: Could not resolve hostname github.com: No such host is known. \r\n${sshRead}`,
  },
  {
    id: "offline-handshake",
    at: "fetch",
    key: "error.offline",
    // Seen on a network whose DNS answers for any name, even nonexistent-host.invalid.
    stderr: `fatal: unable to access 'https://nonexistent-host.invalid/kinetic.git/': schannel: failed to receive handshake, SSL/TLS connection failed`,
  },
  {
    id: "offline-openssl",
    at: "push",
    key: "error.offline",
    stderr: `fatal: unable to access '${github}/': OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to github.com:443 `,
  },
  {
    id: "timeout",
    at: "push",
    key: "error.timeout",
    stderr: `fatal: unable to access '${github}/': Failed to connect to github.com port 443 after 21045 ms: Timed out`,
  },
  {
    id: "timeout-ssh",
    at: "fetch",
    key: "error.timeout",
    stderr: `ssh: connect to host github.com port 22: Connection timed out\r\n${sshRead}`,
  },
  {
    id: "connection-lost",
    at: "push",
    key: "error.connectionLost",
    stderr: `error: RPC failed; curl 56 Recv failure: Connection was reset
send-pack: unexpected disconnect while reading sideband packet
fatal: the remote end hung up unexpectedly`,
  },
  {
    id: "early-eof",
    at: "clone",
    key: "error.connectionLost",
    stderr: `Cloning into 'kinetic'...
error: RPC failed; curl 92 HTTP/2 stream 5 was not closed cleanly: CANCEL (err 8)
error: 4183 bytes of body are still expected
fetch-pack: unexpected disconnect while reading sideband packet
fatal: early EOF
fatal: fetch-pack: invalid index-pack output`,
  },
  {
    id: "certificate",
    at: "fetch",
    key: "error.certificate",
    stderr: `fatal: unable to access '${github}/': SSL certificate problem: unable to get local issuer certificate`,
  },
  {
    id: "certificate-schannel",
    at: "pull",
    key: "error.certificate",
    stderr: `fatal: unable to access '${github}/': schannel: next InitializeSecurityContext failed: Unknown error (0x80092012) - The revocation function was unable to check revocation for the certificate.`,
  },
  {
    id: "auth",
    at: "push",
    key: "error.auth",
    stderr: `remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed for '${github}/'`,
  },
  {
    id: "auth-gitlab",
    at: "pull",
    key: "error.auth",
    stderr: `remote: HTTP Basic: Access denied. If a password was provided for Git authentication, the password was incorrect or you're required to use a token instead of a password.
fatal: Authentication failed for 'https://gitlab.com/kinetic/kinetic.git/'`,
  },
  {
    id: "auth-prompt",
    at: "clone",
    key: "error.authPrompt",
    stderr: `Cloning into 'kinetic'...
fatal: could not read Username for 'https://github.com': terminal prompts disabled`,
  },
  {
    id: "ssh-key",
    at: "fetch",
    key: "error.sshKey",
    stderr: `git@github.com: Permission denied (publickey).\r\n${sshRead}`,
  },
  {
    id: "ssh-host",
    at: "clone",
    key: "error.sshHost",
    stderr: `Cloning into 'kinetic'...
Host key verification failed.\r\n${sshRead}`,
  },
  {
    id: "no-access",
    at: "push",
    key: "error.noAccess",
    stderr: `remote: Permission to kinetic-studio/kinetic.git denied to alexkim-art.
fatal: unable to access '${github}/': The requested URL returned error: 403`,
  },
  {
    id: "not-found",
    at: "clone",
    key: "error.notFound",
    stderr: `Cloning into 'kinetc'...
remote: Repository not found.
fatal: repository 'https://github.com/kinetic-studio/kinetc.git/' not found`,
  },
  {
    id: "no-remote",
    at: "push",
    key: "error.noRemote",
    stderr: `fatal: 'origin' does not appear to be a git repository\n${sshRead}`,
  },
  {
    id: "push-rejected",
    at: "push",
    key: "error.pushRejected",
    stderr: `To ${github}
 ! [rejected]        main -> main (fetch first)
error: failed to push some refs to '${github}'
hint: Updates were rejected because the remote contains work that you do not
hint: have locally. This is usually caused by another repository pushing to
hint: the same ref. If you want to integrate the remote changes, use
hint: 'git pull' before pushing again.
hint: See the 'Note about fast-forwards' in 'git push --help' for details.`,
  },
  {
    id: "push-behind",
    at: "push",
    key: "error.pushRejected",
    stderr: `To ${github}
 ! [rejected]        feature/player-movement -> feature/player-movement (non-fast-forward)
error: failed to push some refs to '${github}'
hint: Updates were rejected because the tip of your current branch is behind
hint: its remote counterpart. If you want to integrate the remote changes,
hint: use 'git pull' before pushing again.`,
  },
  {
    id: "protected-branch",
    at: "push",
    key: "error.protectedBranch",
    stderr: `remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: error: Changes must be made through a pull request.
To ${github}
 ! [remote rejected] main -> main (protected branch hook declined)
error: failed to push some refs to '${github}'`,
  },
  {
    id: "too-large",
    at: "push",
    key: "error.tooLarge",
    stderr: `remote: error: Trace: 6f1f3c2d9a0b4e1c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c
remote: error: See https://gh.io/lfs for more information.
remote: error: File Assets/Video/Intro.mov is 148.21 MB; this exceeds GitHub's file size limit of 100.00 MB
remote: error: GH001: Large files detected. You may want to try Git Large File Storage - https://git-lfs.github.com.
To ${github}
 ! [remote rejected] main -> main (pre-receive hook declined)
error: failed to push some refs to '${github}'`,
  },
  {
    id: "index-lock",
    at: "commit",
    key: "error.locked",
    stderr: `fatal: Unable to create 'D:/Projects/kinetic/.git/index.lock': File exists.

Another git process seems to be running in this repository, e.g.
an editor opened by 'git commit'. Please make sure all processes
are terminated then try again. If it still fails, a git process
may have crashed in this repository earlier:
remove the file manually to continue.`,
  },
  {
    id: "ref-lock",
    at: "fetch",
    key: "error.locked",
    stderr: `error: cannot lock ref 'refs/remotes/origin/main': Unable to create 'D:/Projects/kinetic/.git/refs/remotes/origin/main.lock': File exists.`,
  },
  {
    id: "file-busy",
    at: "switchBranch",
    key: "error.fileBusy",
    stderr: `error: unable to unlink old 'Assets/Plugins/Native/kinetic_physics.dll': Invalid argument
error: unable to unlink old 'Assets/Textures/Bark.png': Permission denied`,
  },
  {
    id: "file-busy-pull",
    at: "pull",
    key: "error.fileBusy",
    stderr: `Updating 4fd2c11..c5d2f80
error: unable to create file Assets/Scenes/Forest.unity: Permission denied
error: unable to create file Assets/Scenes/Forest.unity.meta: Permission denied`,
  },
  {
    id: "file-busy-add",
    at: "commit",
    key: "error.fileBusy",
    stderr: `error: open("Assets/Textures/Bark.psd"): Permission denied
error: unable to index file 'Assets/Textures/Bark.psd'
fatal: adding files failed`,
  },
  {
    // Reading changes while another program holds the file open exclusively.
    id: "file-busy-hash",
    at: "snapshot",
    key: "error.fileBusy",
    stderr: `error: open("Assets/Textures/Bark.txt"): Permission denied
fatal: cannot hash Assets/Textures/Bark.txt`,
  },
  {
    id: "file-busy-os",
    at: "commit",
    key: "error.filesBusy",
    stderr: `The process cannot access the file because it is being used by another process. (os error 32)`,
  },
  {
    id: "disk-full",
    at: "pull",
    key: "error.diskFull",
    stderr: `error: unable to write file Assets/Textures/Cliff_Albedo.png
fatal: sha1 file '.git/objects/pack/tmp_pack_pd1Ftx' write error: No space left on device`,
  },
  {
    id: "disk-full-windows",
    at: "clone",
    key: "error.diskFull",
    stderr: `Cloning into 'kinetic'...
Updating files:  37% (1503/4062)
fatal: write error: There is not enough space on the disk.`,
  },
  {
    id: "path-too-long",
    at: "clone",
    key: "error.pathTooLong",
    stderr: `Cloning into 'kinetic'...
error: unable to create file Assets/ThirdParty/Environment/Stylized Nature Pack/Prefabs/Vegetation/Trees/Variants/Autumn/Large/Tree_Oak_Large_Autumn_Variant_03_LOD_Group.prefab: Filename too long
fatal: unable to checkout working tree`,
  },
  {
    id: "no-permission",
    at: "clone",
    key: "error.noPermission",
    stderr: `fatal: could not create work tree dir 'C:/Program Files/kinetic': Permission denied`,
  },
  {
    id: "lfs-missing",
    at: "pull",
    key: "lfs.missing",
    stderr: `git: 'lfs' is not a git command. See 'git --help'.`,
  },
  {
    id: "lfs-missing-hook",
    at: "push",
    key: "lfs.missing",
    stderr: `This repository is configured for Git LFS but 'git-lfs' was not found on your path. If you no longer wish to use Git LFS, remove this hook by deleting the 'pre-push' file in the hooks directory (set by 'core.hookspath'; usually '.git/hooks').
error: failed to push some refs to '${github}'`,
  },
  {
    id: "lfs-filter-missing",
    at: "switchBranch",
    key: "lfs.missing",
    stderr: `git-lfs filter-process: git-lfs: command not found
fatal: the remote end hung up unexpectedly`,
  },
  {
    id: "lfs-smudge",
    at: "pull",
    key: "error.lfsFilter",
    stderr: `Downloading Assets/Textures/Bark.png (2.1 MB)
Error downloading object: Assets/Textures/Bark.png (3f2a1b0): Smudge error: Error downloading Assets/Textures/Bark.png (3f2a1b0c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a): [404] Object does not exist on the server or you don't have permissions to access it

Errors logged to 'D:\\Projects\\kinetic\\.git\\lfs\\logs\\20261029T101523.2210851.log'.
Use \`git lfs logs last\` to view the log.
error: external filter 'git-lfs filter-process' failed
fatal: Assets/Textures/Bark.png: smudge filter lfs failed`,
  },
  {
    id: "lfs-auth",
    at: "pull",
    key: "error.auth",
    stderr: `Error downloading object: Assets/Models/Crate.fbx (9c1d2e3): Smudge error: Error downloading Assets/Models/Crate.fbx (9c1d2e3f): batch response: Authentication required: Authorization error: ${github}/info/lfs/objects/batch
Check that you have proper access to the repository
error: external filter 'git-lfs filter-process' failed
fatal: Assets/Models/Crate.fbx: smudge filter lfs failed`,
  },
  {
    id: "local-changes",
    at: "pull",
    key: "error.localChanges",
    stderr: `error: Your local changes to the following files would be overwritten by merge:
\tAssets/Textures/Bark.png
\tAssets/Scenes/Forest.unity
Please commit your changes or stash them before you merge.
Aborting`,
  },
  {
    id: "local-changes-switch",
    at: "switchBranch",
    key: "error.localChangesSwitch",
    stderr: `error: Your local changes to the following files would be overwritten by checkout:
\tAssets/Scripts/Player/PlayerController.cs
Please commit your changes or stash them before you switch branches.
Aborting`,
  },
  {
    id: "not-repository",
    at: "snapshot",
    key: "error.notRepository",
    stderr: `fatal: not a git repository (or any of the parent directories): .git`,
  },
  {
    id: "folder-missing",
    at: "snapshot",
    key: "error.folderMissing",
    stderr: `Could not start git in D:\\Projects\\kinetic: the folder does not exist.`,
  },
  {
    id: "git-missing",
    at: "snapshot",
    key: "error.gitMissing",
    stderr: `Git is not installed or not on PATH. Install Git for Windows and restart Rivet.`,
  },
  {
    id: "dubious-ownership",
    at: "snapshot",
    key: "error.dubiousOwnership",
    stderr: `fatal: detected dubious ownership in repository at 'E:/Projects/kinetic'
'E:/Projects/kinetic' is owned by:
\tBUILTIN/Administrators (S-1-5-32-544)
but the current user is:
\tDESKTOP-K7/Alex (S-1-5-21-1004336348-1177238915-682003330-1001)
To add an exception for this directory, call:

\tgit config --global --add safe.directory E:/Projects/kinetic`,
  },
  {
    id: "identity",
    at: "commit",
    key: "error.identity",
    stderr: `Author identity unknown

*** Please tell me who you are.

Run

  git config --global user.email "you@example.com"
  git config --global user.name "Your Name"

to set your account's default identity.
Omit --global to set the identity only in this repository.

fatal: unable to auto-detect email address (got 'Alex@DESKTOP-K7.(none)')`,
  },
  {
    id: "destination-exists",
    at: "clone",
    key: "error.destinationExists",
    stderr: `fatal: destination path 'kinetic' already exists and is not an empty directory.`,
  },
  {
    id: "unrelated",
    at: "pull",
    key: "error.unrelatedHistories",
    stderr: `fatal: refusing to merge unrelated histories`,
  },
  {
    id: "no-remote-branch",
    at: "pull",
    key: "error.noRemoteBranch",
    stderr: `Your configuration specifies to merge with the ref 'refs/heads/feature/player-movement'
from the remote, but no such ref was fetched.`,
  },
  {
    id: "detached",
    at: "push",
    key: "error.detached",
    stderr: `fatal: You are not currently on a branch.
To push the history leading to the current (detached HEAD)
state now, use

    git push origin HEAD:<name-of-remote-branch>`,
  },
  {
    id: "unfinished-merge",
    at: "pull",
    key: "top.syncMerging",
    stderr: `error: You have not concluded your merge (MERGE_HEAD exists).
hint: Please, commit your changes before merging.
fatal: Exiting because of unfinished merge.`,
  },
  {
    id: "unknown",
    at: "fetch",
    key: null,
    stderr: `fatal: bad object refs/remotes/origin/HEAD
error: https://github.com/kinetic-studio/kinetic.git did not send all necessary objects`,
  },
];
