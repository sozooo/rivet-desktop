//! The main window: one copy of Rivet at a time, and Windows 11's snap layouts
//! for the maximize button Rivet draws itself.

use tauri::{AppHandle, Manager};

/// A second start of Rivet brings the open window forward instead of opening another.
pub fn focus_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Windows shows its snap layouts when the pointer rests on a real maximize
/// button. Rivet's is drawn in the page, so it asks for the same menu with Win + Z.
#[tauri::command]
pub fn show_snap_layouts() {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VIRTUAL_KEY,
            VK_LWIN, VK_MENU,
        };
        const VK_Z: VIRTUAL_KEY = 0x5A;
        let key = |vk: VIRTUAL_KEY, up: bool| INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: if up { KEYEVENTF_KEYUP } else { 0 },
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        let send = |keys: &[INPUT]| unsafe {
            SendInput(
                keys.len() as u32,
                keys.as_ptr(),
                std::mem::size_of::<INPUT>() as i32,
            );
        };
        send(&[
            key(VK_LWIN, false),
            key(VK_Z, false),
            key(VK_Z, true),
            key(VK_LWIN, true),
        ]);
        // Win + Z also numbers the layouts for the keyboard; a tap of Alt hides the numbers.
        std::thread::sleep(std::time::Duration::from_millis(50));
        send(&[key(VK_MENU, false), key(VK_MENU, true)]);
    }
}
