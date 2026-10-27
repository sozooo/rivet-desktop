# Rivet

A Git client for two kinds of people: someone who has never used Git and just wants to save and share their work, and a developer who wants a fast replacement for SourceGit. Built with React, TypeScript, Vite and Lucide icons.

Right now Rivet runs in the browser against an in-memory demo repository. Nothing is read from or written to disk.

## Run

```sh
npm install
npm run dev     # http://127.0.0.1:5173
npm test        # unit tests (Vitest)
npm run build   # type check + production build
npm run format  # Prettier
```

## How it works

```
src/
  git/            Domain model and everything Git-shaped
    types.ts      FileChange, Hunk, Commit, StashEntry, RepoSnapshot…
    backend.ts    GitBackend: the interface the UI talks to
    graph.ts      Lane layout for the commit graph
    mock/         MockBackend + sample fixtures (the current backend)
  views/          Changes, History, Branches — each owns its sidebar and main area
  diff/           Diff rendering, side-by-side alignment, file browser for commits
  dialogs/        Operation table (operations.ts) and its dialog, settings, PRs
  setup/          Clone / Add existing / Create screen
  chrome/         Top bar, navigation rail, status bar
  ui/             Shared pieces: checkbox, icons, toast, hooks, panes
  platform.ts     OS services (folder picker, repository discovery) — demo data for now
```

The UI never touches Git directly. It reads a `RepoSnapshot` from a `GitBackend` and calls its methods; the workspace refreshes the snapshot after every change. A desktop build will provide a second `GitBackend` that runs the `git` CLI, and a real `Platform`.

Git operations shown in dialogs (switch, pull, push, discard, merge…) are described once in `dialogs/operations.ts`: title, explanation, the equivalent Git command, and what to run. Merge, rebase, checkout, cherry-pick and revert are preview-only for now.

## What you can do in the demo

- **Changes**: one list with checkboxes. Nothing ticked means the commit takes every change; tick files, or individual hunks in the diff, to commit only those. A file with some hunks ticked shows a dash. Commit with Ctrl+Enter. The message draft is kept per repository across reloads.
- **Stash** from the Changes list ("Stash all"); stashes appear at the bottom of the list, where you can view, restore or delete them.
- **History** with a computed commit graph, commit details and a searchable file browser.
- **Branches**: switch, create, and preview merge or rebase.
- **Pull / Push** with an explanation of what happens; pulling onto unpublished commits creates a merge commit.
- **Repositories**: clone, add existing (with a Browse button and repositories found on this computer), create, and remove from the list.
- Light, dark or system theme; sidebar width, diff layout and other preferences persist.
