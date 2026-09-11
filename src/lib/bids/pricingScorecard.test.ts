import { describe, expect, it } from 'vitest'

import { buildPricingScorecard, describeAgreement } from './pricingScorecard'

const req = (id: string, status: string, result: Record<string, unknown> | null) => ({ id, status, finished_at: '2026-09-11T00:00:00Z', result: result as never })
const corr = (id: string, action: string, digested = false) => ({ id, action, digested_at: digested ? '2026-09-11T01:00:00Z' : null, created_at: '2026-09-11T00:30:00Z' })
const rule = (id: string, source: string, active = true) => ({ id, rule: 'r', kind: 'placement', source, active, times_used: 0, created_at: '2026-09-11T00:00:00Z', mirror_note: null })

describe('buildPricingScorecard', () => {
  it('sums finished requests and reads agreement from overrules', () => {
    const s = buildPricingScorecard(
      [
        req('a', 'ready', { houses_read: 1, rows_total: 3, rows_priced: 1, rows_asked: 1, expired_houses: ['NWS'] }),
        req('b', 'done', { houses_read: 2, rows_total: 27, rows_priced: 22, rows_asked: 4 }),
        req('c', 'queued', null),
      ],
      [corr('c1', 'repick'), corr('c2', 'choose_option', true), corr('c3', 'unpick')],
      [rule('r1', 'robot'), rule('r2', 'human'), rule('r3', 'robot', false)],
    )
    expect(s.requestsFinished).toBe(2)
    expect(s.housesRead).toBe(3)
    expect(s.rowsTotal).toBe(30)
    expect(s.rowsPricedByRobot).toBe(23)
    expect(s.rowsAsked).toBe(5)
    expect(s.overrules).toBe(2)
    expect(s.choicesMade).toBe(1)
    expect(s.agreementPct).toBe(91)
    expect(s.rulesActive).toBe(2)
    expect(s.rulesFromRobot).toBe(1)
    expect(s.correctionsUndigested).toBe(2)
    expect(s.expiredQuotesSeen).toBe(1)
    expect(describeAgreement(s)).toBe('kept 21 of 23 robot picks · 91%')
  })
  it('speaks plainly before any pick', () => {
    expect(describeAgreement(buildPricingScorecard([], [], []))).toBe('no requests finished yet')
    expect(describeAgreement(buildPricingScorecard([req('a', 'ready', { rows_priced: 0, rows_asked: 1 })], [], []))).toBe('nothing picked yet — every row waited on a choice')
  })
})
