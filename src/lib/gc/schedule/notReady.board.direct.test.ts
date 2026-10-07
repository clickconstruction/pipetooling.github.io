/**
 * Main's own tests for the papers a trade's bars wait on (the Board's B2-ii): each trade's gaps
 * before its start, and the bars under way on a trade whose insurance ran out, run through the
 * kernels on the test data. The spike's own cases: on Helotes Dental Office, Brightline Electric's
 * statement of work went Sep 30 unsigned and Kendall Air's master agreement Sep 29; on Fair Oaks
 * Shops, Building D, Pecan Valley Electric's insurance ran out Tue Sep 15.
 */
import { describe, expect, it } from 'vitest'
import { startGaps, uninsuredBars } from './notReady'
import { initialGcState } from './testState'

describe('what a trade’s bars wait on', () => {
  it('names each paper a trade owes before its start, in plain words', () => {
    const s = initialGcState()
    const helotes = s.projects.find((p) => p.id === 'helotes')!
    expect(helotes.packages.map((k) => [k.id, startGaps(s, helotes, k, '2026-10-12').map((g) => g.line)])).toEqual([
      ['dry', []],
      ['delec', ['Statement of work sent Sep 30, not signed.']],
      ['dhvac', ['Master agreement sent Sep 29, not signed.', 'Statement of work drafted, not sent.']],
      ['dplumb', []],
      ['mill', ['Award: no company picked.']],
    ])
  })

  it('finds the bars under way on a trade whose insurance ran out', () => {
    const s = initialGcState()
    expect(s.projects.map((p) => [p.id, uninsuredBars(s, p).map((b) => b.lineId)]).filter(([, ids]) => (ids as string[]).length)).toEqual([
      ['fairoaksd', expect.arrayContaining(['felec-2', 'felec-3'])],
    ])
    const fairoaks = s.projects.find((p) => p.id === 'fairoaksd')!
    const first = uninsuredBars(s, fairoaks)[0]!
    expect([first.partner.company, first.gap.line, first.gap.barWords]).toEqual(['Pecan Valley Electric', 'Insurance ran out Tue Sep 15.', 'current insurance, theirs ran out Sep 15'])
  })
})
