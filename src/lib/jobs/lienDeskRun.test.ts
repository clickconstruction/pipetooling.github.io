import { describe, expect, it } from 'vitest'
import { EMPTY_LIEN_RETAINAGE_QUEUE } from './lienDeskRetainage'
import { buildLienDeskQueue, type LienDeskItemRow, type LienNoticeMonthRow } from './lienDesk'
import { buildLienDeskRun, buildLienRetainageRun, RUN_OWNER_UNCONFIRMED_PROBLEM, runCoverSheetBlocks, runCoverNoteBlocks, runFilingPayload, runNoticeBlocks, runNoticeProblems, runNoticeWhatWords, runCopyPages, runPacketHtml, stepRunPreview, runPayPageBlocks, trackingShape, recipientMailed, runRecordSplit, runEnvelopeFacesHtml, runCourtesyCopies, runCourtesyEmailWords, runCourtesyResultWords } from './lienDeskRun'
import type { LienRetainageEntry } from './lienDeskRetainage'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { homesteadStatementApplies, parseLienDeskDraftFields } from './lienNoticeDraft'

const TODAY = '2026-09-14'

function row(job_id: string, work_month: string, deadline: string): LienNoticeMonthRow {
  return { job_id, work_month, deadline, approved_hours: 40, noticed: false, open_balance: 33_500, customer_id: 'ati', gc_customer_id: 'loberg', property_kind: '', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null }
}

const approved = {
  id: 'it1', job_id: 'j650', kind: 'notice_53_056', months: ['2026-06', '2026-07'], status: 'approved', fields: {}, cover_note: true, drafted_by: 'u1', drafted_at: '2026-09-14T14:00:00Z', submitted_at: '2026-09-14T14:10:00Z', approved_by: 'u-robert', approved_at: '2026-09-14T14:20:00Z', approval_mode: 'leader', word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T14:00:00Z', updated_at: '2026-09-14T14:20:00Z', voided_at: null,
} as LienDeskItemRow

function data(items: LienDeskItemRow[]): LienDeskData {
  const rows = [row('j650', '2026-06', '2026-09-15'), row('j650', '2026-07', '2026-10-15')]
  const queue = buildLienDeskQueue(rows, items, {}, TODAY)
  return {
    queue,
    summary: { office: { jobs: 0, months: 0, dollars: 0, needsOwner: 0, earliestDeadline: null, ready: 1, next: { deadline: null, notices: 0, dollars: 0, gcIds: [], gcNames: [], toDraft: 0, needsOwner: 0 } }, leader: { jobs: 0, dollars: 0, earliestDeadline: null }, held: 0, missed: { jobs: 0, months: 0, dollars: 0, lines: [] } },
    rows,
    items,
    affidavits: { entries: [], piles: { needs_property: [], to_draft: [], awaiting: [], ready: [], held: [], filed: [], missed: [] }, counts: { needs_property: 0, to_draft: 0, awaiting: 0, ready: 0, held: 0, filed: 0, missed: 0 } },
    affidavitRows: [],
    retainage: EMPTY_LIEN_RETAINAGE_QUEUE(),
    retainageRows: [],
    letterTwoByJob: {},
    ownerCallByJob: {},
    jobsById: { j650: { id: 'j650', hcp_number: '650', click_number: null, job_name: 'ATI Schertz', job_address: '1204 Elbel Rd, Schertz, TX', customer_id: 'ati', customer_name: 'ATI Schertz', gc_customer_id: 'loberg', customer_address_id: 'addr1', revenue: 33_500, payments_made: 0, master_user_id: 'u-robert', last_work_date: null } },
    gcsById: { loberg: { id: 'loberg', name: 'Loberg Contracting', address: '2904 Corporate Cr, Flower Mound, TX', email: 'office@loberg.test', policy: 'ask', policyNote: '' } },
    addressesById: { addr1: { id: 'addr1', county: 'Guadalupe', legal_description: 'Lot 1', property_kind: 'non_residential', homestead: false, owner_mode: 'building_owner', owner_name: '', owner_company: 'Elbel Holdings LLC', owner_mailing_address: '4 Example Way, Schertz, TX' } as unknown as LienDeskData['addressesById'][string] },
    ownerByJob: {},
    promisesByJob: {},
    gcsWithPriorNotice: new Set(),
    gcsHeldBefore: new Set(), claimCorrectionsByJob: {}, filingsByJob: {},
  }
}

