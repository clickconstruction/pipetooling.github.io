/**
 * Calls ahead of their migration: the finder behind `npm run check:calls-ahead`
 * (`scripts/check-calls-ahead.ts`). The client deploys to GitHub Pages on every merge; a migration
 * waits for a hand `supabase db push`. So a client that calls a function, table or view that only a
 * still-pending migration creates is broken on prod from the deploy until the push: PostgREST
 * answers the missing name with a 404 (`PGRST202`), which the client reads as a refusal, not a lost
 * signal. On 2026-10-30 #6473 (v2.6099) did this with `land_field_press`, and every clock press on
 * prod was refused from 4:57 AM until the push (CLAUDE.md → Deploy model).
 *
 * Three pure pieces, each tested in `callsAhead.test.ts`:
 *  - `schemaCallsIn` reads the names a TypeScript source calls through `.rpc('name')` and
 *    `.from('name')`, by the compiler's own parse, so a name inside a comment is not a call.
 *    `storage.from('bucket')` and a constructor's `Array.from(…)` are not reads of a table.
 *  - `namesCreatedIn` reads the functions, tables and views a migration's SQL creates, with its
 *    comments stripped first.
 *  - `callsAhead` pairs them: a call whose name is created only by the given pending migrations
 *    (none of the applied ones creates it, so prod does not have it) is ahead of its migration.
 *
 * The TypeScript compiler is loaded through `createRequire`, as `emptyStateCheck.ts` does: its
 * CommonJS bundle has no named ESM exports, so a static import gives an empty namespace under Node.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts: typeof import('typescript') = require('typescript')

type Node = import('typescript').Node
type Expression = import('typescript').Expression

export type SchemaCall = {
  /** `rpc` reads a function, `from` a table or a view. */
  kind: 'rpc' | 'from'
  name: string
  /** The 1-based line of the call's name. */
  line: number
}

export type CreatedName = {
  kind: 'function' | 'table' | 'view'
  name: string
}

/** A call and the pending migrations that create what it calls. */
export type CallAhead = {
  file: string
  call: SchemaCall
  migrations: string[]
}

/** The one sentence the check prints on a finding: what to do, in the order it must happen. */
export const CALLS_AHEAD_ADVICE =
  'Push the migration right after the merge, before the Pages deploy finishes (bash scripts/db-push.sh from the main checkout), and arm the PR only when the person who pushes is at hand: the deploy holds until the push.'

/** The GitHub label the check puts on a pull request whose client calls ahead of its migration. */
export const CALLS_AHEAD_LABEL = 'push right after the merge'

function literalText(expr: Expression): string | null {
  const e = ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr) ? expr.expression : expr
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text
  return null
}

/** `supabase.storage.from('bucket')` reads a bucket; `Array.from(…)` / `Buffer.from(…)` build a value. */
function readsNoTable(object: Expression): boolean {
  if (ts.isPropertyAccessExpression(object) && object.name.text === 'storage') return true
  if (ts.isIdentifier(object) && /^[A-Z]/.test(object.text)) return true
  return false
}

/** Every `.rpc('name')` and `.from('name')` with a literal name in a `.ts` / `.tsx` source, with its line. */
export function schemaCallsIn(source: string, fileName: string): SchemaCall[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind)
  const out: SchemaCall[] = []
  const visit = (node: Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.arguments.length > 0) {
      const method = node.expression.name.text
      if (method === 'rpc' || (method === 'from' && !readsNoTable(node.expression.expression))) {
        const first = node.arguments[0]
        const name = literalText(first)
        if (name !== null) out.push({ kind: method, name, line: sf.getLineAndCharacterOfPosition(first.getStart(sf)).line + 1 })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

const CREATE_FUNCTION = /\bcreate\s+(?:or\s+replace\s+)?function\s+(?:"?[a-z_][a-z0-9_]*"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?/gi
const CREATE_TABLE = /\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:"?[a-z_][a-z0-9_]*"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?/gi
const CREATE_VIEW = /\bcreate\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?(?:"?[a-z_][a-z0-9_]*"?\s*\.\s*)?"?([a-z_][a-z0-9_]*)"?/gi

/** The SQL with its line comments (`--`) and block comments removed, so a commented CREATE is not one. */
function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
}

/** Every function, table and view a migration creates, each name once, in lower case without its schema. */
export function namesCreatedIn(sql: string): CreatedName[] {
  const text = stripSqlComments(sql)
  const out: CreatedName[] = []
  const seen = new Set<string>()
  const add = (kind: CreatedName['kind'], re: RegExp): void => {
    for (const m of text.matchAll(re)) {
      const name = m[1].toLowerCase()
      const key = `${kind}:${name}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ kind, name })
    }
  }
  add('function', CREATE_FUNCTION)
  add('table', CREATE_TABLE)
  add('view', CREATE_VIEW)
  return out
}

/** The key a call and a created name meet on: a function for `.rpc`, a relation (table or view) for `.from`. */
export function createdKey(c: CreatedName): string {
  return c.kind === 'function' ? `function:${c.name}` : `relation:${c.name}`
}

export function callKey(c: SchemaCall): string {
  return c.kind === 'rpc' ? `function:${c.name.toLowerCase()}` : `relation:${c.name.toLowerCase()}`
}

/**
 * The calls that are ahead of their migration. `pending` maps a migration file to what it creates;
 * `applied` is everything the migrations prod already has create. A call is ahead when a pending
 * migration creates its name and no applied one does: a `CREATE OR REPLACE` of a function prod
 * already has answers with the old body, never a 404, so it is not listed here.
 */
export function callsAhead(
  calls: ReadonlyArray<{ file: string; calls: ReadonlyArray<SchemaCall> }>,
  pending: ReadonlyMap<string, ReadonlyArray<CreatedName>>,
  applied: ReadonlyArray<CreatedName>,
): CallAhead[] {
  const before = new Set(applied.map(createdKey))
  const createdBy = new Map<string, string[]>()
  for (const [file, names] of pending) {
    for (const n of names) {
      const key = createdKey(n)
      if (before.has(key)) continue
      const list = createdBy.get(key) ?? []
      list.push(file)
      createdBy.set(key, list)
    }
  }
  const out: CallAhead[] = []
  for (const { file, calls: found } of calls) {
    for (const call of found) {
      const migrations = createdBy.get(callKey(call))
      if (migrations) out.push({ file, call, migrations: [...migrations].sort() })
    }
  }
  return out
}

/** The findings on the lines a change wrote. */
export function callsOnChangedLines(found: ReadonlyArray<SchemaCall>, changed: ReadonlySet<number>): SchemaCall[] {
  return found.filter((f) => changed.has(f.line))
}
