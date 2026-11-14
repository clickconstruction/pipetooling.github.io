import { describe, expect, it } from 'vitest'
import { buildLienAffidavitBlocks, filingDocText, type LienAffidavitFields } from '../jobsDocuments/lienFilingDocuments'
import { buildLienAffidavitFieldsForJob } from './lienNoticeDraft'
import { buildLienWindowAffidavitFields, lienWindowClaim, lienWindowClaimNotes } from './lienWindowAffidavit'
import { buildLienTimelineFromWindow, lienWindowLastMonth } from './lienTimelineDesk'
import { buildLienDeskAffidavitFields } from './lienDeskAffidavitFields'
import { lienBilledOpen } from './lienBilledOpen'
import { correctedClaim, type LienClaimCorrection } from './lienClaimCorrection'
import { lienPaperGaps } from './lienPaperGaps'

/**
 * The desk's affidavit and the Lien window's are one paper (v2.6809). The report: a job with no clock hours and no day
 * set by hand read *from August 1, 2026 through August 31, 2026* on the desk and *from — through —* in the window one
 * press later, and the window's original contractor line had lost its address.
 */

// What both surfaces know about the job: a sub's service visit, created in August, never clocked, no day set by hand.
const shared = {
  jobName: 'Service Visit',
  jobAddress: '12 Sample Rd, San Antonio, TX 78209',
  serviceTypeName: 'Plumbing',
  isSub: true,
  originalContractorName: 'Harborline Builders',
  originalContractorAddress: '9 Yard St, Devine TX 78016',
  ownerName: 'Pat Owner',
  ownerAddress: '4 Owner Ct, San Antonio, TX 78209',
  county: 'Bexar',
  legalDescription: 'CB 1 BLK B LOT 7',
  customerName: 'Harborline Builders',
  revenue: 595,
  paymentsMade: 0,
  todayYmd: '2026-11-09',
  noticesRecorded: true,
  contactPerson: 'Rey Master, Master Plumber',
  issuer: null,
  // These read the earlier form's ten paragraphs, the form a paper drafted before the short one keeps (punch list #305); the short form's parity is at the foot.
  form: 'long' as const,
}
const jobRow = { created_at: '2026-08-18T05:40:28.750883+00:00', first_work_date: null, last_work_date: null, lien_last_work_on: null }

// The desk: its RPC names the creation month as the last month, and the pane hands over the job row.
const desk = (over: Partial<Parameters<typeof buildLienAffidavitFieldsForJob>[0]> = {}) => buildLienAffidavitFieldsForJob({ ...shared, openBalance: 595, lastMonth: '2026-08', workDays: jobRow, ...over })
// The window: the job row and the forecast's months, which leave a job with no sessions out.
const win = (over: Partial<Parameters<typeof buildLienWindowAffidavitFields>[0]> = {}) => buildLienWindowAffidavitFields({ ...shared, openBalance: 595, job: jobRow, workMonths: null, ...over })

const numbered = (fields: LienAffidavitFields) =>
  filingDocText(buildLienAffidavitBlocks(fields))
    .split('\n')
    .filter((line) => /^\d+\. /.test(line.trim()))

