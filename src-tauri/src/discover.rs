//! Finds repositories the user already works with: projects from Unity Hub and
//! repositories from SourceGit.

use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FoundRepository {
    name: String,
    path: String,
    source: &'static str,
    branch: String,
    unity: Option<String>,
}

pub fn find() -> Vec<FoundRepository> {
    let Ok(app_data) = std::env::var("APPDATA") else {
        return Vec::new();
    };
    let app_data = PathBuf::from(app_data);
    let mut found = Vec::new();
    let mut seen = HashSet::new();
    let mut add = |path: &Path, source: &'static str, unity: Option<String>| {
        let Some(root) = repository_root(path) else {
            return;
        };
        if !seen.insert(root.to_string_lossy().to_lowercase()) {
            return;
        }
        found.push(FoundRepository {
            name: root
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default(),
            branch: current_branch(&root).unwrap_or_default(),
            unity: unity.or_else(|| unity_version(&root)),
            path: root.to_string_lossy().into_owned(),
            source,
        });
    };

    for (path, version) in unity_hub_projects(&app_data) {
        add(&path, "Unity Hub", version);
    }
    for path in sourcegit_repositories(&app_data) {
        add(&path, "SourceGit", None);
    }
    found
}

fn read_json(path: &Path) -> Option<Value> {
    let text = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(text.trim_start_matches('\u{feff}')).ok()
}

/// Unity Hub keeps its project list in projects-v1.json, newest first by lastModified.
fn unity_hub_projects(app_data: &Path) -> Vec<(PathBuf, Option<String>)> {
    let Some(json) = read_json(&app_data.join("UnityHub").join("projects-v1.json")) else {
        return Vec::new();
    };
    let Some(data) = json.get("data").and_then(Value::as_object) else {
        return Vec::new();
    };
    let mut projects: Vec<_> = data
        .values()
        .filter_map(|p| {
            let path = p.get("path")?.as_str()?;
            let version = p.get("version").and_then(Value::as_str).map(String::from);
            let modified = p.get("lastModified").and_then(Value::as_f64).unwrap_or(0.0);
            Some((PathBuf::from(path), version, modified))
        })
        .collect();
    projects.sort_by(|a, b| b.2.total_cmp(&a.2));
    projects.into_iter().map(|(p, v, _)| (p, v)).collect()
}

/// SourceGit stores repositories as a tree of nodes in preference.json.
fn sourcegit_repositories(app_data: &Path) -> Vec<PathBuf> {
    fn walk(nodes: &[Value], out: &mut Vec<PathBuf>) {
        for node in nodes {
            if node.get("IsRepository").and_then(Value::as_bool) == Some(true) {
                if let Some(id) = node.get("Id").and_then(Value::as_str) {
                    out.push(PathBuf::from(id));
                }
            }
            if let Some(children) = node.get("SubNodes").and_then(Value::as_array) {
                walk(children, out);
            }
        }
    }
    let mut out = Vec::new();
    if let Some(json) = read_json(&app_data.join("SourceGit").join("preference.json")) {
        if let Some(nodes) = json.get("RepositoryNodes").and_then(Value::as_array) {
            walk(nodes, &mut out);
        }
    }
    out
}

/// The nearest folder at or above `path` that contains `.git`. A Unity project
/// often sits inside a larger repository.
fn repository_root(path: &Path) -> Option<PathBuf> {
    let mut current = Some(path);
    while let Some(dir) = current {
        if dir.join(".git").exists() {
            return Some(dir.to_path_buf());
        }
        current = dir.parent();
    }
    None
}

fn current_branch(root: &Path) -> Option<String> {
    let head = std::fs::read_to_string(root.join(".git").join("HEAD")).ok()?;
    let head = head.trim();
    Some(match head.strip_prefix("ref: refs/heads/") {
        Some(branch) => branch.to_string(),
        None => head.chars().take(7).collect(),
    })
}

fn unity_version(root: &Path) -> Option<String> {
    let text =
        std::fs::read_to_string(root.join("ProjectSettings").join("ProjectVersion.txt")).ok()?;
    text.lines()
        .find_map(|line| line.strip_prefix("m_EditorVersion:"))
        .map(|v| v.trim().to_string())
}
