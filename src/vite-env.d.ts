/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Optional override for Lien Tooling (default https://lientooling.com). */
  readonly VITE_LIEN_TOOLING_ORIGIN?: string
  /** Optional Maps JavaScript API browser key (v2.3145); unset → the Dashboard jobs map uses OpenStreetMap. */
  readonly VITE_GOOGLE_MAPS_BROWSER_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** The punch-list board, rendered at build time from `to-dos/` by `todoBoardPlugin` (vite.config.ts, v2.3623). */
declare module 'virtual:punch-list' {
  import type { BoardData } from './lib/todos/todoBoard'
  const data: BoardData
  export default data
}
