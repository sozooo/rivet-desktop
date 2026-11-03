# Releasing Rivet

For maintainers. One command publishes a version:

```sh
npm run release -- 0.3.0 notes.md
```

`notes.md` holds the release notes, in English (a short note can be given in quotes instead of a file). npm runs scripts through cmd.exe on Windows, which drops everything after a line break in an argument, so notes with several lines need the file.

The script sets the version in `package.json`, `src-tauri/tauri.conf.json` and `Cargo.toml`, commits, tags `v0.3.0` with the notes and pushes. GitHub Actions (`.github/workflows/release.yml`) then builds the installer and publishes the release with `latest.json`, which installed copies of Rivet update from. The notes become the release text and, in full mode, the "What's new" of the update dialog.

The workflow signs updates with the `TAURI_SIGNING_PRIVATE_KEY` repository secret. Installed copies only trust that key, so keep `%USERPROFILE%\.tauri\rivet-updater.key` safe: if it is lost, they can no longer update and have to be reinstalled by hand once.

Building the installer locally signs the update files too, so it needs the key in the environment. In PowerShell:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$env:USERPROFILE\.tauri\rivet-updater.key" -Raw; npm run desktop:build
```
