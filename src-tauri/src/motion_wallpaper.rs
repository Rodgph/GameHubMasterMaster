use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Listener, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use url::Url;

type Result<T> = std::result::Result<T, String>;

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{HWND, LPARAM, RECT, WPARAM};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::HiDpi::{
  SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{
  EnumWindows, FindWindowExW, FindWindowW, GetParent, GetSystemMetrics, GetWindowLongW,
  GetWindowRect, MoveWindow, SendMessageTimeoutW, SetParent, SetWindowLongW, SetWindowPos,
  ShowWindow, GWL_EXSTYLE, HWND_BOTTOM, SEND_MESSAGE_TIMEOUT_FLAGS, SM_CMONITORS,
  SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, SMTO_NORMAL,
  SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SW_HIDE,
  SW_SHOWNOACTIVATE, WS_EX_APPWINDOW, WS_EX_LAYERED, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT,
};

const HOST_LABEL: &str = "wallpaper_host";

#[derive(Default)]
pub struct MotionWallpaperRuntime {
  pub state: Mutex<MotionWallpaperState>,
  pub watcher_running: AtomicBool,
}

#[derive(Default, Clone)]
pub struct MotionWallpaperState {
  pub running: bool,
  pub attached: bool,
  pub monitors: i32,
  pub video_path: Option<String>,
  pub click_through: bool,
  pub volume: u8,
  pub workerw: isize,
  pub host_exists: bool,
  pub host_ready: bool,
  pub host_ready_at: Option<i64>,
  pub host_url: Option<String>,
  pub last_video_event: Option<String>,
  pub last_error: Option<String>,
  pub parent_hwnd: isize,
  pub last_rect: RectDebug,
}

#[derive(Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RectDebug {
  pub x: i32,
  pub y: i32,
  pub w: i32,
  pub h: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MotionWallpaperStatus {
  running: bool,
  attached: bool,
  monitors: i32,
  video_path: Option<String>,
  click_through: bool,
  host_exists: bool,
  host_ready: bool,
  host_ready_at: Option<i64>,
  last_error: Option<String>,
  host_url: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MotionWallpaperDebugState {
  host_ready: bool,
  host_ready_at: Option<i64>,
  last_video_event: Option<String>,
  attached: bool,
  parent_hwnd: isize,
  host_rect: RectDebug,
  last_error: Option<String>,
  current_video_path: Option<String>,
  host_exists: bool,
  windows: Vec<String>,
  host_url: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideoEventPayload {
  #[serde(rename = "type")]
  kind: String,
  code: Option<i32>,
  message: Option<String>,
}

fn now_ms() -> i64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as i64)
    .unwrap_or(0)
}

pub fn register_event_listeners(app: &AppHandle) {
  let handle = app.clone();
  app.listen("motion_wallpaper:video_event", move |event| {
    let payload = serde_json::from_str::<VideoEventPayload>(event.payload()).ok();
    if let Ok(mut state) = handle.state::<MotionWallpaperRuntime>().state.lock() {
      if let Some(p) = payload {
        let mut text = p.kind;
        if let Some(code) = p.code {
          text.push_str(&format!(" code={code}"));
        }
        if let Some(msg) = p.message {
          text.push_str(&format!(" msg={msg}"));
        }
        state.last_video_event = Some(text.clone());
        if text.contains("error") {
          state.last_error = Some(text);
        }
      }
    }
  });
}

fn derive_host_url(app: &AppHandle) -> Result<Url> {
  let main = app
    .get_webview_window("main")
    .ok_or_else(|| "main window not found".to_string())?;
  let mut host_url = main.url().map_err(|e| e.to_string())?;
  host_url.set_fragment(Some("/wallpaper-host"));
  Ok(host_url)
}

fn ensure_host_window(app: &AppHandle, host_url: &Url) -> Result<WebviewWindow> {
  if let Some(win) = app.get_webview_window(HOST_LABEL) {
    return Ok(win);
  }

  let build_result = WebviewWindowBuilder::new(
    app,
    HOST_LABEL,
    WebviewUrl::External(host_url.clone()),
  )
  .decorations(false)
  .transparent(false)
  .resizable(false)
  .visible(false)
  .skip_taskbar(true)
  .always_on_top(false)
  .title("WallpaperHost")
  .build();

  let window = match build_result {
    Ok(window) => {
      println!("Wallpaper host criado com sucesso");
      window
    }
    Err(e) => {
      println!("Erro criando host: {:?}", e);
      return Err(e.to_string());
    }
  };

  #[cfg(target_os = "windows")]
  {
    apply_toolwindow_style(&window)?;
  }

  Ok(window)
}

#[cfg(target_os = "windows")]
fn hwnd_from_window(window: &WebviewWindow) -> Result<HWND> {
  let handle = window.window_handle().map_err(|e| e.to_string())?;
  match handle.as_raw() {
    RawWindowHandle::Win32(raw) => Ok(raw.hwnd.get() as HWND),
    _ => Err("unsupported platform window handle".to_string()),
  }
}

#[cfg(target_os = "windows")]
fn get_hwnd_rect(hwnd: HWND) -> RectDebug {
  unsafe {
    let mut rect: RECT = std::mem::zeroed();
    if GetWindowRect(hwnd, &mut rect) == 0 {
      return RectDebug::default();
    }
    RectDebug {
      x: rect.left,
      y: rect.top,
      w: (rect.right - rect.left).max(0),
      h: (rect.bottom - rect.top).max(0),
    }
  }
}

#[cfg(target_os = "windows")]
fn apply_toolwindow_style(window: &WebviewWindow) -> Result<()> {
  let hwnd = hwnd_from_window(window)?;
  unsafe {
    let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
    let mut next = ex_style | WS_EX_TOOLWINDOW;
    next &= !WS_EX_APPWINDOW;
    SetWindowLongW(hwnd, GWL_EXSTYLE, next as i32);
    let _ = SetWindowPos(
      hwnd,
      std::ptr::null_mut(),
      0,
      0,
      0,
      0,
      SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
    );
  }
  Ok(())
}

#[cfg(target_os = "windows")]
fn set_click_through(window: &WebviewWindow, enabled: bool) -> Result<()> {
  let hwnd = hwnd_from_window(window)?;
  unsafe {
    let mut ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
    ex_style |= WS_EX_TOOLWINDOW;
    ex_style &= !WS_EX_APPWINDOW;

    if enabled {
      ex_style |= WS_EX_TRANSPARENT;
      ex_style |= WS_EX_LAYERED;
    } else {
      ex_style &= !WS_EX_TRANSPARENT;
    }

    SetWindowLongW(hwnd, GWL_EXSTYLE, ex_style as i32);
    let _ = SetWindowPos(
      hwnd,
      std::ptr::null_mut(),
      0,
      0,
      0,
      0,
      SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
    );
  }
  Ok(())
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn enum_windows_find_workerw(hwnd: HWND, lparam: LPARAM) -> i32 {
  let shell = FindWindowExW(
    hwnd,
    std::ptr::null_mut(),
    windows_sys::core::w!("SHELLDLL_DefView"),
    std::ptr::null(),
  );
  if !shell.is_null() {
    let out = lparam as *mut isize;
    let workerw = FindWindowExW(
      std::ptr::null_mut(),
      hwnd,
      windows_sys::core::w!("WorkerW"),
      std::ptr::null(),
    );
    *out = workerw as isize;
    return 0;
  }
  1
}

#[cfg(target_os = "windows")]
fn find_workerw() -> Option<HWND> {
  unsafe {
    let progman = FindWindowW(windows_sys::core::w!("Progman"), std::ptr::null());
    if !progman.is_null() {
      let _ = SendMessageTimeoutW(
        progman,
        0x052C,
        0 as WPARAM,
        0 as LPARAM,
        SMTO_NORMAL as SEND_MESSAGE_TIMEOUT_FLAGS,
        1000,
        std::ptr::null_mut(),
      );
    }

    let mut workerw: isize = 0;
    let _ = EnumWindows(Some(enum_windows_find_workerw), &mut workerw as *mut isize as LPARAM);

    if workerw == 0 {
      None
    } else {
      Some(workerw as HWND)
    }
  }
}

#[cfg(target_os = "windows")]
fn monitor_count() -> i32 {
  unsafe { GetSystemMetrics(SM_CMONITORS) }
}

#[cfg(target_os = "windows")]
fn virtual_bounds() -> (i32, i32, i32, i32) {
  unsafe {
    (
      GetSystemMetrics(SM_XVIRTUALSCREEN),
      GetSystemMetrics(SM_YVIRTUALSCREEN),
      GetSystemMetrics(SM_CXVIRTUALSCREEN).max(1),
      GetSystemMetrics(SM_CYVIRTUALSCREEN).max(1),
    )
  }
}

#[cfg(target_os = "windows")]
fn layout_host(window: &WebviewWindow) -> Result<()> {
  let hwnd = hwnd_from_window(window)?;
  let (x, y, w, h) = virtual_bounds();
  unsafe {
    let _ = MoveWindow(hwnd, x, y, w.max(1), h.max(1), 1);
    let _ = SetWindowPos(
      hwnd,
      HWND_BOTTOM,
      x,
      y,
      w.max(1),
      h.max(1),
      SWP_NOACTIVATE,
    );
  }
  Ok(())
}

#[cfg(target_os = "windows")]
fn attach_to_workerw(window: &WebviewWindow) -> Result<(bool, isize, isize, RectDebug)> {
  let hwnd = hwnd_from_window(window)?;
  let Some(workerw) = find_workerw() else {
    return Ok((false, 0, 0, RectDebug::default()));
  };

  unsafe {
    let _ = SetParent(hwnd, workerw);
  }

  layout_host(window)?;

  unsafe {
    let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
  }

  let parent = unsafe { GetParent(hwnd) } as isize;
  let rect = get_hwnd_rect(hwnd);
  Ok((true, workerw as isize, parent, rect))
}

fn emit_host_event<T: serde::Serialize + Clone>(app: &AppHandle, event: &str, payload: T) {
  if let Some(win) = app.get_webview_window(HOST_LABEL) {
    let _ = win.emit(event, payload);
  }
}

fn wait_for_host_ready(app: &AppHandle, timeout_ms: u64) -> bool {
  let started = std::time::Instant::now();
  while started.elapsed().as_millis() < timeout_ms as u128 {
    if let Ok(state) = app.state::<MotionWallpaperRuntime>().state.lock() {
      if state.host_ready {
        return true;
      }
    }
    std::thread::sleep(Duration::from_millis(50));
  }
  false
}

fn spawn_watcher_once(app: AppHandle) {
  let runtime = app.state::<MotionWallpaperRuntime>();
  if runtime.watcher_running.swap(true, Ordering::SeqCst) {
    return;
  }

  std::thread::spawn(move || loop {
    std::thread::sleep(Duration::from_secs(2));

    let running = match app.state::<MotionWallpaperRuntime>().state.lock() {
      Ok(state) => state.running,
      Err(_) => false,
    };

    if !running {
      continue;
    }

    #[cfg(target_os = "windows")]
    {
      let Some(win) = app.get_webview_window(HOST_LABEL) else {
        continue;
      };

      let should_reattach = match hwnd_from_window(&win) {
        Ok(hwnd) => {
          let current_worker = find_workerw().map(|w| w as isize).unwrap_or(0);
          let parent = unsafe { GetParent(hwnd) } as isize;
          parent == 0 || parent != current_worker
        }
        Err(_) => false,
      };

      if should_reattach {
        if let Ok((attached, worker, parent, rect)) = attach_to_workerw(&win) {
          if let Ok(mut state) = app.state::<MotionWallpaperRuntime>().state.lock() {
            state.attached = attached;
            state.workerw = worker;
            state.parent_hwnd = parent;
            state.last_rect = rect;
            state.monitors = monitor_count();
          }
        }
      }
    }
  });
}

#[tauri::command]
pub fn motion_wallpaper_pick_video() -> Result<Option<String>> {
  let selected = rfd::FileDialog::new()
    .add_filter("Video", &["mp4", "webm", "mkv", "mov", "avi"])
    .pick_file();
  Ok(selected.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn motion_wallpaper_host_ready(app: AppHandle) -> Result<()> {
  let runtime = app.state::<MotionWallpaperRuntime>();
  let mut state = runtime
    .state
    .lock()
    .map_err(|_| "state lock failed".to_string())?;
  state.host_ready = true;
  state.host_ready_at = Some(now_ms());
  state.last_error = None;

  if let Some(win) = app.get_webview_window(HOST_LABEL) {
    let _ = win.show();
  }

  Ok(())
}

#[tauri::command]
pub fn motion_wallpaper_start(app: AppHandle) -> Result<()> {
  #[cfg(target_os = "windows")]
  unsafe {
    let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  }

  let host_url = derive_host_url(&app)?;
  let host_url_str = host_url.to_string();

  let window = if let Some(existing) = app.get_webview_window(HOST_LABEL) {
    if let Err(err) = existing.navigate(host_url.clone()) {
      if let Ok(mut state) = app.state::<MotionWallpaperRuntime>().state.lock() {
        state.last_error = Some(format!("Falha ao navegar host: {err}"));
      }
    }
    existing
  } else {
    ensure_host_window(&app, &host_url)?
  };

  #[cfg(target_os = "windows")]
  {
    let _ = apply_toolwindow_style(&window);
  }

  {
    let runtime = app.state::<MotionWallpaperRuntime>();
    let mut state = runtime
      .state
      .lock()
      .map_err(|_| "state lock failed".to_string())?;
    state.running = true;
    state.attached = false;
    state.host_ready = false;
    state.host_exists = true;
    state.host_url = Some(host_url_str);
    state.last_error = None;
    #[cfg(target_os = "windows")]
    {
      state.monitors = monitor_count();
    }
  }

  spawn_watcher_once(app);
  Ok(())
}

#[tauri::command]
pub fn motion_wallpaper_set_video(app: AppHandle, path: String) -> Result<()> {
  {
    let runtime = app.state::<MotionWallpaperRuntime>();
    let mut state = runtime
      .state
      .lock()
      .map_err(|_| "state lock failed".to_string())?;
    state.video_path = Some(path.clone());
    state.last_error = None;
  }

  let host_url = derive_host_url(&app)?;
  let _ = ensure_host_window(&app, &host_url)?;
  emit_host_event(
    &app,
    "motion-wallpaper:set-video",
    serde_json::json!({ "path": path }),
  );
  Ok(())
}

#[tauri::command]
pub fn motion_wallpaper_set_volume(app: AppHandle, volume: u8) -> Result<()> {
  let vol = volume.min(100);
  {
    let runtime = app.state::<MotionWallpaperRuntime>();
    let mut state = runtime
      .state
      .lock()
      .map_err(|_| "state lock failed".to_string())?;
    state.volume = vol;
  }

  emit_host_event(
    &app,
    "motion-wallpaper:set-volume",
    serde_json::json!({ "volume": vol }),
  );
  Ok(())
}

#[tauri::command]
pub fn motion_wallpaper_apply(app: AppHandle) -> Result<()> {
  let host_url = derive_host_url(&app)?;
  let window = ensure_host_window(&app, &host_url)?;

  {
    let runtime = app.state::<MotionWallpaperRuntime>();
    let mut state = runtime
      .state
      .lock()
      .map_err(|_| "state lock failed".to_string())?;
    state.host_exists = true;
  }

  if !wait_for_host_ready(&app, 1500) {
    let runtime = app.state::<MotionWallpaperRuntime>();
    if let Ok(mut state) = runtime.state.lock() {
      state.last_error = Some("Host nao carregou a rota /#/wallpaper-host".to_string());
    }
    return Err("Host nao carregou a rota /#/wallpaper-host".to_string());
  }

  #[cfg(target_os = "windows")]
  {
    let (attached, worker, parent, rect) = attach_to_workerw(&window)?;
    if !attached || rect.w <= 0 || rect.h <= 0 {
      let message = format!(
        "Attach/layout falhou: attached={} rect=({}, {}, {}, {})",
        attached, rect.x, rect.y, rect.w, rect.h
      );
      if let Ok(mut state) = app.state::<MotionWallpaperRuntime>().state.lock() {
        state.last_error = Some(message.clone());
        state.attached = false;
        state.parent_hwnd = parent;
        state.last_rect = rect;
      }
      return Err(message);
    }

    let click_through = {
      let runtime = app.state::<MotionWallpaperRuntime>();
      let state = runtime
        .state
        .lock()
        .map_err(|_| "state lock failed".to_string())?;
      state.click_through
    };
    let _ = set_click_through(&window, click_through);

    {
      let runtime = app.state::<MotionWallpaperRuntime>();
      let mut state = runtime
        .state
        .lock()
        .map_err(|_| "state lock failed".to_string())?;
      state.running = true;
      state.attached = true;
      state.monitors = monitor_count();
      state.workerw = worker;
      state.parent_hwnd = parent;
      state.last_rect = rect;
      state.last_error = None;
    }
  }

  emit_host_event(&app, "motion-wallpaper:play", ());
  Ok(())
}

#[tauri::command]
pub fn motion_wallpaper_stop(app: AppHandle) -> Result<()> {
  emit_host_event(&app, "motion-wallpaper:stop", ());

  if let Some(win) = app.get_webview_window(HOST_LABEL) {
    #[cfg(target_os = "windows")]
    {
      if let Ok(hwnd) = hwnd_from_window(&win) {
        unsafe {
          let _ = ShowWindow(hwnd, SW_HIDE);
        }
      }
    }
    let _ = win.hide();
  }

  let runtime = app.state::<MotionWallpaperRuntime>();
  let mut state = runtime
    .state
    .lock()
    .map_err(|_| "state lock failed".to_string())?;
  state.running = false;
  state.attached = false;
  Ok(())
}

#[tauri::command]
pub fn motion_wallpaper_reload_host(app: AppHandle) -> Result<()> {
  if let Some(win) = app.get_webview_window(HOST_LABEL) {
    let _ = win.close();
  }

  let host_url = derive_host_url(&app)?;
  let host_url_str = host_url.to_string();
  let _ = ensure_host_window(&app, &host_url)?;

  {
    let runtime = app.state::<MotionWallpaperRuntime>();
    let mut state = runtime
      .state
      .lock()
      .map_err(|_| "state lock failed".to_string())?;
    state.host_ready = false;
    state.host_ready_at = None;
    state.last_video_event = None;
    state.last_error = None;
    state.attached = false;
    state.parent_hwnd = 0;
    state.last_rect = RectDebug::default();
    state.host_exists = true;
    state.host_url = Some(host_url_str);
  }

  Ok(())
}

#[tauri::command]
pub fn motion_wallpaper_status(app: AppHandle) -> Result<MotionWallpaperStatus> {
  let runtime = app.state::<MotionWallpaperRuntime>();
  let state = runtime
    .state
    .lock()
    .map_err(|_| "state lock failed".to_string())?;

  Ok(MotionWallpaperStatus {
    running: state.running,
    attached: state.attached,
    monitors: if state.monitors <= 0 { 1 } else { state.monitors },
    video_path: state.video_path.clone(),
    click_through: state.click_through,
    host_exists: state.host_exists,
    host_ready: state.host_ready,
    host_ready_at: state.host_ready_at,
    last_error: state.last_error.clone(),
    host_url: state.host_url.clone(),
  })
}

#[tauri::command]
pub fn motion_wallpaper_debug_state(app: AppHandle) -> Result<MotionWallpaperDebugState> {
  let runtime = app.state::<MotionWallpaperRuntime>();
  let state = runtime
    .state
    .lock()
    .map_err(|_| "state lock failed".to_string())?;

  let windows = app
    .webview_windows()
    .keys()
    .map(std::string::ToString::to_string)
    .collect::<Vec<_>>();
  let host_exists = windows.iter().any(|w| w == HOST_LABEL) || state.host_exists;

  Ok(MotionWallpaperDebugState {
    host_ready: state.host_ready,
    host_ready_at: state.host_ready_at,
    last_video_event: state.last_video_event.clone(),
    attached: state.attached,
    parent_hwnd: state.parent_hwnd,
    host_rect: state.last_rect.clone(),
    last_error: state.last_error.clone(),
    current_video_path: state.video_path.clone(),
    host_exists,
    windows,
    host_url: state.host_url.clone(),
  })
}

#[tauri::command]
pub fn motion_wallpaper_set_click_through(app: AppHandle, enabled: bool) -> Result<()> {
  {
    let runtime = app.state::<MotionWallpaperRuntime>();
    let mut state = runtime
      .state
      .lock()
      .map_err(|_| "state lock failed".to_string())?;
    state.click_through = enabled;
  }

  if let Some(win) = app.get_webview_window(HOST_LABEL) {
    #[cfg(target_os = "windows")]
    {
      let _ = set_click_through(&win, enabled);
    }
  }

  Ok(())
}
