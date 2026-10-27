/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
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

/** The lens's schema map, read from src/types/database.ts at build time by `lensSchemaPlugin` (vite.config.ts, punch list #194). */
declare module 'virtual:lens-schema' {
  import type { LensSchema } from './lib/lens/answer/lensSchemaTypes'
  const schema: LensSchema
  export default schema
}

/** The theme's light and dark token blocks, read from src/index.css at build time by `lensTokensPlugin` (vite.config.ts, punch list #194). */
declare module 'virtual:lens-tokens' {
  import type { ThemeTokens } from './lib/lens/lensTokens'
  const tokens: ThemeTokens
  export default tokens
}