describe('buildLienDeskRun', () => {
  it('turns every approved entry into a notice with two statutory recipients, its months and its cover note', () => {
    const d = data([approved])
    const run = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert Douglas, Master Plumber', TODAY)
    expect(run).toHaveLength(1)
    const n = run[0]!
    expect(n.label).toBe('650 · ATI Schertz')
    expect(n.months).toEqual(['2026-06', '2026-07'])
    expect(n.amount).toBe(33_500)
    expect(n.fields.originalContractorName).toBe('Loberg Contracting')
    expect(n.fields.contactPerson).toBe('Robert Douglas, Master Plumber')
    expect(n.extras.refItems).toEqual(['Job #650', 'Work months June and July 2026', 'September 14, 2026'])
    // Counsel's letter everywhere (v2.3828): the desk's cover is counsel's commercial letter, filled — never the old routine note.
    expect(n.coverNote).toBeNull()
    expect(n.coverLetter).toContain('This page is a cover letter.')
    expect(n.coverLetter).toContain('Loberg Contracting has not paid us $33,500.00 for work completed in June and July 2026.')
    expect(n.coverLetter).not.toContain('routine notice')
    expect(n.recipients.map((r) => [r.key, r.name, r.method])).toEqual([
      ['owner', 'Elbel Holdings LLC', 'certified_mail'],
      ['original_contractor', 'Loberg Contracting', 'certified_mail'],
    ])
    expect(n.recipients[1]!.email).toBe('office@loberg.test')
    expect(runNoticeProblems(n)).toEqual([])
  })

  it('skips entries whose item is not approved and names the problems a recipient has', () => {
    const d = data([{ ...approved, status: 'awaiting_approval', approval_mode: null }])
    expect(buildLienDeskRun(d.queue.entries, d, null, () => '', TODAY)).toEqual([])
    const ok = data([approved])
    const n = buildLienDeskRun(ok.queue.piles.ready, ok, null, () => '', TODAY)[0]!
    n.recipients[0]!.method = 'email'
    expect(runNoticeProblems(n)).toEqual(['Owner of record: no email on file'])
    n.recipients[0]!.method = 'certified_mail'
    n.recipients[0]!.address = ''
    expect(runNoticeProblems(n)).toEqual(['Owner of record: no mailing address'])
  })

  it('an owner the nightly run saved from the roll blocks Record the run until a person confirms it (v2.3450)', () => {
    const d = data([approved])
    const addr = d.addressesById.addr1 as unknown as Record<string, unknown>
    // Hand-typed owner (no provenance, backfilled confirmed): clean.
    expect(buildLienDeskRun(d.queue.piles.ready, d, null, () => '', TODAY)[0]!.ownerUnconfirmed).toBe(false)
    // From the roll, nobody looked: the run refuses.
    d.addressesById.addr1 = { ...addr, parcel_source: 'Guadalupe Appraisal District', parcel_tax_year: '2025', owner_confirmed_at: null } as unknown as LienDeskData['addressesById'][string]
    const n = buildLienDeskRun(d.queue.piles.ready, d, null, () => '', TODAY)[0]!
    expect(n.ownerUnconfirmed).toBe(true)
    expect(runNoticeProblems(n)).toEqual([RUN_OWNER_UNCONFIRMED_PROBLEM])
    // Confirmed: clean again.
    d.addressesById.addr1 = { ...addr, parcel_source: 'Guadalupe Appraisal District', owner_confirmed_at: '2026-09-15T14:00:00Z' } as unknown as LienDeskData['addressesById'][string]
    expect(buildLienDeskRun(d.queue.piles.ready, d, null, () => '', TODAY)[0]!.ownerUnconfirmed).toBe(false)
    // A job override is a person's own writing — never "from the roll".
    d.addressesById.addr1 = { ...addr, parcel_source: 'Guadalupe Appraisal District', owner_confirmed_at: null } as unknown as LienDeskData['addressesById'][string]
    d.ownerByJob.j650 = { owner_mode: 'building_owner', owner_name: '', company_name: 'Typed Owner LLC', mailing_address: '1 Main St', owner_email: '' }
    expect(buildLienDeskRun(d.queue.piles.ready, d, null, () => '', TODAY)[0]!.ownerUnconfirmed).toBe(false)
  })

  it('the packet is one document: cover sheet with a line per envelope, then per envelope the cover page and the copy', () => {
    const d = data([approved])
    const run = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)
    const cover = runCoverSheetBlocks(run, TODAY)
    expect(cover.filter((b) => b.kind === 'numbered')).toHaveLength(2)
    expect(cover.find((b) => b.kind === 'numbered' && b.n === 1)).toMatchObject({ text: expect.stringContaining('Owner of record: Elbel Holdings LLC, 4 Example Way, Schertz, TX · certified mail, return receipt · tracking # ________________ — 650 · ATI Schertz — June and July 2026 — $33,500.00') })
    expect(cover.find((b) => b.kind === 'paragraph')).toMatchObject({ text: expect.stringContaining('1 notice · 2 envelopes.') })
    expect(runCoverNoteBlocks(run[0]!).some((b) => b.kind === 'paragraph')).toBe(true)
    const ownerCopy = runNoticeBlocks(run[0]!, run[0]!.recipients[0]!)
    expect(ownerCopy.find((b) => b.kind === 'refstrip')).toMatchObject({ items: ['Job #650', 'Work months June and July 2026', 'September 14, 2026', 'Copy for: Owner of record'] })
    const html = runPacketHtml(run, TODAY, null)
    expect(html.split('page-break-after:always').length - 1).toBe(3) // cover sheet · [owner envelope: note, owner copy] · [GC envelope: GC copy] last
    expect(html).toContain('Notice of Claim for Unpaid Labor or Materials')
    expect(html).toContain('Copy for: Original contractor')
  })

  it('the filing payload records every month named and both sends', () => {
    const d = data([approved])
    const n = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)[0]!
    const payload = runFilingPayload(n, [{ recipient: 'owner', method: 'certified_mail', tracking: '9407 1', sent_on: TODAY }, { recipient: 'original_contractor', method: 'email', tracking: 'resend:abc → office@loberg.test', sent_on: TODAY }], 'u-taunya')
    expect(payload).toMatchObject({ job_id: 'j650', created_by: 'u-taunya', kind: 'notice_53_056', amount: 33_500, months_covered: ['2026-06', '2026-07'] })
    expect((payload.sends as unknown[]).length).toBe(2)
    expect((payload.fields as { originalContractorName: string }).originalContractorName).toBe('Loberg Contracting')
  })
})