describe('the Lien window’s affidavit is the desk’s (v2.6809)', () => {
  it('a job with no clock hours and no day set by hand: every numbered item reads the same on both', () => {
    expect(numbered(win())).toEqual(numbered(desk()))
    expect(win()).toEqual(desk())
    expect(numbered(win()).length).toBeGreaterThanOrEqual(9)
  })

  it('paragraph 5 swears the creation month in the window, never the blanks', () => {
    const text = filingDocText(buildLienAffidavitBlocks(win()))
    expect(text).toContain('5. The work was performed and/or materials delivered during the period from August 1, 2026 through August 31, 2026.')
    expect(text).not.toContain('from — through —')
  })

  it('the original contractor line carries the address on file', () => {
    expect(filingDocText(buildLienAffidavitBlocks(win()))).toContain('7. The name and address of the original contractor is: Harborline Builders, 9 Yard St, Devine TX 78016.')
    // No address on file: the name alone, as before.
    expect(filingDocText(buildLienAffidavitBlocks(win({ originalContractorAddress: '' })))).toContain('7. The name and address of the original contractor is: Harborline Builders.')
  })

  it('a day set by hand, and clock days, reach both papers the same way', () => {
    const hand = { ...jobRow, lien_last_work_on: '2026-08-15' }
    expect(win({ job: hand })).toEqual(desk({ workDays: hand }))
    expect(win({ job: hand })).toMatchObject({ workStart: '2026-08-01', workEnd: '2026-08-15' })
    const clocked = { ...jobRow, first_work_date: '2026-07-22', last_work_date: '2026-08-11' }
    const months = { months: [{ key: '2026-07' }, { key: '2026-08' }] as never, lastMonthKey: '2026-08' }
    expect(win({ job: clocked, workMonths: months })).toEqual(desk({ workDays: clocked }))
    expect(win({ job: clocked, workMonths: months })).toMatchObject({ workStart: '2026-07-22', workEnd: '2026-08-11' })
  })

  it('sessions not yet approved: the window’s months give the period, from the first month’s first day', () => {
    const months = { months: [{ key: '2026-07' }, { key: '2026-08' }] as never, lastMonthKey: '2026-08' }
    expect(win({ workMonths: months })).toMatchObject({ workStart: '2026-07-01', workEnd: '2026-08-31' })
  })

  it('no creation day and nothing else: the paper shows its blanks', () => {
    expect(filingDocText(buildLienAffidavitBlocks(win({ job: { ...jobRow, created_at: null } })))).toContain('during the period from — through —.')
  })
})

describe('lienWindowLastMonth · the strip and the paper read one month (v2.6809)', () => {
  it('names the creation month for a job with no hours, the ledger’s month, or the day set by hand', () => {
    expect(lienWindowLastMonth({ workMonths: null, job: jobRow })).toEqual({ lastMonth: '2026-08', fromCreation: true, byHand: false })
    expect(lienWindowLastMonth({ workMonths: null, job: { ...jobRow, last_work_date: '2026-09-02' } })).toEqual({ lastMonth: '2026-09', fromCreation: false, byHand: false })
    expect(lienWindowLastMonth({ workMonths: null, job: { ...jobRow, lien_last_work_on: '2026-10-01' } })).toEqual({ lastMonth: '2026-10', fromCreation: false, byHand: true })
    const months = { months: [{ key: '2026-07' }] as never, lastMonthKey: '2026-07' }
    expect(lienWindowLastMonth({ workMonths: months, job: jobRow })).toEqual({ lastMonth: '2026-07', fromCreation: false, byHand: false })
    expect(lienWindowLastMonth({ workMonths: months, job: { ...jobRow, lien_last_work_on: '2026-08-15' } })).toEqual({ lastMonth: '2026-08', fromCreation: false, byHand: true })
  })

  it('is the month the window’s strip draws as Last work', () => {
    const timeline = buildLienTimelineFromWindow({ workMonths: null, filings: [], job: { id: 'j1', ...jobRow }, isSub: true, propertyKind: 'residential', openBalance: 595, todayYmd: '2026-11-09' })
    const lastWork = timeline.steps.find((s) => s.kind === 'last_work')
    expect(lastWork?.date).toBe('2026-08-01')
    expect(win().workStart).toBe(lastWork?.date)
  })
})

/**
 * The two differences v2.6809 left. The sworn amount: the desk swore what the sent bills still owe less a claim set by
 * hand, the window the job's price less its payments with no correction read. A job contracted with the owner: the
 * desk printed a blank for the original contractor, the window our own company's name.
 */

