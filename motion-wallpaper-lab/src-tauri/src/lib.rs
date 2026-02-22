use serde::Serialize;
use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use std::ffi::c_void;
use std::ptr::null_mut;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

#[cfg(windows)]
use tauri_plugin_dialog::{DialogExt, FilePath};

#[cfg(windows)]
use windows::core::{BOOL, PCWSTR};
#[cfg(windows)]
use windows::Win32::Foundation::*;
#[cfg(windows)]
use windows::Win32::System::LibraryLoader::*;
#[cfg(windows)]
use windows::Win32::UI::HiDpi::*;
#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::*;
#[cfg(windows)]
use windows::Win32::Graphics::Gdi::{
    EnumDisplayMonitors,
    GetMonitorInfoW,
    MONITORINFOEXW,
    HMONITOR,
    HDC,
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

#[derive(Debug, Default)]
struct AppState {
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
    host_visible: bool,
    // true while a host window creation is in progress to avoid races
    creating_host: bool,
    last_attach_at_ms: u128,
    watchdog_repair_tick: u128,
}

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
fn isize_to_hwnd(v: isize) -> HWND {
    HWND(v as *mut c_void)
}

#[cfg(windows)]
fn get_hwnd(window: &tauri::WebviewWindow) -> Result<HWND, String> {
    let handle = window
        .window_handle()
        .map_err(|e| format!("window_handle() failed: {e}"))?;
    match handle.as_raw() {
        RawWindowHandle::Win32(h) => Ok(isize_to_hwnd(h.hwnd.get() as isize)),
        _ => Err("Not a Win32 window".to_string()),
    }
}

#[cfg(windows)]
async fn get_hwnd_with_retry(
    app_handle: &tauri::AppHandle,
    label: &str,
    retries: u32,
) -> Result<HWND, String> {
    for i in 0..retries {
        if let Some(win) = app_handle.get_webview_window(label) {
            match get_hwnd(&win) {
                Ok(hwnd) if hwnd != null_hwnd() => return Ok(hwnd),
                Ok(_) => {}
                Err(e) if i == retries - 1 => return Err(e),
                Err(_) => {}
            }
        }
        sleep(Duration::from_millis(200)).await;
    }
    Err(format!(
        "Could not get HWND for '{}' after {} retries",
        label, retries
    ))
}

#[cfg(windows)]
fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(windows)]
fn is_valid_window(hwnd: HWND) -> bool {
    unsafe { IsWindow(Some(hwnd)).as_bool() }
}

#[cfg(windows)]
fn virtual_rect() -> RectStatus {
    RectStatus {
        x: unsafe { GetSystemMetrics(SM_XVIRTUALSCREEN) },
        y: unsafe { GetSystemMetrics(SM_YVIRTUALSCREEN) },
        w: unsafe { GetSystemMetrics(SM_CXVIRTUALSCREEN) },
        h: unsafe { GetSystemMetrics(SM_CYVIRTUALSCREEN) },
    }
}

#[derive(Debug, Clone, Serialize)]
struct MonitorDesc {
    id: usize,
    name: String,
    rect: RectStatus,
    primary: bool,
}

#[cfg(windows)]
unsafe extern "system" fn monitor_enum_proc(hmonitor: HMONITOR, _hdc: HDC, lprc: *mut windows::Win32::Foundation::RECT, lparam: LPARAM) -> BOOL {
    let vec_ptr = lparam.0 as *mut Vec<MonitorDesc>;
    if vec_ptr.is_null() {
        return BOOL(0);
    }

    let mut mi: MONITORINFOEXW = std::mem::zeroed();
    // MONITORINFOEXW contains a field `monitorInfo` (MONITORINFO) and `szDevice`
    mi.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
    if unsafe { GetMonitorInfoW(hmonitor, &mut mi as *mut _ as *mut _).as_bool() } {
        let name = {
            let slice = &mi.szDevice;
            let mut len = 0usize;
            while len < slice.len() && slice[len] != 0 {
                len += 1;
            }
            String::from_utf16_lossy(&slice[..len])
        };

        let r = unsafe { *lprc };
        let desc = MonitorDesc {
            id: unsafe { (*(vec_ptr)).len() },
            name,
            rect: RectStatus {
                x: r.left,
                y: r.top,
                w: r.right - r.left,
                h: r.bottom - r.top,
            },
            primary: (mi.monitorInfo.dwFlags & 1) != 0,
        };
        unsafe { (*(vec_ptr)).push(desc) };
    }

    BOOL(1)
}

