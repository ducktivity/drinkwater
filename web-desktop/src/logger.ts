/**
 * Dev-only console wrapper for background/debug logging.
 *
 * Background work (the sync engine, reminders, fire-and-forget effects) logs
 * progress and swallowed failures that are handy while developing but are pure
 * noise — or leak internals — in a production build. These methods forward to
 * the matching `console` method during `vite dev` and become no-ops in
 * production bundles, so call sites stay readable without sprinkling
 * `import.meta.env.DEV` checks everywhere.
 *
 * User-facing failures must NOT go here: surface those with a toast so the user
 * actually sees them (see context/ToastContext).
 */
const isDev = import.meta.env.DEV

// Bind to console (rather than wrapping) so the browser devtools still report
// the real call-site file and line, not this module.
const noop = () => {}

export const logger = {
  log: isDev ? console.log.bind(console) : noop,
  info: isDev ? console.info.bind(console) : noop,
  warn: isDev ? console.warn.bind(console) : noop,
  error: isDev ? console.error.bind(console) : noop,
  debug: isDev ? console.debug.bind(console) : noop,
}
