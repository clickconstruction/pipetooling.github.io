import { describe, expect, it } from 'vitest'
import { buildReadyToBillDashboardUnits } from './buildReadyToBillDashboardUnits'

type J = {
  id: string
  revenue: number | null
  payments_made: number | null
}

type I = {
  id: string
  job_id: string
  amount: number | null
  status: string
  is_primary_rtb_bundle: boolean | null
  job_status?: string | null
}

function job(overrides: Partial<J> & Pick<J, 'id'>): J {
  return {
    revenue: 10_000,
    payments_made: 3000,
    ...overrides,
  }
}

function inv(overrides: Partial<I> & Pick<I, 'id' | 'job_id'>): I {
  return {
    amount: 5000,
    status: 'ready_to_bill',
    is_primary_rtb_bundle: false,
    ...overrides,
  }
}

describe('buildReadyToBillDashboardUnits', () => {
  it('bundles primary is_primary_rtb_bundle and does not duplicate invoice card', () => {
    const j = job({ id: 'job-1' })
    const primary = inv({
      id: 'inv-p',
      job_id: 'job-1',
      amount: 7000,
      is_primary_rtb_bundle: true,
    })
    const units = buildReadyToBillDashboardUnits([j], [primary])
    expect(units).toHaveLength(1)
    expect(units[0]?.kind).toBe('job_bundle')
  })

  it('does not bundle sole primary when any billing-unallocated remains', () => {
    const j = job({ id: 'job-1', revenue: 100, payments_made: 10 })
    const primary = inv({
      id: 'inv-p',
      job_id: 'job-1',
      amount: 2,
      is_primary_rtb_bundle: true,
    })
    const units = buildReadyToBillDashboardUnits([j], [primary])
    expect(units).toHaveLength(2)
    expect(units.some((u) => u.kind === 'job')).toBe(true)
    expect(units.some((u) => u.kind === 'invoice' && u.inv.id === 'inv-p')).toBe(true)
  })

  it('does not bundle sole primary $80 when $10 of gross remains unallocated on invoices', () => {
    const j = job({ id: 'job-1', revenue: 100, payments_made: 10 })
    const primary = inv({
      id: 'inv-p',
      job_id: 'job-1',
      amount: 80,
      is_primary_rtb_bundle: true,
    })
    const units = buildReadyToBillDashboardUnits([j], [primary])
    expect(units).toHaveLength(2)
    expect(units.some((u) => u.kind === 'job')).toBe(true)
    expect(units.some((u) => u.kind === 'invoice' && u.inv.id === 'inv-p')).toBe(true)
  })

  it('job_bundle for primary plus standalone invoice row for partial RTB', () => {
    const j = job({ id: 'job-1', revenue: 10_000, payments_made: 3000 })
    const partial = inv({
      id: 'inv-partial',
      job_id: 'job-1',
      amount: 2000,
      is_primary_rtb_bundle: false,
    })
    const primary = inv({
      id: 'inv-primary',
      job_id: 'job-1',
      amount: 5000,
      is_primary_rtb_bundle: true,
    })
    const units = buildReadyToBillDashboardUnits([j], [partial, primary])
    expect(units).toHaveLength(2)
    const bundle = units.find((u) => u.kind === 'job_bundle')
    expect(bundle?.kind).toBe('job_bundle')
    if (bundle?.kind === 'job_bundle') expect(bundle.inv.id).toBe('inv-primary')
    const standalone = units.find((u) => u.kind === 'invoice')
    expect(standalone?.kind).toBe('invoice')
    if (standalone?.kind === 'invoice') expect(standalone.inv.id).toBe('inv-partial')
  })

  it('bundles sole RTB invoice when amount equals job remaining (full balance)', () => {
    const j = job({ id: 'job-1', revenue: 10_000, payments_made: 3000 })
    const line = inv({ id: 'inv-1', job_id: 'job-1', amount: 7000, is_primary_rtb_bundle: false })
    const units = buildReadyToBillDashboardUnits([j], [line])
    expect(units).toHaveLength(1)
    expect(units[0]?.kind).toBe('job_bundle')
    if (units[0]?.kind === 'job_bundle') {
      expect(units[0].inv.id).toBe('inv-1')
    }
  })

  it('does not bundle when sole invoice is partial (amount less than remaining)', () => {
    const j = job({ id: 'job-1', revenue: 10_000, payments_made: 3000 })
    const line = inv({ id: 'inv-1', job_id: 'job-1', amount: 2000, is_primary_rtb_bundle: false })
    const units = buildReadyToBillDashboardUnits([j], [line])
    expect(units).toHaveLength(2)
    expect(units.some((u) => u.kind === 'job')).toBe(true)
    expect(units.some((u) => u.kind === 'invoice' && u.inv.id === 'inv-1')).toBe(true)
  })

  it('does not auto-bundle two RTB invoices on same job', () => {
    const j = job({ id: 'job-1', revenue: 10_000, payments_made: 0 })
    const a = inv({ id: 'inv-a', job_id: 'job-1', amount: 5000, is_primary_rtb_bundle: false })
    const b = inv({ id: 'inv-b', job_id: 'job-1', amount: 5000, is_primary_rtb_bundle: false })
    const units = buildReadyToBillDashboardUnits([j], [a, b])
    expect(units).toHaveLength(3)
    expect(units.filter((u) => u.kind === 'job')).toHaveLength(1)
    expect(units.filter((u) => u.kind === 'invoice')).toHaveLength(2)
  })

  it('matches remaining with cent rounding', () => {
    const j = job({ id: 'job-1', revenue: 100.33, payments_made: 0 })
    const line = inv({ id: 'inv-1', job_id: 'job-1', amount: 100.33, is_primary_rtb_bundle: false })
    const units = buildReadyToBillDashboardUnits([j], [line])
    expect(units).toHaveLength(1)
    expect(units[0]?.kind).toBe('job_bundle')
  })

  describe('bills on paid jobs never make a unit (J3-1 / J3-2, v2.2846)', () => {
    it('drops a stale never-sent draft whose job is paid (live specimens: 688 $5,500, 903 $185)', () => {
      const stale688 = inv({ id: 'inv-688', job_id: 'job-688', amount: 5500, job_status: 'paid' })
      const stale903 = inv({ id: 'inv-903', job_id: 'job-903', amount: 185, job_status: 'paid' })
      // No RTB-status jobs loaded (the board says Ready to Bill (0)) — the Dashboard must agree.
      expect(buildReadyToBillDashboardUnits([], [stale688, stale903])).toEqual([])
    })

    it('keeps a break-off draft on a working job (the board lists working jobs carrying an RTB draft)', () => {
      const breakOff = inv({ id: 'inv-w', job_id: 'job-working', amount: 1200, job_status: 'working' })
      expect(buildReadyToBillDashboardUnits([], [breakOff])).toEqual([{ kind: 'invoice', inv: breakOff }])
    })

    it('keeps drafts on a ready_to_bill job and on a billed job', () => {
      const j = job({ id: 'job-1', revenue: 10_000, payments_made: 0 })
      const primary = inv({ id: 'inv-p', job_id: 'job-1', amount: 10_000, is_primary_rtb_bundle: true, job_status: 'ready_to_bill' })
      expect(buildReadyToBillDashboardUnits([j], [primary])).toEqual([{ kind: 'job_bundle', job: j, inv: primary }])
      const onBilled = inv({ id: 'inv-b', job_id: 'job-billed', amount: 300, job_status: 'billed' })
      expect(buildReadyToBillDashboardUnits([], [onBilled])).toEqual([{ kind: 'invoice', inv: onBilled }])
    })

    it('an unknown job status is not treated as paid (loaders that do not join the job are unaffected)', () => {
      const noStatus = inv({ id: 'inv-x', job_id: 'job-x', amount: 300 })
      expect(buildReadyToBillDashboardUnits([], [noStatus])).toEqual([{ kind: 'invoice', inv: noStatus }])
    })

    it('a paid job\'s draft does not hijack bundling math for a job that is loaded', () => {
      // A paid job's primary draft must not be found by the bundling scan even if the job row were present.
      const j = job({ id: 'job-1', revenue: 10_000, payments_made: 10_000 })
      const stale = inv({ id: 'inv-stale', job_id: 'job-1', amount: 10_000, is_primary_rtb_bundle: true, job_status: 'paid' })
      expect(buildReadyToBillDashboardUnits([j], [stale])).toEqual([{ kind: 'job', job: j }])
    })
  })
})