// A sub's job billed in stages: $5,000, two $2,000 bills out, one part paid, the last $1,000 not billed yet.
const staged = {
  id: 'job-staged',
  status: 'working',
  revenue: 5000,
  payments_made: 500,
  invoices: [
    { id: 'inv-1', job_id: 'job-staged', status: 'billed', amount: 2000, sequence_order: 1, billed_at: '2026-08-20T15:00:00Z' },
    { id: 'inv-2', job_id: 'job-staged', status: 'billed', amount: 2000, sequence_order: 2, billed_at: '2026-09-20T15:00:00Z' },
    { id: 'inv-3', job_id: 'job-staged', status: 'ready_to_bill', amount: 1000, sequence_order: 3, billed_at: null },
  ],
  payments: [{ invoice_id: 'inv-1', amount: 500 }],
}
const correction: LienClaimCorrection = { jobId: 'job-staged', amountOff: 1500, perMonth: null, reason: 'GC disputes the second bill', carry: true, setByName: 'Rey', setAt: '2026-11-03T16:00:00Z', lookedAt: null, lookedByName: '' }
const issuer = { companyName: 'Sample Plumbing LLC', addressText: '1 Shop Rd\nSan Antonio, TX 78201' } as never
const property = { ownerName: shared.ownerName, ownerAddress: shared.ownerAddress, county: shared.county, legalDescription: shared.legalDescription }
const gates = [{ key: 'notice' as const, ok: true, label: '' }]

// The desk, as its pane, its paper preview and its stop window fill the paper: the RPC's entry and the desk's job row.
const deskFor = (over: { isSub?: boolean; gc?: { name: string; address: string } | null; correction?: LienClaimCorrection | null; issuer?: never } = {}) =>
  buildLienDeskAffidavitFields({
    job: { ...jobRow, job_name: shared.jobName, job_address: shared.jobAddress, customer_name: shared.customerName, revenue: staged.revenue, payments_made: staged.payments_made, service_type: { name: 'Plumbing' } },
    // `open_balance` is `lien_billed_open()` in SQL; `lienBilledOpen` is its client twin, held to it by the SQL bed.
    entry: { isSub: over.isSub ?? true, openBalance: lienBilledOpen(staged, staged.invoices, staged.payments), lastMonth: '2026-08', gates },
    gc: over.gc === undefined ? { name: shared.originalContractorName, address: shared.originalContractorAddress } : over.gc,
    ...property,
    correction: over.correction ?? null,
    contactPerson: shared.contactPerson,
    issuer: over.issuer ?? null,
    todayYmd: shared.todayYmd,
    form: 'long',
  })
// The window, as its Lien affidavit tab fills it: the claim from the job's own bills and payments, the correction read for the job.
const winFor = (over: { isSub?: boolean; gcName?: string; gcAddress?: string; correction?: LienClaimCorrection | null; issuer?: never } = {}) =>
  buildLienWindowAffidavitFields({
    ...shared,
    isSub: over.isSub ?? true,
    originalContractorName: over.gcName ?? shared.originalContractorName,
    originalContractorAddress: over.gcAddress ?? shared.originalContractorAddress,
    revenue: staged.revenue,
    paymentsMade: staged.payments_made,
    openBalance: lienWindowClaim(staged, over.correction ?? null).openBalance,
    claimAmountOff: over.correction?.amountOff,
    issuer: over.issuer ?? null,
    job: jobRow,
    workMonths: null,
  })

