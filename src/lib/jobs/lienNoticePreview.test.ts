import { describe, expect, it } from 'vitest'
import { buildLienNoticeBlocks, filingDocHtml, type LienNoticeFields } from '../jobsDocuments/lienFilingDocuments'
import {
  LIEN_NOTICE_FIELD_GUIDE,
  LIEN_NOTICE_PREVIEW_MESSAGE,
  LIEN_NOTICE_TYPED_FIELDS,
  applyWordingEdits,
  buildLienNoticePreviewHtml,
  isTypedNoticeField,
  noticeWordingDiff,
  wordingLineText,
} from './lienNoticePreview'

const DEFAULTS: LienNoticeFields = {
  noticeDate: '2026-09-16',
  projectDescription: 'Dudley Mason — 628 Terrell Rd, San Antonio, TX 78209',
  claimantName: 'Click Plumbing and Electrical',
  laborMaterialsType: 'Plumbing labor and materials',
  originalContractorName: 'RMC- Dudley Mason',
  contractedWithIfDifferent: '',
  claimAmount: '9800.00',
  contactPerson: 'Malachi Whites, Master Plumber',
  claimantAddress: '5501 Balcones Dr A141, Austin, TX 78731',
}

describe('the nine values: four typed, five derived', () => {
  it('the guide covers every field once and agrees with the typed list', () => {
    const keys = LIEN_NOTICE_FIELD_GUIDE.map((g) => g.key)
    expect([...keys].sort()).toEqual([...Object.keys(DEFAULTS)].sort())
    expect(LIEN_NOTICE_FIELD_GUIDE.filter((g) => g.kind === 'typed').map((g) => g.key).sort()).toEqual([...LIEN_NOTICE_TYPED_FIELDS].sort())
    // Every derived value with a home names its door; the date has none — it is the day of the run.
    expect(LIEN_NOTICE_FIELD_GUIDE.find((g) => g.key === 'claimAmount')?.door).toBe('bill')
    expect(LIEN_NOTICE_FIELD_GUIDE.find((g) => g.key === 'noticeDate')?.door).toBeNull()
  })

  it('the claim amount, the parties and the date are never typed', () => {
    expect(isTypedNoticeField('claimAmount')).toBe(false)
    expect(isTypedNoticeField('originalContractorName')).toBe(false)
    expect(isTypedNoticeField('noticeDate')).toBe(false)
    expect(isTypedNoticeField('laborMaterialsType')).toBe(true)
    expect(isTypedNoticeField('nonsense')).toBe(false)
  })
})

describe('wording edits', () => {
  it('layers only the typed fields over the base and ignores an attempt on a derived one', () => {
    const out = applyWordingEdits(DEFAULTS, { laborMaterialsType: 'Electrical labor and materials', claimAmount: '1.00' } as Partial<LienNoticeFields>)
    expect(out.laborMaterialsType).toBe('Electrical labor and materials')
    expect(out.claimAmount).toBe('9800.00')
  })

  it('diffs against the job defaults, ignoring whitespace, and names the line', () => {
    expect(noticeWordingDiff(DEFAULTS, DEFAULTS)).toEqual([])
    const edited = { ...DEFAULTS, laborMaterialsType: ' Electrical labor and materials ', contractedWithIfDifferent: 'Loberg Contracting' }
    expect(noticeWordingDiff(edited, DEFAULTS)).toEqual(['laborMaterialsType', 'contractedWithIfDifferent'])
    expect(noticeWordingDiff({ ...DEFAULTS, laborMaterialsType: 'Plumbing labor and materials ' }, DEFAULTS)).toEqual([])
    expect(wordingLineText([], null)).toBe('Wording · standard')
    expect(wordingLineText(['laborMaterialsType', 'contactPerson'], 'Taunya')).toBe('Wording · edited (2) by Taunya')
    expect(wordingLineText(['laborMaterialsType'], null)).toBe('Wording · edited (1)')
  })
})

