# Rivet

A Git client for two kinds of people: someone who has never used Git and just wants to save and share their work, and a developer who wants a fast replacement for SourceGit. Built with Tauri 2, React, TypeScript, Vite and Lucide icons.

Rivet runs two ways:

- **Desktop app** (Tauri): works with real repositories through the `git` command-line tool. Needs [Git for Windows](https://git-scm.com/download/win); Git Credential Manager, which ships with it, handles sign-in to other hosts. GitHub has its own sign-in in Rivet (see "GitHub sign-in" below).
- **Browser** (`npm run dev`): the same UI against an in-memory demo repository. Nothing is read from or written to disk. Handy for working on the UI.

## Run

```sh
npm install
npm run desktop        # desktop app with hot reload (first start compiles Rust, a few minutes)
npm run desktop:build  # installer in src-tauri/target/release/bundle/nsis
npm run dev            # browser demo at http://127.0.0.1:5173
npm test               # unit tests, plus integration tests against real git repositories
npm run build          # type check + production web build
npm run format         # Prettier
```

Building the desktop app needs Rust (stable, MSVC) and the Visual Studio C++ build tools. WebView2 ships with Windows 11.

## Releases and updates

Installed copies of Rivet update themselves from this repository's GitHub releases: a few seconds after launch (and every six hours) the app reads `https://github.com/sozooo/rivet-desktop/releases/latest/download/latest.json`, and when a newer version is there it offers it with the release notes. Updates are signed; the app only installs files signed with the project's key.

To publish a version:

```sh
npm run release -- 0.2.0 "What's new: …"
```

This sets the version in `package.json`, `src-tauri/tauri.conf.json` and `Cargo.toml`, commits, creates the tag `v0.2.0` with the notes and pushes. GitHub Actions (`.github/workflows/release.yml`) builds the installer and publishes the release with `latest.json`; the notes become the release text and the "What's new" of the update dialog. Write release notes in English.

### One-time setup

1. Create the public repository **github.com/sozooo/rivet-desktop** (empty: no README or license), then push this one:
   ```sh
   git remote add origin https://github.com/sozooo/rivet-desktop.git
   git push -u origin main
   ```
   Another name or owner? Change the address in `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`.
2. Add the signing key as a repository secret: **Settings → Secrets and variables → Actions → New repository secret**, name `TAURI_SIGNING_PRIVATE_KEY`, value: the contents of `%USERPROFILE%\.tauri\rivet-updater.key` (in PowerShell, `Get-Content "$env:USERPROFILE\.tauri\rivet-updater.key" -Raw | Set-Clipboard` copies it). The key has no password, so `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is not needed.
3. Publish the first version: `npm run release -- 0.1.0 "First release"`, wait for the Release workflow (about 10–15 minutes), and install `Rivet_0.1.0_x64-setup.exe` from the release. Later versions arrive by themselves.

Keep `rivet-updater.key` safe and private: it is the only key installed copies trust. If it is lost, they can no longer update and have to be reinstalled by hand once with a build signed by a new key.

The installer is not code-signed, so on first install Windows SmartScreen shows "Windows protected your PC": choose **More info → Run anyway**. Updates installed from inside the app don't go through this.

`npm run desktop:build` signs its update files too, so it needs the key in the environment. In PowerShell:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\rivet-updater.key" -Raw; npm run desktop:build
```

## How it works

```
src/
  git/            Domain model and everything Git-shaped
    types.ts      FileChange, Hunk, Commit, StashEntry, RepoSnapshot, Revision…
    backend.ts    GitBackend: the interface the UI talks to
    cli/          CliBackend: GitBackend on top of the git CLI, its output parsers and runners
    mock/         MockBackend + sample fixtures for the browser build
    graph.ts      Lane layout for the commit graph
  views/          Changes, History, Branches — each owns its sidebar and main area
  diff/           Diff rendering, side-by-side alignment, file browser for commits
  dialogs/        Operation table (operations.ts) and its dialog, settings, PRs
  setup/          Clone / Add existing / Create screen
  chrome/         Top bar, navigation rail, status bar
  ui/             Shared pieces: checkbox, icons, toast, hooks, panes
  preview/        Image, model, material and scene previews in the diff area
  unity/          Unity YAML parser, scene/prefab and material diffs
  i18n/           Russian and English dictionaries, plurals, simple-mode wording
  github/         GitHub sign-in (Device Flow), the repository list, the client ID (config.ts)
  errors/         Plain-language errors (explain.ts + real stderr samples), the error log, the crash screen
  onboarding/     First-run check for Git, the name-and-email dialog
  platform.ts     OS services: folder picker, repository discovery, clone and init, git versions and identity
src-tauri/        The desktop shell (Rust): runs git, reads files, finds repositories, keeps the GitHub token, keeps the error log
```

The UI never touches Git directly. It reads a `RepoSnapshot` from a `GitBackend` and calls its methods; the workspace refreshes the snapshot after every change and whenever the window regains focus. In the desktop app, repositories you add use `CliBackend`; the browser build and the sample repositories use `MockBackend`.

`CliBackend` builds the whole snapshot from a handful of git commands (`status --porcelain=v2`, `diff`, `diff --cached`, `log`, `for-each-ref`, `stash list`). Selecting a single hunk applies that hunk as a patch to the index (`git apply --cached`), so the checkboxes always match what git itself would commit. The Rust side only runs `git` (without console windows and without terminal prompts), reads working-tree files, finds repositories listed by Unity Hub and SourceGit, and keeps the GitHub token in the OS keychain (`account.rs`); GitHub's API is reached through Tauri's HTTP plugin, allowed only for `github.com/login/*` and `api.github.com`; all Git logic lives in TypeScript, where `src/git/cli/CliBackend.test.ts` exercises it against real temporary repositories.

Git operations shown in dialogs (switch, pull, push, discard, merge…) are described once in `dialogs/operations.ts`: title, explanation, the equivalent Git command, and what to run. Merge, rebase, checkout, cherry-pick and revert only show their Git command for now.

## What you can do

- **Changes**: one list with checkboxes. Nothing ticked means the commit takes every change; tick files, or individual hunks in the diff, to commit only those. A file with some hunks ticked shows a dash. Commit with Ctrl+Enter. The message draft is kept per repository.
- **Stash** from the Changes list ("Stash all", including new files); stashes appear at the bottom of the list, where you can view, restore or delete them.
- **History** with a computed commit graph, commit details and a searchable file browser.
- **Undo the last save**: the toast after a commit offers Undo, and so does the newest commit in History. It is a soft reset: the files stay as they are, the changes come back selected, and the message goes back into the form. Pushed commits, merges and the first commit are refused with a plain explanation.
- **Put a file back to an older version** from any History commit (with its `.meta` when the commit changed both). It becomes an ordinary change to review and commit; unsaved changes to that file are confirmed first. "File history" narrows History to the commits that changed one file, following renames, with weekday dates.
- **Teammates' updates show up by themselves**: an open repository is fetched quietly every five minutes and when the window comes back after a while (never during a merge or a dialog, less often after failures). New commits bring one toast with a Pull button. These fetches run with `GIT_ASKPASS=""`, `GCM_INTERACTIVE=never` and `SSH_ASKPASS_REQUIRE=never`, so they never open a sign-in window; sign-in problems show up on the next sync you start yourself. The demo simulates a teammate's push.
- **Branches**: the branch name in the top bar opens a list to switch to (in both modes), including branches that so far exist only on the server; switching asks first only when there are unsaved changes. Full mode also has a Branches view to create branches and see how far one is from main.
- **Fetch / Pull / Push** with an explanation of what happens; pulling onto unpublished commits creates a merge commit, never a rebase.
- **Merge conflicts**: when a pull (or Sync) stops on conflicts, the Changes view lists the conflicted files first under a banner that says what happened, how many files are left, and offers Cancel merge / Finish. Each file offers "Keep my version" or "Take the server version" (or keeping a deletion) above previews of both sides, read from the index stages; full mode can also mark a hand-edited text file resolved. Choices survive a restart: Rivet reads them back from git. A rebase, cherry-pick or revert started elsewhere shows the same screen and can be aborted or continued.
- **Unity Smart Merge**: one click (in the conflict banner or Settings) finds `UnityYAMLMerge.exe` in the Unity editors Unity Hub knows, sets it up as a local merge driver, and adds `.gitattributes` lines for scenes, prefabs, assets, materials, animations and controllers, so pulls merge changes to different objects by themselves.
- **Git LFS**: a hint when changed art (textures, PSDs, models, audio, video, anything over 50 MB) would go in as regular files, with one button that runs `git lfs install --local` and tracks the Unity art set; a hard warning before committing or pushing files over GitHub's 100 MB limit; "Download LFS files" on previews of files that are only pointers; and a plain explanation when git-lfs is missing.
- **GitHub sign-in**: "Sign in with GitHub" on the Clone tab or in Settings. Once signed in, Clone shows your repositories (yours, shared with you and your organisations') with search, so there are no links to copy. The token stays in Windows Credential Manager and is handed to Git Credential Manager, so pull and push work without extra prompts.
- **Repositories**: clone, add existing (Browse, or one click on a repository found in Unity Hub or SourceGit), create, and remove from the list. Adding a subfolder of a repository adds the whole repository.
- **Previews instead of raw text** for what artists change: images side by side, as a swipe or an overlay (PNG, JPG, TGA, PSD); FBX/OBJ/glTF models in a 3D view with synced cameras, mesh statistics and playable animation clips (animation files without a mesh show their skeleton); Unity materials as property changes with color swatches, texture thumbnails (found through their GUIDs) and an approximate sphere; scenes and prefabs as a readable list of object changes (added, removed, moved, component values, prefab overrides, scene settings); `.meta` files as the import settings that changed, under the Inspector names. Files in Git LFS are read from the local LFS store; ones not downloaded yet say so. Full mode can switch any of these back to the text diff.
- **Simple and full modes**, Russian and English. Simple mode (the default) speaks plainly and hides Git machinery: "Save version", and one button that says what syncing will do ("Get updates", "Send", "Sync", or "All synced" when there's nothing to do). Unity `.meta` files travel with their assets in both modes.
- Light, dark or system theme; sidebar width, diff layout and other preferences persist.

## First run, errors and the error log

**First run.** On start the desktop app checks that Git for Windows is installed and is 2.32 or newer (Rivet relies on `git stash show --include-untracked`). If not, the whole window explains what to install, with a link to git-scm.com and "Check again"; Rivet also looks in Git's usual install folders, so a Git installed while Rivet is open is found without a restart. A missing Git LFS only gets a note.

Commits need a name and an email. When the global `user.name` / `user.email` are missing, Rivet asks once, as soon as a project is open: "How should we sign your versions?". Signed in to GitHub, it fills in the account name and GitHub's private address `<id>+<login>@users.noreply.github.com`, so a real email isn't published. Saving writes them with `git config --global`. A commit that fails for a missing identity opens the same dialog and then commits. Settings shows the current name and email with "Change".

**Errors in plain words.** `src/errors/explain.ts` maps git, Git LFS and Windows failures to dictionary keys and a suggested action: no network or timeouts (try again), expired sign-in (sign in to GitHub), a push the server refused because it has newer work (Sync), `index.lock` or a file Unity holds open (try again), a full disk, files over GitHub's 100 MB limit, local changes in the way, a moved or deleted project folder, a folder owned by another Windows user (trust it), and more. `src/errors/samples.ts` holds the real messages the tests check. Every place an error reaches the user goes through it: actions in the workspace (a toast), the screen for a project that won't open, and the clone/create/open screen. Simple mode shows only the plain message and the action; full mode adds "Details" with git's own output, and shows git's text as is when Rivet has no explanation.

**Error log.** The desktop app logs every git command it runs (arguments, folder, exit code, time, and the error output when it fails) and the app's own errors to `%LOCALAPPDATA%\app.rivet.desktop\logs\rivet.log`. At 512 KB the file moves to `rivet.1.log`, so the log stays near 1 MB. Passwords, tokens, `Authorization` headers and credentials in URLs (`https://user:token@…`) are replaced with `***` before anything is written; stdin, where the credential helper gets its input, is never logged. Settings → "Copy error report" copies the Rivet, Windows, Git and Git LFS versions and the last 200 log lines, ready to paste into a message to the developer. If the window itself crashes, a crash screen offers to reload and to copy the same report.

**Seeing these screens in the browser demo.** Add switches to the address of `npm run dev`:

| Address | Shows |
| --- | --- |
| `?git=missing` | the "Rivet needs Git" screen |
| `?git=old` | the "Git needs an update" screen (Git 2.25.1) |
| `?lfs=missing` | the Git LFS note |
| `?identity=empty` | the name-and-email dialog; saving a version fails until they're given |
| `?crash` | the screen shown when the window itself crashes |
| `?fail=<sample>` | the failure with that id from `src/errors/samples.ts`, every time Rivet reaches it: `?fail=offline` (fetch), `?fail=push-rejected` (push), `?fail=index-lock` (commit), `?fail=file-busy` (switching branches), `?fail=folder-missing` or `?fail=dubious-ownership` (opening the project), `?fail=auth-prompt` (cloning), and so on |

Switches combine (`?identity=empty&lfs=missing`). In the demo the log lives in memory, and the report holds the browser's details instead of Windows and Git versions.

## GitHub sign-in

Rivet signs in to GitHub with the OAuth Device Flow: the app shows a short code, you enter it on github.com, and that's it. No client secret is involved. The token is kept only in Windows Credential Manager and handed to Git Credential Manager, so clone, pull and push over HTTPS work without extra prompts. "Sign out" in Settings removes it from both.

For sign-in to work, register an OAuth App on GitHub once:

1. Open https://github.com/settings/applications/new (for an organisation: organisation settings → Developer settings → OAuth Apps → New OAuth App).
2. Fill in:
   - **Application name**: `Rivet`;
   - **Homepage URL**: any address, e.g. `https://github.com/sozooo/rivet-desktop`;
   - **Redirect URI** (**Authorization callback URL** in the older form): the same address. The Device Flow doesn't use it;
   - **Enable Device Flow**: on;
   - **Expire user access tokens**: off. Rivet doesn't refresh tokens yet, so with this on, sign-in would lapse every 8 hours.
3. Click **Register application**. If the form had no Device Flow option, turn it on on the app's page and click **Update application**.
4. Copy the **Client ID** (it looks like `Ov23li…`). Don't create a client secret.
5. Put the Client ID in `src/github/config.ts` and rebuild the app (`npm run desktop` or `npm run desktop:build`).

A client ID isn't a secret: it is visible inside the built app anyway, so it's fine to commit. A client secret must never go into the repository, and Rivet doesn't need one.

Until a Client ID is set, the desktop app hides the sign-in button; full mode shows a hint in Settings.

If an organisation's repositories are missing from the list, the organisation restricts third-party OAuth apps. An owner can approve Rivet in the organisation's settings: Third-party Access → OAuth application policy. You can revoke Rivet's access to your account at https://github.com/settings/applications.

In the browser demo (`npm run dev`) sign-in is pretend: a demo account and a sample repository list.