describe('the run carries the GC-on-notice cover letter (v2.3482)', () => {
  it('fills the letter per notice from the stored template and prints it as the cover page instead of the note', () => {
    const template = 'To the owner of {{property}},\n\nWork in {{months}} on job {{job}} is unpaid.\n\nWe would rather be paid than file a lien.'
    const fields = { notice: { noticeDate: TODAY, projectDescription: 'ATI Schertz', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Loberg Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert Douglas, Master Plumber', claimantAddress: '5501 Balcones Dr' }, gcEmail: '', batchReason: 'GC is not paying its subs — Sarah said the draw was spent', coverLetter: template }
    const d = data([{ ...approved, fields }])
    const run = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)
    const n = run[0]!
    expect(n.coverLetter).toBe('To the owner of 1204 Elbel Rd, Schertz, TX,\n\nWork in June and July 2026 on job 650 is unpaid.\n\nWe would rather be paid than file a lien.')
    const blocks = runCoverNoteBlocks(n)
    expect(blocks.filter((b) => b.kind === 'paragraph').map((b) => (b as { text: string }).text)).toEqual([
      'To the owner of 1204 Elbel Rd, Schertz, TX,',
      'Work in June and July 2026 on job 650 is unpaid.',
      'We would rather be paid than file a lien.',
      'Enclosed: Notice of claim for unpaid labor or materials (Tex. Prop. Code § 53.056).',
    ])
    expect(blocks.find((b) => b.kind === 'signature')).toMatchObject({ lines: ['Robert Douglas, Master Plumber', 'Click Plumbing and Electrical'] })
    // without a stored letter, counsel's letter for the property's kind prints (v2.3828) — not the old routine note
    const plain = buildLienDeskRun(data([approved]).queue.piles.ready, data([approved]), null, () => 'Robert', TODAY)[0]!
    expect(plain.coverLetter).toContain('This page is a cover letter.')
    expect(runCoverNoteBlocks(plain).some((b) => b.kind === 'paragraph' && (b as { text: string }).text.includes('routine notice'))).toBe(false)
    expect(runCoverNoteBlocks({ ...plain, withInvoices: true }).some((b) => b.kind === 'paragraph' && (b as { text: string }).text.endsWith('§ 53.056), with invoices.'))).toBe(true)
  })
})

describe('the imported "Null" token never reaches the paper (punch list #16)', () => {
  const junk = '9703 Lenox Hl San Antonio, TX 78240 Null'
  it("the form's project line reads the address clean, zip kept", () => {
    const d = data([approved])
    d.jobsById.j650 = { ...d.jobsById.j650!, job_address: junk }
    const n = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)[0]!
    expect(n.fields.projectDescription).toBe('ATI Schertz — 9703 Lenox Hl San Antonio, TX 78240')
    expect(runPacketHtml([n], TODAY, null)).not.toMatch(/\bNull\b/)
  })
  it("the cover letter's {{property}} fill reads it clean too", () => {
    const notice = { noticeDate: TODAY, projectDescription: 'ATI Schertz', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Loberg Contracting', contractedWithIfDifferent: '', claimAmount: '33500.00', contactPerson: 'Robert', claimantAddress: '5501 Balcones Dr' }
    const d = data([{ ...approved, fields: { notice, gcEmail: '', batchReason: '', coverLetter: 'To the owner of {{property}}:' } }])
    d.jobsById.j650 = { ...d.jobsById.j650!, job_address: junk }
    const n = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)[0]!
    expect(n.coverLetter).toBe('To the owner of 9703 Lenox Hl San Antonio, TX 78240:')
    expect(runPacketHtml([n], TODAY, null)).not.toMatch(/\bNull\b/)
  })
})