#[cfg(windows)]
fn get_monitors() -> Result<Vec<MonitorDesc>, String> {
    let mut out: Vec<MonitorDesc> = Vec::new();
    unsafe {
        let lp: LPARAM = LPARAM(&mut out as *mut _ as isize);
        let cb = Some(monitor_enum_proc as _);
        if EnumDisplayMonitors(None, None, cb, lp).as_bool() {
            Ok(out)
        } else {
            Err("EnumDisplayMonitors failed".to_string())
        }
    }
}

async fn set_error(state: &State<'_, Mutex<AppState>>, msg: String) {
    let mut s = state.lock().await;
    s.last_error = Some(msg);
}

async fn clear_error(state: &State<'_, Mutex<AppState>>) {
    let mut s = state.lock().await;
    s.last_error = None;
}

#[cfg(windows)]
fn apply_host_window_styles(hwnd: HWND) {
    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let updated = (style | WS_EX_TOOLWINDOW.0 as isize) & !(WS_EX_APPWINDOW.0 as isize);
        let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, updated);
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_TOP),
            0,
            0,
            0,
            0,
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
}

#[cfg(windows)]
fn set_click_through(hwnd: HWND, enabled: bool) {
    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let mut next = (style | WS_EX_TOOLWINDOW.0 as isize | WS_EX_LAYERED.0 as isize)
            & !(WS_EX_APPWINDOW.0 as isize);
        if enabled {
            next |= WS_EX_TRANSPARENT.0 as isize;
        } else {
            next &= !(WS_EX_TRANSPARENT.0 as isize);
        }
        let _ = SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next);
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_TOP),
            0,
            0,
            0,
            0,
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }
}

#[cfg(windows)]
async fn ensure_host_window(app: &AppHandle, state: &State<'_, Mutex<AppState>>) -> Result<(), String> {
    println!("[ensure_host_window] Starting...");
    let mut created_now = false;

    // If another task is already creating the host window, wait briefly and reuse it
    {
        let s = state.lock().await;
        if s.creating_host {
            drop(s);
            println!("[ensure_host_window] Creation in progress, waiting to reuse existing host...");
            for _ in 0..30 {
                if app.get_webview_window(HOST_LABEL).is_some() {
                    return Ok(());
                }
                let s2 = state.lock().await;
                if !s2.creating_host {
                    break;
                }
                sleep(Duration::from_millis(100)).await;
            }
        }
    }

    if app.get_webview_window(HOST_LABEL).is_none() {
        println!("[ensure_host_window] Host window not found, creating...");

        // mark creation in progress
        {
            let mut s = state.lock().await;
            s.creating_host = true;
        }

        let build_result = WebviewWindowBuilder::new(app, HOST_LABEL, WebviewUrl::App("/".into()))
            // Temporary visible=true for debugging host WebView (make sure to revert later)
            .visible(true)
            .decorations(false)
            .resizable(false)
            .skip_taskbar(true)
            .focused(false)
            .build();

        // creation finished, clear flag
        {
            let mut s = state.lock().await;
            s.creating_host = false;
        }

        match build_result {
            Ok(_) => {
                created_now = true;
                println!("[ensure_host_window] Host window created successfully");
            }
            Err(e) => {
                let msg = e.to_string();
                println!("[ensure_host_window] Build error: {}", msg);
                if !msg.contains("already exists") {
                    return Err(format!("create host failed: {e}"));
                }
            }
        }

        let mut s = state.lock().await;
        s.host_ready = false;
        s.host_ready_at = None;
        s.attached = false;
        s.parent_hwnd = None;
        s.host_hwnd = None;
        s.rect = RectStatus::default();
        s.last_error = None;
        s.host_visible = false;
    }

    let should_force_host_route = {
        let s = state.lock().await;
        created_now || s.host_ready_at.is_none()
    };

    let window = app
        .get_webview_window(HOST_LABEL)
        .ok_or_else(|| "host window not found".to_string())?;

    if should_force_host_route {
        sleep(Duration::from_millis(500)).await;
        window
            .eval("window.location.hash = '#/wallpaper-host';")
            .map_err(|e| format!("host route eval failed: {e}"))?;
        sleep(Duration::from_millis(500)).await;
    }

    Ok(())
}