describe('the company’s second address reaches the paper from both fills (punch list #305)', () => {
  const twoAddresses = { companyName: 'Sample Plumbing LLC', addressText: 'PO Box 9\nSan Antonio, TX 78201', physicalAddressText: '1 Shop Rd\nSan Antonio, TX 78201' } as never
  const short = (f: ReturnType<typeof winFor>) => filingDocText(buildLienAffidavitBlocks(f))
  it('the short form prints the mailing address, then the physical one, the same from the desk and the window', () => {
    const desk = buildLienDeskAffidavitFields({
      job: { ...jobRow, job_name: shared.jobName, job_address: shared.jobAddress, customer_name: shared.customerName, revenue: staged.revenue, payments_made: staged.payments_made, service_type: { name: 'Plumbing' } },
      entry: { isSub: true, openBalance: lienBilledOpen(staged, staged.invoices, staged.payments), lastMonth: '2026-08', gates },
      gc: { name: shared.originalContractorName, address: shared.originalContractorAddress },
      ...property,
      correction: null,
      contactPerson: shared.contactPerson,
      issuer: twoAddresses,
      todayYmd: shared.todayYmd,
    })
    const win = buildLienWindowAffidavitFields({ ...shared, isSub: true, originalContractorName: shared.originalContractorName, originalContractorAddress: shared.originalContractorAddress, revenue: staged.revenue, paymentsMade: staged.payments_made, openBalance: lienWindowClaim(staged, null).openBalance, issuer: twoAddresses, job: jobRow, workMonths: null, form: 'short' })
    expect(win.claimantPhysicalAddress).toBe('1 Shop Rd, San Antonio, TX 78201')
    expect(desk.claimantPhysicalAddress).toBe(win.claimantPhysicalAddress)
    expect(short(win)).toContain("Claimant's mailing address is PO Box 9, San Antonio, TX 78201. Its physical address is 1 Shop Rd, San Antonio, TX 78201.")
    expect(short(desk)).toContain('Its physical address is 1 Shop Rd, San Antonio, TX 78201.')
  })
  it('one address in Settings prints one address, as before', () => {
    expect(short(buildLienWindowAffidavitFields({ ...shared, isSub: true, originalContractorName: shared.originalContractorName, originalContractorAddress: shared.originalContractorAddress, revenue: staged.revenue, paymentsMade: staged.payments_made, openBalance: 3500, issuer, job: jobRow, workMonths: null, form: 'short' }))).not.toContain('physical address')
  })
})

describe('the sworn amount is the desk’s: what the sent bills owe, less the claim set by hand', () => {
  it('a job billed in stages swears the bills, never the job’s whole balance', () => {
    const claim = lienWindowClaim(staged, null)
    expect(claim).toMatchObject({ openBalance: 3500, unbilled: 1000, sentBills: 2 })
    expect(claim.claimed).toMatchObject({ claim: 3500, corrected: false })
    expect(numbered(winFor())).toEqual(numbered(deskFor()))
    expect(winFor()).toEqual(deskFor())
    const text = filingDocText(buildLienAffidavitBlocks(winFor()))
    expect(text).toContain('8. The original contract amount was $5,000.00. The amount paid to date is $500.00. The amount currently due and unpaid is $3,500.00.')
    expect(text).not.toContain('$4,500.00')
  })

  it('a claim set by hand on the desk reaches the window’s paper: every numbered item reads the same on both', () => {
    expect(numbered(winFor({ correction }))).toEqual(numbered(deskFor({ correction })))
    expect(winFor({ correction })).toEqual(deskFor({ correction }))
    const text = filingDocText(buildLienAffidavitBlocks(winFor({ correction })))
    expect(text).toContain('The amount currently due and unpaid is $2,000.00.')
    expect(text).toContain('Claimant claims a lien against all the above described property and improvements thereon in the amount of $2,000.00')
    // The window's claim is the desk's own arithmetic.
    expect(lienWindowClaim(staged, correction).claimed).toEqual(correctedClaim(3500, correction))
  })

  it('a correction over the bills, and one larger than them, read the same on both', () => {
    const over = { ...correction, amountOff: -400 }
    expect(winFor({ correction: over })).toEqual(deskFor({ correction: over }))
    expect(winFor({ correction: over }).unpaidAmount).toBe('3900.00')
    const all = { ...correction, amountOff: 9000 }
    expect(winFor({ correction: all })).toEqual(deskFor({ correction: all }))
    expect(winFor({ correction: all }).unpaidAmount).toBe('0.00')
  })

  it('a job billed as one shell is price less payments, and a job with nothing billed claims nothing', () => {
    expect(lienWindowClaim({ id: 'j', status: 'billed', revenue: 595, payments_made: 95 }, null)).toMatchObject({ openBalance: 500, unbilled: 0, sentBills: 0 })
    expect(lienWindowClaim({ id: 'j', status: 'working', revenue: 595, payments_made: 0, invoices: [], payments: [] }, null)).toMatchObject({ openBalance: 0, unbilled: 595, sentBills: 0 })
  })

  it('the window says where the figure came from', () => {
    const day = (ymd: string) => ymd
    expect(lienWindowClaimNotes(lienWindowClaim(staged, null), staged, null, day)).toEqual([{ key: 'unbilled', tone: 'amber', text: 'Not billed yet · $1,000 of the job’s $5,000 · not claimed until it is billed' }])
    const byHand = lienWindowClaimNotes(lienWindowClaim(staged, correction), staged, correction, day)
    expect(byHand[0]).toEqual({ key: 'by_hand', tone: 'amber', text: 'Claim set by hand on the Lien desk: $2,000 · $1,500 under the $3,500 unpaid in the app · carries until cleared · Rey · 2026-11-03 · “GC disputes the second bill”' })
    const over = { ...correction, amountOff: -400, carry: false }
    expect(lienWindowClaimNotes(lienWindowClaim(staged, over), staged, over, day)[0]).toMatchObject({ key: 'by_hand', tone: 'red' })
    expect(lienWindowClaimNotes(lienWindowClaim(staged, over), staged, over, day)[0]?.text).toContain('this notice only')
    const unbilledJob = { id: 'j', status: 'working', revenue: 595, payments_made: 0, invoices: [], payments: [] }
    expect(lienWindowClaimNotes(lienWindowClaim(unbilledJob, null), unbilledJob, null, day).map((n) => n.key)).toEqual(['nothing_billed'])
    expect(lienWindowClaimNotes(lienWindowClaim(staged, null), staged, null, day, { correctionUnread: true })[0]).toMatchObject({ key: 'unread', tone: 'red' })
    // A job billed in full with no correction says nothing.
    const full = { id: 'j', status: 'billed', revenue: 595, payments_made: 0 }
    expect(lienWindowClaimNotes(lienWindowClaim(full, null), full, null, day)).toEqual([])
  })
})

