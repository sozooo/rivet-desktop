//! Rivet's own Git, for computers without Git for Windows: MinGit (which comes
//! with Git Credential Manager) plus Git LFS, downloaded once into Rivet's data
//! folder so nobody has to install Git by hand.

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use tauri::ipc::Channel;
use tauri_plugin_http::reqwest;

struct Download {
    url: &'static str,
    sha256: &'static str,
    size: u64,
}

/// Pinned versions, checked against their published SHA-256 before use.
const MINGIT: Download = Download {
    url: "https://github.com/git-for-windows/git/releases/download/v2.56.0.windows.4/MinGit-2.56.0.4-64-bit.zip",
    sha256: "e3bf78351fe777fba47ddee5950082f8a98bb0f02604fdc7ba3ee2cb68ffa877",
    size: 39_846_926,
};
const GIT_LFS: Download = Download {
    url: "https://github.com/git-lfs/git-lfs/releases/download/v3.8.1/git-lfs-windows-amd64-v3.8.1.zip",
    sha256: "5bb771c12b3dacc535e912d0270a010c209d4da2e63819c5918e3547c2defed9",
    size: 5_870_805,
};

/// `%LOCALAPPDATA%\app.rivet.desktop\git`, next to the log folder.
fn dir() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA")
        .map(|base| PathBuf::from(base).join("app.rivet.desktop").join("git"))
}

/// Rivet's own `git.exe`, once it has been downloaded.
pub fn git_exe() -> Option<PathBuf> {
    let exe = dir()?.join("cmd").join("git.exe");
    exe.is_file().then_some(exe)
}

#[derive(Clone, Serialize)]
pub struct Progress {
    received: u64,
    total: u64,
}

/// Downloads, checks and unpacks Rivet's own Git, reporting bytes received.
#[tauri::command]
pub async fn install_git(on_progress: Channel<Progress>) -> Result<(), String> {
    let target = dir().ok_or("LOCALAPPDATA is not set")?;
    let total = MINGIT.size + GIT_LFS.size;
    let mingit = fetch(&MINGIT, 0, total, &on_progress).await?;
    let lfs = fetch(&GIT_LFS, mingit.len() as u64, total, &on_progress).await?;
    let _ = on_progress.send(Progress {
        received: total,
        total,
    });
    tauri::async_runtime::spawn_blocking(move || unpack(&mingit, &lfs, &target))
        .await
        .map_err(|e| e.to_string())?
}

async fn fetch(
    download: &Download,
    offset: u64,
    total: u64,
    progress: &Channel<Progress>,
) -> Result<Vec<u8>, String> {
    let failed = |e: reqwest::Error| format!("Could not download {}: {e}", download.url);
    let mut response = reqwest::get(download.url)
        .await
        .and_then(|r| r.error_for_status())
        .map_err(failed)?;
    let mut bytes = Vec::with_capacity(download.size as usize);
    let mut reported = 0;
    while let Some(chunk) = response.chunk().await.map_err(failed)? {
        bytes.extend_from_slice(&chunk);
        // About every half a megabyte is plenty for a progress bar.
        if bytes.len() - reported >= 512 * 1024 {
            reported = bytes.len();
            let _ = progress.send(Progress {
                received: offset + reported as u64,
                total,
            });
        }
    }
    let digest = format!("{:x}", Sha256::digest(&bytes));
    if digest != download.sha256 {
        return Err(format!(
            "The download of {} was damaged (checksum mismatch). Try again.",
            download.url
        ));
    }
    Ok(bytes)
}

/// Unpacks next to the target and swaps it in, so a failed attempt leaves no half-made Git.
fn unpack(mingit: &[u8], lfs: &[u8], target: &Path) -> Result<(), String> {
    let staging = target.with_extension("new");
    let _ = fs::remove_dir_all(&staging);
    let result = unpack_into(mingit, lfs, &staging).and_then(|()| {
        let _ = fs::remove_dir_all(target);
        fs::rename(&staging, target).map_err(|e| format!("Could not put Git in place: {e}"))
    });
    if result.is_err() {
        let _ = fs::remove_dir_all(&staging);
    }
    result
}

fn unpack_into(mingit: &[u8], lfs: &[u8], staging: &Path) -> Result<(), String> {
    zip::ZipArchive::new(Cursor::new(mingit))
        .and_then(|mut archive| archive.extract(staging))
        .map_err(|e| format!("Could not unpack Git: {e}"))?;

    // git-lfs.exe goes next to git's own programs, where git finds it.
    let bin = ["ucrt64", "mingw64"]
        .iter()
        .map(|prefix| staging.join(prefix).join("bin"))
        .find(|bin| bin.join("git.exe").is_file())
        .ok_or("The Git download has an unexpected layout.")?;
    let mut archive = zip::ZipArchive::new(Cursor::new(lfs)).map_err(|e| e.to_string())?;
    let index = archive
        .file_names_raw()
        .position(|name| name.ends_with(b"git-lfs.exe"))
        .ok_or("The Git LFS download has no git-lfs.exe.")?;
    let mut exe = archive.by_index(index).map_err(|e| e.to_string())?;
    let mut out = fs::File::create(bin.join("git-lfs.exe")).map_err(|e| e.to_string())?;
    std::io::copy(&mut exe, &mut out).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    fn archive(files: &[(&str, &[u8])]) -> Vec<u8> {
        let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
        for (name, content) in files {
            zip.start_file(*name, SimpleFileOptions::default()).unwrap();
            zip.write_all(content).unwrap();
        }
        zip.finish().unwrap().into_inner()
    }

    #[test]
    fn puts_git_lfs_next_to_git_and_replaces_an_older_copy() {
        let root = std::env::temp_dir().join(format!("rivet-private-git-{}", std::process::id()));
        let target = root.join("git");
        fs::create_dir_all(target.join("stale")).unwrap();
        let mingit = archive(&[
            ("cmd/git.exe", b"wrapper"),
            ("ucrt64/bin/git.exe", b"git"),
            ("etc/gitconfig", b"[credential]\n\thelper = manager\n"),
        ]);
        let lfs = archive(&[
            ("git-lfs-3.8.1/git-lfs.exe", b"lfs"),
            ("git-lfs-3.8.1/README.md", b""),
        ]);

        unpack(&mingit, &lfs, &target).unwrap();

        assert_eq!(
            fs::read(target.join("ucrt64/bin/git-lfs.exe")).unwrap(),
            b"lfs"
        );
        assert!(target.join("cmd/git.exe").is_file());
        assert!(!target.join("stale").exists());
        assert!(!target.with_extension("new").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_a_download_without_git() {
        let root =
            std::env::temp_dir().join(format!("rivet-private-git-bad-{}", std::process::id()));
        let target = root.join("git");
        let mingit = archive(&[("README.md", b"not git")]);
        let lfs = archive(&[("git-lfs.exe", b"lfs")]);
        assert!(unpack(&mingit, &lfs, &target).is_err());
        assert!(!target.exists());
        assert!(!target.with_extension("new").exists());
        let _ = fs::remove_dir_all(root);
    }
}
