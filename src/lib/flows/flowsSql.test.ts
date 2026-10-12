import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FLOW_FACTS, FLOW_KINDS, FLOW_PAPERS } from './facts'
import { SEED_FLOWS } from './seed'
import { LANE_WORDS, NUDGE_DAY_WORDS, NUDGE_HOW_WORDS } from './state'

/** The newest migration that says `marker`: a later one replaces an earlier one's function. */
function newestSaying(marker: string): string {
  const dir = join(process.cwd(), 'supabase', 'migrations')
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  const hit = files.filter((f) => readFileSync(join(dir, f), 'utf8').includes(marker)).pop()
  if (!hit) throw new Error(`no migration says ${marker}`)
  return readFileSync(join(dir, hit), 'utf8')
}

/** The quoted words in a function's `ARRAY[…]` body. */
function arrayOf(sql: string, fn: string): string[] {
  const body = sql.slice(sql.indexOf(`FUNCTION public.${fn}()`))
  const list = /ARRAY\[([^\]]*)\]/.exec(body)?.[1] ?? ''
  return [...list.matchAll(/'([^']*)'/g)].map((m) => m[1]!)
}

/** The quoted words a CHECK allows: `CONSTRAINT <name> CHECK (<column> IN ('a', 'b'))`. */
function checkOf(sql: string, name: string): string[] {
  const at = sql.indexOf(`CONSTRAINT ${name} CHECK`)
  if (at < 0) throw new Error(`no CHECK ${name}`)
  const list = /IN \(([^)]*)\)/.exec(sql.slice(at))?.[1] ?? ''
  return [...list.matchAll(/'([^']*)'/g)].map((m) => m[1]!)
}

const q = (v: string | null | undefined) => (v == null ? 'NULL' : `'${v.replace(/'/g, "''")}'`)
const arr = (xs: readonly string[]) => (xs.length ? `ARRAY[${xs.map(q).join(', ')}]` : "'{}'::text[]")

describe('the flows migration holds the code lists and the seed', () => {
  const sql = newestSaying('FUNCTION public.flows_seed()')

  it('allows exactly the facts and the papers in facts.ts', () => {
    expect(arrayOf(newestSaying('FUNCTION public.flow_fact_ids()'), 'flow_fact_ids')).toEqual(FLOW_FACTS.map((f) => f.id))
    expect(arrayOf(newestSaying('FUNCTION public.flow_paper_ids()'), 'flow_paper_ids')).toEqual(Object.keys(FLOW_PAPERS))
  })

  it('allows exactly the lanes, whose moves, phases and nudges the kernels know', () => {
    const steps = newestSaying('CREATE TABLE IF NOT EXISTS public.flow_steps')
    expect(checkOf(steps, 'flow_steps_lane_known')).toEqual(Object.keys(LANE_WORDS))
    expect(checkOf(steps, 'flow_steps_phase_known')).toEqual(['setup', 'pricing', 'building'])
    expect(checkOf(steps, 'flow_steps_who_known')).toEqual(['us', 'them', 'both'])
    expect(checkOf(steps, 'flow_steps_nudge_how_known')).toEqual(Object.keys(NUDGE_HOW_WORDS))
    expect(checkOf(steps, 'flow_steps_nudge_day_known')).toEqual(Object.keys(NUDGE_DAY_WORDS))
    expect(checkOf(steps, 'flows_kind_known')).toEqual(FLOW_KINDS)
  })

  it('seeds every step of SEED_FLOWS, and nothing else', () => {
    const want: string[] = []
    for (const kind of Object.keys(SEED_FLOWS) as (keyof typeof SEED_FLOWS)[]) {
      for (const lane of SEED_FLOWS[kind].lanes) {
        lane.steps.forEach((s, i) => {
          want.push(
            `(${[
              q(kind), q(s.id), q(lane.lane), String(i), q(s.name), q(s.nameEs), q(s.phase), q(s.who), arr(s.facts), q(s.join), arr(s.papers),
              q(s.loop), q(s.loopEnds), String(s.fork), String(s.aside), String(s.skipOneJob), q(s.later?.en), q(s.later?.es),
              s.nudge ? String(s.nudge.days) : 'NULL', q(s.nudge?.how), q(s.nudge?.send), q(s.nudge?.dayFact), String(s.usual), q(s.owedWords),
            ].join(', ')})`,
          )
        })
      }
    }
    const body = sql.slice(sql.indexOf('JOIN (VALUES'), sql.indexOf(') AS s(kind'))
    const got = body.split('\n').map((l) => l.trim().replace(/,$/, '')).filter((l) => l.startsWith('('))
    expect(got.sort()).toEqual(want.sort())
  })
})
