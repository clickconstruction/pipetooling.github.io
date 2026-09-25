import { describe, expect, it } from 'vitest'
import { backtestRunLabelOwner, isBacktestLockNote } from '../../../supabase/functions/_shared/twinBacktestScoreGate'

describe('twinBacktestScoreGate · isBacktestLockNote', () => {
  it('passes the lock notes the pipeline writes', () => {
    expect(isBacktestLockNote('[STG-3..5 + LOCK] $48,200 — building + travel — class B, census 64')).toBe(true)
    expect(isBacktestLockNote('[shadow LOCK] Blind total $31,000 locked at 2026-09-20T15:00:00Z')).toBe(true)
    expect(isBacktestLockNote('LOCK $12,500')).toBe(true)
  })

  it('refuses notes that only contain the letters (the old ilike %LOCK% gate let these unseal)', () => {
    expect(isBacktestLockNote('[STG-2] blocked on plans — asked the office')).toBe(false)
    expect(isBacktestLockNote('BLOCKED: no plumbing sheets')).toBe(false)
    expect(isBacktestLockNote('do not unlock until counts are in')).toBe(false)
    expect(isBacktestLockNote('UNLOCK after review')).toBe(false)
    expect(isBacktestLockNote('on the clock since 8am')).toBe(false)
    expect(isBacktestLockNote('Blind backtest of b376. Reference sealed until the STG-6 scorecard stamp.')).toBe(false)
  })

  it('refuses an empty ledger entry', () => {
    expect(isBacktestLockNote(null)).toBe(false)
    expect(isBacktestLockNote(undefined)).toBe(false)
    expect(isBacktestLockNote('')).toBe(false)
  })
})

describe('twinBacktestScoreGate · backtestRunLabelOwner', () => {
  it('a new label is free to score', () => {
    expect(backtestRunLabelOwner(null, '512')).toBe('free')
  })

  it('this shell’s own backtest row is reused or amended', () => {
    expect(backtestRunLabelOwner({ kind: 'backtest', twin_bid_number: '512' }, '512')).toBe('mine')
  })

  it('another shell’s row, or a shadow’s, is not this shell’s to read or amend', () => {
    expect(backtestRunLabelOwner({ kind: 'backtest', twin_bid_number: '498' }, '512')).toBe('taken')
    expect(backtestRunLabelOwner({ kind: 'shadow', twin_bid_number: '512' }, '512')).toBe('taken')
    expect(backtestRunLabelOwner({ kind: 'backtest', twin_bid_number: null }, '512')).toBe('taken')
  })
})
