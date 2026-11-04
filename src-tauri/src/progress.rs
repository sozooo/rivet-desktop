//! Long git commands (clone, fetch, pull, push, LFS downloads) with their
//! progress passed to the UI while they run: git's stderr line by line, and the
//! lines git-lfs appends to the file named by GIT_LFS_PROGRESS, which is the
//! only place it reports transfers when no terminal is watching. The UI parses
//! both (`src/git/progress.ts`).
//!
//! A run started with a cancel id can be stopped with `git_cancel`: git and
//! every program it started end at once, and the run reports `cancelled`
//! rather than an error.

use serde::Serialize;
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{ErrorKind, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant};
use tauri::ipc::Channel;

use crate::git;
use crate::process_tree::Tree;

/// Lines from "git" (stderr) or "lfs" (the progress file).
#[derive(Clone, Serialize)]
pub struct Lines {
    source: &'static str,
    lines: Vec<String>,
}

/// What `git_progress` returns: git's output, or that it was cancelled.
#[derive(Serialize)]
pub struct Finished {
    #[serde(flatten)]
    output: git::TextOutput,
    /// Stopped by `git_cancel` before git finished on its own.
    cancelled: bool,
}

/// Like `git_text`, but sends progress lines while git runs. Callers add
/// `--progress`, since git only reports progress to a terminal otherwise.
/// `cancel_id`: a name, unique to this run, for `git_cancel`.
#[tauri::command]
pub async fn git_progress(
    cwd: String,
    args: Vec<String>,
    background: Option<bool>,
    cancel_id: Option<String>,
    on_progress: Channel<Lines>,
) -> Result<Finished, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let stop = cancel_id.as_deref().map(Stop::register);
        let result = run(
            &cwd,
            &args,
            background.unwrap_or(false),
            stop.as_deref(),
            &|source, lines| {
                let _ = on_progress.send(Lines { source, lines });
            },
        );
        if let Some(id) = &cancel_id {
            Stop::unregister(id);
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
    .map(|(output, cancelled)| Finished {
        output: output.into(),
        cancelled,
    })
}

/// Stops the `git_progress` run with this cancel id, with everything git
/// started. A cancel that arrives before its run has started stops it there.
#[tauri::command]
pub fn git_cancel(id: String) {
    Stop::register(&id).cancel();
}

/// Runs that can be cancelled, by cancel id.
static RUNNING: LazyLock<Mutex<HashMap<String, Arc<Stop>>>> = LazyLock::new(Default::default);

/// A way to stop one run: the cancel request, and the process tree to kill.
#[derive(Default)]
pub struct Stop {
    cancelled: AtomicBool,
    tree: Mutex<Option<Arc<Tree>>>,
}

impl Stop {
    /// The run's entry, made by whichever comes first: the run or its cancel.
    /// (A cancel arriving after its run ended leaves a small entry behind; the
    /// interface stops asking once a run has ended, so that stays rare.)
    fn register(id: &str) -> Arc<Stop> {
        let mut running = RUNNING.lock().unwrap_or_else(|e| e.into_inner());
        running.entry(id.to_string()).or_default().clone()
    }

    fn unregister(id: &str) {
        RUNNING.lock().unwrap_or_else(|e| e.into_inner()).remove(id);
    }

    pub fn cancel(&self) {
        let tree = self.tree.lock().unwrap_or_else(|e| e.into_inner());
        self.cancelled.store(true, Ordering::SeqCst);
        if let Some(tree) = tree.as_ref() {
            tree.kill();
        }
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }

    /// The tree to kill from now on; killed at once if a cancel came first.
    fn attach(&self, tree: Arc<Tree>) {
        let mut slot = self.tree.lock().unwrap_or_else(|e| e.into_inner());
        if self.is_cancelled() {
            tree.kill();
        }
        *slot = Some(tree);
    }
}

