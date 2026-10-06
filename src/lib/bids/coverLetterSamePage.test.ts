import { describe, expect, it } from 'vitest'
import { formatCurrency } from '../format'
import {
  COVER_LETTER_ALTS_HEADING_DEFAULT,
  altSectionKey,
  buildAlternatesBlock,
  customerFacingAlternateName,
  formatAlternateDeltaText,
  parseCoverLetterAltTexts,
  buildOptionsBlock,
  optionsAlternateCount,
  optionsShareFixtures,
  planSamePageLetter,
  type SamePageSection,
} from './coverLetterSamePage'

const sec = (over: Partial<SamePageSection> & { name: string }): SamePageSection => ({
  bidVersionId: over.name,
  revenueSum: 0,
  fixtureRows: [],
  isAlternate: false,
  ...over,
})

describe('planSamePageLetter', () => {
  it('returns null when there is nothing to combine (a single section, or one base with no alternates)', () => {
    expect(planSamePageLetter([sec({ name: 'only', revenueSum: 100 })])).toBeNull()
    expect(planSamePageLetter([sec({ name: 'only', revenueSum: 100 }), sec({ name: 'zero', revenueSum: 0, isAlternate: true })].slice(0, 1))).toBeNull()
    // v2.4723: two bases are two options, so they always plan (see the options describe).
    expect(planSamePageLetter([sec({ name: 'a', revenueSum: 100 }), sec({ name: 'b', revenueSum: 200 })])?.options?.length).toBe(2)
  })
  it('bases form the headline; alternates are listed', () => {
    const plan = planSamePageLetter([
      sec({ name: 'base', revenueSum: 100 }),
      sec({ name: 'alt', revenueSum: 80, isAlternate: true }),
    ])!
    expect(plan.headline.map((s) => s.name)).toEqual(['base'])
    expect(plan.alternates.map((s) => s.name)).toEqual(['alt'])
    expect(plan.headlineRevenue).toBe(100)
    expect(plan.alternateLeads).toBe(false)
  })
  it('with no base section the first alternate leads the letter (Wendi: no more $0.00 letters)', () => {
    const plan = planSamePageLetter([
      sec({ name: 'star', revenueSum: 67311.11, isAlternate: true }),
      sec({ name: 'alt1', revenueSum: 62024.11, isAlternate: true }),
    ])!
    expect(plan.headline.map((s) => s.name)).toEqual(['star'])
    expect(plan.alternates.map((s) => s.name)).toEqual(['alt1'])
    expect(plan.headlineRevenue).toBeCloseTo(67311.11)
    expect(plan.alternateLeads).toBe(true)
  })
  it('a lone alternate with no base has nothing to list against itself → null', () => {
    expect(
      planSamePageLetter([sec({ name: 'a', revenueSum: 10, isAlternate: true }), sec({ name: 'b', revenueSum: 0, isAlternate: true })].slice(0, 1)),
    ).toBeNull()
  })
  it('two base sections no longer sum (v2.4723): the lead option is the headline, its own rows only', () => {
    const plan = planSamePageLetter([
      sec({ name: 'bldg-a', revenueSum: 100, fixtureRows: [{ fixture: 'FD', count: 2 }, { fixture: 'HB', count: 1 }] }),
      sec({ name: 'bldg-b', revenueSum: 50, fixtureRows: [{ fixture: 'HB', count: 3 }, { fixture: 'WC-1', count: 1 }] }),
      sec({ name: 'alt', revenueSum: 80, isAlternate: true, fixtureRows: [{ fixture: 'FD', count: 9 }] }),
    ])!
    expect(plan.headlineRevenue).toBe(100)
    expect(plan.fixtureRows).toEqual([
      { fixture: 'FD', count: 2 },
      { fixture: 'HB', count: 1 },
    ])
    expect(plan.options?.map((o) => o.section.name)).toEqual(['bldg-a', 'bldg-b'])
    expect(plan.alternates.map((s) => s.name)).toEqual(['alt'])
  })
})

describe('formatAlternateDeltaText', () => {
  it('leads with Add/Deduct against the headline, whole dollars unless real cents', () => {
    expect(formatAlternateDeltaText(62024.11, 67311.11, formatCurrency)).toBe('Deduct $5,287')
    expect(formatAlternateDeltaText(71411.11, 67311.11, formatCurrency)).toBe('Add $4,100')
    expect(formatAlternateDeltaText(62024.61, 67311.11, formatCurrency)).toBe('Deduct $5,286.50')
  })
  it('a matching price says so; only a missing headline hides the lead', () => {
    expect(formatAlternateDeltaText(100, 100, formatCurrency)).toBe('no change')
    expect(formatAlternateDeltaText(100, 0, formatCurrency)).toBeNull()
  })
})