describe('one envelope per name and address (v2.3720, punch list #16)', () => {
  function twoJobsOneOwner() {
    const d = data([approved, { ...approved, id: 'it2', job_id: 'j651' }])
    d.rows.push(row('j651', '2026-07', '2026-10-15'))
    d.jobsById.j651 = { ...d.jobsById.j650!, id: 'j651', hcp_number: '651', job_name: 'ATI Schertz II' }
    d.queue = buildLienDeskQueue(d.rows, d.items, {}, TODAY)
    return d
  }
  it('two jobs at one property go to the owner in one envelope, and the GC gets one envelope with both — two envelopes, not four', () => {
    const d = twoJobsOneOwner()
    const run = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)
    expect(run).toHaveLength(2)
    const cover = runCoverSheetBlocks(run, TODAY)
    const lines = cover.filter((b) => b.kind === 'numbered').map((b) => (b as { text: string }).text)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('Owner of record: Elbel Holdings LLC, 4 Example Way, Schertz, TX · certified mail, return receipt · tracking # ________________ — 2 notices: 650 · ATI Schertz — June and July 2026 — $33,500.00; 651 · ATI Schertz II')
    expect(lines[1]).toContain('Original contractor: Loberg Contracting, 2904 Corporate Cr, Flower Mound, TX')
    expect(lines[1]).toContain('2 notices:')
    expect((cover.find((b) => b.kind === 'paragraph') as { text: string }).text).toContain('2 notices · 2 envelopes. ')
    expect((cover.find((b) => b.kind === 'paragraph') as { text: string }).text).toContain('share an envelope')
  })
  it('the packet prints in envelope order — the owner envelope (letter + copy, letter + copy), then the GC envelope (copy, copy)', () => {
    const d = twoJobsOneOwner()
    const run = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)
    const html = runPacketHtml(run, TODAY, null)
    const order = [...html.matchAll(/Copy for: (Owner of record|Original contractor)|This page is a cover letter/g)].map((m) => m[0])
    expect(order).toEqual(['This page is a cover letter', 'Copy for: Owner of record', 'This page is a cover letter', 'Copy for: Owner of record', 'Copy for: Original contractor', 'Copy for: Original contractor'])
    expect(html.split('page-break-after:always').length - 1).toBe(6) // 7 pages: cover sheet + 4 owner pages + 2 GC pages
  })
})

describe('the § 53.254(g) statement rides on residential and homestead notices (v2.3744)', () => {
  it('applies on a homestead, on any residential property, and on nothing else', () => {
    expect(homesteadStatementApplies({ propertyKind: 'residential', homestead: false })).toBe(true)
    expect(homesteadStatementApplies({ propertyKind: 'non_residential', homestead: true })).toBe(true)
    expect(homesteadStatementApplies({ propertyKind: 'non_residential', homestead: false })).toBe(false)
    expect(homesteadStatementApplies({ propertyKind: '', homestead: false })).toBe(false)
    expect(homesteadStatementApplies(null)).toBe(false)
  })
  it('the run builds it from the property, the packet prints it on both copies, and a saved draft keeps it', () => {
    const d = data([approved])
    const commercial = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)[0]!
    expect(commercial.fields.homesteadStatement).toBeUndefined()
    expect(runPacketHtml([commercial], TODAY, null)).not.toContain('53.254')
    d.addressesById.addr1 = { ...(d.addressesById.addr1 as unknown as Record<string, unknown>), property_kind: 'residential' } as unknown as LienDeskData['addressesById'][string]
    const home = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)[0]!
    expect(home.fields.homesteadStatement).toBe(true)
    const html = runPacketHtml([home], TODAY, null)
    expect(html.split('53.254(g)').length - 1).toBe(2) // owner copy and GC copy
    // the draft parser keeps the flag, and drops it when absent
    expect(parseLienDeskDraftFields({ notice: home.fields })?.notice.homesteadStatement).toBe(true)
    expect(parseLienDeskDraftFields({ notice: commercial.fields })?.notice.homesteadStatement).toBeUndefined()
  })
})

