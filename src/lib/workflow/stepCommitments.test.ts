import { describe, expect, it } from 'vitest'
import { commitmentBalance, commitmentRail, nextCommitmentActions } from './stepCommitments'

describe('commitmentRail', () => {
  it('marks the money front as "now" before work starts, labeled Awaiting answer while offered', () => {
    const rail = commitmentRail('offered', 'pending')
    expect(rail.map((s) => `${s.key}:${s.state}`)).toEqual([
      'offered:done',
      'accepted:now',
      'in_progress:todo',
      'complete:todo',
      'approved:todo',
      'settled:todo',
    ])
    expect(rail.find((s) => s.key === 'accepted')?.label).toBe('Awaiting answer')
    expect(commitmentRail('accepted', 'pending').find((s) => s.key === 'accepted')?.label).toBe('Accepted')
  })

  it('work status drives the middle segments once accepted', () => {
    const rail = commitmentRail('accepted', 'in_progress')
    expect(rail.find((s) => s.key === 'in_progress')?.state).toBe('now')
    expect(rail.find((s) => s.key === 'accepted')?.state).toBe('done')
  })

  it('approved commitment on a completed step points at settlement', () => {
    const rail = commitmentRail('approved', 'approved')
    expect(rail.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done', 'now'])
  })

  it('settled shows everything done; cancelled and declined render no rail', () => {
    expect(commitmentRail('settled', 'approved').every((s) => s.state === 'done')).toBe(true)
    expect(commitmentRail('cancelled', 'pending')).toEqual([])
    expect(commitmentRail('declined', 'pending')).toEqual([])
  })
})

describe('commitmentBalance', () => {
  it('splits payments and backcharges and applies retainage', () => {
    const balance = commitmentBalance({ amount: 6400, retainage_pct: 10 }, [{ amount: 2000 }, { amount: -150 }])
    expect(balance).toEqual({
      agreed: 6400,
      retainageHeld: 640,
      paidToDate: 2000,
      backcharges: 150,
      balanceRemaining: 6400 - 640 - 2000 + 150,
    })
  })

  it('handles no linked sheet and clamps at zero', () => {
    expect(commitmentBalance({ amount: 500, retainage_pct: 0 }, null).balanceRemaining).toBe(500)
    expect(commitmentBalance({ amount: 100, retainage_pct: 0 }, [{ amount: 900 }]).balanceRemaining).toBe(0)
  })
})

describe('nextCommitmentActions', () => {
  it('walks the full dispatch state machine including withdraw and reoffer', () => {
    expect(nextCommitmentActions('draft')).toEqual(['offer', 'cancel'])
    expect(nextCommitmentActions('offered')).toEqual(['accept', 'withdraw', 'cancel'])
    expect(nextCommitmentActions('declined')).toEqual(['reoffer', 'cancel'])
    expect(nextCommitmentActions('accepted')).toEqual(['cancel'])
    expect(nextCommitmentActions('approved')).toEqual([])
    expect(nextCommitmentActions('settled')).toEqual([])
    expect(nextCommitmentActions('cancelled')).toEqual([])
  })
})