type Sink<'a> = &'a (dyn Fn(&'static str, Vec<String>) + Sync);

/// Runs git, passing progress to `send`, and logs it like any other command.
/// Returns its output and whether `stop` cut it short.
pub fn run(
    cwd: &str,
    args: &[String],
    background: bool,
    stop: Option<&Stop>,
    send: Sink,
) -> Result<(git::Output, bool), String> {
    let started = Instant::now();
    let cancelled = || stop.is_some_and(Stop::is_cancelled);
    let result = if cancelled() {
        Ok(cancelled_output())
    } else {
        let log = lfs_log_path();
        let result = stream(cwd, args, background, stop, &log, send);
        let _ = fs::remove_file(&log);
        result
    };
    // git may have finished on its own just before the cancel took effect.
    let stopped = cancelled() && result.as_ref().is_ok_and(|output| output.code != 0);
    let result = result.map(|output| if stopped { cancelled_output() } else { output });
    crate::applog::git(cwd, args, &result, started.elapsed());
    result.map(|output| (output, stopped))
}

fn cancelled_output() -> git::Output {
    git::Output {
        code: -1,
        stdout: Vec::new(),
        stderr: "Cancelled.".into(),
    }
}

/// A fresh file for git-lfs to append to, one per command.
fn lfs_log_path() -> PathBuf {
    static NEXT: AtomicU64 = AtomicU64::new(0);
    let n = NEXT.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!("rivet-lfs-progress-{}-{n}.log", std::process::id()))
}

fn stream(
    cwd: &str,
    args: &[String],
    background: bool,
    stop: Option<&Stop>,
    lfs_log: &Path,
    send: Sink,
) -> Result<git::Output, String> {
    let _ = fs::remove_file(lfs_log);
    let mut command = git::command(cwd, args, background)?;
    command
        .env("GIT_LFS_PROGRESS", lfs_log)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let (mut child, tree) = Tree::spawn(&mut command).map_err(|e| git::start_error(cwd, e))?;
    let tree = Arc::new(tree);
    if let Some(stop) = stop {
        stop.attach(tree.clone());
    }
    let mut stdout = child.stdout.take().expect("stdout is piped");
    let stderr = child.stderr.take().expect("stderr is piped");
    let finished = AtomicBool::new(false);
    std::thread::scope(|scope| {
        let output = scope.spawn(move || {
            let mut bytes = Vec::new();
            let _ = stdout.read_to_end(&mut bytes);
            bytes
        });
        let tail = scope.spawn(|| tail_lfs(lfs_log, &finished, send));
        let errors = read_lines(stderr, |lines| send("git", lines));
        let status = child.wait();
        finished.store(true, Ordering::Release);
        tail.thread().unpark();
        let _ = tail.join();
        let stdout = output.join().unwrap_or_default();
        let status = status.map_err(|e| e.to_string())?;
        // Killed helpers may hold files in the folder for a moment longer,
        // and a cancelled clone's folder is removed next.
        if stop.is_some_and(Stop::is_cancelled) {
            tree.wait_empty(Duration::from_secs(5));
        }
        Ok(git::Output {
            code: status.code().unwrap_or(-1),
            stdout,
            stderr: errors,
        })
    })
}

/// Reads git's stderr to the end, passing lines along as they come. Returns
/// the output without the lines git redrew, which are only progress.
fn read_lines(mut stderr: impl Read, mut send: impl FnMut(Vec<String>)) -> String {
    let mut splitter = Splitter::default();
    let mut buffer = [0u8; 8192];
    loop {
        match stderr.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => {
                let lines = splitter.push(&buffer[..n]);
                if !lines.is_empty() {
                    send(lines);
                }
            }
            Err(e) if e.kind() == ErrorKind::Interrupted => {}
            Err(_) => break,
        }
    }
    splitter.finish()
}

/// Splits output into lines at \n and at \r, after which git redraws a
/// progress line. \r\n is an ordinary line end.
#[derive(Default)]
struct Splitter {
    line: Vec<u8>,
    /// The last line ended with \r: progress, unless a \n follows.
    after_cr: Option<String>,
    kept: String,
}

impl Splitter {
    fn push(&mut self, bytes: &[u8]) -> Vec<String> {
        let mut lines = Vec::new();
        for &byte in bytes {
            if let Some(previous) = self.after_cr.take()
                && byte == b'\n'
            {
                self.keep(&previous);
                continue;
            }
            if byte != b'\n' && byte != b'\r' {
                self.line.push(byte);
                continue;
            }
            // git pads remote lines with spaces to cover what was there before.
            let text = String::from_utf8_lossy(&self.line).trim_end().to_string();
            self.line.clear();
            if byte == b'\n' {
                self.keep(&text);
            } else {
                self.after_cr = Some(text.clone());
            }
            if !text.is_empty() {
                lines.push(text);
            }
        }
        lines
    }

