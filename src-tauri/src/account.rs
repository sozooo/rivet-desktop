//! The GitHub account Rivet is signed in with. The token is kept only in the OS keychain
//! (Windows Credential Manager) and handed to git's credential helper (Git Credential Manager),
//! so HTTPS clone, pull and push use it too. It is never logged or written to a file.

use serde::{Deserialize, Serialize};

const SERVICE: &str = "app.rivet.desktop";
const ENTRY: &str = "github";

#[derive(Serialize, Deserialize)]
pub struct Account {
    login: String,
    token: String,
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ENTRY).map_err(|e| e.to_string())
}

fn load() -> Result<Option<Account>, String> {
    match entry()?.get_password() {
        Ok(secret) => Ok(serde_json::from_str(&secret).ok()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Runs `git credential approve` or `reject` for github.com with this account.
fn git_credential(action: &str, account: &Account) -> Result<(), String> {
    // A line break would let a value smuggle extra fields into git's credential protocol.
    if [&account.login, &account.token]
        .iter()
        .any(|value| value.is_empty() || value.contains(['\n', '\r', '\0']))
    {
        return Err("The GitHub account details are malformed.".into());
    }
    let input = format!(
        "protocol=https\nhost=github.com\nusername={}\npassword={}\n\n",
        account.login, account.token
    );
    let output = crate::git::run(".", &["credential".into(), action.into()], Some(input))?;
    if output.code != 0 {
        return Err(output.stderr.trim().to_string());
    }
    Ok(())
}

async fn blocking<T: Send + 'static>(
    task: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|e| e.to_string())?
}

/// Remembers a new sign-in: git first, so a failure leaves nothing half-saved.
#[tauri::command]
pub async fn github_account_save(login: String, token: String) -> Result<(), String> {
    blocking(move || {
        let account = Account { login, token };
        git_credential("approve", &account)?;
        let secret = serde_json::to_string(&account).map_err(|e| e.to_string())?;
        entry()?.set_password(&secret).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn github_account_load() -> Result<Option<Account>, String> {
    blocking(load).await
}

/// Signs out: removes the token from git's credential helper and from the keychain.
#[tauri::command]
pub async fn github_account_forget() -> Result<(), String> {
    blocking(|| {
        let Some(account) = load()? else {
            return Ok(());
        };
        // Only this login's credential, and only while it still holds this token.
        let git = git_credential("reject", &account);
        match entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => git,
            Err(e) => Err(e.to_string()),
        }
    })
    .await
}
