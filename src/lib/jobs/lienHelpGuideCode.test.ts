import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { qrMatrix } from '../../../supabase/functions/_shared/qrMatrix'
import { parseStagesDeepLinks } from './stagesDeepLinks'
import { lienDeskFromSearch } from '../lien/lienDeskRoute'
import { LIEN_HELP_STYLES } from './lienHelpSheet'
import { LIEN_HELP_GUIDE_SLUG, LIEN_HELP_RECORD_CODE_QUIET, lienHelpBatchRecordCode, lienHelpBatchRecordUrl, lienHelpGuideCode, lienHelpGuideUrl, lienHelpRecordCode, lienHelpRecordUrl } from './lienHelpGuideCode'

describe('the code a lien help sheet prints (punch list #314, change 11)', () => {
  it('points at a guide that exists, on its public share page', () => {
    expect(existsSync(`src/content/help/${LIEN_HELP_GUIDE_SLUG}.md`)).toBe(true)
    expect(lienHelpGuideUrl()).toBe(`https://clicktooling.com/g/${LIEN_HELP_GUIDE_SLUG}/`)
  })
  it('draws as an image the sheet can carry with no network, and is drawn once', () => {
    const code = lienHelpGuideCode()
    expect(code).toMatch(/^<img alt="" src="data:image\/png;base64,[A-Za-z0-9+/=]+"\/>$/)
    expect(lienHelpGuideCode()).toBe(code)
  })
  it('a cover sheet’s code opens its own job’s affidavit tab, and a batch sheet’s the Affidavits list (change 5)', () => {
    // A made-up job id, the length of a real one: the longest address a sheet draws.
    const jobId = '00000000-0000-4000-8000-000000000001'
    const job = new URL(lienHelpRecordUrl(jobId))
    expect(job.origin).toBe('https://clicktooling.com')
    expect(job.pathname).toBe('/jobs')
    expect(job.searchParams.get('tab')).toBe('stages')
    expect(parseStagesDeepLinks(job.searchParams).lienWindow).toEqual({ jobId, tab: 'affidavit' })
    const list = new URL(lienHelpBatchRecordUrl())
    expect(list.pathname).toBe('/lien-desk')
    expect(lienDeskFromSearch(list.searchParams).kind).toBe('affidavit')
    // Both draw, each its own picture, each drawn once.
    const jobCode = lienHelpRecordCode(jobId)
    expect(jobCode).toMatch(/^<img alt="" src="data:image\/png;base64,[A-Za-z0-9+/=]+"\/>$/)
    expect(lienHelpRecordCode(jobId)).toBe(jobCode)
    expect(lienHelpBatchRecordCode()).toMatch(/^<img alt="" src="data:image\/png;base64,/)
    expect(new Set([jobCode, lienHelpBatchRecordCode(), lienHelpGuideCode()]).size).toBe(3)
    // No job, no code.
    expect(lienHelpRecordCode('')).toBe('')
  })
  it('the job’s code stays coarse enough to scan off a printed page', () => {
    // The cover sheet prints the code 44pt wide with its quiet edge on each side. At 45 modules across or under, a module is a third of a millimetre or more.
    const modules = qrMatrix(lienHelpRecordUrl('00000000-0000-4000-8000-000000000001'))
    expect(modules).not.toBeNull()
    expect((modules?.length ?? 99) + 2 * LIEN_HELP_RECORD_CODE_QUIET).toBeLessThanOrEqual(45)
    expect(LIEN_HELP_STYLES).toContain('.lien-help-record-corner img { width: 44pt; height: 44pt; }')
  })
})