describe('the form lines carry their field name', () => {
  it('every value on the notice is tagged, and the omitted contracted-with line is not rendered', () => {
    const html = filingDocHtml(buildLienNoticeBlocks(DEFAULTS))
    for (const k of Object.keys(DEFAULTS)) {
      if (k === 'contractedWithIfDifferent') expect(html).not.toContain(`data-field="${k}"`)
      else expect(html).toContain(`data-field="${k}"`)
    }
    const withParty = filingDocHtml(buildLienNoticeBlocks({ ...DEFAULTS, contractedWithIfDifferent: 'Loberg Contracting' }))
    expect(withParty).toContain('data-field="contractedWithIfDifferent"')
  })
})

describe('the preview page', () => {
  it('is the print HTML plus a legend, both tints, the two lists, and the message the desk listens for', () => {
    const html = buildLienNoticePreviewHtml({ blocks: buildLienNoticeBlocks(DEFAULTS), fields: DEFAULTS, defaults: DEFAULTS, jobLabel: '258 · Dudley Mason', editedBy: null })
    expect(html).toContain('<title>Notice · 258 · Dudley Mason · preview</title>')
    expect(html).toContain('Notice of Claim for Unpaid Labor or Materials')
    expect(html).toContain('You can change this on the desk')
    expect(html).toContain('Filled from the job · change it there')
    expect(html).toContain('You can change · 4')
    expect(html).toContain('Filled from the job · 5')
    expect(html).toContain('data-focus="laborMaterialsType"')
    expect(html).toContain(LIEN_NOTICE_PREVIEW_MESSAGE)
    expect(html).not.toContain('Wording edited')
    // The print stylesheet strips every mark, so a printed preview is the plain form.
    expect(html).toContain('.doc [data-field] { background: none !important; outline: none !important; }')
  })

  it('says who changed the wording when it differs from the defaults', () => {
    const fields = { ...DEFAULTS, laborMaterialsType: 'Electrical labor and materials' }
    const html = buildLienNoticePreviewHtml({ blocks: buildLienNoticeBlocks(fields), fields, defaults: DEFAULTS, jobLabel: '813 · Reliant Health', editedBy: 'Taunya' })
    expect(html).toContain('Wording edited (1) by Taunya')
    expect(html).toContain('“Electrical labor and materials” · <em>changed from the default</em>')
  })

  it('escapes what the office typed', () => {
    const fields = { ...DEFAULTS, projectDescription: '<b>Not markup</b> & "quotes"' }
    const html = buildLienNoticePreviewHtml({ blocks: buildLienNoticeBlocks(fields), fields, defaults: DEFAULTS, jobLabel: 'x', editedBy: null })
    expect(html).not.toContain('<b>Not markup</b>')
    expect(html).toContain('&lt;b&gt;Not markup&lt;/b&gt; &amp; &quot;quotes&quot;')
  })
})

describe('the cover page in the preview (v2.3540)', () => {
  const cover = [
    { kind: 'title' as const, lines: ['Re: 258 · Dudley Mason', 'July and August 2026'] },
    { kind: 'paragraph' as const, text: 'This notice is routine paper under Texas law, not a claim that anyone is in default.' },
  ]
  it('prints the cover page first as page 1 of 2, breaking the page before the notice', () => {
    const html = buildLienNoticePreviewHtml({ blocks: buildLienNoticeBlocks(DEFAULTS), fields: DEFAULTS, defaults: DEFAULTS, jobLabel: '258 · Dudley Mason', editedBy: null, coverBlocks: cover })
    expect(html).toContain('Page 1 of 2 · cover note')
    expect(html).toContain('Page 2 of 2 · the notice')
    expect(html.indexOf('Re: 258 · Dudley Mason')).toBeLessThan(html.indexOf('Notice of Claim for Unpaid Labor or Materials'))
    expect(html).toContain('.doc.cover { page-break-after: always; }')
    expect(html).toContain('The cover note is page 1, as the packet prints it')
  })
  it('without a cover page the notice is page 1 of 1 and the note says how to add one', () => {
    const html = buildLienNoticePreviewHtml({ blocks: buildLienNoticeBlocks(DEFAULTS), fields: DEFAULTS, defaults: DEFAULTS, jobLabel: 'x', editedBy: null, coverBlocks: [] })
    expect(html).toContain('Page 1 of 1 · the notice')
    expect(html).not.toContain('cover note</div>')
    expect(html).toContain('No cover note — tick it on the desk')
  })
})
