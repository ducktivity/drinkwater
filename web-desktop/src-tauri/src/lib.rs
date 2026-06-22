use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  Manager, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    // Auto-update plugins. `updater` exposes the JS check/download/install API;
    // `process` exposes relaunch so the app can restart itself after applying.
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    // Run-on-startup. The `--autostart` arg is what the OS login entry launches
    // the app with, so we can detect a startup launch (vs. a manual one) below
    // and start hidden in the tray instead of showing the window.
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      Some(vec!["--autostart"]),
    ))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // When launched at login (the OS passes `--autostart`), keep the window
      // hidden so the app sits quietly in the tray rather than popping up. A
      // normal manual launch leaves the window visible as usual.
      if std::env::args().any(|arg| arg == "--autostart") {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.hide();
        }
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
