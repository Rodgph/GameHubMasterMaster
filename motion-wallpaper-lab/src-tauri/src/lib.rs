use serde::Serialize;
use std::ffi::c_void;
use std::ptr::null_mut;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

#[cfg(windows)]
use tauri_plugin_dialog::{DialogExt, FilePath};

#[cfg(windows)]
use windows::core::{BOOL, PCWSTR};
#[cfg(windows)]
use windows::Win32::Foundation::{GetLastError, SetLastError, HWND, LPARAM, WPARAM};
#[cfg(windows)]
use windows::Win32::UI::HiDpi::{
    SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
};
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, FindWindowExW, FindWindowW, GetParent, GetSystemMetrics, GetWindowLongPtrW,
    IsWindow, SendMessageTimeoutW, SetParent, SetWindowLongPtrW, SetWindowPos, ShowWindow,
    GWL_EXSTYLE, HWND_TOP, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
    SM_YVIRTUALSCREEN, SMTO_NORMAL, SW_HIDE, SW_SHOWNOACTIVATE, SWP_FRAMECHANGED,
    SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_NOZORDER, WS_EX_APPWINDOW, WS_EX_LAYERED,
    WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT,
};

const HOST_LABEL: &str = "wallpaper_host";

#[derive(Debug, Clone, Copy, Serialize, Default)]
struct RectStatus {
    x: i32,
    y: i32,
    w: i32,
    h: i32,
}

#[derive(Debug, Clone, Serialize)]
struct MwStatus {
    host_exists: bool,
    host_ready_at: Option<String>,
    attached: bool,
    parent_hwnd: Option<isize>,
    host_hwnd: Option<isize>,
    rect: RectStatus,
    last_error: Option<String>,
    video_path: Option<String>,
}

#[derive(Debug)]
struct WallpaperState {
    host_ready: bool,
    host_ready_at: Option<String>,
    attached: bool,
    parent_hwnd: Option<isize>,
    host_hwnd: Option<isize>,
    rect: RectStatus,
    last_error: Option<String>,
    video_path: Option<String>,
    applied: bool,
    click_through: bool,
    volume: f64,
    last_watchdog_repair_ms: u128,
}

impl Default for WallpaperState {
    fn default() -> Self {
        Self {
            host_ready: false,
            host_ready_at: None,
            attached: false,
            parent_hwnd: None,
            host_hwnd: None,
            rect: RectStatus::default(),
            last_error: None,
            video_path: None,
            applied: false,
            click_through: false,
            volume: 0.5,
            last_watchdog_repair_ms: 0,
        }
    }
}

type SharedState = Mutex<WallpaperState>;

fn now_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

#[cfg(windows)]
fn null_hwnd() -> HWND {
    HWND(null_mut())
}

#[cfg(windows)]
fn hwnd_to_isize(hwnd: HWND) -> isize {
    hwnd.0 as isize
}

#[cfg(windows)]
fn isize_to_hwnd(value: isize) -> HWND {
    HWND(value as *mut c_void)
}

#[cfg(windows)]
fn to_wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
fn virtual_screen_rect() -> RectStatus {
    RectStatus {
        x: unsafe { GetSystemMetrics(SM_XVIRTUALSCREEN) },
        y: unsafe { GetSystemMetrics(SM_YVIRTUALSCREEN) },
        w: unsafe { GetSystemMetrics(SM_CXVIRTUALSCREEN) },
        h: unsafe { GetSystemMetrics(SM_CYVIRTUALSCREEN) },
    }
}

fn set_last_error(state: &State<SharedState>, message: impl Into<String>) {
    if let Ok(mut lock) = state.lock() {
        lock.last_error = Some(message.into());
    }
}

fn clear_last_error(state: &State<SharedState>) {
    if let Ok(mut lock) = state.lock() {
        lock.last_error = None;
    }
}

#[cfg(windows)]
fn hide_from_taskbar_and_alt_tab(hwnd: HWND) {
    unsafe {
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let new_style = (ex_style | WS_EX_TOOLWINDOW.0) & !WS_EX_APPWINDOW.0;
        let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_style as isize);
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_TOP),
            0,
            0,
            0,
            0,
            SWP_NOOWNERZORDER | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
}

