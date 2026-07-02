/// <reference types="vite/client" />

// Type the custom build-time env vars we read via import.meta.env so the
// strict TypeScript build (tsc -b) treats them as known instead of `any`.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_IDENTITY_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
