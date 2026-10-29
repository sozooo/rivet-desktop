//! The error log the developer can ask for: the git commands Rivet ran, app errors and the
//! version, in two small rotating files in the app's local data folder. Passwords, tokens
//! and credentials in URLs are scrubbed before anything is written.

use regex::Regex;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// The current file is rotated to `rivet.1.log` past this size, so the log stays near 1 MB.
const MAX_BYTES: u64 = 512 * 1024;
/// Lines in a report, and errors repeated at its top: a refresh alone runs some 20 commands.
const REPORT_LINES: usize = 200;
const REPORT_ERRORS: usize = 20;
/// How much of a long argument list or error output is kept.
const MAX_ARGS: usize = 400;
const MAX_STDERR: usize = 2000;

struct Log {
    dir: PathBuf,
    file: Option<File>,
    size: u64,
}

static LOG: OnceLock<Mutex<Log>> = OnceLock::new();

impl Log {
    fn current(&self) -> PathBuf {
        self.dir.join("rivet.log")
    }

    fn previous(&self) -> PathBuf {
        self.dir.join("rivet.1.log")
    }

    fn append(&mut self, text: &str) {
        if self.size + text.len() as u64 > MAX_BYTES {
            self.file = None;
            let _ = fs::rename(self.current(), self.previous());
        }
        if self.file.is_none() {
            self.file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(self.current())
                .ok();
            self.size = fs::metadata(self.current()).map_or(0, |m| m.len());
        }
        if let Some(file) = &mut self.file
            && file.write_all(text.as_bytes()).is_ok()
        {
            self.size += text.len() as u64;
        }
    }

    /// Both files, oldest first.
    fn read(&self) -> String {
        [self.previous(), self.current()]
            .iter()
            .filter_map(|path| fs::read_to_string(path).ok())
            .collect()
    }

    /// The last lines, oldest first.
    fn tail(&self, count: usize) -> Vec<String> {
        let text = self.read();
        let lines: Vec<&str> = text.lines().collect();
        lines[lines.len().saturating_sub(count)..]
            .iter()
            .map(|line| line.to_string())
            .collect()
    }

    /// The last errors people were shown, with their detail lines, oldest first.
    fn errors(&self, count: usize) -> Vec<String> {
        let text = self.read();
        let mut entries: Vec<Vec<&str>> = Vec::new();
        for line in text.lines() {
            match entries.last_mut() {
                Some(entry) if line.starts_with("    ") => entry.push(line),
                _ => entries.push(vec![line]),
            }
        }
        let errors: Vec<_> = entries
            .into_iter()
            .filter(|entry| {
                entry[0]
                    .split_once("Z ")
                    .is_some_and(|(_, rest)| rest.starts_with("error: "))
            })
            .collect();
        errors[errors.len().saturating_sub(count)..]
            .iter()
            .flatten()
            .map(|line| line.to_string())
            .collect()
    }
}

/// Starts logging into `dir`, beginning with the version and Windows build.
pub fn init(dir: PathBuf, version: &str) {
    let _ = fs::create_dir_all(&dir);
    let _ = LOG.set(Mutex::new(Log {
        dir,
        file: None,
        size: 0,
    }));
    write(&format!("Rivet {version} started on {}", windows_version()));
}

fn write(entry: &str) {
    let Some(log) = LOG.get() else { return };
    let Ok(mut log) = log.lock() else { return };
    // Continuation lines are indented so each entry starts with its time.
    let text = scrub(entry).trim_end().replace('\n', "\n    ");
    log.append(&format!("{} {text}\n", timestamp(SystemTime::now())));
}

/// Records a git command: its arguments, where it ran, how it ended and how long it took.
pub fn git(
    cwd: &str,
    args: &[String],
    result: &Result<crate::git::Output, String>,
    took: Duration,
) {
    let command = shorten(&quote(args), MAX_ARGS);
    let ms = took.as_millis();
    write(&match result {
        Ok(output) if output.code == 0 => format!("git {command} (in {cwd}) → 0, {ms} ms"),
        Ok(output) => format!(
            "git {command} (in {cwd}) → {}, {ms} ms\n{}",
            output.code,
            shorten(output.stderr.trim(), MAX_STDERR)
        ),
        Err(error) => format!("git {command} (in {cwd}) didn't start: {error}"),
    });
}

/// An error from the interface, with what Rivet was doing.
#[tauri::command]
pub fn log_write(level: String, message: String) {
    write(&format!("{level}: {message}"));
}