#[cfg(windows)]
fn set_click_through_hwnd(hwnd: HWND, enabled: bool) {
    unsafe {
        let mut ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        ex_style |= WS_EX_TOOLWINDOW.0;
        ex_style &= !WS_EX_APPWINDOW.0;
        ex_style |= WS_EX_LAYERED.0;
        if enabled {
            ex_style |= WS_EX_TRANSPARENT.0;
        } else {
            ex_style &= !WS_EX_TRANSPARENT.0;
        }
        let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex_style as isize);
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_TOP),
            0,
            0,
            0,
            0,
            SWP_NOOWNERZORDER | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
}

#[cfg(windows)]
fn ensure_host_window(app: &AppHandle, state: &State<SharedState>) -> Result<(), String> {
    if app.get_webview_window(HOST_LABEL).is_none() {
        WebviewWindowBuilder::new(app, HOST_LABEL, WebviewUrl::App("/".into()))
            .visible(false)
            .decorations(false)
            .resizable(false)
            .skip_taskbar(true)
            .focused(false)
            .build()
            .map_err(|e| format!("create host failed: {e}"))?;

        if let Ok(mut lock) = state.lock() {
            lock.host_ready = false;
            lock.host_ready_at = None;
        }
    }

    let window = app
        .get_webview_window(HOST_LABEL)
        .ok_or_else(|| "host window missing after create".to_string())?;
    window
        .eval("window.location.hash = '/wallpaper-host';")
        .map_err(|e| format!("host route eval failed: {e}"))?;
    let hwnd = window.hwnd().map_err(|e| format!("host hwnd failed: {e}"))?;
    hide_from_taskbar_and_alt_tab(hwnd);
    Ok(())
}

#[cfg(windows)]
unsafe extern "system" fn enum_windows_workerw(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let shell = to_wide("SHELLDLL_DefView");
    let worker = to_wide("WorkerW");

    let def_view =
        FindWindowExW(Some(hwnd), None, PCWSTR(shell.as_ptr()), PCWSTR::null()).unwrap_or(null_hwnd());
    if def_view != null_hwnd() {
        let workerw = FindWindowExW(None, Some(hwnd), PCWSTR(worker.as_ptr()), PCWSTR::null())
            .unwrap_or(null_hwnd());
        if workerw != null_hwnd() {
            *(lparam.0 as *mut HWND) = workerw;
            return BOOL(0);
        }
    }
    BOOL(1)
}

#[cfg(windows)]
fn find_workerw() -> Result<HWND, String> {
    unsafe {
        let progman_class = to_wide("Progman");
        let progman = FindWindowW(PCWSTR(progman_class.as_ptr()), PCWSTR::null()).unwrap_or(null_hwnd());
        if progman == null_hwnd() {
            return Err("Progman not found".to_string());
        }

        let mut out: usize = 0;
        let _ = SendMessageTimeoutW(progman, 0x052C, WPARAM(0), LPARAM(0), SMTO_NORMAL, 1000, Some(&mut out));

        let mut workerw = null_hwnd();
        let _ = EnumWindows(Some(enum_windows_workerw), LPARAM(&mut workerw as *mut HWND as isize));

        if workerw == null_hwnd() {
            let worker_class = to_wide("WorkerW");
            workerw =
                FindWindowExW(None, None, PCWSTR(worker_class.as_ptr()), PCWSTR::null()).unwrap_or(null_hwnd());
        }

        if workerw == null_hwnd() {
            return Err("WorkerW not found".to_string());
        }
        Ok(workerw)
    }
}

#[cfg(windows)]
fn attach_host_to_workerw(app: &AppHandle, state: &State<SharedState>) -> Result<(), String> {
    let window = app
        .get_webview_window(HOST_LABEL)
        .ok_or_else(|| "host window not found".to_string())?;
    let hwnd = window.hwnd().map_err(|e| format!("host hwnd failed: {e}"))?;
    let workerw = find_workerw()?;

    unsafe {
        SetLastError(windows::Win32::Foundation::WIN32_ERROR(0));
        let parent_result = SetParent(hwnd, Some(workerw));
        if parent_result.is_err() && GetLastError().0 != 0 {
            return Err(format!("SetParent failed: {}", GetLastError().0));
        }

        let rect = virtual_screen_rect();
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_TOP),
            rect.x,
            rect.y,
            rect.w,
            rect.h,
            SWP_NOOWNERZORDER | SWP_NOACTIVATE,
        );

        if let Ok(mut lock) = state.lock() {
            lock.attached = true;
            lock.parent_hwnd = Some(hwnd_to_isize(workerw));
            lock.host_hwnd = Some(hwnd_to_isize(hwnd));
            lock.rect = rect;
        }
    }

    Ok(())
}

