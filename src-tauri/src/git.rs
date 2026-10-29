use serde::Serialize;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::time::Instant;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
/// Keeps Windows from flashing a console window for every git call.
#[cfg(windows)]
pub(crate) const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub struct Output {
    pub code: i32,
    pub stdout: Vec<u8>,
    pub stderr: String,
}

#[derive(Serialize)]
pub struct TextOutput {
    code: i32,
    stdout: String,
    stderr: String,
}

impl From<Output> for TextOutput {
    fn from(output: Output) -> Self {
        TextOutput {
            code: output.code,
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: output.stderr,
        }
    }
}

/// Runs git and writes the command, its exit code and its errors to the log.
pub fn run(cwd: &str, args: &[String], stdin: Option<String>) -> Result<Output, String> {
    run_with(cwd, args, stdin, false)
}

/// `background`: nobody is watching, so git must fail rather than ask for a password
/// in any window, including Git Credential Manager's and askpass programs.
pub fn run_with(
    cwd: &str,
    args: &[String],
    stdin: Option<String>,
    background: bool,
) -> Result<Output, String> {
    let started = Instant::now();
    let result = spawn(cwd, args, stdin, background);
    crate::applog::git(cwd, args, &result, started.elapsed());
    result
}

/// Git on PATH, or where Git for Windows installs: PATH changes from an install made
/// while Rivet runs only reach programs started later, and "Check again" must see it.
fn program() -> PathBuf {
    static FOUND: OnceLock<PathBuf> = OnceLock::new();
    if let Some(found) = FOUND.get() {
        return found.clone();
    }
    let exe = if cfg!(windows) { "git.exe" } else { "git" };
    let on_path = std::env::var_os("PATH")
        .is_some_and(|path| std::env::split_paths(&path).any(|dir| dir.join(exe).is_file()));
    let installed = || {
        [
            ("ProgramW6432", r"Git\cmd\git.exe"),
            ("ProgramFiles", r"Git\cmd\git.exe"),
            ("LOCALAPPDATA", r"Programs\Git\cmd\git.exe"),
        ]
        .iter()
        .filter_map(|(base, path)| Some(PathBuf::from(std::env::var_os(base)?).join(path)))
        .find(|path| path.is_file())
    };
    match on_path.then(|| PathBuf::from("git")).or_else(installed) {
        Some(found) => FOUND.get_or_init(|| found).clone(),
        None => PathBuf::from("git"),
    }
}

fn spawn(
    cwd: &str,
    args: &[String],
    stdin: Option<String>,
    background: bool,
) -> Result<Output, String> {
    // Windows reports a missing working folder like a missing program.
    if !Path::new(cwd).is_dir() {
        return Err(format!(
            "Could not start git in {cwd}: the folder does not exist."
        ));
    }
    let mut command = Command::new(program());
    command
        .current_dir(cwd)
        .args(["-c", "core.quotepath=false", "-c", "color.ui=false"])
        .args(args)
        // Never wait on a terminal prompt nobody can see; credential managers use their own windows.
        .env("GIT_TERMINAL_PROMPT", "0")
        // Read-only commands must not fight Unity or other tools over index.lock.
        .env("GIT_OPTIONAL_LOCKS", "0")
        .stdin(if stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if background {
        // An empty GIT_ASKPASS also overrides core.askPass and SSH_ASKPASS.
        command
            .env("GIT_ASKPASS", "")
            .env("SSH_ASKPASS_REQUIRE", "never")
            .env("GCM_INTERACTIVE", "never");
    }
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    let mut child = command.spawn().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "Git is not installed or not on PATH. Install Git for Windows and restart Rivet.".into()
        } else {
            format!("Could not start git in {cwd}: {e}")
        }
    })?;
    // Write stdin on its own thread so a large output can't deadlock against it.
    let writer = stdin.map(|input| {
        let mut pipe = child.stdin.take().expect("stdin is piped");
        std::thread::spawn(move || pipe.write_all(input.as_bytes()))
    });
    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    if let Some(writer) = writer {
        let _ = writer.join();
    }
    Ok(Output {
        code: output.status.code().unwrap_or(-1),
        stdout: output.stdout,
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}