describe('a job contracted with the owner: the original contractor is our own company on both papers', () => {
  it('no GC on the job: every numbered item reads the same, and paragraph 7 names the claimant at its address', () => {
    // The desk has no GC row; the window hands over its own company's name and no address, as it always has.
    const d = deskFor({ isSub: false, gc: null, issuer })
    const w = winFor({ isSub: false, gcName: 'Sample Plumbing LLC', gcAddress: '', issuer })
    expect(numbered(w)).toEqual(numbered(d))
    expect(w).toEqual(d)
    const text = filingDocText(buildLienAffidavitBlocks(d))
    expect(text).toContain('7. The name and address of the original contractor is: Sample Plumbing LLC, 1 Shop Rd, San Antonio, TX 78201.')
    expect(text).toContain('3. The labor and/or materials were furnished under a contract with Pat Owner.')
    expect(text).not.toContain('original contractor is: _______________')
  })

  it('no company name in Settings: both fall to the default claimant, never a blank', () => {
    const d = deskFor({ isSub: false, gc: null })
    expect(winFor({ isSub: false, gcName: '', gcAddress: '' })).toEqual(d)
    expect(d.originalContractorName).toBe(d.claimantCompany)
    expect(d.originalContractorName).not.toBe('')
  })

  it('a job under a GC keeps the GC’s row, and a GC with no name on file stays a blank to fill', () => {
    expect(deskFor()).toMatchObject({ originalContractorName: 'Harborline Builders', originalContractorAddress: '9 Yard St, Devine TX 78016' })
    const noName = deskFor({ gc: { name: '', address: '' }, issuer })
    expect(noName.originalContractorName).toBe('')
    expect(filingDocText(buildLienAffidavitBlocks(noName))).toContain('original contractor is: _______________.')
  })

  it('the desk lists no blank original contractor on a job contracted with the owner', () => {
    const facts = { ownerName: 'Pat Owner', ownerAddress: '4 Owner Ct', county: 'Bexar', legalDescription: 'LOT 7', contactPerson: 'Rey Master', claimantAddress: '1 Shop Rd' }
    const named = deskFor({ isSub: false, gc: null, issuer }).originalContractorName
    expect(lienPaperGaps('affidavit', { ...facts, gcName: named }).map((g) => g.key)).not.toContain('gc')
    // A sub's job with no GC name is still a blank the desk asks for.
    expect(lienPaperGaps('affidavit', { ...facts, gcName: '' }).map((g) => g.key)).toContain('gc')
  })
})

