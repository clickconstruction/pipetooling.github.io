import { describe, expect, it } from 'vitest'
import { boardBarsSaySomething, boardPriceBar, boardSectionBarWords, glanceMoney, holeEstimateWords, BAR_STANDINGS } from './boardPriceBar'
import { boardStateFromRows } from './boardRows'
import { clinicBoardRows } from './boardTestRows'
import { aboutMoney, priceStanding } from './priceStanding'
import { proposalTotals } from './bids'

/** The clinic with sitework's quote carried, concrete on our budget, or the trades cut down. */
function clinic(over: { carrySitework?: boolean; budgetConcrete?: boolean; only?: string[]; money?: boolean } = {}) {
  const base = clinicBoardRows()
  const rows = clinicBoardRows({
    projects: base.projects.map((p) => ({
      ...p,
      trades: p.trades
        .filter((t) => !over.only || over.only.includes(t.id))
        .map((t) => (t.id === 'k1' && over.carrySitework ? { ...t, carriedInviteId: 'i1' } : t.id === 'k2' && over.budgetConcrete ? { ...t, carryBudget: true } : t)),
    })),
    ...(over.money === false ? { money: [], moneyShown: false } : {}),
  })
  const state = boardStateFromRows(rows)
  return { state, project: state.projects[0]! }
}