describe('the § 53.057 retainage notice in the run (v2.3753)', () => {
  it('rides with its own form, footer words and cover letter, records with its kind, and shares the envelope rules', () => {
    const d = data([])
    const retItem = { ...approved, id: 'ret1', kind: 'retainage_53_057', months: [] } as LienDeskItemRow
    const entry: LienRetainageEntry = { jobId: 'j650', retainageHeld: 1_760, contractEndedOn: '2026-09-03', contractEndedHow: 'complete', deadline: '2026-10-05', daysLeft: 21, severity: 'amber', noticed: false, inClaim: false, openBalance: 33_500, customerId: 'ati', gcCustomerId: 'loberg', propertyKind: 'non_residential', hasOwner: true, paymentBond: 'unknown', gates: [], ready: true, item: retItem, pile: 'ready' }
    const run = buildLienRetainageRun([entry], d, null, () => 'Robert Douglas, Master Plumber', TODAY)
    expect(run).toHaveLength(1)
    const n = run[0]!
    expect(n.kind).toBe('retainage_53_057')
    expect(n.months).toEqual([])
    expect(n.amount).toBe(1_760)
    expect(n.fields.claimAmount).toBe('1760.00')
    expect(n.extras.refItems).toEqual(['Job #650', 'Our contract complete September 3, 2026', 'September 14, 2026'])
    // the retainage cover is a letter in counsel's form (v2.3844), not the one-paragraph note
    expect(n.coverNote).toBeNull()
    expect(n.coverLetter).toContain('The enclosed Notice of Claim for Unpaid Retainage is given under Texas Property Code § 53.057.')
    expect(n.coverLetter).toContain('§ 53.081(c)')
    expect(n.coverLetter).toContain('our retainage of $1,760.00')
    expect(runNoticeWhatWords(n)).toBe('retainage')
    const blocks = runNoticeBlocks(n, n.recipients[0]!)
    const title = blocks.find((b) => b.kind === 'title')
    expect(title && title.kind === 'title' ? title.lines[0] : '').toBe('Notice of Claim for Unpaid Retainage')
    expect(runFilingPayload(n, [], 'u1')).toMatchObject({ kind: 'retainage_53_057', amount: 1_760, months_covered: [] })
    const coverTitle = runCoverNoteBlocks(n).find((b) => b.kind === 'title')
    expect(coverTitle && coverTitle.kind === 'title' ? coverTitle.lines : []).toEqual(['Re: 650 · ATI Schertz', 'retainage'])
    // Both kinds in one run: the cover sheet names both statutes.
    const monthly = buildLienDeskRun(data([approved]).queue.piles.ready, data([approved]), null, () => 'R', TODAY)
    const sheet = runCoverSheetBlocks([...monthly, n], TODAY).find((b) => b.kind === 'paragraph')
    expect(sheet && sheet.kind === 'paragraph' ? sheet.text : '').toContain('Each § 53.056 notice and each § 53.057 retainage notice')
  })

  it("{{phone}} is the signer's own number when the desk hands one over", () => {
    const notice = buildLienDeskRun(data([approved]).queue.piles.ready, data([approved]), null, () => 'Robert', TODAY)[0]!.fields
    const withLetter = { ...approved, fields: { notice, gcEmail: '', coverLetter: 'Call {{contact}} at {{phone}}.' } } as LienDeskItemRow
    const d = data([withLetter])
    const run = buildLienDeskRun(d.queue.piles.ready, d, { phone: '(210) 555-0100' } as never, () => 'Robert', TODAY, () => '(830) 555-0142')
    expect(run[0]!.coverLetter).toBe('Call Robert at (830) 555-0142.')
    const fallback = buildLienDeskRun(d.queue.piles.ready, d, { phone: '(210) 555-0100' } as never, () => 'Robert', TODAY)
    expect(fallback[0]!.coverLetter).toBe('Call Robert at (210) 555-0100.')
  })
})

