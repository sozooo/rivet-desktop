# Rivet

A Git client for two kinds of people: someone who has never used Git and just wants to save and share their work, and a developer who wants a fast replacement for SourceGit. Built with Tauri 2, React, TypeScript, Vite and Lucide icons.

Rivet runs two ways:

- **Desktop app** (Tauri): works with real repositories through the `git` command-line tool. Needs [Git for Windows](https://git-scm.com/download/win); Git Credential Manager, which ships with it, handles sign-in to other hosts. GitHub has its own sign-in in Rivet (see «Вход через GitHub» below).
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
  github/         GitHub sign-in (Device Flow), the repository list, the client ID (config.ts)
  platform.ts     OS services: folder picker, repository discovery, clone and init
src-tauri/        The desktop shell (Rust): runs git, reads files, finds repositories, keeps the GitHub token
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
- **Branches**: switch, create, and see how far a branch is from main.
- **Fetch / Pull / Push** with an explanation of what happens; pulling onto unpublished commits creates a merge commit, never a rebase.
- **Merge conflicts**: when a pull (or Sync) stops on conflicts, the Changes view lists the conflicted files first under a banner that says what happened, how many files are left, and offers Cancel merge / Finish. Each file offers "Keep my version" or "Take the server version" (or keeping a deletion) above previews of both sides, read from the index stages; full mode can also mark a hand-edited text file resolved. Choices survive a restart: Rivet reads them back from git. A rebase, cherry-pick or revert started elsewhere shows the same screen and can be aborted or continued.
- **Unity Smart Merge**: one click (in the conflict banner or Settings) finds `UnityYAMLMerge.exe` in the Unity editors Unity Hub knows, sets it up as a local merge driver, and adds `.gitattributes` lines for scenes, prefabs, assets, materials, animations and controllers, so pulls merge changes to different objects by themselves.
- **Git LFS**: a hint when changed art (textures, PSDs, models, audio, video, anything over 50 MB) would go in as regular files, with one button that runs `git lfs install --local` and tracks the Unity art set; a hard warning before committing or pushing files over GitHub's 100 MB limit; "Download LFS files" on previews of files that are only pointers; and a plain explanation when git-lfs is missing.
- **GitHub sign-in**: «Войти через GitHub» on the Clone tab or in Settings. Once signed in, Clone shows your repositories (yours, shared with you and your organisations') with search, so there are no links to copy. The token stays in Windows Credential Manager and is handed to Git Credential Manager, so pull and push work without extra prompts.
- **Repositories**: clone, add existing (Browse, or one click on a repository found in Unity Hub or SourceGit), create, and remove from the list. Adding a subfolder of a repository adds the whole repository.
- **Previews instead of raw text** for what artists change: images side by side, as a swipe or an overlay (PNG, JPG, TGA, PSD); FBX/OBJ/glTF models in a 3D view with synced cameras, mesh statistics and playable animation clips (animation files without a mesh show their skeleton); Unity materials as property changes with color swatches, texture thumbnails (found through their GUIDs) and an approximate sphere; scenes and prefabs as a readable list of object changes (added, removed, moved, component values, prefab overrides, scene settings); `.meta` files as the import settings that changed, under the Inspector names. Files in Git LFS are read from the local LFS store; ones not downloaded yet say so. Full mode can switch any of these back to the text diff.
- **Simple and full modes**, Russian and English. Simple mode (the default) speaks plainly and hides Git machinery: one Sync button, "Save version", no branches. Unity `.meta` files travel with their assets in both modes.
- Light, dark or system theme; sidebar width, diff layout and other preferences persist.

## Вход через GitHub

Rivet входит в GitHub через OAuth Device Flow: приложение показывает короткий код, вы вводите его на github.com, и всё. Секретный ключ приложения (client secret) не нужен. Токен хранится только в Диспетчере учётных данных Windows и передаётся Git Credential Manager, поэтому clone, pull и push по HTTPS проходят без лишних окон. «Выйти» в настройках удаляет его из обоих мест.

Чтобы вход заработал, один раз зарегистрируйте своё OAuth-приложение на GitHub:

1. Откройте https://github.com/settings/applications/new (для организации: настройки организации → Developer settings → OAuth Apps → New OAuth App).
2. Заполните поля:
   - **Application name**: `Rivet`;
   - **Homepage URL**: любой адрес, например `https://github.com/<ваш-логин>`;
   - **Authorization callback URL**: тот же адрес. Device Flow его не использует, но поле обязательное.
3. Нажмите **Register application**.
4. На странице приложения отметьте **Enable Device Flow** и нажмите **Update application**.
5. Скопируйте **Client ID** (вида `Ov23li…`). Client secret создавать не нужно.
6. Вставьте Client ID в `src/github/config.ts` вместо `YOUR_CLIENT_ID` и пересоберите приложение (`npm run desktop` или `npm run desktop:build`).

Client ID не секрет: он всё равно виден внутри собранного приложения, его можно коммитить. А client secret в репозиторий попадать не должен, и Rivet он не нужен.

Пока Client ID не указан, настольная версия не показывает кнопку входа; в полном режиме в настройках есть подсказка.

Если репозиториев организации нет в списке, значит организация ограничила доступ сторонним OAuth-приложениям. Владелец организации может одобрить Rivet в настройках организации: Third-party Access → OAuth application policy. Отозвать доступ Rivet к своему аккаунту можно на https://github.com/settings/applications.

В браузерной демо-версии (`npm run dev`) вход ненастоящий: демо-аккаунт и примерный список репозиториев.