describe('the short form is one paper on the desk and in the window (punch list #305)', () => {
  // The notices on record: July and August named, mailed to the owner twice.
  const filings = [
    { kind: 'notice_53_056', months_covered: ['2026-07'], voided_at: null, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1', sent_on: '2026-08-14' }] },
    { kind: 'notice_53_056', months_covered: ['2026-07', '2026-08'], voided_at: null, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 2', sent_on: '2026-09-11' }, { recipient: 'original_contractor', method: 'certified_mail', tracking: '9407 3', sent_on: '2026-09-11' }] },
  ]
  // Clocked July 22 through August 11: both noticed months are the job's own.
  const worked = { ...jobRow, first_work_date: '2026-07-22', last_work_date: '2026-08-11' }
  const shortDesk = (over: { isSub?: boolean } = {}) =>
    buildLienDeskAffidavitFields({
      job: { ...worked, job_name: shared.jobName, job_address: shared.jobAddress, customer_name: shared.customerName, revenue: 595, payments_made: 0, service_type: { name: 'Plumbing' } },
      entry: { isSub: over.isSub ?? true, openBalance: 595, lastMonth: '2026-08', gates },
      gc: over.isSub === false ? null : { name: shared.originalContractorName, address: shared.originalContractorAddress },
      ...property,
      correction: null,
      contactPerson: shared.contactPerson,
      issuer,
      todayYmd: shared.todayYmd,
      filings,
    })
  const shortWin = (over: { isSub?: boolean } = {}) => buildLienWindowAffidavitFields({ ...shared, form: undefined, isSub: over.isSub ?? true, openBalance: 595, issuer, job: worked, workMonths: null, filings })

  it('a job under a GC: the same seven paragraphs on both, with nobody asking for the form', () => {
    expect(shortWin()).toEqual(shortDesk())
    expect(shortDesk().form).toBe('short')
    expect(numbered(shortDesk())).toEqual([
      '1. I am authorized to make this affidavit for Sample Plumbing LLC ("Claimant"). Claimant\'s mailing address is 1 Shop Rd, San Antonio, TX 78201.',
      '2. Claimant furnished plumbing labor and materials to improve this property in Bexar County, Texas: CB 1 BLK B LOT 7, 12 Sample Rd, San Antonio, TX 78209.',
      '3. Claimant did so under a contract with Harborline Builders, 9 Yard St, Devine TX 78016, the original contractor.',
      '4. The owner or reputed owner is Pat Owner, 4 Owner Ct, San Antonio, TX 78209.',
      '5. Payment is requested for work done and materials furnished in July and August 2026.',
      '6. Notice of the claim was sent to the owner by certified mail on August 14, 2026 and September 11, 2026.',
      '7. The amount of the claim is $595.00. Claimant claims a lien on the property for that amount.',
    ])
  })

  it('a homestead: the flag reaches the paper from the desk and from the window alike, and never a paper on the earlier form', () => {
    const desk = buildLienDeskAffidavitFields({
      job: { ...worked, job_name: shared.jobName, job_address: shared.jobAddress, customer_name: shared.customerName, revenue: 595, payments_made: 0, service_type: { name: 'Plumbing' } },
      entry: { isSub: true, openBalance: 595, lastMonth: '2026-08', gates },
      gc: { name: shared.originalContractorName, address: shared.originalContractorAddress },
      ...property,
      correction: null,
      contactPerson: shared.contactPerson,
      issuer,
      todayYmd: shared.todayYmd,
      filings,
      homestead: true,
    })
    const win = buildLienWindowAffidavitFields({ ...shared, form: undefined, isSub: true, openBalance: 595, issuer, job: worked, workMonths: null, filings, homestead: true })
    expect(win).toEqual(desk)
    expect(desk.homestead).toBe(true)
    expect(filingDocText(buildLienAffidavitBlocks(desk)).startsWith('NOTICE: THIS IS NOT A LIEN. THIS IS ONLY AN AFFIDAVIT CLAIMING A LIEN.')).toBe(true)
    // Not a homestead: the field is left off, so the paper and a stored copy read as before.
    expect('homestead' in shortDesk()).toBe(false)
    expect('homestead' in buildLienWindowAffidavitFields({ ...shared, form: 'long', isSub: true, openBalance: 595, issuer, job: worked, workMonths: null, filings, homestead: true })).toBe(false)
  })

  it('a job contracted with the owner: four paragraphs, no months and no notices', () => {
    // The window hands over its own company as the original contractor; the recipe names it the same way on both.
    expect(buildLienWindowAffidavitFields({ ...shared, form: undefined, isSub: false, originalContractorName: 'Sample Plumbing LLC', originalContractorAddress: '', openBalance: 595, issuer, job: worked, workMonths: null, filings })).toEqual(shortDesk({ isSub: false }))
    expect(numbered(shortDesk({ isSub: false }))).toEqual([
      '1. I am authorized to make this affidavit for Sample Plumbing LLC ("Claimant"). Claimant\'s mailing address is 1 Shop Rd, San Antonio, TX 78201.',
      '2. Claimant furnished plumbing labor and materials to improve this property in Bexar County, Texas: CB 1 BLK B LOT 7, 12 Sample Rd, San Antonio, TX 78209.',
      '3. Claimant did so under a contract with the owner, Pat Owner, 4 Owner Ct, San Antonio, TX 78209. Claimant is the original contractor.',
      '4. The amount of the claim is $595.00. Claimant claims a lien on the property for that amount.',
    ])
  })

  it('a notice mailed for several jobs at the property: the ticket names its own month, never the whole paper’s (the two August tickets of 2026-11-10)', () => {
    // The paper named April, June, July and August for the property; this job was created in August and never clocked.
    const packet = [{ kind: 'notice_53_056', months_covered: ['2026-04', '2026-06', '2026-07', '2026-08'], voided_at: null, sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '9507 1', sent_on: '2026-09-22' }] }]
    const ticket = buildLienDeskAffidavitFields({ job: { ...jobRow, revenue: 595, payments_made: 0 }, entry: { isSub: true, openBalance: 595, lastMonth: '2026-08', gates }, gc: null, ...property, correction: null, contactPerson: 'Rey', issuer, todayYmd: shared.todayYmd, filings: packet })
    expect(ticket.workMonthsWords).toBe('August 2026')
    expect(ticket.noticesSentWords).toBe('certified mail on September 22, 2026')
    expect(buildLienWindowAffidavitFields({ ...shared, form: undefined, openBalance: 595, issuer, job: jobRow, workMonths: null, filings: packet }).workMonthsWords).toBe('August 2026')
    // A job clocked April through August on the same paper keeps all four.
    const clocked = { ...jobRow, first_work_date: '2026-04-02', last_work_date: '2026-08-11' }
    expect(buildLienDeskAffidavitFields({ job: { ...clocked, revenue: 595, payments_made: 0 }, entry: { isSub: true, openBalance: 595, lastMonth: '2026-08', gates }, gc: null, ...property, correction: null, contactPerson: 'Rey', issuer, todayYmd: shared.todayYmd, filings: packet }).workMonthsWords).toBe('April, June, July and August 2026')
  })

  it('a paper asked for on the earlier form carries no short-form mark, so its stored copy draws as the ten paragraphs', () => {
    const long = buildLienDeskAffidavitFields({ job: { ...jobRow, revenue: 595, payments_made: 0 }, entry: { isSub: true, openBalance: 595, lastMonth: '2026-08', gates }, gc: null, ...property, correction: null, contactPerson: 'Rey', issuer, todayYmd: shared.todayYmd, form: 'long', filings })
    expect(long.form).toBeUndefined()
    expect(long.workMonthsWords).toBeUndefined()
    expect(numbered(long)).toHaveLength(10)
  })
})