describe('the pay page in the packet (v2.3758)', () => {
  const rows = [{ invoiceId: 'inv-1', label: 'Invoice #650, August 18, 2026', description: 'Rough-in.', openAmount: 33_500, payable: true }]
  const assets = { 'inv-1': { svg: '<svg data-code></svg>', png: null } }

  it("builds the owner's page from the notice — the GC's copy gets none by default", () => {
    const d = data([approved])
    const run = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)
    const n = run[0]!
    const owner = runPayPageBlocks(n, n.recipients[0]!, rows, assets, '(512) 360-0599')
    expect(owner.find((b) => b.kind === 'refstrip')).toMatchObject({ items: ['Job #650', 'Work months June and July 2026', 'September 14, 2026', 'Copy for: Owner of record'] })
    expect(owner.find((b) => b.kind === 'callout')).toMatchObject({ text: expect.stringContaining('only if Loberg Contracting has told you in writing') })
    expect(owner.filter((b) => b.kind === 'payRow')).toHaveLength(1)
    expect(runPayPageBlocks(n, n.recipients[1]!, rows, assets, '')).toEqual([])
  })

  it("prints between the owner's copy and the invoices, and nowhere on the GC's copy", () => {
    const d = data([approved])
    const run = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)
    const jobId = run[0]!.jobId
    const html = runPacketHtml(run, TODAY, null, { [jobId]: ['<div data-invoice></div>'] }, { [jobId]: { owner: '<div data-pay-page></div>' } })
    // cover sheet · note · owner copy · pay page · invoice · GC copy · invoice
    expect(html.split('page-break-after:always').length - 1).toBe(6)
    expect(html.split('data-pay-page').length - 1).toBe(1)
    expect(html.indexOf('data-pay-page')).toBeGreaterThan(html.indexOf('Copy for: Owner of record'))
    expect(html.indexOf('data-pay-page')).toBeLessThan(html.indexOf('data-invoice'))
    expect(html.indexOf('data-pay-page')).toBeLessThan(html.indexOf('Copy for: Original contractor'))
  })
})

describe('the mailing (v2.4119): the number\u2019s shape, what records, the envelope faces', () => {
  it('trackingShape: certified wants 20 digits (22 with the prefix); courier any text; email and hand none', () => {
    expect(trackingShape('certified_mail', '9407 1118 9876 5432 1098')).toEqual({ ok: true, hint: '20 digits · certified', digits: 20 })
    expect(trackingShape('certified_mail', '9407111898765432109812')).toEqual({ ok: true, hint: '22 digits · certified', digits: 22 })
    expect(trackingShape('certified_mail', '9407 1118 9876 5432 10')).toEqual({ ok: false, hint: '18 digits — a certified number has 20', digits: 18 })
    expect(trackingShape('certified_mail', '')).toEqual({ ok: false, hint: '', digits: 0 })
    expect(trackingShape('traceable_courier', 'FX123')).toEqual({ ok: true, hint: '', digits: 3 })
    expect(trackingShape('email', '')).toEqual({ ok: true, hint: '', digits: 0 })
    expect(trackingShape('hand', '')).toEqual({ ok: true, hint: '', digits: 0 })
  })
  const r = (method: 'certified_mail' | 'traceable_courier' | 'email' | 'hand', tracking = '') => ({ key: 'owner' as const, label: 'Owner of record', name: 'A', address: 'B', email: 'a@b.test', method, tracking })
  const n = (itemId: string, recipients: ReturnType<typeof r>[]) => ({ itemId, jobId: itemId, kind: 'notice_53_056', label: itemId, jobNumber: itemId, months: [], amount: 1, fields: {} as never, extras: {} as never, coverLetter: null, coverNote: '', ownerUnconfirmed: false, recipients }) as unknown as Parameters<typeof runRecordSplit>[0][number]
  it('an envelope is mailed once it carries a number, or goes by email or hand', () => {
    expect(recipientMailed(r('certified_mail'))).toBe(false)
    expect(recipientMailed(r('certified_mail', '9407'))).toBe(true)
    expect(recipientMailed(r('email'))).toBe(true)
    expect(recipientMailed(r('hand'))).toBe(true)
  })
  it('runRecordSplit: numbered notices record now, the rest wait; with no number anywhere the run records whole', () => {
    const a = n('a', [r('certified_mail', '9407 1118 9876 5432 1098'), r('certified_mail')])
    const b = n('b', [r('certified_mail'), r('certified_mail')])
    const split = runRecordSplit([a, b])
    expect(split.partial).toBe(true)
    expect(split.mailed.map((x) => x.itemId)).toEqual(['a'])
    expect(split.waiting.map((x) => x.itemId)).toEqual(['b'])
    const whole = runRecordSplit([b, n('c', [r('certified_mail')])])
    expect(whole.partial).toBe(false)
    expect(whole.mailed).toHaveLength(2)
    expect(whole.waiting).toEqual([])
    const all = runRecordSplit([a])
    expect(all.partial).toBe(false)
    expect(all.mailed).toHaveLength(1)
  })
  it('envelope faces: one page per envelope, the certified line only when certified, no page for an email', () => {
    const html = runEnvelopeFacesHtml(
      [
        { n: 1, label: 'Owner of record', name: 'Rizvi & Kizilbash', address: '704 Garraty Ct\nSan Antonio, TX 78209', method: 'certified_mail' },
        { n: 2, label: 'Original contractor', name: 'RMC', address: '1 River Rd', method: 'traceable_courier' },
        { n: 3, label: 'Owner of record', name: 'Someone', address: '', method: 'email' },
      ],
      { companyName: 'Click Plumbing & Electrical', addressText: '1234 Trade St\nSan Antonio, TX 78201', phone: '', email: '', tagline: '', licenseLine: '' },
    )
    expect(html.match(/<section class="env">/g)).toHaveLength(2)
    expect(html).toContain('CERTIFIED MAIL · RETURN RECEIPT REQUESTED')
    expect(html).toContain('TRACEABLE COURIER')
    expect(html).toContain('Rizvi &amp; Kizilbash')
    expect(html).toContain('Click Plumbing &amp; Electrical<br>1234 Trade St<br>San Antonio, TX 78201')
    expect(html).toContain('Envelope 1 of 3')
    expect(html).not.toContain('Someone')
  })
})