describe('altSectionKey', () => {
  it('keys by version, extended by the offered scenario', () => {
    expect(altSectionKey({ bidVersionId: 'v1' })).toBe('v1')
    expect(altSectionKey({ bidVersionId: 'v1', offeredPricingId: 'p2' })).toBe('v1:p2')
    expect(altSectionKey({ bidVersionId: null })).toBe('none')
  })
})

describe('parseCoverLetterAltTexts', () => {
  it('accepts the stored shape and drops junk', () => {
    expect(parseCoverLetterAltTexts(null)).toEqual({})
    expect(parseCoverLetterAltTexts('nope')).toEqual({})
    expect(parseCoverLetterAltTexts({ heading: 'Options:', sections: { v1: { label: 'PEX', note: 'n' }, v2: 7, v3: { label: 3 } } })).toEqual({
      heading: 'Options:',
      sections: { v1: { label: 'PEX', note: 'n' } },
    })
  })
})

describe('buildAlternatesBlock', () => {
  const plan = planSamePageLetter([
    sec({ name: 'BURD & ASSOCIATES', revenueSum: 67311.11, isAlternate: true }),
    sec({ name: 'BURD & ASSOCIATES · Alternate 1', revenueSum: 62024.11, isAlternate: true, offeredPricingId: 'p-alt' }),
  ])!
  it('an offered price on the leading scope prints as a bare numbered alternate (internal names never auto-print); saved wording wins', () => {
    const block = buildAlternatesBlock(plan, {}, formatCurrency)
    expect(block.heading).toBe(COVER_LETTER_ALTS_HEADING_DEFAULT)
    expect(block.items).toEqual([
      {
        label: 'Alternate 1',
        deltaText: 'Deduct $5,287',
        amountFormatted: '$62,024.11',
        note: null,
      },
    ])
    const edited = buildAlternatesBlock(
      plan,
      { heading: 'Alternates — priced in lieu of the proposal above:', sections: { 'BURD & ASSOCIATES · Alternate 1:p-alt': { label: 'Alternate 1 — PEX in lieu of copper', note: 'Same scope as below.' } } },
      formatCurrency,
    )
    expect(edited.heading).toBe('Alternates — priced in lieu of the proposal above:')
    expect(edited.items[0]!.label).toBe('Alternate 1 — PEX in lieu of copper')
    expect(edited.items[0]!.note).toBe('Same scope as below.')
  })
  it('groups an offered price under its scope alternate as an "— or" option; the option name prints only when saved', () => {
    const grouped = planSamePageLetter([
      sec({ name: 'To Plans', bidVersionId: 'v-base', revenueSum: 56343 }),
      sec({ name: 'PEX in lieu of copper', bidVersionId: 'v-pex', revenueSum: 56343, isAlternate: true }),
      sec({ name: 'PEX in lieu of copper · Default', bidVersionId: 'v-pex', revenueSum: 41700, isAlternate: true, offeredPricingId: 'p-def' }),
    ])!
    const block = buildAlternatesBlock(grouped, {}, formatCurrency)
    expect(block.items).toHaveLength(1)
    expect(block.items[0]!.label).toBe('Alternate 1 — PEX in lieu of copper')
    expect(block.items[0]!.deltaText).toBe('no change')
    expect(block.items[0]!.options).toEqual([
      { label: null, deltaText: 'Deduct $14,643', amountFormatted: '$41,700.00', note: null },
    ])
    const named = buildAlternatesBlock(grouped, { sections: { 'v-pex:p-def': { label: 'Standard-grade fixtures' } } }, formatCurrency)
    expect(named.items[0]!.options![0]!.label).toBe('Standard-grade fixtures')
  })
  it('editable adds preview-only edit keys, on options too', () => {
    const block = buildAlternatesBlock(plan, {}, formatCurrency, true)
    expect(block.headingEditKey).toBe('heading')
    expect(block.items[0]!.editKey).toBe('BURD & ASSOCIATES · Alternate 1:p-alt')
    const grouped = planSamePageLetter([
      sec({ name: 'base', bidVersionId: 'v-base', revenueSum: 100 }),
      sec({ name: 'alt', bidVersionId: 'v-alt', revenueSum: 90, isAlternate: true }),
      sec({ name: 'alt · opt', bidVersionId: 'v-alt', revenueSum: 80, isAlternate: true, offeredPricingId: 'p-o' }),
    ])!
    expect(buildAlternatesBlock(grouped, {}, formatCurrency, true).items[0]!.options![0]!.editKey).toBe('v-alt:p-o')
    const shipped = buildAlternatesBlock(plan, {}, formatCurrency, false)
    expect(shipped.headingEditKey).toBeUndefined()
    expect(shipped.items[0]!.editKey).toBeUndefined()
  })
})

