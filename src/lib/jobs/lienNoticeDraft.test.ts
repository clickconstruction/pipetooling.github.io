import { describe, expect, it } from 'vitest'
import { parseLienDeskDraftFields, buildLienNoticeFieldsForJob, buildLienRetainageNoticeFieldsForJob, retainageInsideClaim, lienRetainageCoverNote } from './lienNoticeDraft'

const notice = { noticeDate: '2026-09-23', projectDescription: '9703 Lenox Hl', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'RMC- Dudley Mason', contractedWithIfDifferent: '', claimAmount: '7902.00', contactPerson: 'Robert Douglas, Master Plumber', claimantAddress: '5501 Balcones Dr' }

describe('parseLienDeskDraftFields · months dated from the job’s creation (v2.3747)', () => {
  it('keeps the flag when the item carries it and drops it otherwise, so older drafts read as before', () => {
    expect(parseLienDeskDraftFields({ notice, gcEmail: '', monthsDatedFromCreation: true })).toMatchObject({ monthsDatedFromCreation: true })
    expect(parseLienDeskDraftFields({ notice, gcEmail: '' })).not.toHaveProperty('monthsDatedFromCreation')
    expect(parseLienDeskDraftFields({ notice, gcEmail: '', monthsDatedFromCreation: 'yes' })).not.toHaveProperty('monthsDatedFromCreation')
  })
})

describe('retainage inside the claim (v2.3753)', () => {
  const facts = { jobName: 'Lantern Row', jobAddress: '44 Lantern Row', originalContractorName: 'Harborline', openBalance: 9_800, contactPerson: 'Rey', issuer: null, todayYmd: '2026-09-24' }
  it('names the recorded retainage on the § 53.056 form, never more than the claim, nothing when none is recorded', () => {
    expect(buildLienNoticeFieldsForJob({ ...facts, retainageHeld: 1_760 }).retainageIncluded).toBe('1760.00')
    expect(buildLienNoticeFieldsForJob({ ...facts, openBalance: 500, retainageHeld: 1_760 }).retainageIncluded).toBe('500.00')
    expect(buildLienNoticeFieldsForJob({ ...facts, retainageHeld: 0 }).retainageIncluded).toBeUndefined()
    expect(buildLienNoticeFieldsForJob(facts).retainageIncluded).toBeUndefined()
    expect(retainageInsideClaim(9_800, null)).toBe(0)
  })
  it('the § 53.057 fields carry the retainage as the figure and no split lines; the draft keeps the retainage line', () => {
    const f = buildLienRetainageNoticeFieldsForJob({ ...facts, retainageHeld: 1_760 })
    expect(f.claimAmount).toBe('1760.00')
    expect(f.retainageIncluded).toBeUndefined()
    expect(f.claimSplit).toBeUndefined()
    const parsed = parseLienDeskDraftFields({ notice: { ...buildLienNoticeFieldsForJob({ ...facts, retainageHeld: 1_760 }) }, gcEmail: '' })
    expect(parsed?.notice.retainageIncluded).toBe('1760.00')
  })
  it("counsel's retainage cover note says how the contract ended and when the owner may withhold", () => {
    expect(lienRetainageCoverNote('Click', { inClaim: false, endedHow: 'terminated' })).toMatch(/has been terminated.*§ 53\.081\(c\)/s)
    expect(lienRetainageCoverNote('Click', { inClaim: true, endedHow: 'complete' })).toMatch(/is complete.*already part of the amount you may withhold/s)
  })
})
