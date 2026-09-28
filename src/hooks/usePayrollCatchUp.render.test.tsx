// @vitest-environment jsdom
/**
 * usePayrollCatchUp (v2.3986): the Earlier-weeks scan runs while Draft Payroll is open, lists
 * the weeks with hours and no report, counts what is still missing as reports appear, and
 * generates a week's report through the page's generator.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { usePayrollCatchUp, type UsePayrollCatchUpInput } from './usePayrollCatchUp'
import type { PayConfigRow } from '../types/peoplePayConfig'

const db = vi.hoisted(() => ({
  hours: [] as Array<{ person_name: string; work_date: string; hours: number }>,
  reads: [] as Array<{ table: string; filters: Array<[string, string, unknown]> }>,
}))

vi.mock('../lib/supabase', () => {
  function makeBuilder(table: string): Record<string, unknown> {
    const read = { table, filters: [] as Array<[string, string, unknown]> }
    db.reads.push(read)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'is', 'not']) builder[m] = () => builder
    for (const m of ['eq', 'gte', 'lte', 'in']) {
      builder[m] = (col: string, value: unknown) => {
        read.filters.push([m, col, value])
        return builder
      }
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      const named = read.filters.find(([m, col]) => m === 'eq' && col === 'person_name')?.[2]
      const rows = table === 'people_hours' ? db.hours.filter((h) => named == null || h.person_name === named) : []
      return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected)
    }
    return builder
  }
  return { supabase: { from: (table: string) => makeBuilder(table) } }
})

const HOURLY = { hourly_wage: 30, is_salary: false } as unknown as PayConfigRow
const generateReport = vi.fn(() => Promise.resolve(true))
const setError = vi.fn()

// The pay period is the week of Sun 2026-09-20; the scan looks at the weeks before it.
const BASE: UsePayrollCatchUpInput = {
  enabled: true,
  canAccessPay: true,
  periodStart: '2026-09-20',
  payConfig: { Alex: HOURLY, Sam: HOURLY },
  peopleNames: ['Alex', 'Sam'],
  payStubs: [],
  generateReport,
  setError,
}

beforeEach(() => {
  db.hours = [
    { person_name: 'Alex', work_date: '2026-09-14', hours: 8 },
    { person_name: 'Alex', work_date: '2026-09-15', hours: 8 },
    { person_name: 'Sam', work_date: '2026-09-08', hours: 6 },
  ]
  db.reads.length = 0
  generateReport.mockClear()
  setError.mockClear()
})
afterEach(cleanup)

describe('usePayrollCatchUp', () => {
  it('lists the earlier weeks with hours and no report', async () => {
    const { result } = renderHook((p: UsePayrollCatchUpInput) => usePayrollCatchUp(p), { initialProps: BASE })
    expect(result.current.catchUpRows).toBeNull() // first paint
    expect(result.current.catchUpUnreportedCount).toBeNull() // first paint
    await waitFor(() => expect(result.current.catchUpRows).not.toBeNull())
    const rows = result.current.catchUpRows ?? []
    expect(rows.map((r) => `${r.personName} ${r.weekStart}`).sort()).toEqual(['Alex 2026-09-13', 'Sam 2026-09-06'])
    expect(rows.find((r) => r.personName === 'Alex')).toMatchObject({ weekEnd: '2026-09-19', hours: 16, estGross: 480 })
    expect(result.current.catchUpUnreportedCount).toBe(2)
    expect(result.current.catchUpLoading).toBe(false)
    expect(result.current.catchUpScanFrom).toBe('2026-07-26')
  })

  it('counts a week done once a report covers it, without scanning again', async () => {
    const { result, rerender } = renderHook((p: UsePayrollCatchUpInput) => usePayrollCatchUp(p), { initialProps: BASE })
    await waitFor(() => expect(result.current.catchUpUnreportedCount).toBe(2))
    const scans = db.reads.filter((r) => r.table === 'people_hours').length
    rerender({ ...BASE, payStubs: [{ person_name: 'Alex', period_start: '2026-09-13', period_end: '2026-09-19' }] })
    expect(result.current.catchUpUnreportedCount).toBe(1)
    expect(result.current.catchUpRows).toHaveLength(2)
    expect(db.reads.filter((r) => r.table === 'people_hours')).toHaveLength(scans)
  })

  it('scans nothing while Draft Payroll is closed, and closes its own window with it', async () => {
    const { result, rerender } = renderHook((p: UsePayrollCatchUpInput) => usePayrollCatchUp(p), { initialProps: BASE })
    await waitFor(() => expect(result.current.catchUpRows).not.toBeNull())
    act(() => result.current.setCatchUpModalOpen(true))
    expect(result.current.catchUpModalOpen).toBe(true)
    rerender({ ...BASE, enabled: false })
    await waitFor(() => expect(result.current.catchUpRows).toBeNull())
    expect(result.current.catchUpModalOpen).toBe(false)
  })

  it('looks eight more weeks back when asked', async () => {
    const { result } = renderHook((p: UsePayrollCatchUpInput) => usePayrollCatchUp(p), { initialProps: BASE })
    await waitFor(() => expect(result.current.catchUpScanFrom).toBe('2026-07-26'))
    act(() => result.current.extendCatchUpScan())
    await waitFor(() => expect(result.current.catchUpScanFrom).toBe('2026-05-31'))
  })

  it('generates a week through the page and marks the row while it runs', async () => {
    const { result } = renderHook((p: UsePayrollCatchUpInput) => usePayrollCatchUp(p), { initialProps: BASE })
    await waitFor(() => expect(result.current.catchUpRows).not.toBeNull())
    await act(async () => {
      await result.current.generateCatchUpReport({ personName: 'Alex', weekStart: '2026-09-13', weekEnd: '2026-09-19', hours: 16, estGross: 480 })
    })
    expect(generateReport).toHaveBeenCalledWith('Alex', '2026-09-13', '2026-09-19')
    expect(setError).toHaveBeenCalledWith(null)
    expect(result.current.catchUpGeneratingKey).toBeNull()
  })

  it('asks for one person\'s weeks by name, and for nothing without pay access', async () => {
    const { result, rerender } = renderHook((p: UsePayrollCatchUpInput) => usePayrollCatchUp(p), { initialProps: { ...BASE, enabled: false } })
    const rows = await result.current.loadUnreportedWeeksForPerson('Sam')
    expect(rows.every((r) => r.personName === 'Sam')).toBe(true)
    expect(db.reads[db.reads.length - 1]?.filters).toContainEqual(['eq', 'person_name', 'Sam'])
    rerender({ ...BASE, enabled: false, canAccessPay: false })
    expect(await result.current.loadUnreportedWeeksForPerson('Sam')).toEqual([])
  })
})
