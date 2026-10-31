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
 *  - `callsAhead` pairs them: a call whose name a pending migration creates is ahead of its
 *    migration — `missing` when no applied migration creates it (prod answers a 404), `replaced`
 *    when one does (prod's old body answers, and refuses what only the new body takes: #6474's
 *    `land_field_press` with the kinds `job_note` and `field_report`).
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

/** A call and the pending migrations that create or replace what it calls. */
export type CallAhead = {
  file: string
  call: SchemaCall
  migrations: string[]
  /**
   * `missing`: no applied migration creates the name, so prod answers a 404 until the push.
   * `replaced`: prod has the name and a pending migration replaces it, so the old body answers
   * until the push — a refusal when the client sends what only the new body takes (#6474).
   */
  why: 'missing' | 'replaced'
}

/** The one sentence the check prints on a finding: what to do, in the order it must happen. */
export const CALLS_AHEAD_ADVICE =
  'Push the migration right after the merge, before the Pages deploy finishes (bash scripts/db-push.sh from the main checkout), and arm the PR only when the person who pushes is at hand: the deploy holds until the push.'

/** The GitHub label the check puts on a pull request whose client calls ahead of its migration. */
export const CALLS_AHEAD_LABEL = 'push right after the merge'

/** GitHub refuses a label whose description runs past 100 characters (v2.6254: 110 kept the label off every PR). */
export const GITHUB_LABEL_DESCRIPTION_MAX = 100

/** The label's color, and the line GitHub's label list shows under it. */
export const CALLS_AHEAD_LABEL_COLOR = 'D93F0B'
export const CALLS_AHEAD_LABEL_DESCRIPTION = 'Its client calls what only its migration creates: push right after the merge'

/**
 * The `gh api` calls that put the label on pull request `number` of `repo` (`owner/name`): read the
 * label, make it when the repo lacks it, add it to the pull request. REST throughout, since
 * `gh pr edit` fails quietly in this repo. `pull-requests: write` covers all three: GitHub lists
 * every label endpoint under both the Issues and the Pull requests permission.
 */
export function callsAheadLabelCalls(repo: string, number: number): { read: string[]; make: string[]; add: string[] } {
  const base = `repos/${repo}`
  return {
    read: ['api', `${base}/labels/${encodeURIComponent(CALLS_AHEAD_LABEL)}`],
    make: ['api', '-X', 'POST', `${base}/labels`, '-f', `name=${CALLS_AHEAD_LABEL}`, '-f', `color=${CALLS_AHEAD_LABEL_COLOR}`, '-f', `description=${CALLS_AHEAD_LABEL_DESCRIPTION}`],
    add: ['api', '-X', 'POST', `${base}/issues/${number}/labels`, '-f', `labels[]=${CALLS_AHEAD_LABEL}`],
  }
}

type GitHubErrorBody = { message?: string; errors?: Array<{ message?: string; field?: string; code?: string }> }

function gitHubErrorBody(stdout: string): GitHubErrorBody | null {
  try {
    const body = JSON.parse(stdout) as unknown
    return body && typeof body === 'object' ? (body as GitHubErrorBody) : null
  } catch {
    return null
  }
}

/** True when a failed make says the label is already there (another run made it first): carry on to the add. */
export function labelAlreadyExists(stdout: string): boolean {
  return (gitHubErrorBody(stdout)?.errors ?? []).some((e) => e.code === 'already_exists')
}

/**
 * Why a `gh api` call failed, in GitHub's own words: the response's message and field errors when
 * it sent JSON (`Validation Failed: description is too long (maximum is 100 characters)`), else the
 * first line gh wrote, else the first line of the error itself. Never the command line alone when
 * GitHub said more.
 */
export function ghFailureWords(stdout: string, stderr: string, message: string): string {
  const body = gitHubErrorBody(stdout)
  if (body) {
    const details = (body.errors ?? []).map((e) => e.message ?? [e.field, e.code].filter(Boolean).join(' ')).filter((d) => d.length > 0)
    const head = body.message ?? ''
    if (details.length > 0) return head ? `${head}: ${details.join('; ')}` : details.join('; ')
    if (head) return head
  }
  const line = stderr.split('\n').map((l) => l.trim()).find((l) => l.length > 0)
  return line ?? message.split('\n')[0] ?? ''
}

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
    const first = ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) ? node.arguments[0] : undefined
    if (first && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text
      if (method === 'rpc' || (method === 'from' && !readsNoTable(node.expression.expression))) {
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
      const name = (m[1] ?? '').toLowerCase()
      if (!name) continue
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
 * `applied` is everything the migrations prod already has create. A call is `missing` when a
 * pending migration creates its name and no applied one does (prod answers a 404 until the push),
 * and `replaced` when an applied one does too (a `CREATE OR REPLACE` of a function prod already
 * has: the old body answers until the push, and refuses what only the new body takes).
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
      const list = createdBy.get(key) ?? []
      list.push(file)
      createdBy.set(key, list)
    }
  }
  const out: CallAhead[] = []
  for (const { file, calls: found } of calls) {
    for (const call of found) {
      const key = callKey(call)
      const migrations = createdBy.get(key)
      if (migrations) out.push({ file, call, migrations: [...migrations].sort(), why: before.has(key) ? 'replaced' : 'missing' })
    }
  }
  return out
}
