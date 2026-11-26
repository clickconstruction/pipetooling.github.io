import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { RELEASE_RUN_NO_PAPER, releaseRunCopyHtml, releaseRunPaper, releaseRunPrintHtml, releaseRunPrintable, releaseRunTitle } from './lienReleaseRunIo'

// Every name, address, job and instrument here is made up.
const PAPER = {
  county: 'Travis',
  claimantCompany: 'Marlow Mechanical',
  claimantPersonName: 'R. Castellan',
  recordingNumber: '2026-0412207',
  filedDate: '2026-11-09',
  legalDescription: 'LOT 1 BLK 2 LARKSPUR SUBD',
  propertyAddress: '212 Larkspur Court, Austin, TX',
  ownerName: 'Marisol Okafor',
  paymentDate: '2026-11-24',
}
const saved = { ...PAPER, releasesFilingId: 'a1', printedForNotary: { by: 'u1', name: 'Alex Rivera', at: '2026-11-26T18:00:00Z' } }
const OPTS = { letterhead: { company: 'Marlow Mechanical', licenseLine: 'M-00000', contactLines: ['1 Shop Road'] }, todayYmd: '2026-12-01' }

describe('releaseRunPaper', () => {
  it('reads the paper back off a saved release, and nothing else of the row', () => {
    expect(releaseRunPaper(saved)).toEqual(PAPER)
  })

  it('refuses a row that does not hold a paper', () => {
    expect(releaseRunPaper({ releasesFilingId: 'a1', paymentDate: '2026-11-24' })).toBeNull()
    expect(releaseRunPaper({ ...PAPER, recordingNumber: ' ' })).toBeNull()
    expect(releaseRunPaper(null)).toBeNull()
    expect(releaseRunPaper([PAPER])).toBeNull()
    expect(plainWordsFailures(RELEASE_RUN_NO_PAPER)).toEqual([])
  })
})

describe('the print', () => {
  const one = { jobNumber: '2041', fields: saved }
  const two = { jobNumber: '2058', fields: { ...saved, recordingNumber: '2026-0412208' } }
  const bare = { jobNumber: '1987', fields: { releasesFilingId: 'a3' } }

  it('puts every release that holds a paper in one print, each with its own instrument and job', () => {
    const html = releaseRunPrintHtml([one, two, bare], OPTS) ?? ''
    expect(html).toContain('2026-0412207')
    expect(html).toContain('2026-0412208')
    expect(html).toContain('Job #2041')
    expect(html).toContain('Job #2058')
    expect(html).not.toContain('Job #1987')
    expect(html).toContain('<title>2 Releases of Recorded Lien</title>')
    expect(html.match(/filing-paper/g)?.length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('Marlow Mechanical')
  })

  it('is null with nothing to print, and says which rows hold no paper', () => {
    expect(releaseRunPrintHtml([bare], OPTS)).toBeNull()
    expect(releaseRunPrintable([one, bare])).toEqual({ printable: [one], noPaper: [bare] })
  })

  it('files one release alone as its job’s copy, under the tab’s own title', () => {
    const html = releaseRunCopyHtml(one, OPTS) ?? ''
    expect(html).toContain('2026-0412207')
    expect(html).not.toContain('2026-0412208')
    expect(releaseRunTitle(one)).toBe('Release of Recorded Lien — Job 2041')
    expect(releaseRunCopyHtml(bare, OPTS)).toBeNull()
  })
})