#[cfg(windows)]
fn wait_host_ready(state: &State<SharedState>, timeout_ms: u64) -> bool {
    let mut elapsed = 0;
    while elapsed < timeout_ms {
        if let Ok(lock) = state.lock() {
            if lock.host_ready {
                return true;
            }
        }
        std::thread::sleep(Duration::from_millis(100));
        elapsed += 100;
    }
    false
}

#[tauri::command]
fn mw_host_ready(state: State<SharedState>) {
    if let Ok(mut lock) = state.lock() {
        lock.host_ready = true;
        lock.host_ready_at = Some(now_string());
    }
}

#[cfg(windows)]
#[tauri::command]
fn mw_pick_video(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Videos", &["mp4", "mkv", "webm", "avi", "mov"])
        .blocking_pick_file();

    Ok(match picked {
        Some(FilePath::Path(path)) => Some(path.to_string_lossy().to_string()),
        Some(FilePath::Url(url)) => Some(url.to_string()),
        None => None,
    })
}

#[cfg(not(windows))]
#[tauri::command]
fn mw_pick_video() -> Result<Option<String>, String> {
    Err("only supported on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
fn mw_start_host(app: AppHandle, state: State<SharedState>) -> Result<(), String> {
    clear_last_error(&state);
    ensure_host_window(&app, &state)
}

#[cfg(not(windows))]
#[tauri::command]
fn mw_start_host() -> Result<(), String> {
    Err("only supported on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
fn mw_reload_host(app: AppHandle, state: State<SharedState>) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(HOST_LABEL) {
        let _ = w.close();
    }
    ensure_host_window(&app, &state)
}

#[cfg(not(windows))]
#[tauri::command]
fn mw_reload_host() -> Result<(), String> {
    Err("only supported on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
fn mw_apply(
    app: AppHandle,
    state: State<SharedState>,
    path: String,
    volume: f64,
    click_through: bool,
) -> Result<(), String> {
    clear_last_error(&state);
    ensure_host_window(&app, &state)?;

    if !wait_host_ready(&state, 8000) {
        let err = "host did not signal ready".to_string();
        set_last_error(&state, err.clone());
        return Err(err);
    }

    app.emit_to(HOST_LABEL, "mw:set_video", serde_json::json!({ "path": path.clone() }))
        .map_err(|e| format!("emit set_video failed: {e}"))?;
    app.emit_to(HOST_LABEL, "mw:set_volume", serde_json::json!({ "value": volume }))
        .map_err(|e| format!("emit set_volume failed: {e}"))?;
    app.emit_to(HOST_LABEL, "mw:play", serde_json::Value::Null)
        .map_err(|e| format!("emit play failed: {e}"))?;

    attach_host_to_workerw(&app, &state)?;

    let window = app
        .get_webview_window(HOST_LABEL)
        .ok_or_else(|| "host window missing after attach".to_string())?;
    let hwnd = window.hwnd().map_err(|e| format!("host hwnd failed: {e}"))?;
    set_click_through_hwnd(hwnd, click_through);
    unsafe {
        let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
    }

    if let Ok(mut lock) = state.lock() {
        lock.video_path = Some(path);
        lock.volume = volume;
        lock.click_through = click_through;
        lock.applied = true;
        lock.host_hwnd = Some(hwnd_to_isize(hwnd));
    }

    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
fn mw_apply(_path: String, _volume: f64, _click_through: bool) -> Result<(), String> {
    Err("only supported on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
fn mw_stop(app: AppHandle, state: State<SharedState>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(HOST_LABEL) {
        let _ = app.emit_to(HOST_LABEL, "mw:pause", serde_json::Value::Null);
        let hwnd = window.hwnd().map_err(|e| format!("host hwnd failed: {e}"))?;
        unsafe {
            let _ = ShowWindow(hwnd, SW_HIDE);
        }
    }

    if let Ok(mut lock) = state.lock() {
        lock.applied = false;
    }

    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
fn mw_stop() -> Result<(), String> {
    Err("only supported on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
fn mw_set_click_through(app: AppHandle, state: State<SharedState>, enabled: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(HOST_LABEL) {
        let hwnd = window.hwnd().map_err(|e| format!("host hwnd failed: {e}"))?;
        set_click_through_hwnd(hwnd, enabled);
    }
    if let Ok(mut lock) = state.lock() {
        lock.click_through = enabled;
    }
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
fn mw_set_click_through(_enabled: bool) -> Result<(), String> {
    Err("only supported on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
fn mw_set_volume(app: AppHandle, state: State<SharedState>, value: f64) -> Result<(), String> {
    let clamped = value.clamp(0.0, 1.0);
    let _ = app.emit_to(HOST_LABEL, "mw:set_volume", serde_json::json!({ "value": clamped }));
    if let Ok(mut lock) = state.lock() {
        lock.volume = clamped;
    }
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
fn mw_set_volume(_value: f64) -> Result<(), String> {
    Err("only supported on Windows".to_string())
}

#[tauri::command]
fn mw_status(app: AppHandle, state: State<SharedState>) -> MwStatus {
    let host_exists = app.get_webview_window(HOST_LABEL).is_some();
    if let Ok(lock) = state.lock() {
        MwStatus {
            host_exists,
            host_ready_at: lock.host_ready_at.clone(),
            attached: lock.attached,
            parent_hwnd: lock.parent_hwnd,
            host_hwnd: lock.host_hwnd,
            rect: lock.rect,
            last_error: lock.last_error.clone(),
            video_path: lock.video_path.clone(),
        }
    } else {
        MwStatus {
            host_exists,
            host_ready_at: None,
            attached: false,
            parent_hwnd: None,
            host_hwnd: None,
            rect: RectStatus::default(),
            last_error: Some("state lock poisoned".to_string()),
            video_path: None,
        }
    }
}

#[cfg(windows)]
fn start_watchdog(app: AppHandle) {
    let app_handle = app.clone();

    std::thread::spawn(move || loop {
        let state_ref = app_handle.state::<SharedState>();
        std::thread::sleep(Duration::from_secs(2));

        let (should_check, parent_hwnd, host_hwnd, now_ms) = {
            let lock = match state_ref.lock() {
                Ok(l) => l,
                Err(_) => continue,
            };
            let now_ms = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
            (lock.applied && lock.attached, lock.parent_hwnd, lock.host_hwnd, now_ms)
        };
        if !should_check {
            continue;
        }

        let parent_valid = parent_hwnd.map(|p| unsafe { IsWindow(Some(isize_to_hwnd(p))).as_bool() }).unwrap_or(false);
        let host_valid = host_hwnd.map(|h| unsafe { IsWindow(Some(isize_to_hwnd(h))).as_bool() }).unwrap_or(false);
        let attached_valid = if let (Some(h), Some(p)) = (host_hwnd, parent_hwnd) {
            unsafe { GetParent(isize_to_hwnd(h)).unwrap_or(null_hwnd()) == isize_to_hwnd(p) }
        } else {
            false
        };

        if parent_valid && host_valid && attached_valid {
            if let Some(h) = host_hwnd {
                let rect = virtual_screen_rect();
                unsafe {
                    let _ = SetWindowPos(
                        isize_to_hwnd(h),
                        Some(HWND_TOP),
                        rect.x,
                        rect.y,
                        rect.w,
                        rect.h,
                        SWP_NOOWNERZORDER | SWP_NOACTIVATE,
                    );
                }
                if let Ok(mut lock) = state_ref.lock() {
                    lock.rect = rect;
                }
            }
            continue;
        }

        let do_repair = {
            let mut lock = match state_ref.lock() {
                Ok(l) => l,
                Err(_) => continue,
            };
            if now_ms.saturating_sub(lock.last_watchdog_repair_ms) < 1500 {
                false
            } else {
                lock.last_watchdog_repair_ms = now_ms;
                true
            }
        };
        if !do_repair {
            continue;
        }

        let _ = ensure_host_window(&app_handle, &state_ref);
        if let Err(err) = attach_host_to_workerw(&app_handle, &state_ref) {
            if let Ok(mut lock) = state_ref.lock() {
                lock.last_error = Some(format!("watchdog reattach failed: {err}"));
            }
        }
    });
}

#[cfg(not(windows))]
fn start_watchdog(_app: AppHandle) {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    unsafe {
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            app.manage(Mutex::new(WallpaperState::default()));
            start_watchdog(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            mw_pick_video,
            mw_start_host,
            mw_reload_host,
            mw_apply,
            mw_stop,
            mw_set_click_through,
            mw_set_volume,
            mw_status,
            mw_host_ready
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
