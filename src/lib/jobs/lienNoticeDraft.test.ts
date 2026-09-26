import { describe, expect, it } from 'vitest'
import { parseLienDeskDraftFields, buildLienNoticeFieldsForJob, buildLienRetainageNoticeFieldsForJob, buildLienAffidavitFieldsForJob, retainageInsideClaim, lienRetainageCoverLetter } from './lienNoticeDraft'

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
  it("the retainage cover letter keeps counsel's rules: both pots held, neither released, the withhold rule, no joint check, the GC copied (v2.3844)", () => {
    const base = { claimantName: 'Click Plumbing and Electrical', gcName: 'Harborline Builders', property: '212 Kettle Dr, Buda, TX', amount: '$4,250.00', contact: 'Malachi Whites, Master Plumber', phone: '(830) 946-0050' }
    const onlyRetainage = lienRetainageCoverLetter({ ...base, inClaim: false, endedHow: 'terminated', paymentBond: 'no' })
    expect(onlyRetainage.split('\n\n')[0]).toBe('To the owner of 212 Kettle Dr, Buda, TX,')
    expect(onlyRetainage).toContain('The enclosed Notice of Claim for Unpaid Retainage is given under Texas Property Code § 53.057.')
    expect(onlyRetainage).toContain('Now that our subcontract on this project has been terminated, that retainage has not been paid.')
    expect(onlyRetainage).toContain('You did not hire us, and this is not a lawsuit.')
    expect(onlyRetainage).toContain('do not release either to Harborline Builders:')
    expect(onlyRetainage).toContain('reserve during the work and for 30 days after that contract is completed (§ 53.101)')
    expect(onlyRetainage).toContain('once you receive a copy of our filed lien affidavit (§ 53.081(c))')
    expect(onlyRetainage).toContain('We cannot deposit a joint check')
    expect(onlyRetainage).toContain('A copy of this letter and the notice is going to Harborline Builders.')
    expect(onlyRetainage).toContain('Call Malachi Whites, Master Plumber at (830) 946-0050 before you make the next payment to Harborline Builders.')
    expect(onlyRetainage).not.toContain('not a claim that you are in default')
    const inClaim = lienRetainageCoverLetter({ ...base, inClaim: true, endedHow: 'complete', paymentBond: 'unknown' })
    expect(inClaim).toContain('Now that our work on this project is complete')
    expect(inClaim).toContain('already part of what you may withhold from any further payment to Harborline Builders (§ 53.081)')
    // a payment bond: no ask to hold the 10% reserve (counsel: check for a bond before telling an owner to hold 10%)
    const bonded = lienRetainageCoverLetter({ ...base, inClaim: false, paymentBond: 'yes' })
    expect(bonded).not.toContain('§ 53.101')
    expect(bonded).toContain('A payment bond covers this project, so we are not asking you to hold the 10% reserve for us.')
    // the job's trade (v2.3849)
    expect(onlyRetainage).toContain('We are the plumbing contractor on your project')
    expect(lienRetainageCoverLetter({ ...base, inClaim: false, trade: 'Electrical' })).toContain('We are the electrical contractor on your project, working under Harborline Builders.')
  })
  it("the form's type of labor and the affidavit's work description follow the job's service type (v2.3849)", () => {
    const facts = { jobName: '', jobAddress: '9703 Lenox Hl', originalContractorName: 'RMC', openBalance: 100, contactPerson: 'R', issuer: null, todayYmd: '2026-09-26' }
    expect(buildLienNoticeFieldsForJob(facts).laborMaterialsType).toBe('Plumbing labor and materials')
    expect(buildLienNoticeFieldsForJob({ ...facts, serviceTypeName: 'Electrical' }).laborMaterialsType).toBe('Electrical labor and materials')
    expect(buildLienNoticeFieldsForJob({ ...facts, serviceTypeName: null }).laborMaterialsType).toBe('Plumbing labor and materials')
    const aff = { jobName: '', jobAddress: '9703 Lenox Hl', isSub: true, originalContractorName: 'RMC', originalContractorAddress: '', ownerName: 'O', ownerAddress: 'A', county: 'Travis', legalDescription: 'Lot 1', customerName: 'RMC', revenue: 100, paymentsMade: 0, lastMonth: '2026-08', contactPerson: 'R', issuer: null, noticesRecorded: true }
    expect(buildLienAffidavitFieldsForJob({ ...aff, serviceTypeName: 'HVAC' }).workDescription).toBe('HVAC labor and materials')
    expect(buildLienAffidavitFieldsForJob(aff).workDescription).toBe('Plumbing labor and materials')
  })
})
