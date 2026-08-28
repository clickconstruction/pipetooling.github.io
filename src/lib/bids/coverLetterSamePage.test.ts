import { describe, expect, it } from 'vitest'
import { formatCurrency } from '../format'
import {
  COVER_LETTER_ALTS_HEADING_DEFAULT,
  altSectionKey,
  buildAlternatesBlock,
  customerFacingAlternateName,
  formatAlternateDeltaText,
  parseCoverLetterAltTexts,
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
  it('returns null when there is nothing to combine (single section, or no alternates)', () => {
    expect(planSamePageLetter([sec({ name: 'only', revenueSum: 100 })])).toBeNull()
    expect(planSamePageLetter([sec({ name: 'a', revenueSum: 100 }), sec({ name: 'b', revenueSum: 200 })])).toBeNull()
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
  it('merges headline fixture rows across base sections (counts summed, first-seen order)', () => {
    const plan = planSamePageLetter([
      sec({ name: 'bldg-a', revenueSum: 100, fixtureRows: [{ fixture: 'FD', count: 2 }, { fixture: 'HB', count: 1 }] }),
      sec({ name: 'bldg-b', revenueSum: 50, fixtureRows: [{ fixture: 'HB', count: 3 }, { fixture: 'WC-1', count: 1 }] }),
      sec({ name: 'alt', revenueSum: 80, isAlternate: true, fixtureRows: [{ fixture: 'FD', count: 9 }] }),
    ])!
    expect(plan.headlineRevenue).toBe(150)
    expect(plan.fixtureRows).toEqual([
      { fixture: 'FD', count: 2 },
      { fixture: 'HB', count: 4 },
      { fixture: 'WC-1', count: 1 },
    ])
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
