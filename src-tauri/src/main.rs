#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

    // 1 = DWMWCP_DONOTROUND
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

  let url = format!("/widget?widgetId={widget_id}&moduleId={module_id}");
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

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![open_widget_window, close_window])
    .setup(|app| {
      let window = app.get_webview_window("main").expect("main window not found");

      let _ = window.set_decorations(false);
      let _ = window.set_shadow(false);

      #[cfg(target_os = "windows")]
      disable_rounded_corners();

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
