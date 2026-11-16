import { describe, expect, it } from 'vitest'
import { LIEN_RUN_ONE_BARE, lienRunOnePlan } from './lienRunOne'
import { RUN_OWNER_UNCONFIRMED_PROBLEM, runPacketHtml, type RunNotice, type RunRecipient } from './lienDeskRun'
import { lienNoticeSignatureAfterSigning } from './lienNoticeSignature'
import { plainWordsFailures } from '../plainWords'

// Made-up names throughout: the repo is public.
const owner = (over: Partial<RunRecipient> = {}): RunRecipient => ({ key: 'owner', label: 'Owner of record', name: 'Avery Stone', address: '12 Elm St, Alder, TX 78000', email: '', method: 'certified_mail', tracking: '', ...over })
const gc = (over: Partial<RunRecipient> = {}): RunRecipient => ({ key: 'original_contractor', label: 'Original contractor', name: 'Birch Builders LLC', address: '40 Oak Ave, Alder, TX 78000', email: 'office@birchbuilders.test', method: 'certified_mail', tracking: '', ...over })
const signed = lienNoticeSignatureAfterSigning({ mode: 'code', printedName: 'Sam Reed', pngDataUrl: null, signedAtIso: '2026-11-16T15:00:00Z', jobNumber: '1042', itemId: 'it1', onDeviceName: null })
const notice = (over: Partial<RunNotice> = {}): RunNotice => ({
  itemId: 'it1',
  jobId: 'j1',
  kind: 'notice_53_056',
  label: '1042 · Elm Street',
  jobNumber: '1042',
  months: ['2026-09'],
  amount: 17600,
  fields: { noticeDate: '2026-11-16', projectDescription: 'Elm Street — 12 Elm St, Alder, TX 78000', claimantName: 'Pipe and Wire Co', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Birch Builders LLC', contractedWithIfDifferent: '', claimAmount: '17600.00', contactPerson: 'Sam Reed', claimantAddress: '1 Shop Rd, Alder, TX 78000' },
  extras: {},
  coverLetter: 'Dear owner,\n\nPlease hold this amount back.',
  coverNote: null,
  ownerUnconfirmed: false,
  signature: signed,
  mailBy: '2026-12-15',
  recipients: [owner(), gc()],
  ...over,
})

describe('Just this one: the plan of what one notice prints (v2.7512)', () => {
  it('an owner and an original contractor are two envelopes, each with its own set, the letter in the owner’s', () => {
    const plan = lienRunOnePlan(notice())
    expect(plan.label).toBe('Just this one · 2 envelopes ›')
    expect(plan.held).toEqual([])
    expect(plan.shared).toBe(false)
    expect(plan.sets).toEqual([
      { n: 1, label: 'Owner of record', name: 'Avery Stone', pages: ['Cover letter', '§ 53.056 notice · copy for owner of record'] },
      { n: 2, label: 'Original contractor', name: 'Birch Builders LLC', pages: ['§ 53.056 notice · copy for original contractor'] },
    ])
    expect(plan.title).toBe('This notice alone, as the run prints it. Both envelopes print in one press. Each has its own set of pages, so nothing is photocopied. The mail numbers are typed in the same window.')
  })

  it('the plan counts what the run’s own packet prints: a sheet, a divider before each envelope, each copy signed and named', () => {
    const plan = lienRunOnePlan(notice())
    const html = runPacketHtml([notice()], '2026-11-16', null)
    expect(html).toContain('Today’s mail')
    expect(html.match(/data-run-divider="/g)).toHaveLength(plan.sets.length)
    expect(html).toContain('Copy for: Owner of record')
    expect(html).toContain('Copy for: Original contractor')
    // The sheet in front never says to photocopy a set or to sign in ink.
    expect(/Copy every page|signs the notice in each set/.test(html)).toBe(false)
    // No envelope is held, so no copy prints unsigned.
    expect(plan.held).toEqual([])
  })

  it('a contractor with no mailing address holds the whole notice, as the window does: nothing prints, and each envelope says why', () => {
    const plan = lienRunOnePlan(notice({ recipients: [owner(), gc({ address: '' })] }))
    expect(plan.label).toBe('Just this one · held ›')
    expect(plan.sets).toEqual([])
    expect(plan.held).toEqual([
      { label: 'Owner of record', name: 'Avery Stone', why: 'With its notice: Original contractor: no mailing address' },
      { label: 'Original contractor', name: 'Birch Builders LLC', why: 'No mailing address. Set it on the customer, then print this envelope from the run.' },
    ])
    expect(plan.title).toMatch(/^Nothing prints yet\. With its notice: Original contractor: no mailing address /)
  })

  it('an owner from the roll nobody confirmed holds the notice too, though each envelope could be mailed', () => {
    const plan = lienRunOnePlan(notice({ ownerUnconfirmed: true }))
    expect(plan.label).toBe('Just this one · held ›')
    expect(plan.sets).toEqual([])
    expect(plan.held.map((h) => h.why)).toEqual([`With its notice: ${RUN_OWNER_UNCONFIRMED_PROBLEM}`, `With its notice: ${RUN_OWNER_UNCONFIRMED_PROBLEM}`])
  })

  it('a job that owes nothing now is held: there is nothing to put on notice', () => {
    const plan = lienRunOnePlan(notice({ amount: 0 }))
    expect(plan.label).toBe('Just this one · held ›')
    expect(plan.title).toContain('Nothing to send: the claim is $0.')
  })

  it('one name at one address is one envelope that carries both copies, and says so', () => {
    const same = { name: 'Avery Stone', address: '12 Elm St, Alder, TX 78000' }
    const plan = lienRunOnePlan(notice({ recipients: [owner(same), gc(same)] }))
    expect(plan.label).toBe('Just this one · 1 envelope ›')
    expect(plan.shared).toBe(true)
    expect(plan.sets).toHaveLength(1)
    expect(plan.sets[0]!.pages).toEqual(['Cover letter', '§ 53.056 notice · copy for owner of record', '§ 53.056 notice · copy for original contractor'])
    expect(plan.title).toContain('The owner and the original contractor are one name at one address, so it carries both copies.')
  })

  it('an unsigned notice prints nothing, as in the run: the link says held and the hover says why', () => {
    const plan = lienRunOnePlan(notice({ signature: null }))
    expect(plan.label).toBe('Just this one · held ›')
    expect(plan.sets).toEqual([])
    expect(plan.held).toHaveLength(2)
    expect(plan.title).toMatch(/^Nothing prints yet\. Unsigned: /)
    expect(plan.title).toMatch(/The window that opens has the way to clear it\.$/)
  })

  it('a notice already printed keeps its envelopes, signed or not, so the same window takes its mail numbers', () => {
    expect(lienRunOnePlan(notice({ signature: null, printedAt: '2026-11-16T16:00:00Z' })).label).toBe('Just this one · 2 envelopes ›')
  })

  it('no run notice for the row reads the bare link', () => {
    expect(lienRunOnePlan(null)).toMatchObject({ label: LIEN_RUN_ONE_BARE, sets: [], held: [] })
  })

  it('the hover’s own sentences keep to the plain-words rules', () => {
    for (const n of [notice(), notice({ recipients: [owner({ name: 'Avery Stone' }), gc({ name: 'Avery Stone', address: owner().address })] }), null]) {
      const plan = lienRunOnePlan(n)
      // The held reasons are the run's own words, checked in its own test.
      const own = plan.title.split(' Held: ')[0]!
      expect(plainWordsFailures(own)).toEqual([])
    }
  })
})
