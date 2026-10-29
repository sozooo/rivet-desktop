mod art;
mod account;
mod discover;
mod git;

use std::path::PathBuf;
use std::time::UNIX_EPOCH;
use tauri::ipc::Response;

/// Runs git and returns its exit code with text output. Failures are data, not errors,
/// so the frontend can show git's own message. `background` runs never ask for passwords.
#[tauri::command]
async fn git_text(
    cwd: String,
    args: Vec<String>,
    stdin: Option<String>,
    background: Option<bool>,
) -> Result<git::TextOutput, String> {
    let background = background.unwrap_or(false);
    tauri::async_runtime::spawn_blocking(move || git::run_with(&cwd, &args, stdin, background))
        .await
        .map_err(|e| e.to_string())?
        .map(git::TextOutput::from)
}

/// Runs git and returns raw stdout bytes (file contents); a non-zero exit is an error.
#[tauri::command]
async fn git_bytes(cwd: String, args: Vec<String>) -> Result<Response, String> {
    let output = tauri::async_runtime::spawn_blocking(move || git::run(&cwd, &args, None))
        .await
        .map_err(|e| e.to_string())??;
    if output.code != 0 {
        return Err(output.stderr);
    }
    Ok(Response::new(output.stdout))
}

/// Reads a file inside a repository's working tree. Paths that leave the repository are refused.
#[tauri::command]
async fn read_worktree_file(root: String, path: String) -> Result<Response, String> {
    let root = PathBuf::from(root)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let file = root
        .join(path)
        .canonicalize()
        .map_err(|_| "not-found".to_string())?;
    if !file.starts_with(&root) {
        return Err("The path is outside the repository.".into());
    }
    std::fs::read(file)
        .map(Response::new)
        .map_err(|_| "not-found".into())
}

/// Last modification time in milliseconds, or None when the file does not exist.
#[tauri::command]
fn modified_time(path: String) -> Option<u64> {
    let modified = std::fs::metadata(path).ok()?.modified().ok()?;
    Some(modified.duration_since(UNIX_EPOCH).ok()?.as_millis() as u64)
}

#[tauri::command]
async fn discover_repositories() -> Vec<discover::FoundRepository> {
    tauri::async_runtime::spawn_blocking(discover::find)
        .await
        .unwrap_or_default()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            git_text,
            git_bytes,
            read_worktree_file,
            modified_time,
            discover_repositories,
            art::file_sizes,
            art::write_worktree_file,
            art::unity_merge_tools,
            account::github_account_save,
            account::github_account_load,
            account::github_account_forget
        ])
        .run(tauri::generate_context!())
        .expect("error while running Rivet");
}
