/**
 * The schema map the lens's world answers from (punch list #194): each table's and view's columns
 * and foreign keys, and what each RPC returns. The `virtual:lens-schema` plugin in vite.config.ts
 * reads them from src/types/database.ts at build time (scripts/lens/lensSchema.ts), so there is no
 * generated file to keep in step. Types only.
 */

export type LensRelation = {
  /** The constraint's name, which an embed's `!hint` may name. */
  fk: string
  /** The key's columns, on the table that holds the key. */
  columns: string[]
  /** The table or view the key points at. */
  ref: string
  refColumns: string[]
  /** True when at most one row of the holding table points at each referenced row. */
  one: boolean
}

export type LensTableShape = { view?: true; columns: string[]; rel: LensRelation[] }

/**
 * What an RPC answers when the world has no handler for it: `set` no rows, `scalar` null, `void`
 * nothing, and `json` (an object, or a composite row) an error, because code that reads a field of
 * an object would crash on null, while every call site already handles an error.
 */
export type LensRpcKind = 'set' | 'scalar' | 'json' | 'void'

export type LensSchema = { tables: Record<string, LensTableShape>; rpcs: Record<string, LensRpcKind> }