/// Versions and the latest log lines, to paste into a message to the developer.
#[tauri::command]
pub async fn diagnostics_report(app: tauri::AppHandle, context: String) -> String {
    let version = app.package_info().version.to_string();
    tauri::async_runtime::spawn_blocking(move || report(&version, &context))
        .await
        .unwrap_or_default()
}

fn report(version: &str, context: &str) -> String {
    let (folder, errors, lines) = match LOG.get().and_then(|log| log.lock().ok()) {
        Some(log) => (
            log.dir.display().to_string(),
            log.errors(REPORT_ERRORS),
            log.tail(REPORT_LINES),
        ),
        None => ("not available".into(), Vec::new(), Vec::new()),
    };
    let tool = |args: &[&str]| {
        let args: Vec<String> = args.iter().map(|a| a.to_string()).collect();
        match crate::git::run(".", &args, None) {
            Ok(output) if output.code == 0 => {
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            }
            Ok(output) => format!("{} (exit {})", output.stderr.trim(), output.code),
            Err(error) => error,
        }
    };
    let mut report = vec![
        format!("Rivet {version}"),
        windows_version(),
        tool(&["--version"]),
        tool(&["lfs", "version"]),
        context.to_string(),
        String::new(),
        "--- Errors Rivet showed recently ---".into(),
    ];
    report.extend(errors);
    report.push(String::new());
    report.push(format!("--- Last {} log lines ({folder}) ---", lines.len()));
    report.extend(lines);
    scrub(&report.join("\n"))
}

/// Hides passwords and tokens: in URLs, Authorization headers, key=value pairs and GitHub tokens.
pub fn scrub(text: &str) -> String {
    static RULES: OnceLock<Vec<(Regex, &str)>> = OnceLock::new();
    let rules = RULES.get_or_init(|| {
        [
            // https://user:token@host → https://user:***@host
            (r"(?i)\b([a-z][a-z0-9+.-]*://)([^/\s:@'\x22]+):[^/\s@'\x22]+@", "${1}${2}:***@"),
            // https://ghp_token@host → https://***@host
            (
                r"(?i)\b([a-z][a-z0-9+.-]*://)(gh[pousr]_|github_pat_|glpat-)[^/\s@'\x22]+@",
                "${1}***@",
            ),
            (r"(?i)\b(authorization\s*[:=]\s*)[^\r\n'\x22]+", "${1}***"),
            (
                r"(?i)\b(password|passwd|token|access_token|client_secret|secret)(\s*[=:]\s*)[^\s&'\x22*][^\s&'\x22]*",
                "${1}${2}***",
            ),
            (r"\b(gh[pousr]_|github_pat_|glpat-)[A-Za-z0-9_-]{8,}", "${1}***"),
        ]
        .into_iter()
        .map(|(pattern, replacement)| (Regex::new(pattern).expect("valid pattern"), replacement))
        .collect()
    });
    rules
        .iter()
        .fold(text.to_string(), |text, (pattern, replacement)| {
            pattern.replace_all(&text, *replacement).into_owned()
        })
}