#[cfg(windows)]
unsafe extern "system" fn enum_windows_find_workerw(hwnd: HWND, lparam: LPARAM) -> BOOL {
    #[repr(C)]
    struct FindWorkerWData {
        workerw: HWND,
    }

    let data = &mut *(lparam.0 as *mut FindWorkerWData);

    let shelldll_class = wide("SHELLDLL_DefView");
    let shelldll = FindWindowExW(
        Some(hwnd),
        Some(null_hwnd()),
        PCWSTR(shelldll_class.as_ptr()),
        PCWSTR::null(),
    )
    .unwrap_or(null_hwnd());

    if shelldll != null_hwnd() {
        let workerw_class = wide("WorkerW");
        let workerw = FindWindowExW(
            Some(null_hwnd()),
            Some(hwnd),
            PCWSTR(workerw_class.as_ptr()),
            PCWSTR::null(),
        )
        .unwrap_or(null_hwnd());

        if workerw != null_hwnd() {
            data.workerw = workerw;
        }

        return BOOL(0);
    }

    BOOL(1)
}

#[cfg(windows)]
fn find_workerw() -> Result<HWND, String> {
    #[repr(C)]
    struct FindWorkerWData {
        workerw: HWND,
    }

    unsafe {
        let progman_name = wide("Progman");
        let hwnd_progman =
            FindWindowW(PCWSTR(progman_name.as_ptr()), PCWSTR::null()).unwrap_or(null_hwnd());
        if hwnd_progman == null_hwnd() {
            return Err("Progman not found".to_string());
        }

        let mut result: usize = 0;
        let _ = SendMessageTimeoutW(
            hwnd_progman,
            0x052C,
            WPARAM(0),
            LPARAM(0),
            SMTO_NORMAL,
            1000,
            Some(&mut result),
        );

        std::thread::sleep(std::time::Duration::from_millis(200));

        let mut data = FindWorkerWData {
            workerw: null_hwnd(),
        };
        let _ = EnumWindows(
            Some(enum_windows_find_workerw),
            LPARAM(&mut data as *mut FindWorkerWData as isize),
        );

        if data.workerw == null_hwnd() {
            let workerw_class = wide("WorkerW");
            let fallback = FindWindowExW(
                Some(hwnd_progman),
                Some(null_hwnd()),
                PCWSTR(workerw_class.as_ptr()),
                PCWSTR::null(),
            )
            .unwrap_or(null_hwnd());
            if fallback != null_hwnd() {
                return Ok(fallback);
            }
            return Err("WorkerW not found via EnumWindows or fallback".to_string());
        }

        if !is_valid_window(data.workerw) {
            return Err("WorkerW handle invalid".to_string());
        }

        Ok(data.workerw)
    }
}

