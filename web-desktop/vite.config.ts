import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

// `@tauri-apps/cli` sets this when targeting a mobile device on the LAN; on desktop it is undefined and the dev server binds to localhost as usual.
const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), solid()],

  // Tauri integration (https://tauri.app/start/frontend/vite/): keep the Rust compiler's error output visible instead of letting Vite wipe the terminal on each reload.
  clearScreen: false,
  server: {
    // Tauri's `devUrl` is pinned to 5173, so fail loudly rather than silently hopping to another port when 5173 is taken.
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // The Rust shell is built by Cargo, not Vite — don't trigger HMR on it.
      ignored: ['**/src-tauri/**'],
    },
  },
  // Expose Tauri's build-time env vars to the client alongside our own VITE_*.
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
})
