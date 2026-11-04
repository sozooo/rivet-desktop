//! A git command together with every program it starts (git-remote-https,
//! git-lfs, credential helpers, hooks), so that cancelling stops all of them.
//! Killing git.exe alone would leave its helpers running, still downloading
//! and holding files in the folder.
//!
//! On Windows the command runs in a job object of its own. It starts suspended
//! and only runs once it is in the job, so nothing it starts can slip out
//! before that. Elsewhere it leads a process group of its own.

use std::io;
use std::process::{Child, Command};
use std::time::{Duration, Instant};

pub struct Tree {
    pid: u32,
    #[cfg(windows)]
    job: Option<windows::Job>,
}

impl Tree {
    /// Starts `command` in a tree of its own.
    pub fn spawn(command: &mut Command) -> io::Result<(Child, Tree)> {
        #[cfg(windows)]
        {
            windows::spawn(command)
        }
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
            let child = command.spawn()?;
            let pid = child.id();
            Ok((child, Tree { pid }))
        }
        #[cfg(not(any(windows, unix)))]
        {
            let child = command.spawn()?;
            let pid = child.id();
            Ok((child, Tree { pid }))
        }
    }

    /// Stops the command and everything it started.
    pub fn kill(&self) {
        #[cfg(windows)]
        match &self.job {
            Some(job) => job.terminate(),
            None => windows::kill_by_parent(self.pid),
        }
        #[cfg(unix)]
        {
            let _ = Command::new("kill")
                .args(["-KILL", "--", &format!("-{}", self.pid)])
                .status();
        }
    }

    /// Waits, up to `timeout`, until every program in the tree has exited and
    /// let go of its files.
    pub fn wait_empty(&self, timeout: Duration) {
        let started = Instant::now();
        #[cfg(windows)]
        if let Some(job) = &self.job {
            while job.active() > 0 && started.elapsed() < timeout {
                std::thread::sleep(Duration::from_millis(20));
            }
        }
        let _ = (started, timeout);
    }
}

#[cfg(windows)]
mod windows {
    use super::Tree;
    use crate::git::CREATE_NO_WINDOW;
    use std::ffi::c_void;
    use std::io;
    use std::mem::{size_of, zeroed};
    use std::os::windows::io::AsRawHandle;
    use std::os::windows::process::CommandExt;
    use std::process::{Child, Command, Stdio};
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, TH32CS_SNAPTHREAD, THREADENTRY32, Thread32First, Thread32Next,
    };
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JOBOBJECT_BASIC_ACCOUNTING_INFORMATION,
        JobObjectBasicAccountingInformation, QueryInformationJobObject, TerminateJobObject,
    };
    use windows_sys::Win32::System::Threading::{
        CREATE_SUSPENDED, OpenThread, ResumeThread, THREAD_SUSPEND_RESUME,
    };

    /// A job object; closing it leaves its processes running.
    pub struct Job(HANDLE);

    // A job handle is a kernel object; any thread may use it.
    unsafe impl Send for Job {}
    unsafe impl Sync for Job {}

    impl Drop for Job {
        fn drop(&mut self) {
            unsafe { CloseHandle(self.0) };
        }
    }

    impl Job {
        fn new() -> Option<Job> {
            let handle = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
            if handle.is_null() {
                return None;
            }
            // No breakaway allowed: MSYS programs (sh running hooks and
            // aliases) ask to leave the job and would outlive a cancel.
            Some(Job(handle))
        }

        fn assign(&self, process: HANDLE) -> bool {
            unsafe { AssignProcessToJobObject(self.0, process) != 0 }
        }

        pub fn terminate(&self) {
            unsafe { TerminateJobObject(self.0, 1) };
        }

        /// Processes in the job that haven't exited yet.
        pub fn active(&self) -> u32 {
            let mut info: JOBOBJECT_BASIC_ACCOUNTING_INFORMATION = unsafe { zeroed() };
            let ok = unsafe {
                QueryInformationJobObject(
                    self.0,
                    JobObjectBasicAccountingInformation,
                    &mut info as *mut _ as *mut c_void,
                    size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32,
                    std::ptr::null_mut(),
                )
            };
            if ok == 0 { 0 } else { info.ActiveProcesses }
        }
    }

    pub fn spawn(command: &mut Command) -> io::Result<(Child, Tree)> {
        let Some(job) = Job::new() else {
            // No job object: start normally, and kill the tree by parent ids.
            let child = command.spawn()?;
            let pid = child.id();
            return Ok((child, Tree { pid, job: None }));
        };
        command.creation_flags(CREATE_NO_WINDOW | CREATE_SUSPENDED);
        let mut child = command.spawn()?;
        let pid = child.id();
        let joined = job.assign(child.as_raw_handle() as HANDLE);
        if !resume(pid) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(io::Error::other("git started but could not run"));
        }
        let job = joined.then_some(job);
        Ok((child, Tree { pid, job }))
    }

    /// Lets a process started suspended run: resumes its threads (a new
    /// process has one). std doesn't hand out the main thread's handle.
    fn resume(pid: u32) -> bool {
        let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0) };
        if snapshot == INVALID_HANDLE_VALUE {
            return false;
        }
        let mut entry: THREADENTRY32 = unsafe { zeroed() };
        entry.dwSize = size_of::<THREADENTRY32>() as u32;
        let mut resumed = false;
        let mut more = unsafe { Thread32First(snapshot, &mut entry) } != 0;
        while more {
            if entry.th32OwnerProcessID == pid {
                let thread = unsafe { OpenThread(THREAD_SUSPEND_RESUME, 0, entry.th32ThreadID) };
                if !thread.is_null() {
                    resumed |= unsafe { ResumeThread(thread) } != u32::MAX;
                    unsafe { CloseHandle(thread) };
                }
            }
            more = unsafe { Thread32Next(snapshot, &mut entry) } != 0;
        }
        unsafe { CloseHandle(snapshot) };
        resumed
    }

    /// Without a job: what `taskkill /T` does, following parent process ids.
    pub fn kill_by_parent(pid: u32) {
        let _ = Command::new("taskkill")
            .args(["/T", "/F", "/PID", &pid.to_string()])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }
}