describe('customerFacingAlternateName', () => {
  const gc = 'MERIT GENERAL CONTRACTORS'
  const project = 'ALSATIAN'

  it("swaps the GC for the project and collapses the doubled halves (the owner's screenshot)", () => {
    expect(
      customerFacingAlternateName(
        'MERIT GENERAL CONTRACTORS value engineered · MERIT GENERAL CONTRACTORS value engineered',
        gc,
        project,
      ),
    ).toBe('ALSATIAN value engineered')
  })

  it('a packet named exactly the GC becomes the project name', () => {
    expect(customerFacingAlternateName('MERIT GENERAL CONTRACTORS · value engineered', gc, project)).toBe(
      'ALSATIAN · value engineered',
    )
  })

  it('GC match is case-insensitive; names without the GC pass through', () => {
    expect(customerFacingAlternateName('Merit General Contractors VE', gc, project)).toBe('ALSATIAN VE')
    expect(customerFacingAlternateName('PEX in lieu of copper', gc, project)).toBe('PEX in lieu of copper')
  })

  it('no project name: the GC prefix drops; nothing left keeps the original', () => {
    expect(customerFacingAlternateName('MERIT GENERAL CONTRACTORS value engineered', gc, null)).toBe('value engineered')
    expect(customerFacingAlternateName('MERIT GENERAL CONTRACTORS', gc, null)).toBe('MERIT GENERAL CONTRACTORS')
  })

  it('buildAlternatesBlock auto labels read customer-facing; saved labels stay untouched', () => {
    const plan = {
      headline: [],
      alternates: [
        { name: `${gc} VE · ${gc} VE`, bidVersionId: 'v1', revenueSum: 100, fixtureRows: [], isAlternate: true },
        { name: `${gc} VE2`, bidVersionId: 'v2', revenueSum: 200, fixtureRows: [], isAlternate: true },
      ],
      headlineRevenue: 0,
      fixtureRows: [],
      alternateLeads: false,
    }
    const block = buildAlternatesBlock(
      plan,
      { sections: { v2: { label: 'Alternate 2 — hand-written' } } },
      (n) => n.toFixed(2),
      false,
      { gcName: gc, projectName: project },
    )
    expect(block.items[0]!.label).toBe('Alternate 1 — ALSATIAN VE')
    expect(block.items[1]!.label).toBe('Alternate 2 — hand-written')
  })
})

