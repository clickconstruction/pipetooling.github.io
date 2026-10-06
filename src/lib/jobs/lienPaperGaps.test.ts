import { describe, expect, it } from 'vitest'
import { gapToken, lienPaperBannerWords, lienPaperGaps, paintGaps, withGapTokens } from './lienPaperGaps'

const whole = { ownerName: 'Elbel Holdings LLC', ownerAddress: '4 Example Way, Schertz, TX', county: 'Guadalupe', legalDescription: 'Lot 1, Block 2', gcName: 'Loberg Contracting', contactPerson: 'Robert Douglas, Master Plumber', claimantAddress: '5501 Balcones Dr' }

describe('lienPaperGaps (v2.4632)', () => {
  it('a whole paper has no gaps, on either form', () => {
    expect(lienPaperGaps('notice', whole)).toEqual([])
    expect(lienPaperGaps('affidavit', whole)).toEqual([])
  })
  it("a notice's owner gap sits on the envelope, not the form; the GC, signer and address sit on the form", () => {
    const gaps = lienPaperGaps('notice', { ...whole, ownerName: '', gcName: '', contactPerson: '' })
    expect(gaps.map((g) => [g.n, g.key, g.where, g.fix, g.field ?? null])).toEqual([
      [1, 'owner', 'envelope', 'find_owner', null],
      [2, 'gc', 'form', 'edit_job', 'originalContractorName'],
      [3, 'signer', 'form', 'settings', 'contactPerson'],
    ])
    // A named owner with no address is one gap, not two.
    expect(lienPaperGaps('notice', { ...whole, ownerAddress: '' }).map((g) => g.key)).toEqual(['owner_address'])
  })
  it("an affidavit's gaps are the county, the legal description and the owner, all fixed on the property", () => {
    const gaps = lienPaperGaps('affidavit', { ...whole, county: '', legalDescription: '', ownerName: '' })
    expect(gaps.map((g) => [g.n, g.key, g.fix, g.field])).toEqual([
      [1, 'county', 'fix_property', 'county'],
      [2, 'legal', 'fix_property', 'legalDescription'],
      [3, 'owner', 'fix_property', 'ownerName'],
    ])
  })
  it("the gates the affidavit does not print become record gaps, listed but never painted", () => {
    const gaps = lienPaperGaps('affidavit', { ...whole, affidavitGates: [{ key: 'owner', ok: true }, { key: 'legal', ok: true }, { key: 'notice', ok: false }, { key: 'homestead', ok: false }] })
    expect(gaps.map((g) => [g.n, g.key, g.where, g.fixWords, g.field ?? null])).toEqual([
      [1, 'notices', 'record', 'Send the notices first', null],
      [2, 'homestead', 'record', 'Talk to counsel', null],
    ])
    expect(withGapTokens({ county: 'Bexar' }, gaps)).toEqual({ county: 'Bexar' })
  })
  it('the tokens ride inside the fields and paint as numbered marks in the HTML; the envelope token paints the same way', () => {
    const gaps = lienPaperGaps('affidavit', { ...whole, county: '', legalDescription: '' })
    const fields = withGapTokens({ county: 'x', legalDescription: 'y', ownerName: 'kept' }, gaps)
    expect(fields).toEqual({ county: '⟦GAP:1⟧', legalDescription: '⟦GAP:2⟧', ownerName: 'kept' })
    const html = paintGaps(`<p>COUNTY OF ${fields.county.toUpperCase()} — ${fields.legalDescription}</p>`, gaps)
    expect(html).toBe('<p>COUNTY OF <span class="lienPaperGap" data-gap="1"><b>1</b>County</span> — <span class="lienPaperGap" data-gap="2"><b>2</b>Legal description</span></p>')
    expect(paintGaps(gapToken(1), gaps)).toContain('<b>1</b>County')
    // An unknown number still paints, as Missing.
    expect(paintGaps(gapToken(9), gaps)).toContain('<b>9</b>Missing')
  })
  it('the banner counts the blanks, or says the paper is whole and what is next', () => {
    const gaps = lienPaperGaps('notice', { ...whole, ownerName: '' })
    expect(lienPaperBannerWords('notice', gaps, 'Draft notice', 'In the mail by Oct 15 · 10 days left')).toEqual({ tone: 'red', words: '1 detail missing before this notice can go. In the mail by Oct 15 · 10 days left.' })
    expect(lienPaperBannerWords('affidavit', lienPaperGaps('affidavit', { ...whole, county: '', ownerName: '' }), 'Draft affidavit', 'File by Oct 15 · 10 days left').words).toBe('2 details missing before this affidavit can be filed. File by Oct 15 · 10 days left.')
    expect(lienPaperBannerWords('notice', [], 'Approve', 'In the mail by Oct 15 · 10 days left')).toEqual({ tone: 'green', words: 'Nothing missing. Ready for the next step: Approve. In the mail by Oct 15 · 10 days left.' })
  })
})
