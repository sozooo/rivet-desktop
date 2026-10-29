# Rivet

A Git client for two kinds of people: someone who has never used Git and just wants to save and share their work, and a developer who wants a fast replacement for SourceGit. Built with Tauri 2, React, TypeScript, Vite and Lucide icons.

Rivet runs two ways:

- **Desktop app** (Tauri): works with real repositories through the `git` command-line tool. Needs [Git for Windows](https://git-scm.com/download/win); sign-in to GitHub and other hosts goes through Git Credential Manager, which ships with it.
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

Installed copies of Rivet update themselves from this repository's GitHub releases: a few seconds after launch (and every six hours) the app reads `https://github.com/sozooo/rivet/releases/latest/download/latest.json`, and when a newer version is there it offers it with the release notes. Updates are signed; the app only installs files signed with the project's key.

To publish a version:

```sh
npm run release -- 0.2.0 "Что нового: …"
```

This sets the version in `package.json`, `src-tauri/tauri.conf.json` and `Cargo.toml`, commits, creates the tag `v0.2.0` with the notes and pushes. GitHub Actions (`.github/workflows/release.yml`) builds the installer and publishes the release with `latest.json`; the notes become the release text and the "What's new" of the update dialog.

### One-time setup

1. Create the public repository **github.com/sozooo/rivet** (empty: no README or license), then push this one:
   ```sh
   git remote add origin https://github.com/sozooo/rivet.git
   git push -u origin main
   ```
   Another name or owner? Change the address in `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`.
2. Add the signing key as a repository secret: **Settings → Secrets and variables → Actions → New repository secret**, name `TAURI_SIGNING_PRIVATE_KEY`, value: the contents of `%USERPROFILE%\.tauri\rivet-updater.key`. The key has no password, so `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is not needed.
3. Publish the first version: `npm run release -- 0.1.0 "Первая версия"`, wait for the Release workflow (about 10–15 minutes), and install `Rivet_0.1.0_x64-setup.exe` from the release. Later versions arrive by themselves.

Keep `rivet-updater.key` safe and private: it is the only key installed copies trust. If it is lost, they can no longer update and have to be reinstalled by hand once with a build signed by a new key.

The installer is not code-signed, so on first install Windows SmartScreen shows "Windows protected your PC": choose **More info → Run anyway**. Updates installed from inside the app don't go through this.

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
  platform.ts     OS services: folder picker, repository discovery, clone and init
src-tauri/        The desktop shell (Rust): runs git, reads files, finds repositories
```

The UI never touches Git directly. It reads a `RepoSnapshot` from a `GitBackend` and calls its methods; the workspace refreshes the snapshot after every change and whenever the window regains focus. In the desktop app, repositories you add use `CliBackend`; the browser build and the sample repositories use `MockBackend`.

`CliBackend` builds the whole snapshot from a handful of git commands (`status --porcelain=v2`, `diff`, `diff --cached`, `log`, `for-each-ref`, `stash list`). Selecting a single hunk applies that hunk as a patch to the index (`git apply --cached`), so the checkboxes always match what git itself would commit. The Rust side only runs `git` (without console windows and without terminal prompts), reads working-tree files and finds repositories listed by Unity Hub and SourceGit; all Git logic lives in TypeScript, where `src/git/cli/CliBackend.test.ts` exercises it against real temporary repositories.

Git operations shown in dialogs (switch, pull, push, discard, merge…) are described once in `dialogs/operations.ts`: title, explanation, the equivalent Git command, and what to run. Merge, rebase, checkout, cherry-pick and revert only show their Git command for now.

## What you can do

- **Changes**: one list with checkboxes. Nothing ticked means the commit takes every change; tick files, or individual hunks in the diff, to commit only those. A file with some hunks ticked shows a dash. Commit with Ctrl+Enter. The message draft is kept per repository.
- **Stash** from the Changes list ("Stash all", including new files); stashes appear at the bottom of the list, where you can view, restore or delete them.
- **History** with a computed commit graph, commit details and a searchable file browser.
- **Branches**: switch, create, and see how far a branch is from main.
- **Fetch / Pull / Push** with an explanation of what happens; pulling onto unpublished commits creates a merge commit, never a rebase.
- **Repositories**: clone, add existing (Browse, or one click on a repository found in Unity Hub or SourceGit), create, and remove from the list. Adding a subfolder of a repository adds the whole repository.
- **Previews instead of raw text** for what artists change: images side by side, as a swipe or an overlay (PNG, JPG, TGA, PSD); FBX/OBJ/glTF models in a 3D view with synced cameras, mesh statistics and playable animation clips (animation files without a mesh show their skeleton); Unity materials as property changes with color swatches, texture thumbnails (found through their GUIDs) and an approximate sphere; scenes and prefabs as a readable list of object changes (added, removed, moved, component values, prefab overrides, scene settings); `.meta` files as the import settings that changed, under the Inspector names. Files in Git LFS are read from the local LFS store; ones not downloaded yet say so. Full mode can switch any of these back to the text diff.
- **Simple and full modes**, Russian and English. Simple mode (the default) speaks plainly and hides Git machinery: one Sync button, "Save version", no branches. Unity `.meta` files travel with their assets in both modes.
- Light, dark or system theme; sidebar width, diff layout and other preferences persist.
