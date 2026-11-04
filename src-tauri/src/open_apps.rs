//! Programs that keep a repository's files open while Rivet rewrites them on
//! disk: the Unity editor and Blender. Saving in them afterwards would put the
//! old version back, so Rivet asks before a pull, a branch switch or a restore.
//! Windows only; elsewhere nothing is ever reported open.

use regex::Regex;
use serde::Serialize;
use std::path::Path;
use std::sync::LazyLock;

#[derive(Serialize, Default, Debug, PartialEq)]
pub struct OpenApps {
    /// Unity projects open in the editor, as folders inside the repository: "" or "Game/".
    unity: Vec<String>,
    /// .blend files open in Blender that live inside the repository.
    blender: Vec<BlendFile>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct BlendFile {
    /// Relative to the repository, with forward slashes.
    path: String,
    /// Blender has changes it hasn't saved.
    unsaved: bool,
}

/// What Unity and Blender have open inside the repository at `root`.
#[tauri::command]
pub async fn open_apps(root: String) -> OpenApps {
    tauri::async_runtime::spawn_blocking(move || find(Path::new(&root)))
        .await
        .unwrap_or_default()
}

fn find(root: &Path) -> OpenApps {
    OpenApps {
        unity: unity_projects(root)
            .into_iter()
            .filter(|project| unity_open(&root.join(project)))
            .collect(),
        blender: blend_files(root, &window_titles("blender.exe", ".blend")),
    }
}

/// Folders that never hold a Unity project worth looking into.
const SKIP: [&str; 7] = [
    "Library",
    "Temp",
    "Logs",
    "obj",
    "node_modules",
    "Assets",
    "Packages",
];

/// Unity projects in the repository: its own folder, or folders up to two
/// levels down ("Game/", "src/Game/"). Projects don't nest, so the search
/// stops at the first one on each path.
fn unity_projects(root: &Path) -> Vec<String> {
    let mut found = Vec::new();
    search(root, String::new(), 0, &mut found);
    found
}

fn search(folder: &Path, prefix: String, depth: u8, found: &mut Vec<String>) {
    if folder
        .join("ProjectSettings")
        .join("ProjectVersion.txt")
        .is_file()
    {
        found.push(prefix);
        return;
    }
    if depth == 2 {
        return;
    }
    let Ok(entries) = std::fs::read_dir(folder) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || SKIP.contains(&name.as_str()) {
            continue;
        }
        if entry.file_type().is_ok_and(|kind| kind.is_dir()) {
            search(&entry.path(), format!("{prefix}{name}/"), depth + 1, found);
        }
    }
}

/// The editor keeps `Temp/UnityLockfile` open without sharing for as long as a
/// project is open; Unity Hub reads "already open" from the same file. A crashed
/// editor leaves the file behind, but nothing holds it then.
fn unity_open(project: &Path) -> bool {
    locked(&project.join("Temp").join("UnityLockfile"))
}

/// Whether another program holds the file so that it can't be opened for writing.
/// The file stays as it is: nothing is created, truncated or written.
#[cfg(windows)]
fn locked(file: &Path) -> bool {
    const ERROR_SHARING_VIOLATION: i32 = 32;
    const ERROR_LOCK_VIOLATION: i32 = 33;
    match std::fs::OpenOptions::new().write(true).open(file) {
        Ok(_) => false,
        Err(error) => matches!(
            error.raw_os_error(),
            Some(ERROR_SHARING_VIOLATION | ERROR_LOCK_VIOLATION)
        ),
    }
}

#[cfg(not(windows))]
fn locked(_file: &Path) -> bool {
    false
}

/// The file in a Blender window's title and whether it has unsaved changes.
/// On Windows Blender 4.1 and later write `* Tree [D:\Art\Tree.blend] - Blender 4.2.3`
/// ("* " when unsaved, " (Recovered)" after the name); up to 4.0 it was
/// `Blender* [D:\Art\Tree.blend]`. Other windows ("Blender Preferences") and
/// new files ("(Unsaved) - Blender 4.2") have no path.
fn blender_title(title: &str) -> Option<(String, bool)> {
    static PATH: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"\[((?:[A-Za-z]:[\\/]|\\\\).*\.blend\d*)(?: \(Recovered\))?\]")
            .expect("valid pattern")
    });
    let path = PATH.captures(title)?.get(1)?.as_str().to_string();
    let unsaved = title.starts_with("* ") || title.starts_with("Blender*");
    Some((path, unsaved))
}

