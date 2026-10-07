/**
 * Writes main's test data for the schedule's kernels (`src/lib/gc/schedule/testState.ts`, the schedule's
 * PR 1a): the prototype's made-up data, `initialGcState()`, cut to the fields main's kernels read, as
 * `schedule-pr1a.lift.json` lists them (its `types` fields and its `slice`). Run it on the spike:
 *
 *   VITE_SUPABASE_URL=http://x VITE_SUPABASE_ANON_KEY=x npx vite-node to-dos/gc-mode/scripts/schedule-test-state.ts <out.ts>
 *
 * `sliceOf` is exported, so the spike's test can hold main's copy equal to the fixture.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { initialGcState } from '../../../src/lib/gcMode/gcFixture'

type Lift = {
  types: { to: string; fields?: Record<string, string[] | 'all'> }[]
  slice: { root: string; nested: Record<string, Record<string, string>> }
}
const lift = JSON.parse(readFileSync(new URL('./schedule-pr1a.lift.json', import.meta.url), 'utf8')) as Lift
const fields = Object.assign({}, ...lift.types.map((t) => t.fields ?? {})) as Record<string, string[] | 'all'>

/** A value cut to a named shape's fields; a field holding another named shape is cut to it in turn. */
function cut(value: unknown, shape: string): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((v) => cut(v, shape))
  const keep = fields[shape]
  if (!keep || keep === 'all' || typeof value !== 'object') return value
  const nested = lift.slice.nested[shape] ?? {}
  const out: Record<string, unknown> = {}
  for (const f of keep) {
    const v = (value as Record<string, unknown>)[f]
    if (v === undefined) continue
    out[f] = nested[f] ? cut(v, nested[f]) : v
  }
  return out
}

/** The made-up data as main's kernels read it. */
export function sliceOf(state = initialGcState()): unknown {
  return cut(state, lift.slice.root)
}

const key = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`)
const str = (v: string) => `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** On one line, when it is short: `{ id: 'site-1', label: 'Paving' }`. */
function oneLine(v: unknown): string {
  if (v === null) return 'null'
  if (typeof v === 'string') return str(v)
  if (typeof v !== 'object') return String(v)
  if (Array.isArray(v)) return `[${v.map(oneLine).join(', ')}]`
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined)
  return entries.length ? `{ ${entries.map(([k, x]) => `${key(k)}: ${oneLine(x)}`).join(', ')} }` : '{}'
}

/** A TypeScript literal in the repo's style: single quotes, bare keys, two spaces, a short value on one line, no undefined. */
function literal(v: unknown, indent = ''): string {
  const next = indent + '  '
  if (v === null || typeof v !== 'object') return oneLine(v)
  const flat = oneLine(v)
  if (flat.length + indent.length <= 120) return flat
  if (Array.isArray(v)) return `[\n${v.map((x) => next + literal(x, next)).join(',\n')},\n${indent}]`
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined)
  return `{\n${entries.map(([k, x]) => `${next}${key(k)}: ${literal(x, next)}`).join(',\n')},\n${indent}}`
}

const out = process.argv[2]
if (out) {
  writeFileSync(
    out,
    `/**
 * Test data only: the app never reads it. It is the GC mode prototype's made-up data
 * (\`initialGcState\` in \`gcFixture.ts\`, branch spike/gc-mode), cut to the fields main's GC kernels
 * read (\`../types.ts\` and \`./types.ts\`). Written by to-dos/gc-mode/scripts/schedule-test-state.ts on
 * the spike, never by hand; the spike's test holds the two equal.
 */
import type { GcState } from '../types'

const DATA: GcState = ${literal(sliceOf())}

/** A fresh copy each call, like the prototype's \`initialGcState\`, so a test may change what it gets. */
export function initialGcState(): GcState {
  return structuredClone(DATA)
}
`,
  )
  console.log(`wrote ${out}`)
}
