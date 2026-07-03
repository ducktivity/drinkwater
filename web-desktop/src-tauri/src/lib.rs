use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  Manager, WindowEvent,
};

/// Nudge WebView2's memory target down when the window is hidden in the tray and back up when it returns to the foreground. `Low` asks Chromium to release caches and unused heap; `Normal` restores the default. Windows-only (WebView2 is the only backend exposing this), and a no-op elsewhere. Crucially, unlike suspending the webview this leaves JS timers running, so the in-page hydration reminder (`setInterval` in reminder.ts) keeps firing while the app sits quietly in the tray.
fn set_webview_memory_low(window: &tauri::WebviewWindow, low: bool) {
  #[cfg(windows)]
  {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
      ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
      COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
    };
    use windows::core::Interface;

    let _ = window.with_webview(move |webview| unsafe {
      let controller = webview.controller();
      if let Ok(core) = controller.CoreWebView2() {
        // MemoryUsageTargetLevel lives on ICoreWebView2_19 (shipped with Edge 114). On an older runtime the cast fails and we simply skip the hint rather than error.
        if let Ok(core) = core.cast::<ICoreWebView2_19>() {
          let level = if low {
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
          } else {
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
          };
          let _ = core.SetMemoryUsageTargetLevel(level);
        }
      }
    });
  }
  #[cfg(not(windows))]
  {
    let _ = (window, low);
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Trim WebView2's always-on memory before the webview is created. `--disable-gpu` drops the dedicated GPU process (software compositing is more than enough for this small, mostly-static UI) and `--renderer-process-limit=1` holds Chromium to a single renderer. WebView2 reads this env var when it launches its browser process. Windows-only.
  #[cfg(windows)]
  std::env::set_var(
    "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
    "--disable-gpu --renderer-process-limit=1",
  );

  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    // Auto-update plugins. `updater` exposes the JS check/download/install API; `process` exposes relaunch so the app can restart itself after applying.
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    // Run-on-startup. The `--autostart` arg is what the OS login entry launches the app with, so we can detect a startup launch (vs. a manual one) below and start hidden in the tray instead of showing the window.
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

      // When launched at login (the OS passes `--autostart`), keep the window hidden so the app sits quietly in the tray rather than popping up. A normal manual launch leaves the window visible as usual.
      if std::env::args().any(|arg| arg == "--autostart") {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.hide();
          // Launched straight into the tray — start in the low-memory target so a login-time app doesn't hold its full footprint while unseen.
          set_webview_memory_low(&window, true);
        }
      }

      // Build the tray's right-click context menu. "Exit" is the only way to actually quit the app — closing the window merely hides it (see below).
      let exit_item = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
      let tray_menu = Menu::with_items(app, &[&exit_item])?;

      TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Drinkwater")
        .menu(&tray_menu)
        // Only show the menu on right-click; left-click is reserved for restoring the window below.
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
    .on_window_event(|window, event| match event {
      // Intercept the window's close button: hide to the tray instead of quitting. The app stays alive in the background until "Exit" is selected from the tray menu. While hidden, let WebView2 trim its memory.
      WindowEvent::CloseRequested { api, .. } => {
        let _ = window.hide();
        if let Some(webview) = window.get_webview_window(window.label()) {
          set_webview_memory_low(&webview, true);
        }
        api.prevent_close();
      }
      // Back in the foreground — via the tray-click restore or the reminder popping the window forward — restore the normal memory target so the UI is immediately responsive.
      WindowEvent::Focused(true) => {
        if let Some(webview) = window.get_webview_window(window.label()) {
          set_webview_memory_low(&webview, false);
        }
      }
      _ => {}
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
