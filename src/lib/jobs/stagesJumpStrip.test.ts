import { describe, expect, it } from 'vitest'
import { stagesJumpStripCount } from './stagesJumpStrip'

describe('stagesJumpStripCount', () => {
  it('uses the header-stats count while the scope is unfetched (the (0)-until-opened bug)', () => {
    expect(stagesJumpStripCount({ searchActive: false, scopeMerged: false, statsCount: 20, liveCount: 0 })).toBe('20')
  })

  it('uses live rows once the scope is merged (rows are fresher than the stats snapshot)', () => {
    expect(stagesJumpStripCount({ searchActive: false, scopeMerged: true, statsCount: 20, liveCount: 19 })).toBe('19')
  })

  it('search narrows to live matches even on unfetched scopes', () => {
    expect(stagesJumpStripCount({ searchActive: true, scopeMerged: false, statsCount: 20, liveCount: 2 })).toBe('2')
  })

  it("bridges the first stats load with '…'", () => {
    expect(stagesJumpStripCount({ searchActive: false, scopeMerged: false, statsCount: null, liveCount: 0 })).toBe('…')
  })
})
