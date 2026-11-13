import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { ESTIMATE_LOST_AFTER_DAYS, buildEstimateWins, type EstimateSent } from './estimateWins'

const TODAY = '2026-11-11'
const WINDOW_START = '2026-09-16'
const est = (over: Partial<EstimateSent> & Pick<EstimateSent, 'sentYmd' | 'usd'>): EstimateSent => ({ status: 'sent', customerKey: null, addressKey: '', answeredYmd: null, ...over })
const build = (estimates: EstimateSent[]) => buildEstimateWins({ todayYmd: TODAY, windowStart: WINDOW_START, estimates })

describe('buildEstimateWins: won, lost and still out', () => {
  it('reads won by dollars as won over won and lost', () => {
    const w = build([est({ sentYmd: '2026-10-01', usd: 3_000, status: 'customer_accepted' }), est({ sentYmd: '2026-10-02', usd: 9_000, status: 'declined' }), est({ sentYmd: '2026-11-01', usd: 5_000 })])
    expect(w.won).toEqual({ count: 1, usd: 3_000 })
    expect(w.declined).toEqual({ count: 1, usd: 9_000 })
    expect(w.out).toMatchObject({ count: 1, usd: 5_000 })
    expect(w.coefficient).toBe(0.25)
    // What is still out, at that rate.
    expect(w.out.expectedUsd).toBe(1_250)
  })

  it('counts an estimate with no answer as lost after 90 days, and not a day sooner', () => {
    expect(ESTIMATE_LOST_AFTER_DAYS).toBe(90)
    // 89 and 90 days before 2026-11-11.
    const w = build([est({ sentYmd: '2026-08-14', usd: 4_000 }), est({ sentYmd: '2026-08-13', usd: 6_000 }), est({ sentYmd: '2026-10-01', usd: 2_000, status: 'customer_accepted' })])
    expect(w.expired).toEqual({ count: 1, usd: 6_000 })
    expect(w.out).toMatchObject({ count: 1, usd: 4_000 })
    expect(w.coefficient).toBe(0.25)
  })

  it('says how much has waited past the usual answer, and where the rate lands if none of it signs', () => {
    const w = build([est({ sentYmd: '2026-10-01', usd: 5_000, status: 'customer_accepted' }), est({ sentYmd: '2026-10-02', usd: 5_000, status: 'declined' }), est({ sentYmd: '2026-10-10', usd: 10_000 }), est({ sentYmd: '2026-11-08', usd: 3_000 })])
    expect(w.coefficient).toBe(0.5)
    // The one sent 32 days ago is past the usual 14; the one sent 3 days ago is not.
    expect(w.agingOut).toEqual({ count: 1, usd: 10_000 })
    expect(w.coefficientIfAgedOut).toBe(0.25)
  })

  it('sells the window’s sent dollars a week at the rate', () => {
    const w = build([est({ sentYmd: '2026-09-20', usd: 8_000, status: 'customer_accepted' }), est({ sentYmd: '2026-09-21', usd: 8_000, status: 'declined' }), est({ sentYmd: '2026-06-01', usd: 100_000, status: 'declined' })])
    // 16,000 went out in the eight weeks; the June one is outside them but in the rate.
    expect(w.window.sentPerWeekUsd).toBe(2_000)
    expect(w.coefficient).toBeCloseTo(8_000 / 116_000, 10)
    expect(w.soldPerWeekUsd).toBeCloseTo(2_000 * (8_000 / 116_000), 6)
  })

  it('has no rate until something is won or lost', () => {
    const w = build([est({ sentYmd: '2026-11-01', usd: 5_000 })])
    expect(w.coefficient).toBeNull()
    expect(w.soldPerWeekUsd).toBeNull()
    expect(w.line).toBe('estimates: no won share yet')
  })
})

