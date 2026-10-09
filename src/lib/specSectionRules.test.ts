import { describe, expect, it } from 'vitest'
import { classifySpecSection } from './classifySpecSection'
import {
  DRAFT_RULE_ID,
  applyRuleChange,
  groupRulesBySection,
  orderRules,
  previewRuleChange,
  priorityBand,
  ruleCatches,
  ruleStandings,
  sectionTallies,
  validateRuleDraft,
  type LedgerRule,
} from './specSectionRules'

const rule = (id: string, pattern: string, matchKind: LedgerRule['matchKind'], sectionCode: string | null, priority: number): LedgerRule => ({
  id,
  pattern,
  matchKind,
  sectionCode,
  priority,
})

// A small ledger shaped like the real one: seeded exacts first, then patterns, then a catch-all.
const RULES: LedgerRule[] = [
  rule('wc1', 'WC-1', 'exact', '22 42 13', 10),
  rule('wc', 'WC-', 'starts_with', '22 42 13', 100),
  rule('fd', 'FD-', 'contains', '22 13 19', 200),
  rule('demo', 'DEMO', 'contains', null, 300),
  rule('valve', 'VALVE', 'contains', '22 05 23', 700),
  rule('wc-dup', 'WC-1', 'contains', '22 42 16', 800),
]

const NAMES = [
  { fixture: 'WC-1', bidCount: 9 },
  { fixture: 'wc-1', bidCount: 1 },
  { fixture: 'WC-2', bidCount: 4 },
  { fixture: '4IN FD-1', bidCount: 3 },
  { fixture: 'DEMO', bidCount: 2 },
  { fixture: 'BALL VALVE', bidCount: 5 },
  { fixture: 'MOP SINK', bidCount: 6 },
]

describe('ruleCatches', () => {
  it('tests each kind the way the classifier does, ignoring case and outer spaces', () => {
    expect(ruleCatches(rule('a', ' wc-1 ', 'exact', null, 1), 'WC-1')).toBe(true)
    expect(ruleCatches(rule('a', 'WC-1', 'exact', null, 1), 'WC-10')).toBe(false)
    expect(ruleCatches(rule('a', 'wc-', 'starts_with', null, 1), 'WC-2')).toBe(true)
    expect(ruleCatches(rule('a', 'wc-', 'starts_with', null, 1), 'A WC-2')).toBe(false)
    expect(ruleCatches(rule('a', 'fd-', 'contains', null, 1), '4IN FD-1')).toBe(true)
  })

  it('an empty pattern or an empty name catches nothing', () => {
    expect(ruleCatches(rule('a', '  ', 'contains', null, 1), 'ANY')).toBe(false)
    expect(ruleCatches(rule('a', 'FD-', 'contains', null, 1), '   ')).toBe(false)
  })
})