describe('options (v2.4723) — two or more base bids are proposals the GC picks between', () => {
  const toPlans = sec({ name: 'To Plans', revenueSum: 922196.69, fixtureRows: [{ fixture: 'WC', count: 6 }, { fixture: 'ft of 4IN WASTE', count: 2038.04 }] })
  const toPlansNoMg = sec({ name: 'To Plans · excl MG', bidVersionId: 'To Plans', revenueSum: 880227.11, isAlternate: true, offeredPricingId: 'p-tp-2' })
  const ve = sec({ name: 'Value Engineered', revenueSum: 366998.23, fixtureRows: [{ fixture: 'WC', count: 6 }, { fixture: 'ft of 4IN PVC', count: 2038.04 }] })
  const veNoMg = sec({ name: 'VE · excl MG', bidVersionId: 'Value Engineered', revenueSum: 329441.55, isAlternate: true, offeredPricingId: 'p-ve-2' })

  it('plans two bases as options, each owning the offered prices on its own version; the lead is the headline, never the sum', () => {
    const plan = planSamePageLetter([toPlans, toPlansNoMg, ve, veNoMg])!
    expect(plan.options?.map((o) => [o.n, o.section.name, o.alternates.map((a) => a.name)])).toEqual([
      [1, 'To Plans', ['To Plans · excl MG']],
      [2, 'Value Engineered', ['VE · excl MG']],
    ])
    expect(plan.headline.map((s) => s.name)).toEqual(['To Plans'])
    expect(plan.headlineRevenue).toBe(922196.69)
    expect(plan.fixtureRows).toEqual(toPlans.fixtureRows)
    expect(plan.alternates).toEqual([])
    expect(plan.alternateLeads).toBe(false)
  })

  it('two bases with no alternates still plan as options (no more one-letter-per-section sum)', () => {
    const plan = planSamePageLetter([toPlans, ve])!
    expect(plan.options?.length).toBe(2)
    expect(optionsAlternateCount(plan)).toBe(0)
  })

  it('a version flagged Alternate stays an in-lieu-of line under the lead, numbered after the options’ alternates', () => {
    const inLieu = sec({ name: 'Phase 2 only', bidVersionId: 'v-p2', revenueSum: 500000, isAlternate: true })
    const plan = planSamePageLetter([toPlans, toPlansNoMg, ve, veNoMg, inLieu])!
    expect(plan.alternates.map((s) => s.name)).toEqual(['Phase 2 only'])
    const block = buildAlternatesBlock(plan, {}, formatCurrency, false, undefined, optionsAlternateCount(plan) + 1)
    expect(block.items[0]!.label).toBe('Alternate 3 — Phase 2 only')
    expect(block.items[0]!.deltaText).toBe('Deduct $422,196.69')
  })

  it('the options block: labels, words, figures, each alternate a deduct against its own option, numbered across the letter', () => {
    const plan = planSamePageLetter([toPlans, toPlansNoMg, ve, veNoMg])!
    const block = buildOptionsBlock(plan, {}, formatCurrency, (n) => `words(${n})`)!
    expect(block.intro).toBe('in one of the following amounts')
    expect(block.items.map((o) => [o.label, o.amountWords, o.amountFormatted])).toEqual([
      ['Option 1 — To Plans', 'WORDS(922196.69)', '$922,196.69'],
      ['Option 2 — Value Engineered', 'WORDS(366998.23)', '$366,998.23'],
    ])
    expect(block.items[0]!.alternates).toEqual([{ label: 'Alternate 1', deltaText: 'Deduct $41,969.58', amountFormatted: '$880,227.11', note: null }])
    expect(block.items[1]!.alternates).toEqual([{ label: 'Alternate 2', deltaText: 'Deduct $37,556.68', amountFormatted: '$329,441.55', note: null }])
    expect(block.sharedFixtures).toBe(false)
  })

  it('saved wording wins on an option and on its alternate; editable adds the keys; customer-facing names drop the GC', () => {
    const gcNamed = sec({ name: 'Acme GC · value engineered', bidVersionId: 'v-acme', revenueSum: 100 })
    const plan = planSamePageLetter([toPlans, toPlansNoMg, gcNamed])!
    const texts = { sections: { [altSectionKey(toPlans)]: { label: 'Option 1 — Per the drawings' }, [altSectionKey(toPlansNoMg)]: { label: 'Excluding med gas', note: 'Med gas by others' } } }
    const block = buildOptionsBlock(plan, texts, formatCurrency, (n) => String(n), true, { gcName: 'Acme GC', projectName: 'Elm Creek' })!
    expect(block.items[0]!.label).toBe('Option 1 — Per the drawings')
    expect(block.items[0]!.editKey).toBe(altSectionKey(toPlans))
    expect(block.items[0]!.alternates[0]).toMatchObject({ label: 'Excluding med gas', note: 'Med gas by others', editKey: altSectionKey(toPlansNoMg) })
    expect(block.items[1]!.label).toBe('Option 2 — Elm Creek · value engineered')
  })

  it('identical fixture lists print once', () => {
    const a = sec({ name: 'A', revenueSum: 10, fixtureRows: [{ fixture: 'WC', count: 2 }] })
    const b = sec({ name: 'B', revenueSum: 9, fixtureRows: [{ fixture: 'wc', count: 2 }] })
    expect(optionsShareFixtures(planSamePageLetter([a, b])!.options!)).toBe(true)
    const c = sec({ name: 'C', revenueSum: 9, fixtureRows: [{ fixture: 'WC', count: 3 }] })
    expect(optionsShareFixtures(planSamePageLetter([a, c])!.options!)).toBe(false)
  })

  it('one base keeps the single-headline plan (null options), as before', () => {
    expect(planSamePageLetter([toPlans, toPlansNoMg])!.options).toBeNull()
    expect(buildOptionsBlock(planSamePageLetter([toPlans, toPlansNoMg])!, {}, formatCurrency, String)).toBeNull()
  })
})