    fn keep(&mut self, text: &str) {
        self.kept.push_str(text);
        self.kept.push('\n');
    }

    /// What is left to show if git failed: every line but the redrawn ones.
    fn finish(mut self) -> String {
        if !self.line.is_empty() {
            let rest = String::from_utf8_lossy(&self.line).into_owned();
            self.kept.push_str(&rest);
        }
        self.kept
    }
}

/// Follows git-lfs's progress file about four times a second until git ends.
fn tail_lfs(path: &Path, finished: &AtomicBool, send: Sink) {
    let mut offset = 0;
    let mut partial = Vec::new();
    loop {
        let last = finished.load(Ordering::Acquire);
        if let Ok(mut file) = File::open(path)
            && file.seek(SeekFrom::Start(offset)).is_ok()
            && let Ok(read) = file.read_to_end(&mut partial)
        {
            offset += read as u64;
            let lines = latest_per_file(&mut partial);
            if !lines.is_empty() {
                send("lfs", lines);
            }
        }
        if last {
            break;
        }
        std::thread::park_timeout(Duration::from_millis(250));
    }
}

/// Takes the complete lines out of `buffer`, keeping only the latest for each
/// file: git-lfs writes one per 32 KB, and each carries that file's total so far.
fn latest_per_file(buffer: &mut Vec<u8>) -> Vec<String> {
    let Some(end) = buffer.iter().rposition(|&b| b == b'\n') else {
        return Vec::new();
    };
    let complete: Vec<u8> = buffer.drain(..=end).collect();
    let text = String::from_utf8_lossy(&complete);
    let mut order = Vec::new();
    let mut latest = HashMap::new();
    for line in text.lines().map(str::trim_end).filter(|l| !l.is_empty()) {
        // "download 3/10 1048576/4194304 Assets/Tex.psd": direction and path.
        let mut parts = line.splitn(4, ' ');
        let key = match (parts.next(), parts.nth(2)) {
            (Some(direction), Some(name)) => format!("{direction} {name}"),
            _ => line.to_string(),
        };
        if latest.insert(key.clone(), line.to_string()).is_none() {
            order.push(key);
        }
    }
    order
        .into_iter()
        .filter_map(|key| latest.remove(&key))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[test]
    fn splits_redrawn_progress_from_lines_worth_keeping() {
        let mut splitter = Splitter::default();
        let mut lines = splitter.push(b"Cloning into 'art'...\nremote: Counting objects:  50% (1/2)        \rremote: Counting");
        lines.extend(splitter.push(b" objects: 100% (2/2), done.        \n"));
        lines.extend(splitter.push(b"Receiving objects:  50% (1/2)\rReceiving objects: 100% (2/2), 1.20 MiB | 2.00 MiB/s, done.\n"));
        lines.extend(
            splitter.push(b"error: from a program with Windows line ends\r\nfatal: the end"),
        );
        assert_eq!(
            lines,
            [
                "Cloning into 'art'...",
                "remote: Counting objects:  50% (1/2)",
                "remote: Counting objects: 100% (2/2), done.",
                "Receiving objects:  50% (1/2)",
                "Receiving objects: 100% (2/2), 1.20 MiB | 2.00 MiB/s, done.",
                "error: from a program with Windows line ends",
            ]
        );
        assert_eq!(
            splitter.finish(),
            "Cloning into 'art'...\n\
             remote: Counting objects: 100% (2/2), done.\n\
             Receiving objects: 100% (2/2), 1.20 MiB | 2.00 MiB/s, done.\n\
             error: from a program with Windows line ends\n\
             fatal: the end"
        );
    }

    #[test]
    fn keeps_the_latest_lfs_line_per_file_and_waits_for_whole_lines() {
        let mut buffer = b"download 1/3 32768/4194304 Art/Big Cliff.psd\n\
            download 2/3 32768/1048576 Art/Tree.png\n\
            download 1/3 65536/4194304 Art/Big Cliff.psd\n\
            upload 1/1 10/10 Art/Tree.png\n\
            download 2/3 655"
            .to_vec();
        assert_eq!(
            latest_per_file(&mut buffer),
            [
                "download 1/3 65536/4194304 Art/Big Cliff.psd",
                "download 2/3 32768/1048576 Art/Tree.png",
                "upload 1/1 10/10 Art/Tree.png",
            ]
        );
        assert_eq!(buffer, b"download 2/3 655");
        assert!(latest_per_file(&mut buffer).is_empty());
    }

    fn git_in(dir: &Path, args: &[&str]) {
        let status = std::process::Command::new("git")
            .current_dir(dir)
            .args(args)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .expect("git runs");
        assert!(status.success(), "git {args:?}");
    }

    #[test]
    fn streams_a_clones_progress_while_it_runs() {
        let root = std::env::temp_dir().join(format!("rivet-progress-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let source = root.join("source");
        fs::create_dir_all(&source).unwrap();
        git_in(&source, &["init", "-q", "-b", "main"]);
        for i in 0..50 {
            fs::write(source.join(format!("file{i}.txt")), format!("file {i}\n")).unwrap();
        }
        git_in(&source, &["add", "-A"]);
        git_in(
            &source,
            &[
                "-c",
                "user.name=T",
                "-c",
                "user.email=t@e",
                "commit",
                "-q",
                "-m",
                "Files",
            ],
        );

        let received = Mutex::new(Vec::new());
        let url = format!(
            "file:///{}",
            source.display().to_string().replace('\\', "/")
        );
        let args = ["clone", "--progress", &url, "copy"].map(String::from);
        let (output, cancelled) = run(
            root.to_str().unwrap(),
            &args,
            false,
            None,
            &|source, lines| {
                received
                    .lock()
                    .unwrap()
                    .extend(lines.into_iter().map(|l| (source, l)));
            },
        )
        .unwrap();
        assert!(!cancelled);

        assert_eq!(output.code, 0, "{}", output.stderr);
        let received = received.into_inner().unwrap();
        assert!(
            received
                .iter()
                .any(|(source, line)| *source == "git" && line.starts_with("Receiving objects:"))
        );
        // Redrawn lines are progress only; the finished one stays in the output.
        assert!(!output.stderr.contains("Receiving objects:   0%"));
        assert!(output.stderr.contains("Receiving objects: 100%"));
        assert!(root.join("copy").join("file49.txt").is_file());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn cancelling_stops_git_and_everything_it_started() {
        let root = std::env::temp_dir().join(format!("rivet-cancel-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let stop = Arc::new(Stop::default());
        let canceller = {
            let stop = stop.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(700));
                stop.cancel();
            })
        };
        let started = Instant::now();
        // git runs the alias through sh, which runs sleep: three programs deep.
        // sleep shares git's stderr, so the run only ends once sleep is gone too.
        let args = ["-c", "alias.wait=!sleep 60", "wait"].map(String::from);
        let (output, cancelled) = run(
            root.to_str().unwrap(),
            &args,
            false,
            Some(&stop),
            &|_, _| {},
        )
        .unwrap();
        canceller.join().unwrap();
        assert!(cancelled);
        assert_eq!(output.stderr, "Cancelled.");
        assert!(
            started.elapsed() < Duration::from_secs(20),
            "{:?}",
            started.elapsed()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_cancel_that_comes_first_stops_the_run_before_it_starts() {
        let stop = Stop::register("rivet-test-early-cancel");
        git_cancel("rivet-test-early-cancel".into());
        let args = ["-c", "alias.wait=!sleep 60", "wait"].map(String::from);
        let started = Instant::now();
        let (_, cancelled) = run(".", &args, false, Some(&stop), &|_, _| {}).unwrap();
        Stop::unregister("rivet-test-early-cancel");
        assert!(cancelled);
        assert!(started.elapsed() < Duration::from_secs(5));
    }

    #[test]
    fn programs_git_starts_through_sh_still_run() {
        // Hooks and aliases run through MSYS's sh, which asks to leave the job.
        let stop = Stop::default();
        let args = ["-c", "alias.hello=!sh -c 'sleep 0; echo hello'", "hello"].map(String::from);
        let (output, cancelled) = run(".", &args, false, Some(&stop), &|_, _| {}).unwrap();
        assert!(!cancelled);
        assert_eq!(output.code, 0, "{}", output.stderr);
        assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "hello");
    }

    #[test]
    fn a_run_that_finished_is_not_reported_as_cancelled() {
        let stop = Stop::default();
        let args = ["--version"].map(String::from);
        let (output, cancelled) = run(".", &args, false, Some(&stop), &|_, _| {}).unwrap();
        stop.cancel();
        assert!(!cancelled);
        assert_eq!(output.code, 0);
    }
}
