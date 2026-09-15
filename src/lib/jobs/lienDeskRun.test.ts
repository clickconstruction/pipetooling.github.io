import { describe, expect, it } from 'vitest'
import { buildLienDeskQueue, type LienDeskItemRow, type LienNoticeMonthRow } from './lienDesk'
import { buildLienDeskRun, RUN_OWNER_UNCONFIRMED_PROBLEM, runCoverSheetBlocks, runCoverNoteBlocks, runFilingPayload, runNoticeBlocks, runNoticeProblems, runPacketHtml } from './lienDeskRun'
import type { LienDeskData } from '../../hooks/useLienDeskData'

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
    summary: { office: { jobs: 0, months: 0, dollars: 0, needsOwner: 0, earliestDeadline: null, ready: 1 }, leader: { jobs: 0, dollars: 0, earliestDeadline: null }, held: 0 },
    rows,
    items,
    affidavits: { entries: [], piles: { needs_property: [], to_draft: [], awaiting: [], ready: [], held: [], filed: [], missed: [] }, counts: { needs_property: 0, to_draft: 0, awaiting: 0, ready: 0, held: 0, filed: 0, missed: 0 } },
    affidavitRows: [],
    jobsById: { j650: { id: 'j650', hcp_number: '650', click_number: null, job_name: 'ATI Schertz', job_address: '1204 Elbel Rd, Schertz, TX', customer_id: 'ati', customer_name: 'ATI Schertz', gc_customer_id: 'loberg', customer_address_id: 'addr1', revenue: 33_500, payments_made: 0, master_user_id: 'u-robert' } },
    gcsById: { loberg: { id: 'loberg', name: 'Loberg Contracting', address: '2904 Corporate Cr, Flower Mound, TX', email: 'office@loberg.test', policy: 'ask', policyNote: '' } },
    addressesById: { addr1: { id: 'addr1', county: 'Guadalupe', legal_description: 'Lot 1', property_kind: 'non_residential', homestead: false, owner_mode: 'building_owner', owner_name: '', owner_company: 'Elbel Holdings LLC', owner_mailing_address: '4 Example Way, Schertz, TX' } as unknown as LienDeskData['addressesById'][string] },
    ownerByJob: {},
    promisesByJob: {},
    gcsWithPriorNotice: new Set(),
    gcsHeldBefore: new Set(),
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
    expect(n.coverNote).toContain('work furnished in June and July 2026')
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

  it('the packet is one document: cover sheet with an envelope line per recipient, the cover note page, a copy per recipient', () => {
    const d = data([approved])
    const run = buildLienDeskRun(d.queue.piles.ready, d, null, () => 'Robert', TODAY)
    const cover = runCoverSheetBlocks(run, TODAY)
    expect(cover.filter((b) => b.kind === 'numbered')).toHaveLength(2)
    expect(cover.find((b) => b.kind === 'numbered' && b.n === 1)).toMatchObject({ text: expect.stringContaining('650 · ATI Schertz — June and July 2026 — $33,500.00 · Owner of record: Elbel Holdings LLC, 4 Example Way, Schertz, TX · certified mail, return receipt · tracking # ') })
    expect(runCoverNoteBlocks(run[0]!).some((b) => b.kind === 'paragraph')).toBe(true)
    const ownerCopy = runNoticeBlocks(run[0]!, run[0]!.recipients[0]!)
    expect(ownerCopy.find((b) => b.kind === 'refstrip')).toMatchObject({ items: ['Job #650', 'Work months June and July 2026', 'September 14, 2026', 'Copy for: Owner of record'] })
    const html = runPacketHtml(run, TODAY, null)
    expect(html.split('page-break-after:always').length - 1).toBe(3) // cover · note · owner copy, then the GC copy last
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
    // without a letter the standard note still prints
    const plain = buildLienDeskRun(data([approved]).queue.piles.ready, data([approved]), null, () => 'Robert', TODAY)[0]!
    expect(plain.coverLetter).toBeNull()
    expect(runCoverNoteBlocks(plain).some((b) => b.kind === 'paragraph' && (b as { text: string }).text.includes('routine notice'))).toBe(true)
  })
})
