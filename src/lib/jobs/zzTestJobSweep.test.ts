import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isZzSinkJob,
  isZzTestJob,
  isZzTestName,
  planZzTestJobSweep,
  sweepZzTestJobIntoSink,
  zzSweepSummaryWords,
  type ZzJobRow,
} from './zzTestJobSweep'

const NOW = new Date('2026-09-29T18:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

function row(over: Partial<ZzJobRow> & { id: string }): ZzJobRow {
  return {
    hcp_number: '',
    click_number: '',
    job_name: 'ZZ TEST row',
    customer_name: null,
    status: 'working',
    revenue: 2200,
    created_at: daysAgo(30),
    ...over,
  }
}
const sinkRow = (over: Partial<ZzJobRow> = {}) => row({ id: 'sink', hcp_number: '1060', job_name: 'ZZ TEST sink', created_at: daysAgo(200), ...over })

describe('the ZZ name rules', () => {
  it('accepts the prefix in any case, after trimming, and nothing else', () => {
    expect(isZzTestName('ZZ TEST Row 4')).toBe(true)
    expect(isZzTestName('  zz twin bid')).toBe(true)
    expect(isZzTestName('Zzyzx Plumbing')).toBe(true)
    expect(isZzTestName('Buzz Electric')).toBe(false)
    expect(isZzTestName('')).toBe(false)
    expect(isZzTestName(null)).toBe(false)
  })

  it('reads the job name or the customer name', () => {
    expect(isZzTestJob({ job_name: 'Coe Trim', customer_name: 'ZZ TEST Owner On Notice' })).toBe(true)
    expect(isZzTestJob({ job_name: 'ZZ TEST Row 4', customer_name: 'Kimberly Coe' })).toBe(true)
    expect(isZzTestJob({ job_name: 'Coe Trim', customer_name: 'Kimberly Coe' })).toBe(false)
  })

  it('the sink is a ZZ job whose own name carries the word sink', () => {
    expect(isZzSinkJob({ job_name: 'ZZ TEST sink' })).toBe(true)
    expect(isZzSinkJob({ job_name: 'zz Sink — permanent' })).toBe(true)
    expect(isZzSinkJob({ job_name: 'ZZ TEST kitchen sink rough-in' })).toBe(true)
    expect(isZzSinkJob({ job_name: 'ZZ TEST sinking fund' })).toBe(false)
    expect(isZzSinkJob({ job_name: 'Sink install', customer_name: 'ZZ TEST Owner' })).toBe(false)
    expect(isZzSinkJob({ job_name: 'Sink install', customer_name: 'Kimberly Coe' })).toBe(false)
  })
})

describe('planZzTestJobSweep', () => {
  it('finds the sink by name, sweeps the old rows oldest first, holds the new ones', () => {
    const plan = planZzTestJobSweep(
      [
        row({ id: 'new', created_at: daysAgo(2) }),
        row({ id: 'old-b', created_at: daysAgo(20) }),
        sinkRow(),
        row({ id: 'old-a', created_at: daysAgo(40) }),
        row({ id: 'real', job_name: 'Coe Trim', customer_name: 'Kimberly Coe' }),
      ],
      { now: NOW, minAgeDays: 7 },
    )
    expect(plan.sink?.id).toBe('sink')
    expect(plan.sink?.jobNumber).toBe('1060')
    expect(plan.sweep.map((r) => r.id)).toEqual(['old-a', 'old-b'])
    expect(plan.tooNew.map((r) => r.id)).toEqual(['new'])
    expect(plan.skippedNotZz).toBe(1)
    expect(plan.sweep[0]?.ageDays).toBe(40)
    expect(plan.sweep[0]?.jobNumber).toBe('—')
  })

  it('keeps every sink-named row and sweeps into the oldest; a row with no created_at counts as old', () => {
    const plan = planZzTestJobSweep(
      [sinkRow({ id: 'sink-new', created_at: daysAgo(1) }), sinkRow({ id: 'sink-old', created_at: daysAgo(90) }), row({ id: 'legacy', created_at: null })],
      { now: NOW, minAgeDays: 7 },
    )
    expect(plan.sink?.id).toBe('sink-old')
    expect(plan.sweep.map((r) => r.id)).toEqual(['legacy'])
    expect(plan.tooNew).toEqual([])
    expect(plan.sweep[0]?.ageDays).toBeNull()
  })

  it('has no sink when the only "sink" job is a customer\'s', () => {
    const plan = planZzTestJobSweep([row({ id: 'customer', job_name: 'Sink replacement', customer_name: 'Kimberly Coe' }), row({ id: 'zz' })], {
      now: NOW,
      minAgeDays: 7,
    })
    expect(plan.sink).toBeNull()
    expect(plan.skippedNotZz).toBe(1)
    expect(plan.sweep.map((r) => r.id)).toEqual(['zz'])
  })

  it('a minimum age of 0 sweeps everything but the sink', () => {
    const plan = planZzTestJobSweep([sinkRow(), row({ id: 'today', created_at: daysAgo(0) })], { now: NOW, minAgeDays: 0 })
    expect(plan.sweep.map((r) => r.id)).toEqual(['today'])
    expect(plan.tooNew).toEqual([])
  })
})

describe('zzSweepSummaryWords', () => {
  it('names the counts and the sink', () => {
    const plan = planZzTestJobSweep([sinkRow(), row({ id: 'a' }), row({ id: 'b', created_at: daysAgo(1) })], { now: NOW, minAgeDays: 7 })
    expect(zzSweepSummaryWords(plan, 7)).toBe('2 ZZ test jobs · 1 older than 7 days can be swept into J1060 · 1 newer stays')
  })
  it('says when only the sink is left, and when there is no sink', () => {
    expect(zzSweepSummaryWords(planZzTestJobSweep([sinkRow()], { now: NOW, minAgeDays: 7 }), 7)).toBe('None found — only the sink (J1060) is left.')
    expect(zzSweepSummaryWords(planZzTestJobSweep([row({ id: 'a' })], { now: NOW, minAgeDays: 7 }), 7)).toBe(
      '1 ZZ test job · no sink — make a New Job named "ZZ TEST sink" before sweeping',
    )
  })
})

type Step = { kind: 'update' | 'delete' | 'rpc'; table?: string; values?: unknown; eq?: [string, string]; args?: unknown }

function recordingClient(answers: { update?: { message: string } | null; delete?: { message: string } | null; rpc?: { data?: unknown; error?: { message: string } | null } } = {}) {
  const steps: Step[] = []
  const from = (table: string) => ({
    update: (values: unknown) => ({
      eq: async (col: string, v: string) => {
        steps.push({ kind: 'update', table, values, eq: [col, v] })
        return { error: answers.update ?? null }
      },
    }),
    delete: () => ({
      eq: async (col: string, v: string) => {
        steps.push({ kind: 'delete', table, eq: [col, v] })
        return { error: answers.delete ?? null }
      },
    }),
  })
  const rpc = async (name: string, args: unknown) => {
    steps.push({ kind: 'rpc', table: name, args })
    return { data: answers.rpc?.data ?? { ok: true }, error: answers.rpc?.error ?? null }
  }
  return { steps, client: { from, rpc } as unknown as SupabaseClient }
}

describe('sweepZzTestJobIntoSink', () => {
  it('zeroes the total, removes the lines, then migrates — in that order', async () => {
    const { steps, client } = recordingClient({ rpc: { data: { ok: true, estimate_unlinked: true } } })
    const result = await sweepZzTestJobIntoSink(client, 'job-1', 'sink-1')
    expect(result).toEqual({ ok: true, estimateUnlinked: true })
    expect(steps).toEqual([
      { kind: 'update', table: 'jobs_ledger', values: { revenue: 0 }, eq: ['id', 'job-1'] },
      { kind: 'delete', table: 'jobs_ledger_fixtures', eq: ['job_id', 'job-1'] },
      { kind: 'rpc', table: 'migrate_job_ledger_costs_and_delete', args: { p_from: 'job-1', p_to: 'sink-1', p_allow_billed: true } },
    ])
  })

  it('stops at the first refusal and says which step', async () => {
    const zero = recordingClient({ update: { message: 'permission denied for table jobs_ledger' } })
    expect(await sweepZzTestJobIntoSink(zero.client, 'job-1', 'sink-1')).toEqual({ ok: false, error: 'permission denied for table jobs_ledger' })
    expect(zero.steps.map((s) => s.kind)).toEqual(['update'])

    const lines = recordingClient({ delete: { message: '' } })
    expect(await sweepZzTestJobIntoSink(lines.client, 'job-1', 'sink-1')).toEqual({ ok: false, error: 'Could not remove the Specific Work lines' })
    expect(lines.steps.map((s) => s.kind)).toEqual(['update', 'delete'])

    const refused = recordingClient({ rpc: { data: { ok: false, error: 'Not authorized to migrate these jobs' } } })
    expect(await sweepZzTestJobIntoSink(refused.client, 'job-1', 'sink-1')).toEqual({ ok: false, error: 'Not authorized to migrate these jobs' })
  })

  it('refuses to sweep the sink into itself before writing anything', async () => {
    const { steps, client } = recordingClient()
    expect(await sweepZzTestJobIntoSink(client, 'sink-1', 'sink-1')).toEqual({ ok: false, error: 'The sink cannot be swept into itself.' })
    expect(steps).toEqual([])
  })
})