#[cfg(windows)]
fn set_virtual_rect(hwnd: HWND) -> Result<RectStatus, String> {
    if !is_valid_window(hwnd) {
        return Err("invalid hwnd for SetWindowPos".to_string());
    }

    let rect = virtual_rect();
    unsafe {
        let ok = SetWindowPos(
            hwnd,
            Some(HWND_TOP),
            rect.x,
            rect.y,
            rect.w,
            rect.h,
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
        if ok.is_err() {
            return Err(format!("SetWindowPos virtual rect failed: {:?}", ok.err()));
        }
    }
    Ok(rect)
}

#[cfg(windows)]
async fn attach_workerw(
    host_hwnd: isize,
    state: &State<'_, Mutex<AppState>>,
) -> Result<(isize, isize, RectStatus), String> {
    let (host_hwnd_v, parent_now_v, rect) = {
        let host_hwnd = isize_to_hwnd(host_hwnd);
        if !is_valid_window(host_hwnd) {
            return Err("host window invalid before attach".to_string());
        }

        let workerw_hwnd = find_workerw()?;
        unsafe {
            SetLastError(WIN32_ERROR(0));
            let previous_parent = SetParent(host_hwnd, Some(workerw_hwnd))
                .map_err(|e| format!("SetParent failed: {e}"))?;
            let last_err = GetLastError();
            if previous_parent == null_hwnd() && last_err.0 != 0 {
                return Err(format!(
                    "SetParent falhou. WinError: {}. host={:?} workerw={:?}",
                    last_err.0, host_hwnd, workerw_hwnd
                ));
            }
        }

        let rect = set_virtual_rect(host_hwnd)?;
        (hwnd_to_isize(host_hwnd), hwnd_to_isize(workerw_hwnd), rect)
    };

    let mut s = state.lock().await;
    s.attached = true;
    s.parent_hwnd = Some(parent_now_v);
    s.host_hwnd = Some(host_hwnd_v);
    s.rect = rect;
    s.last_error = None;
    s.last_attach_at_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    Ok((host_hwnd_v, parent_now_v, rect))
}

#[tauri::command]
async fn mw_host_ready(state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    let mut s = state.lock().await;
    s.host_ready = true;
    s.host_ready_at = Some(now_string());
    Ok(())
}

#[cfg(windows)]
#[tauri::command]
async fn mw_pick_video(app: AppHandle) -> Result<Option<String>, String> {
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

#[cfg(windows)]
#[tauri::command]
async fn mw_get_monitors() -> Result<Vec<MonitorDesc>, String> {
    match get_monitors() {
        Ok(v) => Ok(v),
        Err(e) => Err(e),
    }
}

#[cfg(not(windows))]
#[tauri::command]
async fn mw_pick_video() -> Result<Option<String>, String> {
    Err("only supported on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
async fn mw_start_host(app: AppHandle, state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    clear_error(&state).await;
    match ensure_host_window(&app, &state).await {
        Ok(_) => Ok(()),
        Err(e) => {
            set_error(&state, e.clone()).await;
            Err(e)
        }
    }
}

#[cfg(not(windows))]
#[tauri::command]
async fn mw_start_host() -> Result<(), String> {
    Err("only supported on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
async fn mw_reload_host(app: AppHandle, state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(HOST_LABEL) {
        let _ = w.close();
    }
    mw_start_host(app, state).await
}

#[cfg(not(windows))]
#[tauri::command]
async fn mw_reload_host() -> Result<(), String> {
    Err("only supported on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
async fn mw_apply(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    path: String,
    volume: f64,
    click_through: bool,
    aspect: Option<String>,
    monitor: Option<usize>,
) -> Result<(), String> {
    clear_error(&state).await;
    ensure_host_window(&app, &state).await?;

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(15);
    loop {
        {
            let s = state.lock().await;
            if s.host_ready_at.is_some() {
                break;
            }
        }
        if std::time::Instant::now() > deadline {
            let err = "Host nao ficou ready em 15s".to_string();
            set_error(&state, err.clone()).await;
            return Err(err);
        }
        sleep(Duration::from_millis(100)).await;
    }

    let host_hwnd_v = hwnd_to_isize(
        get_hwnd_with_retry(&app, HOST_LABEL, 15)
        .await
        .map_err(|e| format!("host hwnd failed: {e}"))?,
    );

    app.emit_to(HOST_LABEL, "mw:set_video", serde_json::json!({ "path": path.clone() }))
        .map_err(|e| format!("emit set_video failed: {e}"))?;
    sleep(Duration::from_millis(300)).await;
    app.emit_to(HOST_LABEL, "mw:set_volume", serde_json::json!({ "value": volume.clamp(0.0, 1.0) }))
        .map_err(|e| format!("emit set_volume failed: {e}"))?;
    sleep(Duration::from_millis(200)).await;

    // Conditional attach: allow skipping attach_workerw for debugging via env var
    let skip_attach = std::env::var("MW_DEBUG_SKIP_ATTACH").is_ok();
    let mut rect = RectStatus::default();

    if skip_attach {
        println!("[mw_apply] MW_DEBUG_SKIP_ATTACH set — skipping attach_workerw");
        // No await path: safe to create HWND and call SetWindowPos directly
        let host_hwnd = isize_to_hwnd(host_hwnd_v);
        rect = set_virtual_rect(host_hwnd)?;

        apply_host_window_styles(host_hwnd);
        set_click_through(host_hwnd, click_through);

        unsafe {
            println!("[mw_apply] ShowWindow (skip attach) with SW_SHOWNOACTIVATE...");
            let result = ShowWindow(host_hwnd, SW_SHOWNOACTIVATE);
            println!("[mw_apply] ShowWindow result: {:?}", result);

            let setpos_result = SetWindowPos(
                host_hwnd,
                Some(HWND_TOP),
                rect.x,
                rect.y,
                rect.w,
                rect.h,
                SWP_SHOWWINDOW | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
            );
            println!("[mw_apply] SetWindowPos result: {:?}", setpos_result);
        }

        // compute target rect based on requested aspect and monitor selection
        let aspect_str = aspect.as_deref().unwrap_or("16:9");
        let virt = if let Some(mid) = monitor {
            match get_monitors() {
                Ok(list) => list.get(mid).map(|m| m.rect).unwrap_or_else(|| virtual_rect()),
                Err(_) => virtual_rect(),
            }
        } else {
            virtual_rect()
        };
        let r = if aspect_str == "9:16" {
            // portrait: width/height = 9/16
            let ratio = 9.0f64 / 16.0f64;
            let vw = virt.w as f64;
            let vh = virt.h as f64;
            if vw / vh > ratio {
                // container wider than ratio -> full height
                let target_h = vh;
                let target_w = (target_h * ratio).round();
                RectStatus {
                    x: virt.x + ((virt.w as f64 - target_w) / 2.0).round() as i32,
                    y: virt.y,
                    w: target_w as i32,
                    h: target_h as i32,
                }
            } else {
                let target_w = vw;
                let target_h = (target_w / ratio).round();
                RectStatus {
                    x: virt.x,
                    y: virt.y + ((virt.h as f64 - target_h) / 2.0).round() as i32,
                    w: target_w as i32,
                    h: target_h as i32,
                }
            }
        } else {
            // default landscape 16:9
            let ratio = 16.0f64 / 9.0f64;
            let vw = virt.w as f64;
            let vh = virt.h as f64;
            if vw / vh > ratio {
                // container wider than ratio -> full height
                let target_h = vh;
                let target_w = (target_h * ratio).round();
                RectStatus {
                    x: virt.x + ((virt.w as f64 - target_w) / 2.0).round() as i32,
                    y: virt.y,
                    w: target_w as i32,
                    h: target_h as i32,
                }
            } else {
                let target_w = vw;
                let target_h = (target_w / ratio).round();
                RectStatus {
                    x: virt.x,
                    y: virt.y + ((virt.h as f64 - target_h) / 2.0).round() as i32,
                    w: target_w as i32,
                    h: target_h as i32,
                }
            }
        };

        let mut s = state.lock().await;
        s.applied = true;
        s.video_path = Some(path);
        s.volume = volume.clamp(0.0, 1.0);
        s.click_through = click_through;
        s.rect = r;
        s.host_hwnd = Some(host_hwnd_v);
        s.host_visible = true;
    } else {
        // Await path: do not create HWND or any non-Send value before await
        let (host_hwnd_v2, _parent, r) = attach_workerw(host_hwnd_v, &state).await?;
        rect = r;

        let host_hwnd = isize_to_hwnd(host_hwnd_v2);
        apply_host_window_styles(host_hwnd);
        set_click_through(host_hwnd, click_through);

        unsafe {
            println!("[mw_apply] ShowWindow with SW_SHOWNOACTIVATE...");
            let result = ShowWindow(host_hwnd, SW_SHOWNOACTIVATE);
            println!("[mw_apply] ShowWindow result: {:?}", result);

            let setpos_result = SetWindowPos(
                host_hwnd,
                Some(HWND_TOP),
                rect.x,
                rect.y,
                rect.w,
                rect.h,
                SWP_SHOWWINDOW | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
            );
            println!("[mw_apply] SetWindowPos result: {:?}", setpos_result);
        }

        let mut s = state.lock().await;
        s.applied = true;
        s.video_path = Some(path);
        s.volume = volume.clamp(0.0, 1.0);
        s.click_through = click_through;
        s.rect = rect;
        s.host_hwnd = Some(host_hwnd_v2);
        s.host_visible = true;
    }

    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
async fn mw_apply(_path: String, _volume: f64, _click_through: bool) -> Result<(), String> {
    Err("only supported on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
async fn mw_stop(app: AppHandle, state: State<'_, Mutex<AppState>>) -> Result<(), String> {
    if app.get_webview_window(HOST_LABEL).is_some() {
        let _ = app.emit_to(HOST_LABEL, "mw:pause", serde_json::Value::Null);
        if let Ok(hwnd) = get_hwnd_with_retry(&app, HOST_LABEL, 15).await {
            if is_valid_window(hwnd) {
                unsafe {
                    let _ = ShowWindow(hwnd, SW_HIDE);
                }
            }
        }
    }

    let mut s = state.lock().await;
    s.applied = false;
    s.host_visible = false;
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
async fn mw_stop() -> Result<(), String> {
    Err("only supported on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
async fn mw_set_click_through(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    enabled: bool,
) -> Result<(), String> {
    if app.get_webview_window(HOST_LABEL).is_some() {
        if let Ok(hwnd) = get_hwnd_with_retry(&app, HOST_LABEL, 15).await {
            if is_valid_window(hwnd) {
                set_click_through(hwnd, enabled);
            }
        }
    }

    let mut s = state.lock().await;
    s.click_through = enabled;
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
async fn mw_set_click_through(_enabled: bool) -> Result<(), String> {
    Err("only supported on Windows".to_string())
}

#[cfg(windows)]
#[tauri::command]
async fn mw_set_volume(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    value: f64,
) -> Result<(), String> {
    let v = value.clamp(0.0, 1.0);
    app.emit_to(HOST_LABEL, "mw:set_volume", serde_json::json!({ "value": v }))
        .map_err(|e| format!("emit set_volume failed: {e}"))?;

    let mut s = state.lock().await;
    s.volume = v;
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
async fn mw_set_volume(_value: f64) -> Result<(), String> {
    Err("only supported on Windows".to_string())
}

#[tauri::command]
async fn mw_status(app: AppHandle, state: State<'_, Mutex<AppState>>) -> Result<MwStatus, String> {
    let host_exists = app.get_webview_window(HOST_LABEL).is_some();
    let mut s = state.lock().await;

    if app.get_webview_window(HOST_LABEL).is_some() {
        if let Ok(hwnd) = get_hwnd_with_retry(&app, HOST_LABEL, 15).await {
            s.host_hwnd = Some(hwnd_to_isize(hwnd));
            if !is_valid_window(hwnd) {
                s.last_error = Some("host hwnd invalid".to_string());
            }
        }
    }

    Ok(MwStatus {
        host_exists,
        host_ready_at: s.host_ready_at.clone(),
        attached: s.attached,
        parent_hwnd: s.parent_hwnd,
        host_hwnd: s.host_hwnd,
        rect: s.rect,
        last_error: s.last_error.clone(),
        video_path: s.video_path.clone(),
    })
}

#[cfg(windows)]
fn spawn_watchdog(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            sleep(Duration::from_secs(2)).await;

            let state = app.state::<Mutex<AppState>>();
            let (is_attached, parent_hwnd, host_hwnd, should_check, tick, last_attach_at_ms) = {
                let s = state.lock().await;
                (
                    s.attached,
                    s.parent_hwnd,
                    s.host_hwnd,
                    s.host_ready_at.is_some(),
                    SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .map(|d| d.as_millis())
                        .unwrap_or(0),
                    s.last_attach_at_ms,
                )
            };

            if !is_attached || !should_check || parent_hwnd.is_none() || host_hwnd.is_none() {
                continue;
            }
            if tick.saturating_sub(last_attach_at_ms) < 5000 {
                continue;
            }

            let parent_valid = parent_hwnd
                .map(|hwnd| is_valid_window(isize_to_hwnd(hwnd)))
                .unwrap_or(false);

            if parent_valid {
                continue;
            }

            {
                let mut s = state.lock().await;
                if tick.saturating_sub(s.watchdog_repair_tick) < 1500 {
                    continue;
                }
                s.watchdog_repair_tick = tick;
            }

            let host_hwnd = host_hwnd.unwrap_or_default();
            if let Err(e) = attach_workerw(host_hwnd, &state).await {
                set_error(&state, format!("watchdog reattach failed: {e}")).await;
            }
        }
    });
}

#[cfg(not(windows))]
fn spawn_watchdog(_app: AppHandle) {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    unsafe {
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
        let _ = GetModuleHandleW(PCWSTR::null());
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

            app.manage(Mutex::new(AppState::default()));
            spawn_watchdog(app.handle().clone());
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
