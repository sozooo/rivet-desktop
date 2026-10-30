# Rivet

A Git client for Unity teams with two kinds of people in them: someone who has never used Git and just wants to save and share their work, and a developer who wants a fast, clear replacement for tools like SourceGit.

## Download

Get the latest `Rivet_x.y.z_x64-setup.exe` from [Releases](https://github.com/sozooo/rivet-desktop/releases/latest) and run it. It installs for your Windows user only, without administrator rights. The installer isn't code-signed yet, so Windows may say "Windows protected your PC": choose **More info → Run anyway**.

Rivet updates itself: when a new version is out, it offers to install it.

Rivet uses Git for Windows if it's installed. If it isn't, Rivet downloads its own copy of Git (with Git LFS and Git Credential Manager) the first time it starts; nothing else needs installing.

## What Rivet does

- **Two modes, two languages.** Simple mode (the default) speaks plainly and hides Git: you see what changed, "Save version", and one button that says what syncing will do. Full mode has every tool: staging single hunks, branches, history operations. Russian and English.
- **Previews instead of raw text** for what artists change: images side by side, as a swipe or an overlay (PNG, JPG, TGA, PSD); FBX, OBJ and glTF models in 3D with their animations; Unity materials as property changes with color swatches and textures; scenes and prefabs as a readable list of object changes; `.meta` files as the import settings that changed. Text files show a normal diff.
- **Unity-aware**: `.meta` files travel with their assets, Unity Smart Merge is one click away, and projects listed in Unity Hub or SourceGit can be added with one click.
- **Changes**: tick files or single hunks, or nothing to save everything. Put changes aside and bring them back later.
- **History** with a commit graph. Undo the last save if it hasn't been sent yet, put any file back to an older version, and see every version of one file.
- **Branches**: switch from the top bar, including branches that so far exist only on the server.
- **Sync** that says what will happen, and teammates' new work noticed in the background.
- **Merge conflicts** explained file by file: keep yours or take the server's, with previews of both.
- **Git LFS** for large art files, set up with one button, and a warning before a file GitHub would refuse.
- **GitHub sign-in** with a short code, then clone your repositories from a list.
- **Plain-language errors** with a suggested fix, and "Copy error report" in Settings to send to the developer.
- **Interface size** (Normal, Large, Larger, or Ctrl + = / Ctrl + − / Ctrl + 0), light and dark themes, and Rivet's own window frame with Windows 11 snap layouts. Rivet reopens where you left it, and starting it again brings the open window forward.

## Development

```sh
npm install
npm run dev            # browser demo with sample repositories at http://127.0.0.1:5173
npm run desktop        # desktop app with hot reload (the first start compiles Rust, a few minutes)
npm test               # unit tests, plus integration tests against real git repositories
npm run build          # type check + production web build
npm run format         # Prettier
```

The desktop app needs Rust (stable, MSVC) and the Visual Studio C++ build tools.

Rivet is Tauri 2 with React, TypeScript and Vite. The UI never runs Git itself: it reads a `RepoSnapshot` from a `GitBackend` (`src/git/backend.ts`) and calls its methods. In the desktop app that is `CliBackend` (`src/git/cli/`), which runs the git command line through the Rust shell (`src-tauri/`); the browser demo uses `MockBackend` (`src/git/mock/`) with sample data.

```
src/
  git/          Domain model; CliBackend (git CLI) and MockBackend (demo)
  views/        Changes, History, Branches
  diff/         Diffs and the file browser for commits
  preview/      Image, model, material and scene previews
  unity/        Unity YAML parsing, scene and material diffs
  dialogs/      Operations (operations.ts), settings
  chrome/       Top bar, window frame, navigation
  setup/        Clone / open / create
  onboarding/   Git check and download, name and email
  errors/       Plain-language errors, error log, crash screen
  github/       GitHub sign-in and repository list
  i18n/         Russian and English texts
src-tauri/      Rust: runs git, reads files, finds repositories, keeps the GitHub token and the log
```

The browser demo can show screens that are hard to reach on purpose; add switches to its address: `?git=missing`, `?git=old`, `?git=offline`, `?lfs=missing`, `?identity=empty`, `?crash`, or `?fail=<id>` with an id from `src/errors/samples.ts` (for example `?fail=offline`).

### Releasing

```sh
npm run release -- 0.2.0 "What's new: …"
```

This bumps the version, commits, tags `v0.2.0` with the notes (in English) and pushes; GitHub Actions builds the installer and publishes the release that installed copies update from. The workflow signs updates with the `TAURI_SIGNING_PRIVATE_KEY` repository secret; installed copies only trust that key, so keep `%USERPROFILE%\.tauri\rivet-updater.key` safe.
