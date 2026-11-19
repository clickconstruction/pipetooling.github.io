import { describe, expect, it } from 'vitest'
import {
  LIEN_EXPORT_PAGE_KEYS,
  LIEN_PAGE_EXPORT_WORDS,
  isLienExportPageKey,
  lienExportDraftLine,
  lienExportDraftStamp,
  lienExportFileName,
  lienExportFiling,
  lienExportIsDraft,
  lienExportPageName,
  lienExportPressLabel,
  lienExportRecipe,
  lienExportTitle,
} from './lienPageExport'
import type { LienDeskPile } from './lienDesk'

const JOB = '11111111-2222-4333-8444-555555555555'

describe('lienPageExport — one page of a notice, exported alone (v2.7432)', () => {
  it('knows the four page keys the pane draws and no other', () => {
    expect([...LIEN_EXPORT_PAGE_KEYS]).toEqual(['cover', 'release', 'notice', 'pay'])
    expect(isLienExportPageKey('cover')).toBe(true)
    expect(isLienExportPageKey('affidavit')).toBe(false)
  })

  it('names the file by the job number, the job name and the page', () => {
    expect(lienExportFileName({ jobNumber: '523', jobName: 'Marsden Hills', key: 'cover' })).toBe('523 Marsden Hills, cover letter.pdf')
    expect(lienExportFileName({ jobNumber: '523', jobName: 'Marsden Hills', key: 'release' })).toBe('523 Marsden Hills, conditional release.pdf')
    expect(lienExportFileName({ jobNumber: '523', jobName: 'Marsden Hills', key: 'notice' })).toBe('523 Marsden Hills, notice.pdf')
    expect(lienExportFileName({ jobNumber: '523', jobName: 'Marsden Hills', key: 'pay' })).toBe('523 Marsden Hills, pay codes.pdf')
    expect(lienExportTitle({ jobNumber: '523', jobName: 'Marsden Hills', key: 'cover' })).toBe('523 Marsden Hills, cover letter')
  })

  it('keeps the name safe for a file: no path marks, one space between words, no dot at an end', () => {
    expect(lienExportFileName({ jobNumber: '878', jobName: ' Tune 5- Seguin / Phase: 2 "B"  ', key: 'notice' })).toBe('878 Tune 5- Seguin Phase 2 B, notice.pdf')
    expect(lienExportFileName({ jobNumber: '12', jobName: 'ZZ Test\tWalk\nProject.', key: 'pay' })).toBe('12 ZZ Test Walk Project, pay codes.pdf')
    expect(lienExportFileName({ jobNumber: '9', jobName: '..\\..\\secrets', key: 'cover' })).toBe('9 secrets, cover letter.pdf')
  })

  it('reads with what the job has, and holds a long name to 80 characters', () => {
    expect(lienExportFileName({ jobNumber: '—', jobName: 'Marsden Hills', key: 'cover' })).toBe('Marsden Hills, cover letter.pdf')
    expect(lienExportFileName({ jobNumber: '523', jobName: '', key: 'cover' })).toBe('523, cover letter.pdf')
    expect(lienExportFileName({ jobNumber: null, jobName: undefined, key: 'cover' })).toBe('Lien notice, cover letter.pdf')
    const long = lienExportTitle({ jobNumber: '523', jobName: 'A'.repeat(200), key: 'cover' })
    expect(long).toBe(`523 ${'A'.repeat(76)}, cover letter`)
  })

  it('makes each page the way the run makes that part', () => {
    expect(lienExportRecipe('cover')).toEqual({ builder: 'filing', fit: 'one-page', citation: false })
    expect(lienExportRecipe('notice')).toEqual({ builder: 'filing', fit: null, citation: true })
    expect(lienExportRecipe('pay')).toEqual({ builder: 'filing', fit: null, citation: true })
    expect(lienExportRecipe('release')).toEqual({ builder: 'waiver' })
  })

  it('is a draft until the notice is approved, and when nothing went', () => {
    const drafts: LienDeskPile[] = ['needs_owner', 'to_draft', 'awaiting', 'held', 'missed']
    const approved: LienDeskPile[] = ['ready', 'printed', 'sent']
    expect(drafts.every((p) => lienExportIsDraft(p))).toBe(true)
    expect(approved.some((p) => lienExportIsDraft(p))).toBe(false)
    expect(lienExportIsDraft(null)).toBe(true)
  })

  it('writes the draft line with the day, and no line once approved', () => {
    expect(lienExportDraftLine('to_draft', '2026-11-15')).toBe('Draft, not sent · November 15, 2026')
    expect(lienExportDraftLine('awaiting', '2026-11-15')).toBe('Draft, not sent · November 15, 2026')
    expect(lienExportDraftLine('ready', '2026-11-15')).toBe('')
    expect(lienExportDraftLine('sent', '2026-11-15')).toBe('')
  })

  it('puts the draft line at the left of an empty foot, and in the clear middle where the foot holds words at its left', () => {
    expect(lienExportDraftStamp('cover')).toEqual({ align: 'left', xMm: 22, baselineMm: 272 })
    expect(lienExportDraftStamp('notice')).toEqual({ align: 'center', xMm: 135, baselineMm: 272 })
    expect(lienExportDraftStamp('pay')).toEqual({ align: 'center', xMm: 135, baselineMm: 272 })
    // The waiver's own foot sits 2mm lower than a filing paper's.
    expect(lienExportDraftStamp('release')).toEqual({ align: 'center', xMm: 135, baselineMm: 274 })
  })

  it('files a download of an approved notice under its job, and nothing for a draft', () => {
    expect(lienExportFiling({ pile: 'ready', jobId: JOB, title: '523 Marsden Hills, cover letter' })).toEqual({ kind: 'lien_notice_page', title: '523 Marsden Hills, cover letter', jobIds: [JOB], recipientName: null })
    expect(lienExportFiling({ pile: 'sent', jobId: JOB, title: 't', recipientName: ' ZZ Test Owner ' })?.recipientName).toBe('ZZ Test Owner')
    expect(lienExportFiling({ pile: 'to_draft', jobId: JOB, title: 't' })).toBeNull()
    expect(lienExportFiling({ pile: 'awaiting', jobId: JOB, title: 't' })).toBeNull()
    expect(lienExportFiling({ pile: 'ready', jobId: null, title: 't' })).toBeNull()
  })

  it('words the presses, and names the page to a screen reader', () => {
    expect(LIEN_PAGE_EXPORT_WORDS.open).toEqual({ label: 'Open', arrow: '↗', title: 'Open this page alone in a new tab, as it prints' })
    expect(LIEN_PAGE_EXPORT_WORDS.pdf).toEqual({ label: 'PDF', arrow: '↓', title: 'Save this page as a PDF' })
    expect(LIEN_PAGE_EXPORT_WORDS.busy).toBe('Making the PDF…')
    expect(lienExportPressLabel('open', 'cover')).toBe('Open the cover letter in a new tab')
    expect(lienExportPressLabel('pdf', 'pay')).toBe('Save the pay codes as a PDF')
    expect(lienExportPageName('release')).toBe('conditional release')
  })
})
