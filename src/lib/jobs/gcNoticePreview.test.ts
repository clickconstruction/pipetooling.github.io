import { describe, expect, it } from 'vitest'
import { defaultGcNoticeCoverLetter, gcNoticeJobClaim, type GcNoticeMonth } from './gcOnNotice'
import { buildGcNoticePreview, gcNoticeCopyLine, gcNoticePageLabel, gcNoticePreviewableJobs, stepGcNoticePreview } from './gcNoticePreview'

const month = (key: string, deadline: string, closed: boolean): GcNoticeMonth => ({ key, hours: 8, deadline, closed, fromCreation: false })
const issuer = { companyName: 'Click Plumbing and Electrical', addressText: '5501 Balcones Dr A141\nAustin, TX 78731', phone: '(512) 360-0599', email: 'office@clickplumbing.com', tagline: '', licenseLine: '' }
const base = {
  job: (() => {
    const months = [month('2026-04', '2026-07-15', true), month('2026-07', '2026-10-15', false), month('2026-08', '2026-11-16', false)]
    return { jobId: 'j273', claimAmount: 17585, isBilled: true, months, ...gcNoticeJobClaim(months, 17585, null) }
  })(),
  label: '273 · Dudley (Lennox)',
  jobNumber: '273',
  jobName: 'Dudley (Lennox)',
  jobAddress: '9703 Lenox Hl, San Antonio, TX',
  gcName: 'RMC- Dudley Mason',
  contactPerson: 'Malachi Whites, Master Plumber',
  issuer,
  todayYmd: '2026-09-21',
  includeLetter: true,
  letter: defaultGcNoticeCoverLetter({ gcName: 'RMC- Dudley Mason', claimantName: 'Click Plumbing and Electrical' }),
}
const text = (blocks: ReadonlyArray<unknown>) => JSON.stringify(blocks)

describe('buildGcNoticePreview', () => {
  it('the owner gets the letter then the form, filled for this job; the GC gets the form only', () => {
    const p = buildGcNoticePreview(base)
    expect(p.cover).toBe('letter')
    expect(p.pages.owner.map((pg) => pg.key)).toEqual(['cover', 'notice'])
    expect(p.pages.original_contractor.map((pg) => pg.key)).toEqual(['notice'])
    const cover = text(p.pages.owner[0]!.blocks)
    expect(cover).toContain('Re: 273 · Dudley (Lennox)')
    expect(cover).toContain('To the owner of 9703 Lenox Hl, San Antonio, TX')
    expect(cover).not.toContain('{{')
    // the claim names the open months; the closed one's dollars are the letter's footnote (v2.3818 — as approveAll saves it)
    expect(cover).toContain('July and August')
    expect(cover).toContain('A further $5,861.67 for April 2026 is unpaid but outside the statutory notice window')
    const form = text(p.pages.owner[1]!.blocks)
    expect(form).toContain('Notice of Claim for Unpaid Labor or Materials')
    expect(form).toContain('RMC- Dudley Mason')
    expect(p.fields.claimAmount).toBe('11723.33')
    expect(form).not.toContain('17,585')
    expect(form).toContain('Copy for: owner of record')
    expect(text(p.pages.original_contractor[0]!.blocks)).toContain('Copy for: original contractor')
    expect(p.fields.originalContractorName).toBe('RMC- Dudley Mason')
  })

  it('unticked or empty, the owner gets the standard cover note instead — as approveAll saves it', () => {
    for (const over of [{ includeLetter: false }, { letter: '   ' }]) {
      const p = buildGcNoticePreview({ ...base, ...over })
      expect(p.cover).toBe('note')
      expect(p.pages.owner[0]!.label).toBe('cover note')
      expect(text(p.pages.owner[0]!.blocks)).not.toContain('To the owner of')
    }
  })
})

describe('the pager', () => {
  it('lists only the rows a notice is written for', () => {
    const jobs = [
      { id: 'a', readiness: 'ready' as const, timelyMonths: ['2026-07'] },
      { id: 'city', readiness: 'public_owner' as const, timelyMonths: ['2026-07'] },
      { id: 'done', readiness: 'no_months' as const, timelyMonths: [] },
      { id: 'b', readiness: 'needs_owner' as const, timelyMonths: ['2026-08'] },
      // every window closed: the run sends it no notice, so there is nothing to read (v2.3818)
      { id: 'gone', readiness: 'no_months' as const, timelyMonths: [] },
    ]
    expect(gcNoticePreviewableJobs(jobs).map((j) => j.id)).toEqual(['a', 'b'])
  })

  it('stops at the ends and labels the pages', () => {
    expect([stepGcNoticePreview(0, -1, 6), stepGcNoticePreview(0, 1, 6), stepGcNoticePreview(5, 1, 6), stepGcNoticePreview(0, 1, 0)]).toEqual([0, 1, 5, 0])
    expect(gcNoticePageLabel(0, 2, 'cover letter')).toBe('Page 1 of 2 · cover letter')
  })
})

describe('the pay page in the preview (punch list #35, PR 3)', () => {
  const pay = { rows: [{ invoiceId: 'inv-1', label: 'Invoice #273-1, May 5, 2026', description: 'Trim.', openAmount: 13420, payable: true }], assets: { 'inv-1': { svg: '<svg data-code></svg>', png: null } } }

  it("is page 3 of the owner's copy, after the notice, and not on the GC's; the toggle's line says so", () => {
    const p = buildGcNoticePreview({ ...base, pay })
    expect(p.pages.owner.map((pg) => pg.key)).toEqual(['cover', 'notice', 'pay'])
    expect(p.pages.owner[2]!.label).toBe('pay codes')
    expect(text(p.pages.owner[2]!.blocks)).toContain('Copy for: owner of record')
    expect(text(p.pages.owner[2]!.blocks)).toContain('only if RMC- Dudley Mason has told you in writing')
    expect(p.pages.original_contractor.map((pg) => pg.key)).toEqual(['notice'])
    expect(gcNoticeCopyLine('owner', p, true)).toBe('The cover letter, then the notice, then the pay codes — the unpaid invoices follow in the packet')
    expect(gcNoticeCopyLine('original_contractor', p, true)).toBe("The GC's copy carries the statutory form only")
  })

  it('a job with nothing to pay has no page, and the line reads as before', () => {
    const p = buildGcNoticePreview({ ...base, pay: { rows: [], assets: {} } })
    expect(p.pages.owner.map((pg) => pg.key)).toEqual(['cover', 'notice'])
    expect(gcNoticeCopyLine('owner', p, true)).toBe('The cover letter, then the notice — the unpaid invoice follows in the packet')
    expect(gcNoticeCopyLine('owner', buildGcNoticePreview({ ...base, includeLetter: false }), false)).toBe('The standard cover note, then the notice')
  })
})
