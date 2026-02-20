#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

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

fn main() {
  tauri::Builder::default()
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