describe('the pages one copy prints (v2.4621 — the run preview reads them, the packet stacks them)', () => {
  it("the owner's copy is the cover page then the form; the GC's copy is the form alone; the pay page and the invoices follow in order", () => {
    const d = data([approved])
    const run = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)
    const n0 = run[0]!
    const [owner, gc] = n0.recipients
    // The run from this data carries counsel's letter as the cover page; without one the note is the cover page.
    expect(runCopyPages(n0, owner!)[0]!.label).toBe('Cover letter')
    expect(runCopyPages(n0, owner!, { j650: ['<p>invoice one</p>'] })[0]!.html).toContain('with invoices')
    const n = { ...n0, coverLetter: null, coverNote: 'A routine notice.' }
    const invoices = { j650: ['<p>invoice one</p>', '<p>invoice two</p>'] }
    const pay = { j650: { owner: '<p>pay codes</p>' } }
    expect(runCopyPages(n, owner!).map((p) => p.label)).toEqual(['Cover note', '§ 53.056 notice · copy for owner of record'])
    expect(runCopyPages(n, gc!).map((p) => p.label)).toEqual(['§ 53.056 notice · copy for original contractor'])
    const full = runCopyPages(n, owner!, invoices, pay)
    expect(full.map((p) => p.label)).toEqual(['Cover note', '§ 53.056 notice · copy for owner of record', 'Pay codes', 'Unpaid invoice 1 of 2', 'Unpaid invoice 2 of 2'])
    expect(full[0]!.html).toContain('A routine notice.')
    expect(full[2]!.html).toBe('<p>pay codes</p>')
    // The GC's copy carries the invoices but no pay page by default.
    expect(runCopyPages(n, gc!, invoices, pay).map((p) => p.label)).toEqual(['§ 53.056 notice · copy for original contractor', 'Unpaid invoice 1 of 2', 'Unpaid invoice 2 of 2'])
    // The packet is those pages, in envelope order, behind the cover sheet.
    const html = runPacketHtml(run, TODAY, null, invoices, pay)
    expect(html.split('page-break-after:always').length - 1).toBe(1 + 5 + 3 - 1)
    expect(html.indexOf('pay codes')).toBeLessThan(html.indexOf('invoice one'))
  })
  it('stepRunPreview walks the packet and stops at its ends', () => {
    expect(stepRunPreview(0, 1, 3)).toBe(1)
    expect(stepRunPreview(2, 1, 3)).toBe(2)
    expect(stepRunPreview(0, -1, 3)).toBe(0)
    expect(stepRunPreview(0, 1, 0)).toBe(0)
  })
})

