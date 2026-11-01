// @vitest-environment jsdom
/**
 * The record check between spans (punch list #220, v2.6248): the lines are the span's, so a new span starts from
 * none while it reads, instead of showing the old day's line under the new heading.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { useStatementRecordCheck } from './useStatementRecordCheck'

const db: { gate: Promise<void> } = { gate: Promise.resolve() }

vi.mock('../../../lib/supabase', () => {
  function builder(table: string): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'not', 'gte', 'lte', 'order', 'limit']) b[m] = () => b
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      db.gate.then(() => ({ data: table === 'clock_sessions' ? [{ user_id: 'u-da', job_ledger_id: 'j1', work_date: '2026-09-03', clocked_in_at: '2026-09-03T12:12:00Z', clocked_out_at: '2026-09-03T13:05:00Z', rejected_at: null, revoked_at: null }] : [], error: null })).then(onFulfilled, onRejected)
    return b
  }
  return { supabase: { from: (table: string) => builder(table), rpc: () => db.gate.then(() => ({ data: [], error: null })) } }
})

afterEach(() => { cleanup(); db.gate = Promise.resolve() })

const base = { jobs: [{ id: 'j1', label: '742' }], incidentTo: '', affiant: { userId: 'u-da', name: 'Daniel Alvarez' }, users: [{ id: 'u-da', name: 'Daniel Alvarez' }], enabled: true }

describe('useStatementRecordCheck · a new span starts from no lines (v2.6248)', () => {
  it('clears the old span’s lines the moment the span changes, then lists the new span’s', async () => {
    const { result, rerender } = renderHook((props: { incidentOn: string }) => useStatementRecordCheck({ ...base, incidentOn: props.incidentOn }), { initialProps: { incidentOn: '2026-09-03' } })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.lines.map((l) => l.ymd)).toEqual(['2026-09-03'])
    // The next read waits on the gate, so the hook's state between spans is what the window draws while reading.
    let release: () => void = () => undefined
    db.gate = new Promise<void>((resolve) => { release = resolve })
    rerender({ incidentOn: '2026-09-10' })
    await waitFor(() => expect(result.current.loading).toBe(true))
    expect(result.current.lines).toEqual([])
    release()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.lines.map((l) => l.ymd)).toEqual(['2026-09-10'])
    expect(result.current.lines[0]!.text).toMatch(/^Nothing recorded on this day/)
  })
})
