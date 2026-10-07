/**
 * Main's own tests for asks and the word a company gave (the Board's B2-i): the quote day that counts
 * on an ask, its words, who to follow up with across every job and why, an open trade, and how often a
 * company's word held, run through the kernels on the test data. The spike's own cases: today Fri
 * Oct 2, Hillside Excavation promised Boerne's sitework by Wed Sep 30, Tejas Power promised Boerne's
 * electrical today, Bexar Steel Erectors has not opened the ask, and Bluebonnet Roofing promised Mon
 * Oct 5.
 */
import { describe, expect, it } from 'vitest'
import { OPEN_WITHIN_DAYS, askPromise, followUps, packageIsOpen, promiseWords } from './followUp'
import { answerRecord, compareReliability } from './reliability'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const job = (s: GcState, id: string) => s.projects.find((p) => p.id === id)!
const trade = (s: GcState, id: string, pkg: string) => job(s, id).packages.find((k) => k.id === pkg)!

describe('the quote day on an ask', () => {
  it('the newest day they gave counts, and reads passed, today, pending or kept', () => {
    const s = initialGcState()
    const hillside = trade(s, 'boerne', 'site').invites.find((i) => i.partnerId === 'hillside')!
    expect(askPromise(hillside, s.today)).toEqual({ by: '2026-09-30', madeOn: '2026-09-26', state: 'passed', days: 2 })
    expect(promiseWords(askPromise(hillside, s.today)!)).toBe('promised Wed Sep 30, 2 days past')
    const tejas = trade(s, 'boerne', 'elec').invites.find((i) => i.partnerId === 'tejas')!
    expect(promiseWords(askPromise(tejas, s.today)!)).toBe('promised today, Fri Oct 2')
    const bluebonnet = trade(s, 'boerne', 'roof').invites.find((i) => i.partnerId === 'bluebonnet')!
    expect(promiseWords(askPromise(bluebonnet, s.today)!)).toBe('promised by Mon Oct 5')
    const coolbreeze = trade(s, 'boerne', 'hvac').invites.find((i) => i.partnerId === 'coolbreeze')!
    expect(promiseWords(askPromise(coolbreeze, s.today)!)).toBe('kept their word: quote by Sat Sep 26')
    expect(askPromise(trade(s, 'boerne', 'steel').invites[0]!, s.today)).toBeNull()
  })
})

describe('follow up', () => {
  it('lists who to chase across every job, a passed day first', () => {
    const s = initialGcState()
    expect(followUps(s).map((f) => [f.project.id, f.pkg.id, f.partner.id, f.why, f.words])).toEqual([
      ['boerne', 'site', 'hillside', 'passed', 'Promised a quote by Wed Sep 30. That was 2 days ago. Our bid is due Thu Oct 8.'],
      ['boerne', 'elec', 'tejas', 'today', 'Promised a quote today. Our bid is due Thu Oct 8.'],
      ['boerne', 'steel', 'bexar', 'silent', 'Asked 13 days ago and has not opened it. Our bid is due Thu Oct 8.'],
      ['boerne', 'roof', 'bluebonnet', 'waiting', 'Promised a quote by Mon Oct 5, in 3 days.'],
    ])
    expect(OPEN_WITHIN_DAYS).toBe(3)
  })

  it('a trade is open while we bid and someone is still being asked, never our own', () => {
    const s = initialGcState()
    expect([packageIsOpen(job(s, 'boerne'), trade(s, 'boerne', 'steel')), packageIsOpen(job(s, 'boerne'), trade(s, 'boerne', 'plumb'))]).toEqual([true, false])
    expect(packageIsOpen(job(s, 'helotes'), trade(s, 'helotes', 'mill'))).toBe(true)
    expect(packageIsOpen(job(s, 'helotes'), trade(s, 'helotes', 'dry'))).toBe(false)
    const lost = { ...job(s, 'padb'), lostOn: '2026-10-01' }
    expect(packageIsOpen(lost, lost.packages[0]!)).toBe(false)
  })
})

describe('how a company answers', () => {
  it('reads reliable, mixed, silent or new from its asks, and sorts the most reliable first', () => {
    const s = initialGcState()
    const p = (id: string) => s.partners.find((x) => x.id === id)!
    expect(['summit', 'bluebonnet', 'hillside', 'tejas'].map((id) => answerRecord(p(id)))).toEqual(['reliable', 'mixed', 'silent', 'new'])
    const order = [...s.partners].sort((a, b) => compareReliability(s, a, b)).map((x) => x.id)
    expect(order.slice(0, 5)).toEqual(['summit', 'coolbreeze', 'kendall', 'brightline', 'voltage'])
    expect(order.slice(-3)).toEqual(['bexar', 'comal', 'hillside'])
  })
})