describe('the courtesy PDF to the original contractor (punch list #87 B)', () => {
  it('the builders tick it on the GC copy when an email is on file, never on the owner copy', () => {
    const d = data([approved])
    const n = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)[0]!
    expect(n.recipients.map((r) => [r.key, r.courtesy])).toEqual([
      ['owner', undefined],
      ['original_contractor', true],
    ])
    // The owner has an email too: still no courtesy copy, the desk line promises the GC one only.
    d.ownerByJob = { j650: { owner_mode: 'building_owner', owner_name: '', company_name: 'Elbel Holdings LLC', mailing_address: '4 Example Way, Schertz, TX', owner_email: 'owner@elbel.test' } }
    expect(buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)[0]!.recipients[0]!.email).toBe('owner@elbel.test')
    expect(buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)[0]!.recipients[0]!.courtesy).toBeUndefined()
    // No email on file: nothing to tick.
    d.gcsById.loberg = { ...d.gcsById.loberg!, email: '' }
    expect(buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)[0]!.recipients[1]!.courtesy).toBe(false)
    // The § 53.057 retainage notice goes to the same GC on the same terms.
    const ret = data([])
    const retItem = { ...approved, id: 'ret1', kind: 'retainage_53_057', months: [] } as LienDeskItemRow
    const entry: LienRetainageEntry = { jobId: 'j650', retainageHeld: 1_760, contractEndedOn: '2026-09-03', contractEndedHow: 'complete', deadline: '2026-10-05', daysLeft: 21, severity: 'amber', noticed: false, inClaim: false, openBalance: 33_500, customerId: 'ati', gcCustomerId: 'loberg', propertyKind: 'non_residential', hasOwner: true, paymentBond: 'unknown', gates: [], ready: true, item: retItem, pile: 'ready' }
    expect(buildLienRetainageRun([entry], ret, null, () => 'Robert', TODAY)[0]!.recipients.map((r) => r.courtesy)).toEqual([undefined, true])
  })

  it('a recorded notice owes one courtesy email per ticked copy with an email that goes on paper', () => {
    const d = data([approved])
    const n = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)[0]!
    expect(runCourtesyCopies(n).map((r) => [r.key, r.email])).toEqual([['original_contractor', 'office@loberg.test']])
    // Untick it and it owes none.
    expect(runCourtesyCopies({ recipients: n.recipients.map((r) => ({ ...r, courtesy: false })) })).toEqual([])
    // An envelope sent by email already is the email: no second one.
    expect(runCourtesyCopies({ recipients: n.recipients.map((r) => ({ ...r, method: 'email' as const })) })).toEqual([])
    // Courier and hand delivery still get it.
    expect(runCourtesyCopies({ recipients: n.recipients.map((r) => ({ ...r, method: 'hand' as const })) })).toHaveLength(1)
    // A blank email never sends, ticked or not.
    expect(runCourtesyCopies({ recipients: n.recipients.map((r) => ({ ...r, courtesy: true, email: ' ' })) })).toEqual([])
  })

  it('the email names the form it carries and how the paper copy travels', () => {
    expect(runCourtesyEmailWords({ kind: 'notice_53_056', label: '650 · ATI Schertz' }, 'certified_mail')).toEqual({
      subject: 'Notice of claim for unpaid labor or materials — 650 · ATI Schertz',
      // the email function's own default, word for word, for the case it was written for
      text: 'Please find the attached notice of claim for unpaid labor or materials (Tex. Prop. Code § 53.056). A copy is also being delivered by certified mail.',
    })
    expect(runCourtesyEmailWords({ kind: 'retainage_53_057', label: '650 · ATI Schertz' }, 'traceable_courier')).toEqual({
      subject: 'Notice of claim for unpaid retainage — 650 · ATI Schertz',
      text: 'Please find the attached notice of claim for unpaid retainage (Tex. Prop. Code § 53.057). A copy is also being delivered by traceable courier.',
    })
    expect(runCourtesyEmailWords({ kind: 'notice_53_056', label: '650' }, 'hand').text).toContain('A copy is also being delivered by hand.')
  })

  it('the record says who got one and which did not go, and that a failed one leaves the notice recorded', () => {
    expect(runCourtesyResultWords([], [])).toEqual({ sent: '', failed: '' })
    const sent = { itemId: 'it1', label: '650 · ATI Schertz', email: 'office@loberg.test' }
    expect(runCourtesyResultWords([sent], []).sent).toBe('Courtesy PDF emailed to office@loberg.test.')
    expect(runCourtesyResultWords([sent, { ...sent, itemId: 'it2', label: '651 · Annex' }], []).sent).toBe('2 courtesy PDFs emailed to office@loberg.test.')
    expect(runCourtesyResultWords([], [{ ...sent, reason: 'Resend 502' }]).failed).toBe('Courtesy PDF not emailed: 650 · ATI Schertz to office@loberg.test (Resend 502). That notice is recorded all the same.')
  })
})
