mod motion_wallpaper;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg(target_os = "windows")]
fn disable_rounded_corners() {
  use windows::Win32::Graphics::Dwm::{DWMWA_WINDOW_CORNER_PREFERENCE, DwmSetWindowAttribute};
  use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

  unsafe {
    let hwnd = GetForegroundWindow();
    if hwnd.0.is_null() {
      return;
    }

    let preference: u32 = 1;

    let _ = DwmSetWindowAttribute(
      hwnd,
      DWMWA_WINDOW_CORNER_PREFERENCE,
      &preference as *const _ as _,
      std::mem::size_of::<u32>() as u32,
    );
  }
}

#[tauri::command]
fn open_widget_window(
  app: tauri::AppHandle,
  label: String,
  widget_id: String,
  module_id: String,
) -> Result<(), String> {
  if let Some(existing) = app.get_webview_window(&label) {
    let _ = existing.set_focus();
    return Ok(());
  }

  let url = format!("/#/widget?widgetId={widget_id}&moduleId={module_id}");
  WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .resizable(true)
    .min_inner_size(400.0, 600.0)
    .build()
    .map_err(|error| error.to_string())?;

  Ok(())
}

#[tauri::command]
fn close_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
  if let Some(window) = app.get_webview_window(&label) {
    window.close().map_err(|error| error.to_string())?;
  }
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(motion_wallpaper::MotionWallpaperRuntime::default())
    .setup(|app| {
      motion_wallpaper::register_event_listeners(&app.handle());

      let window = app.get_webview_window("main").expect("main window not found");
      let _ = window.set_decorations(false);
      let _ = window.set_shadow(false);

      #[cfg(target_os = "windows")]
      disable_rounded_corners();

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      open_widget_window,
      close_window,
      motion_wallpaper::motion_wallpaper_pick_video,
      motion_wallpaper::motion_wallpaper_start,
      motion_wallpaper::motion_wallpaper_set_video,
      motion_wallpaper::motion_wallpaper_set_volume,
      motion_wallpaper::motion_wallpaper_apply,
      motion_wallpaper::motion_wallpaper_stop,
      motion_wallpaper::motion_wallpaper_reload_host,
      motion_wallpaper::motion_wallpaper_host_ready,
      motion_wallpaper::motion_wallpaper_status,
      motion_wallpaper::motion_wallpaper_debug_state,
      motion_wallpaper::motion_wallpaper_set_click_through
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