describe('boardPriceBar', () => {
  it('three holes: no quoted part, the estimates dashed, the overhead grey, the full length what the price comes to', () => {
    const { state, project } = clinic()
    const bar = boardPriceBar(state, project)!
    const p = priceStanding(state, project)
    expect(bar.holes).toBe(3)
    expect(bar.soFar).toBe(p.soFar)
    expect(bar.likely).toBe(p.likely)
    expect(bar.total).toBe(p.likely)
    expect(bar.segments.map((s) => s.kind)).toEqual(['hole', 'overhead'])
    const holes = p.rows.reduce((t, r) => t + (r.estimate ?? 0), 0)
    expect(bar.segments[0]!.amount).toBe(holes)
    expect(bar.segments[0]!.label).toBe(`≈ ${glanceMoney(holes)}`)
    expect(bar.segments.reduce((t, s) => t + s.fraction, 0)).toBeCloseTo(1, 6)
    expect(bar.segments.reduce((t, s) => t + s.amount, 0)).toBeCloseTo(p.likely, 6)
    expect(bar.legend.map((l) => l.words)).toEqual(['holes · Sitework from the lowest good quote, Concrete from our budget, Plumbing from our own figure', 'GC $12,000 + contingency 3% + fee 8%'])
    expect(bar.lines).toEqual({ first: 'so far, with 3 holes', second: `${aboutMoney(p.likely)} with every trade in` })
    expect(bar.lines.second).toMatch(/^about \$[\d,]+ with every trade in$/)
    expect(bar.words).toContain('have no number yet and count as $0')
  })

  it('a carried quote is the quoted part, solid, with its trades counted', () => {
    const { state, project } = clinic({ carrySitework: true })
    const bar = boardPriceBar(state, project)!
    expect(bar.segments.map((s) => s.kind)).toEqual(['quoted', 'hole', 'overhead'])
    expect(bar.segments[0]!.amount).toBe(proposalTotals(project).trades)
    expect(bar.segments[0]!.label).toBe('$61k')
    expect(bar.legend[0]).toEqual({ kind: 'quoted', words: 'quoted · 1 trade' })
    expect(bar.lines.first).toBe('so far, with 2 holes')
    expect(bar.words).toContain('$61,000 quoted on 1 trade.')
  })

  it('our budget on a trade is hatched and named, and counts as quoted in the figure', () => {
    const { state, project } = clinic({ carrySitework: true, budgetConcrete: true })
    const bar = boardPriceBar(state, project)!
    expect(bar.segments.map((s) => s.kind)).toEqual(['quoted', 'budget', 'hole', 'overhead'])
    expect(bar.segments[1]!.amount).toBe(84000)
    expect(bar.legend.map((l) => l.words)).toEqual(['quoted · 1 trade', 'our budget · 1 trade carrying ours', 'hole · Plumbing · from our own figure', 'GC $12,000 + contingency 3% + fee 8%'])
    expect(bar.lines.first).toBe('so far, with 1 hole, our budget on 1')
    expect(bar.words).toContain('Our budget stands in for Concrete.')
  })

  it('every trade a real number: the bar is quoted and overhead, and the figure is one we stand behind', () => {
    const { state, project } = clinic({ carrySitework: true, only: ['k1'] })
    const bar = boardPriceBar(state, project)!
    expect(bar.holes).toBe(0)
    expect(bar.total).toBe(bar.soFar)
    expect(bar.segments.map((s) => s.kind)).toEqual(['quoted', 'overhead'])
    expect(bar.lines).toEqual({ first: 'quoted · we stand behind it', second: null })
  })

  it('outside the money team the overhead has no words and the lines say trades so far', () => {
    const { state, project } = clinic({ carrySitework: true, money: false })
    const bar = boardPriceBar(state, project, { moneyShown: false })!
    expect(bar.segments.map((s) => s.kind)).toEqual(['quoted', 'hole'])
    expect(bar.legend.map((l) => l.kind)).toEqual(['quoted', 'hole'])
    expect(bar.lines.first).toBe('trades so far, with 2 holes')
    const whole = boardPriceBar(state, clinic({ carrySitework: true, only: ['k1'], money: false }).project, { moneyShown: false })!
    expect(whole.lines.first).toBe('every trade quoted')
  })

  it('nothing priced and nothing estimated draws no bar; general conditions alone draw the overhead alone', () => {
    const none = clinic({ only: [], money: false })
    expect(boardPriceBar(none.state, none.project, { moneyShown: false })).toBeNull()
    const gcOnly = clinic({ only: [] })
    const bar = boardPriceBar(gcOnly.state, gcOnly.project)!
    expect(bar.segments.map((s) => s.kind)).toEqual(['overhead'])
    expect(bar.lines).toEqual({ first: 'so far', second: null })
  })

  it('each segment opens the price card on its own standings', () => {
    expect(BAR_STANDINGS.quoted).toEqual(['real', 'gap', 'ranOut'])
    expect(BAR_STANDINGS.hole).toEqual(['pick', 'waiting', 'notAsked', 'ownBid'])
    expect(BAR_STANDINGS.budget).toEqual(['guess'])
    expect(BAR_STANDINGS.overhead).toEqual([])
  })

  it('glanceMoney and the hole’s source words', () => {
    expect(glanceMoney(612400)).toBe('$612k')
    expect(glanceMoney(1_420_000)).toBe('$1.42M')
    expect(glanceMoney(980)).toBe('$980')
    expect(glanceMoney(1500)).toBe('$2k')
    const { state, project } = clinic()
    const rows = priceStanding(state, project).rows
    expect(rows.map(holeEstimateWords)).toEqual(['the lowest good quote', 'our budget', 'our own figure'])
  })

  it('a section’s bars draw only when one says something its figure does not', () => {
    const plain = boardPriceBar(...(Object.values(clinic({ carrySitework: true, only: ['k1'], money: false })) as [never, never]), { moneyShown: false })!
    expect(plain.segments.length).toBe(1)
    expect(boardBarsSaySomething([plain])).toBe(false)
    expect(boardBarsSaySomething([plain, null])).toBe(false)
    expect(boardBarsSaySomething([])).toBe(false)
    const overhead = boardPriceBar(...(Object.values(clinic({ carrySitework: true, only: ['k1'] })) as [never, never]))!
    expect(boardBarsSaySomething([plain, overhead])).toBe(true)
    const holes = boardPriceBar(...(Object.values(clinic()) as [never, never]))!
    expect(boardBarsSaySomething([holes])).toBe(true)
  })

  it('the heading says the two sums: priced so far, and about what with every trade in', () => {
    const a = boardPriceBar(...Object.values(clinic({ carrySitework: true })) as [never, never])!
    const b = boardPriceBar(...Object.values(clinic({ carrySitework: true, only: ['k1'] })) as [never, never])!
    expect(boardSectionBarWords([a, b])).toMatch(/^\$[\d,]+ priced so far · about \$[\d,.]+[Mk]? with every trade in$/)
    expect(boardSectionBarWords([b])).toMatch(/^\$[\d,]+ priced so far$/)
    expect(boardSectionBarWords([null])).toBe('')
    expect(boardSectionBarWords([])).toBe('')
  })
})
