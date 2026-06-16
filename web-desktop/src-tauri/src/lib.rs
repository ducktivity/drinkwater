use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  Manager, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Build the tray's right-click context menu. "Exit" is the only way to
      // actually quit the app — closing the window merely hides it (see below).
      let exit_item = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
      let tray_menu = Menu::with_items(app, &[&exit_item])?;

      TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Drinkwater")
        .menu(&tray_menu)
        // Only show the menu on right-click; left-click is reserved for
        // restoring the window below.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
          if event.id.as_ref() == "exit" {
            app.exit(0);
          }
        })
        .on_tray_icon_event(|tray, event| {
          // Left-click the tray icon to restore and focus the window.
          if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
          } = event
          {
            if let Some(window) = tray.app_handle().get_webview_window("main") {
              let _ = window.show();
              let _ = window.unminimize();
              let _ = window.set_focus();
            }
          }
        })
        .build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| {
      // Intercept the window's close button: hide to the tray instead of
      // quitting. The app stays alive in the background until "Exit" is
      // selected from the tray menu.
      if let WindowEvent::CloseRequested { api, .. } = event {
        let _ = window.hide();
        api.prevent_close();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
