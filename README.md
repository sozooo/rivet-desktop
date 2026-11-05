# Rivet

A Git client for Unity teams with two kinds of people in them: someone who has never used Git and just wants to save and share their work, and a developer who wants a fast, clear replacement for tools like SourceGit.

## Download

Get the latest `Rivet_x.y.z_x64-setup.exe` from [Releases](https://github.com/sozooo/rivet-desktop/releases/latest) and run it. It installs for your Windows user only, without administrator rights. The installer isn't code-signed yet, so Windows may say "Windows protected your PC": choose **More info → Run anyway**.

Rivet updates itself: when a new version is out, it offers to install it.

Rivet uses Git for Windows if it's installed. If it isn't, Rivet downloads its own copy of Git (with Git LFS and Git Credential Manager) the first time it starts; nothing else needs installing.

## What Rivet does

- **Two modes, two languages.** Simple mode (the default) speaks plainly and hides Git: you see what changed, "Save version", and one button that says what syncing will do. Full mode has every tool: staging single hunks, branches, history operations. Russian and English.
- **Previews instead of raw text** for what artists change: images side by side, as a swipe or an overlay (PNG, JPG, TGA, PSD); FBX, OBJ and glTF models in 3D with their animations; Unity materials as property changes with color swatches and textures; scenes and prefabs as a readable list of object changes; `.meta` files as the import settings that changed. Text files show a normal diff.
- **Unity-aware**: `.meta` files travel with their assets, Unity Smart Merge is one click away, and projects listed in Unity Hub or SourceGit can be added with one click. A repository Rivet creates for a Unity project gets Unity's `.gitignore`, and folders Unity makes for itself (`Library`, `Temp`, `Logs`…) never end up in a version: Rivet leaves them out and offers to fix the `.gitignore`, or to stop tracking them if they were committed before.
- **Changes**: tick files or single hunks, or nothing to save everything. Put changes aside and bring them back later, and open any file's folder in Explorer.
- **History** with a commit graph. Undo the last save if it hasn't been sent yet, put any file back to an older version, and see every version of one file.
- **Branches**: switch from the top bar, including branches that so far exist only on the server.
- **Who works where**: faces in the top bar show who saved versions on your branch in the last 14 days and how many work on others; a click lists every active branch with its people and switches to one. Git has no presence, so this comes from commits (a feature branch counts what main lacks). Signed in to GitHub, faces are people's GitHub pictures; otherwise initials in a colour of their own.
- **Sync** that says what will happen and how far it got (big art files counted in megabytes, also when cloning), and teammates' new work noticed in the background. Downloads and sending can be cancelled while that is safe (not once a pull is merging), and nothing is lost.
- **Cloning that never leaves a mess**: a clone cancelled or failed half-way removes the folder it made, and when only the art download broke, the project opens anyway and "Download the rest" picks up where it stopped.
- **Open in Unity or Blender**: before Rivet brings in or puts back files, it checks whether Unity has the project open or Blender has one of those `.blend` files open, and says to save (and close Blender) first, so the next Ctrl+S doesn't save the old version over the new one. Unity is open when it holds `Temp/UnityLockfile`; Blender's open file comes from its window title.
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
  openApps/     Asking first when Unity or Blender has files open that an action rewrites
  i18n/         Russian and English texts
src-tauri/      Rust: runs git, reads files, finds repositories, keeps the GitHub token and the log
```

The browser demo can show screens that are hard to reach on purpose; add switches to its address: `?git=missing`, `?git=old`, `?git=offline`, `?lfs=missing`, `?identity=empty`, `?crash`, or `?fail=<id>` with an id from `src/errors/samples.ts` (for example `?fail=offline`). `?gitignore=missing` shows a sample project whose Unity folders aren't ignored, and `?gitignore=committed` one that committed them. `?open=unity,blender` (or just one of them) pretends Unity has the project open and Blender has `Art/Tree.blend` open with unsaved changes, so syncing, switching branches or discarding a scene asks to save first.

Unity's `.gitignore` is GitHub's template, vendored in `src/unity/Unity.gitignore` (its header names the commit) with a few Rivet additions at the end.

To watch transfers and their progress against scratch repositories, `node src/git/cli/lfsTestServer.ts 8899 2000000` runs a small Git LFS server that sends about 2 MB a second; point a repository at it with `.lfsconfig` (`[lfs] url = http://127.0.0.1:8899/`). git-lfs reports no progress for a plain folder remote, so the tests use this server too. `node src/git/cli/gitHttpTestServer.ts 8898 D:\scratch\remotes 1500000` serves the bare repositories in a folder over smart HTTP at about 1.5 MB a second (`http://127.0.0.1:8898/name.git`, which the setup screen accepts), so clones, fetches and pushes take long enough to cancel; the cancelling tests use it.

Publishing a version is described in [docs/releasing.md](docs/releasing.md).
