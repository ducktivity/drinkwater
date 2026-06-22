import { logger } from './logger'

/**
 * Desktop auto-update: checks the GitHub Release feed, and if a newer signed
 * build exists, downloads and installs it, then relaunches into the new version.
 *
 * This only runs inside the Tauri desktop shell. The same SolidJS bundle is also
 * deployed to the web (Cloudflare Pages), where there is nothing to "update" —
 * the browser always loads the latest deploy — so the whole flow is a no-op
 * there and the heavy `@tauri-apps/plugin-updater` code is only imported on
 * desktop (dynamic import, mirroring reminder.ts).
 */

/**
 * Whether we're running inside the Tauri desktop shell (vs. a plain browser).
 * Tauri injects `__TAURI_INTERNALS__` onto the window, so its presence is a
 * reliable, import-free way to branch between the native and web paths.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** How the caller is told about update progress (wired to the toast queue). */
type Notify = (message: string, type?: 'error' | 'info') => void

/**
 * Checks for a desktop update and, if one is available, applies it and
 * relaunches. Safe to call unconditionally on app startup: it returns
 * immediately on the web and swallows all errors (a failed update check must
 * never block the app from starting). The existing version keeps running if
 * anything goes wrong; the next launch simply tries again.
 */
export async function checkForUpdates(notify?: Notify): Promise<void> {
  if (!isTauri()) return

  try {
    const { check } = await import('@tauri-apps/plugin-updater')

    const update = await check()
    if (!update) {
      logger.info('updater: already up to date')
      return
    }

    logger.info(`updater: update available -> ${update.version}`)
    notify?.(`Updating Drinkwater to v${update.version}…`, 'info')

    // Download and install the signed installer. The callback streams progress;
    // we only log it (a small app updates in a second or two — no progress bar).
    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        logger.info(
          `updater: downloading ${event.data.contentLength ?? '?'} bytes`,
        )
      } else if (event.event === 'Finished') {
        logger.info('updater: download finished, installing')
      }
    })

    // Restart into the freshly installed version. On Windows the NSIS installer
    // has already replaced the binary at this point.
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  } catch (err) {
    // Never surface a scary error for a routine background check; just log it.
    // (No network, GitHub down, or no release yet all land here harmlessly.)
    logger.error('updater: check/install failed', err)
  }
}
