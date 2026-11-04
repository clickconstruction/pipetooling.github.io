import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/teamLabor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/teamLabor')>()
  return {
    ...actual,
    resolveRecordedHoursTable: async () => 'people_hours' as const,
    fetchLaborPayConfigMap: async () => ({ Luis: { hourly_wage: 40, is_salary: false } }),
  }
})

import { fetchSiteLabor } from './fetchSiteLabor'

/**
 * The Scoreboard's reads (v2.6407, v2.6457) against a client that answers like PostgREST: at most 1,000 rows an
 * answer, with no error, ranged or not (`max_rows` in `supabase/config.toml`). A job past 1,000 person-days lost
 * the rest of its Hours, Days, Labor, Cost and Profit until the reads paged (v2.6489).
 */
type Step = { name: string; args: unknown[] }
type Call = { kind: 'from' | 'rpc'; name: string; steps: Step[] }
type Answer = { data: unknown[] | null; error: { message: string } | null }

const METHODS = ['select', 'contains', 'in', 'eq', 'order', 'range', 'limit'] as const

function stubClient(answer: (call: Call) => Answer) {
  const calls: Call[] = []
  const builder = (call: Call) => {
    const b: Record<string, unknown> = {}
    for (const m of METHODS) {
      b[m] = (...args: unknown[]) => {
        call.steps.push({ name: m, args })
        return b
      }
    }
    b.then = (ok: (v: Answer) => unknown, err?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => answer(call))
        .then(ok, err)
    return b
  }
  const open = (kind: Call['kind'], name: string) => {
    const call: Call = { kind, name, steps: [] }
    calls.push(call)
    return builder(call)
  }
  const client = { from: (table: string) => open('from', table), rpc: (name: string) => open('rpc', name) } as unknown as SupabaseClient
  return { client, calls }
}

const argsOf = (call: Call, name: string) => call.steps.filter((s) => s.name === name).map((s) => s.args)
const day = (i: number) => new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10)
/** PostgREST's max_rows: an answer stops at 1,000 rows with no error, ranged or not. */
const cut = (rows: unknown[], call: Call): Answer => {
  const [from, to] = (argsOf(call, 'range')[0] ?? [0, 999]) as [number, number]
  return { data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null }
}

describe('fetchSiteLabor', () => {
  it('reads every crew row of a job past 1,000 person-days, two pages held still by date and name', async () => {
    const crew = Array.from({ length: 1001 }, (_, i) => ({ work_date: day(i), person_name: 'Luis', person_id: 'p-luis', job_assignments: [{ job_id: 'j1', pct: 100 }], crew_lead_person_name: 'Luis' }))
    const { client, calls } = stubClient((call) => {
      if (call.name === 'people_crew_jobs') return cut(crew, call)
      if (call.name === 'people_hours') {
        const dates = (argsOf(call, 'in').find((a) => a[0] === 'work_date')?.[1] ?? []) as string[]
        return cut(
          dates.map((d) => ({ person_name: 'Luis', person_id: 'p-luis', work_date: d, hours: 1 })),
          call,
        )
      }
      return { data: [], error: null }
    })

    const out = await fetchSiteLabor(client, ['j1'])

    const j1 = out.byJobId.get('j1')!
    expect(j1.hours).toBe(1001)
    expect(j1.days).toBe(1001)
    expect(j1.costUsd).toBe(1001 * 40)
    expect(out.daysKnown).toBe(true)
    const crewReads = calls.filter((c) => c.name === 'people_crew_jobs')
    expect(crewReads.map((c) => argsOf(c, 'range'))).toEqual([[[0, 999]], [[1000, 1999]]])
    for (const c of crewReads) expect(argsOf(c, 'order')).toEqual([['work_date'], ['person_name']])
    const hoursReads = calls.filter((c) => c.name === 'people_hours')
    expect(hoursReads.length).toBeGreaterThan(0)
    for (const c of hoursReads) {
      expect(argsOf(c, 'order')).toEqual([['work_date'], ['person_name']])
      expect(argsOf(c, 'range')).toEqual([[0, 999]])
    }
  })

  it('pages the man-hours fallback in job and name order when no crew row is open to the reader', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ job_id: 'j1', person_name: `Person ${String(i).padStart(4, '0')}`, man_hours: 1 }))
    const { client, calls } = stubClient((call) => (call.kind === 'rpc' && call.name === 'get_man_hours_by_job' ? cut(rows, call) : { data: [], error: null }))

    const out = await fetchSiteLabor(client, ['j1'])

    const j1 = out.byJobId.get('j1')!
    expect(j1.hours).toBe(1001)
    expect(j1.people).toHaveLength(1001)
    expect(out.daysKnown).toBe(false)
    const reads = calls.filter((c) => c.kind === 'rpc')
    expect(reads.map((c) => argsOf(c, 'range'))).toEqual([[[0, 999]], [[1000, 1999]]])
    for (const c of reads) {
      expect(argsOf(c, 'in')).toEqual([['job_id', ['j1']]])
      expect(argsOf(c, 'order')).toEqual([['job_id'], ['person_name']])
    }
  })
})
