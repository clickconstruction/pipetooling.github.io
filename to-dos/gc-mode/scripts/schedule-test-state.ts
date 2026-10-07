/**
 * Writes main's test data for the schedule's kernels (`src/lib/gc/schedule/testState.ts`, the schedule's
 * PR 1a): the prototype's made-up data, `initialGcState()`, cut to the fields main's kernels read, as
 * the lifts in `LIFTS` list them (their `types` fields and their `slice`). Run it on the spike:
 *
 *   VITE_SUPABASE_URL=http://x VITE_SUPABASE_ANON_KEY=x npx vite-node to-dos/gc-mode/scripts/schedule-test-state.ts --out <out.ts>
 *
 * `--with <lift.json>` adds a lift for one run: the data its PR carries, before its follow-up lists it
 * in `LIFTS` with main's new copy.
 *
 * `testStateSource` is exported, so the spike's test holds main's file to exactly what this writes
 * (`gcScheduleTestState.test.ts`). Imported there, it writes nothing: only `--out` writes.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { initialGcState } from '../../../src/lib/gcMode/gcFixture'

type Lift = {
  types: { to: string; fields?: Record<string, string[] | 'all'> }[]
  slice?: { root?: string; nested: Record<string, Record<string, string>> }
}
/** The lifts whose fields main's test data carries, oldest first. A later lift's list for a shape replaces an earlier one's. */
const LIFTS = ['schedule-pr1a.lift.json', 'schedule-pr1b-i.lift.json', 'schedule-pr1b-ii.lift.json', 'board-b2-i.lift.json', 'building-u2.lift.json']
const withAt = process.argv.indexOf('--with')
const withLift = withAt > 0 ? process.argv[withAt + 1] : undefined
const lifts = [...LIFTS, ...(withLift ? [withLift] : [])].map((f) => JSON.parse(readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')) as Lift)
const fields = Object.assign({}, ...lifts.flatMap((l) => l.types.map((t) => t.fields ?? {}))) as Record<string, string[] | 'all'>
const nestedOf: Record<string, Record<string, string>> = {}
for (const l of lifts) for (const [shape, map] of Object.entries(l.slice?.nested ?? {})) nestedOf[shape] = { ...(nestedOf[shape] ?? {}), ...map }
const rootShape = lifts.find((l) => l.slice)?.slice?.root ?? 'GcState'

/** A value cut to a named shape's fields; a field holding another named shape is cut to it in turn. */
function cut(value: unknown, shape: string): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((v) => cut(v, shape))
  const keep = fields[shape]
  if (!keep || keep === 'all' || typeof value !== 'object') return value
  const nested = nestedOf[shape] ?? {}
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
  return cut(state, rootShape)
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

/** The whole of main's `testState.ts`, as this script writes it. */
export function testStateSource(state = initialGcState()): string {
  return `/**
 * Test data only: the app never reads it. It is the GC mode prototype's made-up data
 * (\`initialGcState\` in \`gcFixture.ts\`, branch spike/gc-mode), cut to the fields main's GC kernels
 * read (\`../types.ts\` and \`./types.ts\`). Written by to-dos/gc-mode/scripts/schedule-test-state.ts on
 * the spike, never by hand; the spike's test holds the two equal.
 */
import type { GcState } from '../types'

const DATA: GcState = ${literal(sliceOf(state))}

/** A fresh copy each call, like the prototype's \`initialGcState\`, so a test may change what it gets. */
export function initialGcState(): GcState {
  return structuredClone(DATA)
}
`
}

const outAt = process.argv.indexOf('--out')
const out = outAt > 0 ? process.argv[outAt + 1] : undefined
if (out) {
  writeFileSync(out, testStateSource())
  console.log(`wrote ${out}`)
}
