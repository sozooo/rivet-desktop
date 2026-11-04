//! The folder a clone goes into. Rivet makes it itself, so that when the clone
//! fails or is cancelled before git finishes, it can remove exactly what it
//! made, and never a folder that was there before.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};
use std::time::Duration;

/// Clone destinations Rivet created, with the outermost folder it had to make
/// for each (the destination itself, or a parent that didn't exist either).
static CREATED: LazyLock<Mutex<HashMap<PathBuf, PathBuf>>> = LazyLock::new(Default::default);

fn created() -> std::sync::MutexGuard<'static, HashMap<PathBuf, PathBuf>> {
    CREATED.lock().unwrap_or_else(|e| e.into_inner())
}

/// Makes the destination folder for a clone. Returns false when it already
/// existed: then it isn't Rivet's to remove.
#[tauri::command]
pub fn clone_folder_create(path: String) -> Result<bool, String> {
    create(Path::new(&path))
}

/// The clone is over. `discard`: git never finished, so the folder Rivet made
/// goes away again. Either way Rivet forgets that it made it.
#[tauri::command]
pub async fn clone_folder_finish(path: String, discard: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || finish(Path::new(&path), discard))
        .await
        .map_err(|e| e.to_string())?
}

fn create(path: &Path) -> Result<bool, String> {
    let path = std::path::absolute(path).map_err(|e| e.to_string())?;
    if path.exists() {
        created().remove(&path);
        return Ok(false);
    }
    let outermost = path
        .ancestors()
        .take_while(|folder| !folder.exists())
        .last()
        .unwrap_or(&path)
        .to_path_buf();
    std::fs::create_dir_all(&path)
        .map_err(|e| format!("Could not create {}: {e}", path.display()))?;
    created().insert(path, outermost);
    Ok(true)
}

fn finish(path: &Path, discard: bool) -> Result<(), String> {
    let path = std::path::absolute(path).map_err(|e| e.to_string())?;
    let Some(outermost) = created().remove(&path) else {
        return Ok(());
    };
    if !discard {
        return Ok(());
    }
    // Antivirus or the search indexer may still be reading a file just written.
    let mut attempt = 0;
    loop {
        match std::fs::remove_dir_all(&outermost) {
            Ok(()) => return Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(_) if attempt < 10 => {
                attempt += 1;
                std::thread::sleep(Duration::from_millis(200));
            }
            Err(e) => return Err(format!("Could not remove {}: {e}", outermost.display())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn scratch(name: &str) -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("rivet-clone-folder-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn removes_only_the_folders_it_made() {
        let root = scratch("made");
        let destination = root.join("Projects").join("Kinetic");
        assert!(create(&destination).unwrap());
        fs::create_dir_all(destination.join(".git")).unwrap();
        fs::write(
            destination.join(".git").join("HEAD"),
            "ref: refs/heads/main\n",
        )
        .unwrap();
        finish(&destination, true).unwrap();
        // "Projects" didn't exist either, so it goes too; the folder above stays.
        assert!(!root.join("Projects").exists());
        assert!(root.is_dir());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn leaves_a_folder_that_was_there_before() {
        let root = scratch("existing");
        let destination = root.join("Kinetic");
        fs::create_dir_all(&destination).unwrap();
        assert!(!create(&destination).unwrap());
        fs::write(destination.join("partial"), "data").unwrap();
        finish(&destination, true).unwrap();
        assert!(destination.join("partial").is_file());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn keeps_a_finished_clone_and_forgets_it() {
        let root = scratch("kept");
        let destination = root.join("Kinetic");
        assert!(create(&destination).unwrap());
        finish(&destination, false).unwrap();
        // A later failure in the same folder doesn't remove the finished clone.
        finish(&destination, true).unwrap();
        assert!(destination.is_dir());
        fs::remove_dir_all(root).unwrap();
    }
}