describe('orderRules', () => {
  it('sorts by priority and keeps the input order on a tie, as the classifier does', () => {
    const tied = [rule('b', 'X', 'contains', '22 05 23', 5), rule('a', 'X', 'contains', '22 42 13', 5), rule('c', 'X', 'contains', null, 1)]
    expect(orderRules(tied).map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('ruleStandings', () => {
  const standings = ruleStandings(RULES, NAMES)

  it('counts the names each rule decides, with spellings folded as the audit folds them', () => {
    expect(standings.get('wc1')).toMatchObject({ state: 'deciding', wins: 1, winBids: 10, sampleWins: ['WC-1'] })
    expect(standings.get('wc')).toMatchObject({ state: 'deciding', wins: 1, winBids: 4, sampleWins: ['WC-2'] })
    expect(standings.get('demo')).toMatchObject({ state: 'deciding', wins: 1 })
  })

  it('a rule that catches names an earlier rule decides is shadowed, and says which rule decides them', () => {
    expect(standings.get('wc-dup')).toMatchObject({ state: 'shadowed', wins: 0, shadowed: 1, sampleShadowedBy: [{ fixture: 'WC-1', byRuleId: 'wc1' }] })
    expect(standings.get('wc')).toMatchObject({ shadowed: 1, sampleShadowedBy: [{ fixture: 'WC-1', byRuleId: 'wc1' }] })
  })

  it('a rule that catches nothing is idle', () => {
    const s = ruleStandings([...RULES, rule('none', 'ZZZ', 'contains', '22 05 23', 900)], NAMES)
    expect(s.get('none')).toMatchObject({ state: 'idle', wins: 0, shadowed: 0, sampleWins: [], sampleShadowedBy: [] })
  })

  it('never disagrees with the classifier about which rule decides a name', () => {
    for (const n of NAMES) {
      const m = classifySpecSection(n.fixture, RULES)
      const decider = [...standings.values()].find((s) => s.sampleWins.some((w) => w.toLowerCase() === n.fixture.toLowerCase()))
      if (m.outcome === 'unmatched') expect(decider).toBeUndefined()
      else expect(decider?.id).toBe((m.rule as LedgerRule).id)
    }
  })

  it('samples the most-bid names first, up to the sample size', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ fixture: `WC-${i + 2}`, bidCount: i }))
    const s = ruleStandings(RULES, many, 3)
    expect(s.get('wc')).toMatchObject({ wins: 8, sampleWins: ['WC-9', 'WC-8', 'WC-7'] })
  })
})

describe('applyRuleChange', () => {
  it('adds a draft under the draft id, edits in place, and deletes by id', () => {
    const draft = { pattern: 'MOP', matchKind: 'contains' as const, sectionCode: '22 42 16', priority: 150 }
    expect(applyRuleChange(RULES, { kind: 'add', draft }).find((r) => r.id === DRAFT_RULE_ID)).toMatchObject(draft)
    const edited = applyRuleChange(RULES, { kind: 'edit', id: 'fd', draft: { ...draft, pattern: 'FD' } })
    expect(edited.map((r) => r.id)).toEqual(RULES.map((r) => r.id))
    expect(edited.find((r) => r.id === 'fd')?.pattern).toBe('FD')
    expect(applyRuleChange(RULES, { kind: 'delete', id: 'fd' }).map((r) => r.id)).not.toContain('fd')
  })
})

describe('previewRuleChange', () => {
  it('an added rule codes the uncoded names it catches and lifts the coverage', () => {
    const p = previewRuleChange(RULES, NAMES, { kind: 'add', draft: { pattern: 'MOP', matchKind: 'contains', sectionCode: '22 42 16', priority: 150 } })
    expect(p.shifts).toEqual([{ fixture: 'MOP SINK', bidCount: 6, before: { outcome: 'unmatched' }, after: { outcome: 'matched', sectionCode: '22 42 16' } }])
    expect(p).toMatchObject({ newlyCoded: 1, newlyUncoded: 0, recoded: 0, coverageBefore: 83, coverageAfter: 100 })
  })

  it('moving a rule to another section recodes the names it decides', () => {
    const p = previewRuleChange(RULES, NAMES, { kind: 'edit', id: 'valve', draft: { pattern: 'VALVE', matchKind: 'contains', sectionCode: '22 11 19', priority: 700 } })
    expect(p.shifts).toEqual([{ fixture: 'BALL VALVE', bidCount: 5, before: { outcome: 'matched', sectionCode: '22 05 23' }, after: { outcome: 'matched', sectionCode: '22 11 19' } }])
    expect(p).toMatchObject({ newlyCoded: 0, newlyUncoded: 0, recoded: 1, coverageBefore: 83, coverageAfter: 83 })
  })

  it('a deleted rule hands its names to the next rule that catches them, or leaves them uncoded', () => {
    // WC-1 falls to "starts with WC-", the same section, so nothing shifts.
    const toNext = previewRuleChange(RULES, NAMES, { kind: 'delete', id: 'wc1' })
    expect(toNext.shifts).toEqual([])
    expect(toNext).toMatchObject({ recoded: 0, coverageBefore: 83, coverageAfter: 83 })
    // Moving "starts with WC-" to another section shows the hand-off would recode WC-1 too.
    const recoding = previewRuleChange(applyRuleChange(RULES, { kind: 'delete', id: 'wc1' }), NAMES, {
      kind: 'edit',
      id: 'wc',
      draft: { pattern: 'WC-', matchKind: 'starts_with', sectionCode: '22 42 16', priority: 100 },
    })
    expect(recoding.shifts.map((s) => s.fixture)).toEqual(['WC-1', 'WC-2'])
    const toNone = previewRuleChange(RULES, NAMES, { kind: 'delete', id: 'demo' })
    expect(toNone.shifts).toEqual([{ fixture: 'DEMO', bidCount: 2, before: { outcome: 'no-code' }, after: { outcome: 'unmatched' } }])
    expect(toNone).toMatchObject({ newlyUncoded: 1, coverageBefore: 83, coverageAfter: 67 })
  })

  it('a section change from a code to no code counts as recoded', () => {
    const p = previewRuleChange(RULES, NAMES, { kind: 'edit', id: 'fd', draft: { pattern: 'FD-', matchKind: 'contains', sectionCode: null, priority: 200 } })
    expect(p.shifts).toEqual([{ fixture: '4IN FD-1', bidCount: 3, before: { outcome: 'matched', sectionCode: '22 13 19' }, after: { outcome: 'no-code' } }])
    expect(p.recoded).toBe(1)
  })

  it('coverage is 100 with no names at all', () => {
    expect(previewRuleChange(RULES, [], { kind: 'delete', id: 'fd' })).toMatchObject({ shifts: [], coverageBefore: 100, coverageAfter: 100 })
  })
})

describe('validateRuleDraft', () => {
  const SECTIONS = new Set(['22 42 13', '22 42 16', '22 13 19', '22 05 23'])
  const base = { pattern: 'MOP', matchKind: 'contains' as const, sectionCode: '22 42 16', priority: 150 }

  it('a good draft has no problems', () => {
    expect(validateRuleDraft(base, RULES, SECTIONS)).toEqual([])
  })

  it('refuses an empty pattern, an unknown section and a bad order', () => {
    const levels = (d: typeof base) => validateRuleDraft(d, RULES, SECTIONS).map((p) => p.level)
    expect(levels({ ...base, pattern: '  ' })).toEqual(['refuse'])
    expect(validateRuleDraft({ ...base, sectionCode: '22 99 99' }, RULES, SECTIONS)[0]?.message).toContain('22 99 99')
    expect(levels({ ...base, priority: 0 })).toEqual(['refuse'])
    expect(levels({ ...base, priority: 1.5 })).toEqual(['refuse'])
  })

  it('refuses a second rule looking for the same words the same way, in any case', () => {
    expect(validateRuleDraft({ ...base, pattern: 'fd-' }, RULES, SECTIONS).map((p) => p.level)).toEqual(['refuse'])
    expect(validateRuleDraft({ ...base, pattern: 'FD-', matchKind: 'exact' }, RULES, SECTIONS)).toEqual([])
    expect(validateRuleDraft({ ...base, pattern: 'FD-' }, RULES, SECTIONS, 'fd')).toEqual([])
  })

  it('warns on a short contains or starts-with pattern, never on a short exact one', () => {
    expect(validateRuleDraft({ ...base, pattern: 'CO' }, RULES, SECTIONS)).toEqual([expect.objectContaining({ level: 'warn' })])
    expect(validateRuleDraft({ ...base, pattern: 'CO', matchKind: 'starts_with' }, RULES, SECTIONS)).toEqual([expect.objectContaining({ level: 'warn' })])
    expect(validateRuleDraft({ ...base, pattern: 'CO', matchKind: 'exact' }, RULES, SECTIONS)).toEqual([])
    expect(validateRuleDraft({ ...base, pattern: 'COP' }, RULES, SECTIONS)).toEqual([])
  })

  it('a no-code draft needs no section', () => {
    expect(validateRuleDraft({ ...base, sectionCode: null }, RULES, SECTIONS)).toEqual([])
  })
})

describe('priorityBand', () => {
  it('names the band an order sits in', () => {
    expect([10, 59, 60, 99, 100, 699, 700, 900].map(priorityBand)).toEqual([
      'seeded names', 'seeded names', 'pinned names', 'pinned names', 'patterns', 'patterns', 'catch-alls', 'catch-alls',
    ])
  })
})

describe('groupRulesBySection', () => {
  it('lists every section in code order with its rules in deciding order, no-code last, unknown codes kept', () => {
    const sections = [
      { code: '22 42 16', title: 'Commercial Lavatories and Sinks' },
      { code: '22 05 23', title: 'General-Duty Valves for Plumbing Piping' },
      { code: '22 42 13', title: 'Commercial Water Closets and Urinals' },
      { code: '22 31 00', title: 'Domestic Water Softeners' },
    ]
    const groups = groupRulesBySection(RULES, sections)
    expect(groups.map((g) => [g.code, g.title, g.rules.map((r) => r.id)])).toEqual([
      ['22 05 23', 'General-Duty Valves for Plumbing Piping', ['valve']],
      ['22 13 19', 'Unknown section', ['fd']],
      ['22 31 00', 'Domestic Water Softeners', []],
      ['22 42 13', 'Commercial Water Closets and Urinals', ['wc1', 'wc']],
      ['22 42 16', 'Commercial Lavatories and Sinks', ['wc-dup']],
      [null, 'No code (deliberately)', ['demo']],
    ])
  })
})

describe('sectionTallies', () => {
  it('totals each section\'s rules, the names they decide and the bids behind them', () => {
    const sections = [
      { code: '22 42 13', title: 'Commercial Water Closets and Urinals' },
      { code: '22 31 00', title: 'Domestic Water Softeners' },
    ]
    const groups = groupRulesBySection(RULES, sections)
    const tallies = sectionTallies(groups, ruleStandings(RULES, NAMES))
    expect(tallies.find((t) => t.code === '22 42 13')).toEqual({ code: '22 42 13', title: 'Commercial Water Closets and Urinals', rules: 2, names: 2, bids: 14 })
    expect(tallies.find((t) => t.code === '22 31 00')).toEqual({ code: '22 31 00', title: 'Domestic Water Softeners', rules: 0, names: 0, bids: 0 })
    expect(tallies[tallies.length - 1]).toEqual({ code: null, title: 'No code (deliberately)', rules: 1, names: 1, bids: 2 })
  })
})