/// The open .blend files inside the repository, each once.
fn blend_files(root: &Path, titles: &[String]) -> Vec<BlendFile> {
    let mut files: Vec<BlendFile> = Vec::new();
    for (path, unsaved) in titles.iter().filter_map(|title| blender_title(title)) {
        let Some(path) = inside(root, &path) else {
            continue;
        };
        // Every window of one Blender shows the same file.
        match files
            .iter_mut()
            .find(|f| f.path.to_lowercase() == path.to_lowercase())
        {
            Some(file) => file.unsaved |= unsaved,
            None => files.push(BlendFile { path, unsaved }),
        }
    }
    files
}

/// `path` relative to `root` with forward slashes, when it is inside. Windows
/// paths compare without regard to case or slash direction.
fn inside(root: &Path, path: &str) -> Option<String> {
    let root = root.to_string_lossy().replace('/', "\\");
    let root = root.trim_end_matches('\\');
    let path = path.replace('/', "\\");
    let head = path.get(..root.len())?;
    let rest = path.get(root.len()..)?.strip_prefix('\\')?;
    (!root.is_empty() && !rest.is_empty() && head.to_lowercase() == root.to_lowercase())
        .then(|| rest.replace('\\', "/"))
}

/// Titles of the visible top-level windows of a program (by its file name, e.g.
/// "blender.exe") whose title contains `hint`. Reading another program's title
/// doesn't send it a message, so a busy program can't hold Rivet up.
#[cfg(windows)]
fn window_titles(exe: &str, hint: &str) -> Vec<String> {
    use std::collections::HashMap;
    use windows_sys::Win32::Foundation::{HWND, LPARAM};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
        IsWindowVisible,
    };
    use windows_sys::core::BOOL;

    struct Search<'a> {
        exe: &'a str,
        hint: &'a str,
        /// Process id → whether it is the program, asked once per process.
        programs: HashMap<u32, bool>,
        titles: Vec<String>,
    }

    unsafe extern "system" fn visit(window: HWND, data: LPARAM) -> BOOL {
        // SAFETY: `data` is the `Search` passed to EnumWindows below, alive for the whole call.
        let search = unsafe { &mut *(data as *mut Search) };
        if unsafe { IsWindowVisible(window) } == 0 {
            return 1;
        }
        let length = unsafe { GetWindowTextLengthW(window) };
        if length <= 0 {
            return 1;
        }
        let mut text = vec![0u16; length as usize + 1];
        let copied = unsafe { GetWindowTextW(window, text.as_mut_ptr(), text.len() as i32) };
        let title = String::from_utf16_lossy(&text[..copied.max(0) as usize]);
        if !title.contains(search.hint) {
            return 1;
        }
        let mut pid = 0;
        unsafe { GetWindowThreadProcessId(window, &mut pid) };
        let exe = search.exe;
        let wanted = *search.programs.entry(pid).or_insert_with(|| {
            process_file_name(pid).is_some_and(|name| name.eq_ignore_ascii_case(exe))
        });
        if wanted {
            search.titles.push(title);
        }
        1
    }

    let mut search = Search {
        exe,
        hint,
        programs: HashMap::new(),
        titles: Vec::new(),
    };
    unsafe { EnumWindows(Some(visit), &mut search as *mut Search as LPARAM) };
    search.titles
}

/// The file name of a running program, e.g. "blender.exe".
#[cfg(windows)]
fn process_file_name(pid: u32) -> Option<String> {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
        QueryFullProcessImageNameW,
    };
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if process.is_null() {
        return None;
    }
    let mut buffer = [0u16; 1024];
    let mut size = buffer.len() as u32;
    let ok = unsafe {
        QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, buffer.as_mut_ptr(), &mut size)
    };
    unsafe { CloseHandle(process) };
    if ok == 0 {
        return None;
    }
    let path = String::from_utf16_lossy(&buffer[..size as usize]);
    path.rsplit(['\\', '/']).next().map(str::to_string)
}

