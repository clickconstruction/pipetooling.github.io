import { describe, expect, it } from 'vitest'

import { compareAuditStake, orderPendingByStake, pickOpenAudit, type AuditTriageSignals } from './auditTriage'

type A = { id: string; status: string; requested_at: string }
const a = (id: string, status: string, requested_at: string): A => ({ id, status, requested_at })

describe('compareAuditStake', () => {
  it('open questions outrank everything — the biggest lever', () => {
    const many = { openQuestions: 3, deltaPct: -2, requested_at: '2026-09-05T00:00:00Z' }
    const none = { openQuestions: 0, deltaPct: -80, requested_at: '2026-08-01T00:00:00Z' }
    expect(compareAuditStake(many, none)).toBeLessThan(0)
  })

  it('then absolute delta when priced — a −57% card teaches more than a −3%', () => {
    const wild = { openQuestions: 1, deltaPct: -57, requested_at: '2026-09-05T00:00:00Z' }
    const close = { openQuestions: 1, deltaPct: 3, requested_at: '2026-08-01T00:00:00Z' }
    expect(compareAuditStake(wild, close)).toBeLessThan(0)
    // sign doesn't matter, magnitude does
    expect(compareAuditStake({ ...wild, deltaPct: 57 }, close)).toBeLessThan(0)
  })

  it('an unpriced card (deltaPct null) ranks after any priced one at equal questions', () => {
    const priced = { openQuestions: 0, deltaPct: 0.5, requested_at: '2026-09-05T00:00:00Z' }
    const unpriced = { openQuestions: 0, deltaPct: null, requested_at: '2026-08-01T00:00:00Z' }
    expect(compareAuditStake(priced, unpriced)).toBeLessThan(0)
  })

  it('age is the tiebreak — older first', () => {
    const old = { openQuestions: 1, deltaPct: -10, requested_at: '2026-08-01T00:00:00Z' }
    const young = { openQuestions: 1, deltaPct: 10, requested_at: '2026-09-05T00:00:00Z' }
    expect(compareAuditStake(old, young)).toBeLessThan(0)
  })
})

describe('orderPendingByStake', () => {
  const signals: Record<string, AuditTriageSignals> = {
    p1: { openQuestions: 0, deltaPct: -3 }, // oldest but low stake
    p2: { openQuestions: 2, deltaPct: null }, // questions win despite no price
    p3: { openQuestions: 0, deltaPct: -57 }, // big delta beats small delta
  }
  const list = [
    a('p1', 'pending', '2026-08-01T00:00:00Z'),
    a('p2', 'pending', '2026-09-01T00:00:00Z'),
    a('p3', 'pending', '2026-09-05T00:00:00Z'),
    a('d1', 'done', '2026-08-20T00:00:00Z'),
    a('g1', 'digested', '2026-08-10T00:00:00Z'),
  ]

  it('reorders the pending block only; done/digested keep their given order', () => {
    const out = orderPendingByStake(list, (x) => signals[x.id] ?? { openQuestions: 0, deltaPct: null })
    expect(out.map((x) => x.id)).toEqual(['p2', 'p3', 'p1', 'd1', 'g1'])
  })

  it('does not mutate the input and falls back to oldest-first on flat signals', () => {
    const flat = [a('x2', 'pending', '2026-09-02T00:00:00Z'), a('x1', 'pending', '2026-09-01T00:00:00Z')]
    const before = [...flat]
    const out = orderPendingByStake(flat, () => ({ openQuestions: 0, deltaPct: null }))
    expect(out.map((x) => x.id)).toEqual(['x1', 'x2'])
    expect(flat).toEqual(before)
  })
})

describe('pickOpenAudit (v2.4230) — the open card is the top of the queue', () => {
  const triaged = [a('top', 'pending', '2026-09-05T00:00:00Z'), a('sealed', 'pending', '2026-09-04T00:00:00Z'), a('old', 'pending', '2026-08-01T00:00:00Z'), a('done', 'done', '2026-08-02T00:00:00Z')]
  const workable = (x: A) => x.id !== 'sealed'
  it('opens nothing before the signals are in', () => {
    expect(pickOpenAudit({ triaged, current: null, picked: false, ready: false, workable })).toBeNull()
  })
  it('once ready, opens the first workable pending card — never a sealed one', () => {
    expect(pickOpenAudit({ triaged, current: null, picked: false, ready: true, workable })).toBe('top')
    expect(pickOpenAudit({ triaged: [triaged[1]!, triaged[0]!], current: null, picked: false, ready: true, workable })).toBe('top')
  })
  it('re-picks to the new top while nobody has picked', () => {
    expect(pickOpenAudit({ triaged, current: 'old', picked: false, ready: true, workable })).toBe('top')
  })
  it('holds the card the estimator picked, and a door-named one, until it stops being workable', () => {
    expect(pickOpenAudit({ triaged, current: 'old', picked: true, ready: true, workable })).toBe('old')
    expect(pickOpenAudit({ triaged, current: 'done', picked: true, ready: true, workable })).toBe('done')
    expect(pickOpenAudit({ triaged, current: 'sealed', picked: true, ready: true, workable })).toBe('top')
    expect(pickOpenAudit({ triaged, current: 'gone', picked: true, ready: true, workable })).toBe('top')
  })
  it('a card closed by hand (v2.4234, the phone panel) stays closed', () => {
    expect(pickOpenAudit({ triaged, current: null, picked: true, ready: true, workable })).toBeNull()
  })
  it('where the card would cover the queue (v2.4295, the phone panel) nothing opens until a row is tapped', () => {
    expect(pickOpenAudit({ triaged, current: null, picked: false, ready: true, workable, autoOpen: false })).toBeNull()
    // A card left open by the wider layout closes; a tapped one holds.
    expect(pickOpenAudit({ triaged, current: 'top', picked: false, ready: true, workable, autoOpen: false })).toBeNull()
    expect(pickOpenAudit({ triaged, current: 'old', picked: true, ready: true, workable, autoOpen: false })).toBe('old')
  })
  it('keeps a workable held card through a reload that resets readiness', () => {
    expect(pickOpenAudit({ triaged, current: 'old', picked: true, ready: false, workable })).toBe('old')
  })
})
