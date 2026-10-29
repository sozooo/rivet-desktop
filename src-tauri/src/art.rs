//! What art-heavy repositories need beyond running git: file sizes for Git LFS
//! hints, writing .gitattributes, and finding Unity's merge tool.

use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

/// Sizes of working-tree files in bytes; None for ones that don't exist.
#[tauri::command]
pub fn file_sizes(root: String, paths: Vec<String>) -> Vec<Option<u64>> {
    let root = Path::new(&root);
    paths
        .iter()
        .map(|path| std::fs::metadata(root.join(path)).ok().map(|m| m.len()))
        .collect()
}

/// Writes a text file inside a repository's working tree. Paths that leave the repository are refused.
#[tauri::command]
pub fn write_worktree_file(root: String, path: String, text: String) -> Result<(), String> {
    let root = PathBuf::from(root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let file = root.join(&path);
    let folder = file
        .parent()
        .and_then(|p| p.canonicalize().ok())
        .ok_or("The folder does not exist.")?;
    if !folder.starts_with(&root) || path.split(['/', '\\']).any(|part| part == "..") {
        return Err("The path is outside the repository.".into());
    }
    std::fs::write(file, text).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct MergeTool {
    version: String,
    path: String,
}

const TOOL: [&str; 3] = ["Data", "Tools", "UnityYAMLMerge.exe"];

/// UnityYAMLMerge from every Unity editor Unity Hub knows about: its install
/// folder (default or custom) and editors located by hand.
#[tauri::command]
pub async fn unity_merge_tools() -> Vec<MergeTool> {
    tauri::async_runtime::spawn_blocking(find_merge_tools)
        .await
        .unwrap_or_default()
}

fn find_merge_tools() -> Vec<MergeTool> {
    let mut editors: Vec<(String, PathBuf)> = Vec::new();
    let hub = std::env::var("APPDATA")
        .map(|dir| PathBuf::from(dir).join("UnityHub"))
        .ok();
    let mut install_folders = vec![PathBuf::from(r"C:\Program Files\Unity\Hub\Editor")];
    if let Some(custom) = hub
        .as_ref()
        .and_then(|hub| read_json(&hub.join("secondaryInstallPath.json")))
        .and_then(|v| v.as_str().map(PathBuf::from))
        .filter(|p| !p.as_os_str().is_empty())
    {
        install_folders.push(custom);
    }
    // Each version gets its own folder: <folder>\<version>\Editor.
    for folder in install_folders {
        let Ok(entries) = std::fs::read_dir(folder) else {
            continue;
        };
        for entry in entries.flatten() {
            let version = entry.file_name().to_string_lossy().into_owned();
            editors.push((version, entry.path().join("Editor")));
        }
    }
    // Editors added with "Locate": editors-v2.json (Hub 3) or editors.json (older).
    for name in ["editors-v2.json", "editors.json"] {
        let Some(json) = hub.as_ref().and_then(|hub| read_json(&hub.join(name))) else {
            continue;
        };
        let list: Vec<&Value> = match json.get("data") {
            Some(Value::Array(items)) => items.iter().collect(),
            _ => json.as_object().map(|o| o.values().collect()).unwrap_or_default(),
        };
        for editor in list {
            let version = editor.get("version").and_then(Value::as_str).unwrap_or("");
            let location = match editor.get("location") {
                Some(Value::Array(items)) => items.first().and_then(Value::as_str),
                Some(Value::String(path)) => Some(path.as_str()),
                _ => None,
            };
            if let Some(folder) = location.and_then(|exe| Path::new(exe).parent()) {
                editors.push((version.to_string(), folder.to_path_buf()));
            }
        }
    }

    let mut seen = HashSet::new();
    editors
        .into_iter()
        .filter_map(|(version, editor)| {
            let tool = TOOL.iter().fold(editor, |path, part| path.join(part));
            let key = tool.to_string_lossy().to_lowercase();
            (tool.is_file() && seen.insert(key)).then(|| MergeTool {
                version,
                path: tool.to_string_lossy().into_owned(),
            })
        })
        .collect()
}

fn read_json(path: &Path) -> Option<Value> {
    let text = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(text.trim_start_matches('\u{feff}')).ok()
}
