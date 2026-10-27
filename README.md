# Rivet

Interactive desktop-oriented Git GUI prototype, built with React, TypeScript, Vite and Lucide icons. The visual reference informs spacing and restraint; the workflow uses ordinary Git staging and a single current branch.

## Run

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. `npm run build` performs TypeScript checking and produces `dist/`; `npm run preview` serves the production build.

## Try the main workflow

1. Select PlayerController.cs in Changes.
2. Stage one hunk. The file appears in both lists because it is partially staged.
3. Select its staged entry and unstage the hunk, or use the file controls and Stage all / Unstage all.
4. Enter a commit title and optional description. Collapse and expand the composer; the draft is retained.
5. Commit the staged files. Only staged hunks are removed from Changes. History contains the new commit, its description, and its exact staged file snapshot.
6. Inspect History, Branches, and Stashes using the rail. Switch themes with the moon/sun control. Drag the sidebar divider to resize it, or collapse it.

The diff includes unified and aligned side-by-side layouts, syntax and changed-fragment highlighting, correct line counters, horizontal scrolling and whitespace visibility.

## Scope

This is a browser-rendered application shell, not a packaged Electron/Tauri application. Repository entries persist in browser localStorage. Working changes, commit drafts and other session state stay separate for each repository and survive switching; reloading resets this working state. There is no Git process execution, filesystem access, hosting integration, AI, virtual branch model, or automatic stash.

File/hunk staging, commits, branch creation and switching, push counters and stash removal have local demo state. Merge, rebase, checkout, cherry-pick, revert and stash application demonstrate explicit operation previews only. They do not simulate a full Git object database or merge engine. Existing history, branch relationships and stash contents are representative fixtures. Repository selection loads another demo fixture, not a real local folder.

Typography uses DM Sans and IBM Plex Mono from Google Fonts, with local system-font fallbacks.

## Repository setup

The repository menu includes Add existing, Create and Clone. Each opens a dedicated two-column setup screen with a form and an original SVG illustration. Enter a folder path, or a URL and destination for cloning. Invalid clone URLs and duplicate locations are rejected. Submitting saves a browser-only repository entry and switches into it. Create starts with an empty working tree, no commits or stashes, and the main branch. Add and Clone use sample contents; no real files are inspected, created or downloaded.

The collapsed-sidebar control stays next to the navigation rail. History reserves fixed text and graph columns, with connected merge lanes. The branch comparison diagram uses shared SVG coordinates so the offshoot starts at a commit node.

## Reviewing larger commits and synchronization

History and Stashes now use a vertical changed-file browser beside the diff, with independent scrolling. Files are grouped by folder and searchable by full path. Resize the divider or collapse the file browser to expand the diff. The camera/input and gamepad history fixtures each contain 14 files, including controller profiles and input settings.

Repository setup reserves fixed layout slots, keeping Clone / Add existing / Create new and the action row stationary. View changes fade out and in, repository menus animate into place, and selected navigation icons have a small press response. The enabled Commit button has a subdued 7.5-second sheen. Reduced-motion preferences disable these effects.

Fetch lives beside the current upstream branch. A plain-language status reports incoming commits, unpublished commits, or “You're up to date.” Pull and Push update the simulated counters; Pull shows its explicit merge command before confirmation. Pull requests opens three separate sample proposals with authors, source/target branches, review state, checks and changed-file counts. These requests are fixtures, not live hosting data.

## Verification

Production build and TypeScript checks pass. Browser verification covers hunk staging and unstaging, file staging, commit title/description, collapsed composer submission, history snapshots, unified/split diffs, theme switching, sidebar collapse, stash operation preview cancellation, and 1280×720 / 1440×900 layouts. Browser console has no errors during this workflow.

Additional browser checks cover searching a 14-file commit, selecting its diff, independent scroll dimensions, stationary repository tabs and actions, Pull → Push synchronization, the Pull command preview, sample pull request details, and the enabled Commit animation.
