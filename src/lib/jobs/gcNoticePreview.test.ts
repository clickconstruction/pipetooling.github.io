import { describe, expect, it } from 'vitest'
import { defaultGcNoticeCoverLetter, type GcNoticeMonth } from './gcOnNotice'
import { buildGcNoticePreview, gcNoticePageLabel, gcNoticePreviewableJobs, stepGcNoticePreview } from './gcNoticePreview'

const month = (key: string, deadline: string, closed: boolean): GcNoticeMonth => ({ key, hours: 8, deadline, closed, fromCreation: false })
const issuer = { companyName: 'Click Plumbing and Electrical', addressText: '5501 Balcones Dr A141\nAustin, TX 78731', phone: '(512) 360-0599', email: 'office@clickplumbing.com', tagline: '', licenseLine: '' }
const base = {
  job: { jobId: 'j273', claimAmount: 17585, isBilled: true, months: [month('2026-04', '2026-07-15', true), month('2026-07', '2026-10-15', false), month('2026-08', '2026-11-16', false)] },
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
    // one notice names every month of the job — closed ones too
    expect(cover).toContain('April')
    expect(cover).toContain('August')
    const form = text(p.pages.owner[1]!.blocks)
    expect(form).toContain('Notice of Claim for Unpaid Labor or Materials')
    expect(form).toContain('RMC- Dudley Mason')
    expect(form).toContain('17,585')
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
      { id: 'a', readiness: 'ready' as const, months: [month('2026-07', '2026-10-15', false)] },
      { id: 'city', readiness: 'public_owner' as const, months: [month('2026-07', '2026-10-15', false)] },
      { id: 'done', readiness: 'no_months' as const, months: [] },
      { id: 'b', readiness: 'needs_owner' as const, months: [month('2026-05', '2026-08-17', true)] },
    ]
    expect(gcNoticePreviewableJobs(jobs).map((j) => j.id)).toEqual(['a', 'b'])
  })

  it('stops at the ends and labels the pages', () => {
    expect([stepGcNoticePreview(0, -1, 6), stepGcNoticePreview(0, 1, 6), stepGcNoticePreview(5, 1, 6), stepGcNoticePreview(0, 1, 0)]).toEqual([0, 1, 5, 0])
    expect(gcNoticePageLabel(0, 2, 'cover letter')).toBe('Page 1 of 2 · cover letter')
  })
})
