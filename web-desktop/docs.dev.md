### Web & Desktop Development Documentation

#### Desktop app prerequisites (Tauri)

- **Rust toolchain** via [rustup](https://rustup.rs/).
- **Microsoft Visual Studio C++ Build Tools** (MSVC + Windows SDK):
  https://aka.ms/vs/17/release/vs_BuildTools.exe
- WebView2 runtime — already ships with Windows 11.

#### Generate OpenAPI schema in TS

```bash
pnpm run generate-types
```

Output: types/schema.d.ts

#### Start both web and desktop

```bash
pnpm run tauri:dev     # launches Vite (port 5173) + the native window with HMR
pnpm run tauri:build   # produces an installer in src-tauri/target/release/bundle
pnpm tauri info        # diagnose the local toolchain
```

`tauri dev` runs `pnpm dev` for you (`beforeDevCommand`); `tauri build` runs
`pnpm build` and bundles `dist/` (`frontendDist`). The window points at the same
backend as the web app via `VITE_API_BASE_URL` (defaults to
`http://localhost:8080`).

##### Clean up local build (Tauri)

```bash
cargo clean -p drinkwater
```

Usecase: Clear all caches and old icons / images.
