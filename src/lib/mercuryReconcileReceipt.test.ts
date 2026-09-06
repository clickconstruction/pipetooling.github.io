import { describe, expect, it } from 'vitest'
import { buildReconcileReceipt, receiptVerdict } from '../../supabase/functions/_shared/reconcileReceipt'

const month = (period: string, count: number, present: number) => ({ period, statementCount: count, presentCount: present, missingCount: count - present })

describe('buildReconcileReceipt (T5-06)', () => {
  it('sums presence per account and overall, spans the periods, and reads the live-balance check', () => {
    const r = buildReconcileReceipt({
      monthsBack: 6,
      accounts: [
        { id: 'a', name: 'Operating', months: [month('2026-08', 200, 200), month('2026-07', 212, 212)], current: { delta: 0 } },
        { id: 'b', name: 'Savings', months: [month('2026-08', 3, 2)], current: { delta: -14.5 } },
      ],
    })
    expect(r.accountsChecked).toBe(2)
    expect(r.statementLines).toBe(415)
    expect(r.statementLinesPresent).toBe(414)
    expect(r.monthsWithMissing).toBe(1)
    expect(r.currentWithinEpsilon).toBe(false)
    expect(r.accounts[0]).toMatchObject({ oldestPeriod: '2026-07', newestPeriod: '2026-08', currentStatus: 'ok', missing: 0 })
    expect(r.accounts[1]).toMatchObject({ oldestPeriod: '2026-08', newestPeriod: '2026-08', currentStatus: 'drift', missing: 1 })
    expect(r.scope).toBe(
      '414 of 415 statement transactions present in the books across 2 accounts, 2026-07 – 2026-08; 1 month with something missing; live balance off on 1 account. Scope: presence only, statement → books — books-only rows and amount differences are not checked; manual transactions have no statement.',
    )
  })
  it('says when the live balance could not be checked and when everything is present', () => {
    const r = buildReconcileReceipt({ monthsBack: 3, accounts: [{ id: 'a', name: 'Op', months: [month('2026-08', 10, 10)], current: { delta: null } }] })
    expect(r.currentWithinEpsilon).toBeNull()
    expect(r.scope.startsWith('10 of 10 statement transactions present in the books across 1 account, 2026-08; live balance not checked.')).toBe(true)
  })
  it('handles an empty run', () => {
    const r = buildReconcileReceipt({ monthsBack: 6, accounts: [] })
    expect(r.statementLines).toBe(0)
    expect(r.currentWithinEpsilon).toBeNull()
    expect(r.scope.startsWith('0 of 0 statement transactions present in the books across 0 accounts, the last 6 months')).toBe(true)
  })
})

describe('receiptVerdict', () => {
  it('is ok only when everything is present and the balance is not off', () => {
    expect(receiptVerdict({ statementLines: 5, statementLinesPresent: 5, currentWithinEpsilon: true })).toEqual({ ok: true, label: '5 / 5 present · balance ✓' })
    expect(receiptVerdict({ statementLines: 5, statementLinesPresent: 5, currentWithinEpsilon: null })).toEqual({ ok: true, label: '5 / 5 present' })
    expect(receiptVerdict({ statementLines: 5, statementLinesPresent: 4, currentWithinEpsilon: true }).ok).toBe(false)
    expect(receiptVerdict({ statementLines: 5, statementLinesPresent: 5, currentWithinEpsilon: false })).toEqual({ ok: false, label: '5 / 5 present · balance off' })
  })
})
