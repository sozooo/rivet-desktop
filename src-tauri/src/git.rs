use serde::Serialize;
use std::io::Write;
use std::process::{Command, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
/// Keeps Windows from flashing a console window for every git call.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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

pub fn run(cwd: &str, args: &[String], stdin: Option<String>) -> Result<Output, String> {
    let mut command = Command::new("git");
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