describe('buildEstimateWins: the ones a customer did not choose', () => {
  const customer = 'oak-hollow'
  const approved = est({ sentYmd: '2026-11-01', usd: 3_000, status: 'customer_accepted', customerKey: customer, addressKey: '12 elm st', answeredYmd: '2026-11-06' })

  it('counts an unanswered estimate as lost when the same customer approved another for the same address after it was sent', () => {
    const w = build([approved, est({ sentYmd: '2026-10-20', usd: 12_000, customerKey: customer, addressKey: '12 elm st' }), est({ sentYmd: '2026-11-03', usd: 9_000, customerKey: customer, addressKey: '12 elm st' })])
    expect(w.notChosen).toEqual({ count: 2, usd: 21_000 })
    expect(w.out.count).toBe(0)
    expect(w.coefficient).toBe(3_000 / 24_000)
  })

  it('keeps an estimate sent after the customer’s last approval: it is a new ask', () => {
    const w = build([approved, est({ sentYmd: '2026-11-10', usd: 4_000, customerKey: customer, addressKey: '12 elm st' })])
    expect(w.notChosen.count).toBe(0)
    expect(w.out).toMatchObject({ count: 1, usd: 4_000 })
  })

  it('keeps an estimate for another address: it is another job', () => {
    const w = build([approved, est({ sentYmd: '2026-10-20', usd: 12_000, customerKey: customer, addressKey: '90 pine rd' })])
    expect(w.notChosen.count).toBe(0)
    expect(w.out.count).toBe(1)
  })

  it('treats two estimates as one job when either carries no address', () => {
    const w = build([approved, est({ sentYmd: '2026-10-20', usd: 12_000, customerKey: customer, addressKey: '' })])
    expect(w.notChosen).toEqual({ count: 1, usd: 12_000 })
  })

  it('never reaches across customers, or to an estimate with no customer', () => {
    const w = build([approved, est({ sentYmd: '2026-10-20', usd: 12_000, customerKey: 'cedar-bend', addressKey: '12 elm st' }), est({ sentYmd: '2026-10-20', usd: 7_000, customerKey: null, addressKey: '12 elm st' })])
    expect(w.notChosen.count).toBe(0)
    expect(w.out.count).toBe(2)
  })
})

describe('buildEstimateWins: the words', () => {
  it('writes every sentence in plain words', () => {
    const many: EstimateSent[] = []
    for (let i = 0; i < 8; i++) many.push(est({ sentYmd: '2026-09-20', usd: 1_500 + i * 400, status: i % 2 === 0 ? 'customer_accepted' : 'declined' }))
    many.push(est({ sentYmd: '2026-07-01', usd: 6_000 }), est({ sentYmd: '2026-10-10', usd: 9_000 }), est({ sentYmd: '2026-11-08', usd: 2_000 }))
    many.push(est({ sentYmd: '2026-11-01', usd: 3_000, status: 'customer_accepted', customerKey: 'c', addressKey: 'a', answeredYmd: '2026-11-06' }), est({ sentYmd: '2026-10-25', usd: 5_000, customerKey: 'c', addressKey: 'a' }))
    const w = build(many)
    expect(w.thin).toBe(false)
    expect(w.detail.length).toBeGreaterThan(6)
    for (const sentence of w.detail) expect({ sentence, failures: plainWordsFailures(sentence) }).toEqual({ sentence, failures: [] })
  })

  it('marks a thin count', () => {
    const w = build([est({ sentYmd: '2026-10-01', usd: 3_000, status: 'customer_accepted' }), est({ sentYmd: '2026-10-02', usd: 3_000, status: 'declined' })])
    expect(w.thin).toBe(true)
    expect(w.line).toContain('a thin count')
  })
})

describe('buildEstimateWins: which estimates are behind each count (punch list #334, PR 4)', () => {
  it('keeps each count’s estimates by their place in the list handed in', () => {
    const w = build([
      est({ sentYmd: '2026-10-01', usd: 3_000, status: 'customer_accepted' }),
      est({ sentYmd: '2026-10-02', usd: 9_000, status: 'declined' }),
      est({ sentYmd: '2026-08-01', usd: 6_000 }),
      est({ sentYmd: '2026-11-01', usd: 5_000 }),
      // A draft is in no count and in no list.
      est({ sentYmd: '2026-11-02', usd: 1_000, status: 'draft' }),
    ])
    expect(w.members).toEqual({ won: [0], declined: [1], notChosen: [], expired: [2], out: [3] })
    expect([w.members.won.length, w.members.declined.length, w.members.notChosen.length, w.members.expired.length, w.members.out.length]).toEqual([w.won.count, w.declined.count, w.notChosen.count, w.expired.count, w.out.count])
  })
})