#[cfg(not(windows))]
fn window_titles(_exe: &str, _hint: &str) -> Vec<String> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn scratch(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("rivet-open-apps-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn unity_project(folder: &Path) {
        fs::create_dir_all(folder.join("ProjectSettings")).unwrap();
        fs::write(
            folder.join("ProjectSettings/ProjectVersion.txt"),
            "m_EditorVersion: 6000.0.32f1\n",
        )
        .unwrap();
    }

    #[test]
    fn reads_the_file_from_current_blender_titles() {
        let file = r"D:\Projects\Kinetic Art\Art\Tree.blend";
        assert_eq!(
            blender_title(r"* Tree [D:\Projects\Kinetic Art\Art\Tree.blend] - Blender 4.2.3"),
            Some((file.into(), true))
        );
        assert_eq!(
            blender_title(r"Tree [D:\Projects\Kinetic Art\Art\Tree.blend] - Blender 5.2.3"),
            Some((file.into(), false))
        );
        // A recovered file says so after its name.
        assert_eq!(
            blender_title(
                r"* Tree (Recovered) [D:\Projects\Kinetic Art\Art\Tree.blend] - Blender 4.5.0"
            ),
            Some((file.into(), true))
        );
        // Brackets in names and folders.
        assert_eq!(
            blender_title(r"Tree [v2] [D:\Art [old]\Tree [v2].blend] - Blender 4.2.0"),
            Some((r"D:\Art [old]\Tree [v2].blend".into(), false))
        );
        // A network share, and the em dash newer builds use.
        assert_eq!(
            blender_title(r"Rock [\\studio\art\Rock.blend] — Blender 5.3.0 Alpha"),
            Some((r"\\studio\art\Rock.blend".into(), false))
        );
    }

    #[test]
    fn reads_the_file_from_older_blender_titles() {
        assert_eq!(
            blender_title(r"Blender* [C:\Art\Tree.blend]"),
            Some((r"C:\Art\Tree.blend".into(), true))
        );
        assert_eq!(
            blender_title(r"Blender [C:\Art\Tree.blend (Recovered)]"),
            Some((r"C:\Art\Tree.blend".into(), false))
        );
    }

    #[test]
    fn ignores_blender_windows_without_a_file() {
        for title in [
            "Blender",
            "Blender Preferences",
            "* (Unsaved) - Blender 4.2.3",
            "(Unsaved) - Blender 5.2.3",
            "Blender File View",
        ] {
            assert_eq!(blender_title(title), None, "{title}");
        }
    }

    #[test]
    fn keeps_blend_files_inside_the_repository_once() {
        let root = Path::new(r"D:\Projects\kinetic-art");
        let titles = [
            r"Tree [d:\projects\Kinetic-Art\Art\Tree.blend] - Blender 4.2.3",
            r"* Tree [D:\Projects\kinetic-art\Art\Tree.blend] - Blender 4.2.3",
            r"Rock [D:\Projects\kinetic-art-old\Rock.blend] - Blender 4.2.3",
            r"Other [E:\Elsewhere\Other.blend] - Blender 4.2.3",
            "Blender Preferences",
        ]
        .map(String::from);
        assert_eq!(
            blend_files(root, &titles),
            vec![BlendFile {
                path: "Art/Tree.blend".into(),
                unsaved: true
            }]
        );
        assert_eq!(
            inside(
                Path::new("D:/Projects/kinetic-art/"),
                r"D:\Projects\kinetic-art\a.blend"
            ),
            Some("a.blend".into())
        );
        assert_eq!(inside(root, r"D:\Projects\kinetic-art"), None);
    }

    #[test]
    fn finds_unity_projects_two_levels_down() {
        let root = scratch("projects");
        unity_project(&root.join("Game"));
        unity_project(&root.join("src/simulator"));
        unity_project(&root.join("a/b/too-deep"));
        // Nothing inside a project counts as another one.
        unity_project(&root.join("Game/Assets/Nested"));
        let mut found = unity_projects(&root);
        found.sort();
        assert_eq!(found, ["Game/", "src/simulator/"]);
        unity_project(&root);
        assert_eq!(unity_projects(&root), [""]);
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn a_project_is_open_while_its_lockfile_is_held() {
        use std::os::windows::fs::OpenOptionsExt;
        let root = scratch("lockfile");
        unity_project(&root);
        assert_eq!(find(&root).unity, Vec::<String>::new(), "never opened");
        fs::create_dir_all(root.join("Temp")).unwrap();
        let lockfile = root.join("Temp/UnityLockfile");
        fs::write(&lockfile, "").unwrap();
        assert_eq!(
            find(&root).unity,
            Vec::<String>::new(),
            "left behind by a crash"
        );
        // What the editor does: keep it open and share it with nobody.
        let held = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .share_mode(0)
            .open(&lockfile)
            .unwrap();
        assert_eq!(find(&root).unity, [""]);
        drop(held);
        assert_eq!(find(&root).unity, Vec::<String>::new(), "closed");
        assert_eq!(fs::read(&lockfile).unwrap(), b"", "left as it was");
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn looking_at_windows_is_quick() {
        let started = std::time::Instant::now();
        let titles = window_titles("blender.exe", ".blend");
        let elapsed = started.elapsed();
        println!("{} Blender windows in {elapsed:?}", titles.len());
        assert!(elapsed.as_millis() < 100, "{elapsed:?}");
    }

    /// `RIVET_OPEN_APPS_ROOT=D:\Projects\game cargo test real -- --ignored --nocapture`
    /// shows what is open in a real repository and how long looking took.
    #[test]
    #[ignore]
    fn real_repository() {
        let root = std::env::var("RIVET_OPEN_APPS_ROOT").expect("RIVET_OPEN_APPS_ROOT");
        let started = std::time::Instant::now();
        let open = find(Path::new(&root));
        println!("{open:?} in {:?}", started.elapsed());
    }
}