fn quote(args: &[String]) -> String {
    args.iter()
        .map(|arg| {
            if arg.is_empty() || arg.contains(char::is_whitespace) {
                format!("\"{arg}\"")
            } else {
                arg.clone()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn shorten(text: &str, limit: usize) -> String {
    match text.char_indices().nth(limit) {
        Some((end, _)) => format!("{}…", &text[..end]),
        None => text.to_string(),
    }
}

/// UTC, e.g. 2026-10-29 14:05:09Z.
fn timestamp(now: SystemTime) -> String {
    let seconds = now.duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs());
    let (year, month, day) = civil_date((seconds / 86_400) as i64);
    let time = seconds % 86_400;
    format!(
        "{year:04}-{month:02}-{day:02} {:02}:{:02}:{:02}Z",
        time / 3600,
        time / 60 % 60,
        time % 60
    )
}

/// Days since 1970-01-01 as a calendar date (Howard Hinnant's algorithm).
fn civil_date(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = (day_of_year - (153 * shifted_month + 2) / 5 + 1) as u32;
    let month = (if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    }) as u32;
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

/// e.g. "Windows 11 (10.0.26200.6899)"; `ver` is the one source that needs no extra crate.
#[cfg(windows)]
fn windows_version() -> String {
    use std::os::windows::process::CommandExt;
    let output = std::process::Command::new("cmd")
        .args(["/c", "ver"])
        .creation_flags(crate::git::CREATE_NO_WINDOW)
        .output();
    let text = output
        .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
        .unwrap_or_default();
    let Some(build) = Regex::new(r"\d+\.\d+\.(\d+)[\d.]*")
        .ok()
        .and_then(|r| r.captures(&text))
    else {
        return "Windows (version unknown)".into();
    };
    let name = if build[1].parse::<u32>().unwrap_or(0) >= 22_000 {
        "Windows 11"
    } else {
        "Windows 10"
    };
    format!("{name} ({})", &build[0])
}

#[cfg(not(windows))]
fn windows_version() -> String {
    std::env::consts::OS.into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hides_credentials_in_urls() {
        assert_eq!(
            scrub(
                "fatal: unable to access 'https://alex:ghp_abcdefghij0123456789@github.com/kinetic/kinetic.git/'"
            ),
            "fatal: unable to access 'https://alex:***@github.com/kinetic/kinetic.git/'"
        );
        assert_eq!(
            scrub("clone -- https://x-access-token:s3cr3t@github.com/o/r.git D:\\Projects\\r"),
            "clone -- https://x-access-token:***@github.com/o/r.git D:\\Projects\\r"
        );
        assert_eq!(
            scrub("https://gho_16C7e42F292c6912E7710c838347Ae178B4a@github.com/o/r"),
            "https://***@github.com/o/r"
        );
        // A login alone is not a secret: Rivet puts it in clone URLs on purpose.
        assert_eq!(
            scrub("clone -- https://alexkim-art@github.com/o/r.git"),
            "clone -- https://alexkim-art@github.com/o/r.git"
        );
    }

    #[test]
    fn hides_headers_tokens_and_passwords() {
        assert_eq!(
            scrub("git -c http.extraHeader=Authorization: Bearer gho_abc123def456 fetch"),
            "git -c http.extraHeader=Authorization: ***"
        );
        assert_eq!(
            scrub("Authorization: Basic YWxleDpodW50ZXIy"),
            "Authorization: ***"
        );
        assert_eq!(
            scrub("protocol=https\nhost=github.com\nusername=alex\npassword=hunter2\n"),
            "protocol=https\nhost=github.com\nusername=alex\npassword=***\n"
        );
        assert_eq!(scrub("token: gho_abcdefgh12345678"), "token: ***");
        assert_eq!(
            scrub("saw github_pat_11ABCDEFG0123456789_abcdefghijklmnop in output"),
            "saw github_pat_*** in output"
        );
    }

    #[test]
    fn leaves_ordinary_messages_alone() {
        let message = "remote: Invalid username or token. Password authentication is not supported for Git operations.\nfatal: Authentication failed for 'https://github.com/kinetic/kinetic.git/'";
        assert_eq!(scrub(message), message);
        let lock = "fatal: Unable to create 'D:/Projects/kinetic/.git/index.lock': File exists.";
        assert_eq!(scrub(lock), lock);
    }

    #[test]
    fn formats_utc_dates() {
        assert_eq!(civil_date(0), (1970, 1, 1));
        assert_eq!(civil_date(11_017), (2000, 3, 1));
        assert_eq!(civil_date(19_723), (2024, 1, 1));
        assert_eq!(
            timestamp(UNIX_EPOCH + Duration::from_secs(1_793_282_709)),
            "2026-10-29 14:05:09Z"
        );
    }

    #[test]
    fn rotates_and_reads_back_the_tail() {
        let dir = std::env::temp_dir().join(format!("rivet-log-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let mut log = Log {
            dir: dir.clone(),
            file: None,
            size: 0,
        };
        let line = format!("{}\n", "x".repeat(99));
        for _ in 0..(MAX_BYTES as usize / line.len() + 10) {
            log.append(&line);
        }
        log.append("last\n");
        assert!(log.previous().exists());
        assert!(fs::metadata(log.current()).unwrap().len() < 2000);
        let tail = log.tail(3);
        assert_eq!(tail.len(), 3);
        assert_eq!(tail[2], "last");
        log.append("2026-10-29 14:05:09Z git push (in D:/p) → 1, 9 ms\n    rejected\n");
        log.append(
            "2026-10-29 14:05:10Z error: D:/p: fatal: early EOF\n    fatal: index-pack failed\n",
        );
        log.append("2026-10-29 14:05:11Z git status (in D:/p) → 0, 9 ms\n");
        assert_eq!(
            log.errors(5),
            [
                "2026-10-29 14:05:10Z error: D:/p: fatal: early EOF",
                "    fatal: index-pack failed"
            ]
        );
        drop(log);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn shortens_long_text_on_character_boundaries() {
        assert_eq!(shorten("абвгд", 3), "абв…");
        assert_eq!(shorten("abc", 3), "abc");
    }
}
