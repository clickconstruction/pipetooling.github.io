import { describe, expect, it } from 'vitest'
import type { JobLienFilingRow } from './lienDeadlines'
import { lienServeBatchPrint, lienServeClock, lienServeHeldLine, lienServeJobsFromDesk, lienServeMailedJobsFromDesk, lienServeMailSheetHtml, lienServePlan, lienServePlanWords, type LienServeDeskData, type LienServeJob } from './lienServePackets'
import { lienServeStageCounts, lienServeStageDoorWords } from './lienServeStage'

// Every name, address and figure here is made up.
const FIELDS = {
  county: 'Hays',
  claimantPersonName: 'Dana Whitlow',
  claimantCompany: 'Sample Plumbing LLC',
  claimantAddress: 'PO Box 100, Kyle, TX 78640',
  legalDescription: 'Lot 4, Block 2, Sample Addition',
  propertyAddress: '410 Sample Street, Kyle, TX 78640',
  contractedWithName: 'Brightline Builders',
  workDescription: 'Plumbing labor and materials',
  workStart: '2026-07-01',
  workEnd: '2026-08-28',
  ownerName: 'Hollow Creek Holdings LLC',
  ownerAddress: '88 Sample Ridge Rd, Austin, TX 78700',
  originalContractorName: 'Brightline Builders',
  originalContractorAddress: '12 Example Pkwy, Buda, TX 78610',
  contractAmount: '40000.00',
  paidAmount: '21550.00',
  unpaidAmount: '18450.00',
  includeNoticesSworn: true,
  form: 'short',
  isSub: true,
}

const filing = (id: string, over: Record<string, unknown> = {}): JobLienFilingRow =>
  ({ id, job_id: `job-${id}`, kind: 'affidavit', fields: FIELDS, county: 'Hays', recording_number: `2026-00${id}`, filed_at: '2026-11-13', serve_due: '2026-11-18', served_at: null, voided_at: null, sends: [], ...over }) as unknown as JobLienFilingRow

const job = (number: string, over: Record<string, unknown> = {}, more: Partial<LienServeJob> = {}): LienServeJob => ({ jobId: `job-${number}`, jobNumber: number, jobLabel: `${number} · Sample Job`, filing: filing(number, over), isSub: true, ...more })

const TODAY = '2026-11-16'
const CTX = { todayYmd: TODAY, phone: '(512) 555-0142' }

describe('lienServeClock', () => {
  it('counts the days left, today, and the days late', () => {
    expect(lienServeClock('2026-11-18', TODAY)).toEqual({ serveDue: '2026-11-18', daysLeft: 2, late: false, chip: '2 days left', words: 'by Nov 18' })
    expect(lienServeClock('2026-11-17', TODAY).chip).toBe('1 day left')
    expect(lienServeClock('2026-11-16', TODAY)).toMatchObject({ daysLeft: 0, late: false, chip: 'due today', words: 'today' })
    expect(lienServeClock('2026-11-15', TODAY)).toMatchObject({ late: true, chip: '1 day late' })
    expect(lienServeClock('2026-11-11', TODAY)).toEqual({ serveDue: '2026-11-11', daysLeft: -5, late: true, chip: '5 days late', words: 'were due Nov 11. Mail them today.' })
  })

  it('says nothing for a filing with no day', () => {
    expect(lienServeClock(null, TODAY)).toEqual({ serveDue: '', daysLeft: 0, late: false, chip: '', words: '' })
  })
})

describe('lienServePlan', () => {
  it('prints what is ready, the soonest day first, and holds the rest with every reason', () => {
    const plan = lienServePlan(
      [
        job('2317'),
        job('2104', { serve_due: '2026-11-11' }),
        job('2340', { recording_number: '', serve_due: '2026-11-23' }),
        job('2291', { serve_due: '2026-11-16', fields: { ...FIELDS, isSub: false } }, { isSub: false }),
      ],
      CTX,
    )
    expect(plan.ready.map((r) => r.job.jobNumber)).toEqual(['2104', '2291', '2317'])
    expect(plan.held.map((h) => h.job.jobNumber)).toEqual(['2340'])
    expect(plan.held[0]?.holds.map((h) => h.key)).toEqual(['no_recording_number'])
    // Two envelopes on a job under a GC, one on a job contracted with the owner.
    expect(plan.envelopes).toBe(5)
    expect(plan.earliestDue).toBe('2026-11-11')
    expect(plan.late).toBe(1)
    expect(lienServeHeldLine(plan.held[0]!)).toBe('2340 · Sample Job: no recording number yet.')
  })

  it('leaves out a served filing, and holds one that keeps no fields', () => {
    const plan = lienServePlan([job('1', { served_at: '2026-11-14' }), job('2', { fields: null })], CTX)
    expect(plan.ready).toEqual([])
    expect(plan.held.map((h) => [h.job.jobNumber, h.holds[0]?.door])).toEqual([['2', 'photocopy']])
  })

  it('mails to the address the desk holds today', () => {
    const plan = lienServePlan([job('7', { fields: { ...FIELDS, ownerAddress: '' } }, { to: { owner: { name: 'Hollow Creek Holdings LLC', address: '500 New Owner Blvd, Austin, TX 78701' }, contractor: null } })], CTX)
    expect(plan.ready[0]?.envelopes[0]).toEqual({ recipient: 'owner', name: 'Hollow Creek Holdings LLC', address: '500 New Owner Blvd, Austin, TX 78701' })
  })
})

describe('lienServePlanWords', () => {
  const words = (jobs: LienServeJob[]) => lienServePlanWords(lienServePlan(jobs, CTX), TODAY)

  it('counts what prints and what is held on the press', () => {
    const w = words([job('1'), job('2'), job('3', { recording_number: '' })])
    expect(w.button).toBe('Print 2 liens’ copies · 1 held ▸')
    expect(w.dead).toBe(false)
    expect(w.foot).toBe('1 is held. It stays here with the reason. The 2 ready ones print now.')
    expect(w.lead).toBe('3 filed liens owe their copies. The soonest is due Nov 18.')
    expect(w.late).toBe('')
  })

  it('reads one lien as one', () => {
    const w = words([job('1', { serve_due: '2026-11-16' })])
    expect(w.button).toBe('Print 1 lien’s copies')
    expect(w.foot).toBeNull()
    expect(w.lead).toBe('1 filed lien owes its copies. The soonest is due today.')
  })

  it('says when a copy is late', () => {
    const w = words([job('1', { serve_due: '2026-11-11' }), job('2', { serve_due: '2026-11-12' }), job('3')])
    expect(w.lead).toBe('3 filed liens owe their copies. The soonest was due Nov 11.')
    expect(w.late).toBe('2 are past their day. Mail them today.')
    expect(words([job('1', { serve_due: '2026-11-11' })]).late).toBe('1 is past its day. Mail it today.')
  })

  it('names the door to the window by the stage the copies are at (`lienServeStage.ts`)', () => {
    const door = (jobs: LienServeJob[], printed: string[] = []) => lienServeStageDoorWords(lienServeStageCounts(lienServePlan(jobs, CTX), printed))?.label ?? ''
    // Nothing printed: the print, counting the liens that can print. A held one cannot.
    expect(door([job('1'), job('2'), job('3', { recording_number: '' })])).toBe('Print 2 · Enter mail numbers 1 ›')
    expect(door([job('1'), job('2')])).toBe('Print 2 liens’ copies ›')
    expect(door([job('1')])).toBe('Print 1 lien’s copies ›')
    // Every lien that can print has: the numbers, counting every lien still owed its day, the held one too.
    const ids = (jobs: LienServeJob[]) => jobs.map((j) => j.filing.id)
    const three = [job('1'), job('2'), job('3', { recording_number: '' })]
    expect(door(three, ids(three).slice(0, 2))).toBe('Enter mail numbers · 3 ›')
    // One still to print: the door names both halves.
    expect(door(three, ids(three).slice(0, 1))).toBe('Print 1 · Enter mail numbers 2 ›')
    expect(door([])).toBe('')
  })

  it('is dead only when nothing is ready', () => {
    const held = words([job('3', { recording_number: '' })])
    expect(held.dead).toBe(true)
    expect(held.button).toBe('Print ▸')
    const none = words([])
    expect(none).toMatchObject({ dead: true, lead: '', late: '' })
  })
})

describe('the stack', () => {
  const plan = lienServePlan([job('2291'), job('2104', { serve_due: '2026-11-11', fields: { ...FIELDS, isSub: false } }, { isSub: false }), job('2340', { recording_number: '' })], CTX)

  it('lists every envelope on the mail sheet in the order it prints, then what was left out', () => {
    const sheet = lienServeMailSheetHtml(plan, { printedOn: 'November 16, 2026', letter: true })
    expect(sheet).toContain('Copies of filed lien affidavits: 3 envelopes')
    expect(sheet.indexOf('2104 · Sample Job')).toBeLessThan(sheet.indexOf('2291 · Sample Job'))
    expect(sheet).toContain('Nov 11 · late')
    expect(sheet).toContain('>Original contractor</td>')
    expect(sheet).toContain('Not printed: no recording number yet. <span style="font-weight:400">Type the number the clerk gave.</span>')
    expect(sheet).toContain('The first letter is the next page')
    expect(lienServeMailSheetHtml(plan, { printedOn: '', letter: false })).toContain('The first copy is the next page')
  })

  it('keeps the number, Copy to and Mail by no wider than their longest text', () => {
    const sheet = lienServeMailSheetHtml(plan, { printedOn: '', letter: true })
    const fit = ' style="width:1%;white-space:nowrap"'
    // The table lays itself out by its content: no fixed column widths are left to pad the three.
    expect(sheet).toContain('<table class="lien-help-rows" style="table-layout:auto">')
    expect(sheet).not.toContain('<colgroup>')
    expect(sheet).toContain(`<th${fit}>#</th>`)
    expect(sheet).toContain(`<th${fit}>Copy to</th>`)
    expect(sheet).toContain(`<th${fit}>Mail by</th>`)
    expect(sheet).toContain(`<td${fit}>1</td>`)
    expect(sheet).toContain(`<td${fit}>Original contractor</td>`)
    expect(sheet).toContain(`<td${fit}>Nov 11 · late</td>`)
    // The job, the envelope's name and address, and the blank for the number keep the room.
    expect(sheet).toContain('<th style="width:22%">Job</th>')
    expect(sheet).toContain('<th>Name and address on the envelope</th>')
    expect(sheet).toContain('<th style="width:22%">Certified mail number</th>')
  })

  it('prints one document behind the sheet and hands each job its own papers to file', () => {
    const print = lienServeBatchPrint(plan, { letter: true, todayYmd: TODAY })
    expect(print?.jobs.map((j) => [j.jobId, j.filingId, j.title, j.papers.length])).toEqual([
      ['job-2104', '2104', 'Copy of lien affidavit — Job 2104', 2],
      ['job-2291', '2291', 'Copy of lien affidavit — Job 2291', 4],
    ])
    expect(print?.html).toContain('data-lien-serve-sheet')
    expect(print?.html.match(/class="filing-paper/g)?.length).toBe(6)
    expect(print?.html.indexOf('data-lien-serve-sheet')).toBeLessThan(print?.html.indexOf('class="filing-paper') ?? 0)
    // A job's own copy carries its papers alone, never the sheet.
    expect(print?.jobs[0]?.html).not.toContain('data-lien-serve-sheet')
    expect(print?.jobs[0]?.html.match(/class="filing-paper/g)?.length).toBe(2)
  })

  it('leaves the letters out when the box is unticked, and is null with nothing ready', () => {
    expect(lienServeBatchPrint(plan, { letter: false, todayYmd: TODAY })?.html.match(/class="filing-paper/g)?.length).toBe(3)
    expect(lienServeBatchPrint(lienServePlan([job('2340', { recording_number: '' })], CTX), { letter: true, todayYmd: TODAY })).toBeNull()
  })
})

describe('lienServeJobsFromDesk', () => {
  const data: LienServeDeskData = {
    filingsByJob: {
      'job-1': [filing('1'), { ...filing('n'), kind: 'notice_53_056' } as JobLienFilingRow],
      'job-2': [filing('2', { served_at: '2026-11-14' })],
      'job-3': [filing('3', { voided_at: '2026-11-14T00:00:00Z' })],
      'job-4': [filing('4')],
    },
    jobsById: {
      'job-1': { hcp_number: '2291', job_name: 'Cedar Hollow Lofts', gc_customer_id: 'gc-1', customer_address_id: 'addr-1' },
      'job-4': { hcp_number: '2104', job_name: null, gc_customer_id: null, customer_address_id: null },
    },
    addressesById: { 'addr-1': { owner_mode: 'company', owner_name: '', owner_company: 'Hollow Creek Holdings LLC', owner_mailing_address: '500 New Owner Blvd, Austin, TX 78701' } as never },
    ownerByJob: {},
    gcsById: { 'gc-1': { name: 'Brightline Builders', address: '12 Example Pkwy, Buda, TX 78610' } },
  }

  it('takes each filed, unserved, live affidavit with where its envelopes go today', () => {
    const jobs = lienServeJobsFromDesk(data)
    expect(jobs.map((j) => [j.jobNumber, j.jobLabel, j.isSub])).toEqual([
      ['2291', '2291 · Cedar Hollow Lofts', true],
      ['2104', '2104', false],
    ])
    expect(jobs[0]?.to).toEqual({ owner: { name: 'Hollow Creek Holdings LLC', address: '500 New Owner Blvd, Austin, TX 78701' }, contractor: { name: 'Brightline Builders', address: '12 Example Pkwy, Buda, TX 78610' } })
    expect(jobs[1]?.to?.contractor).toBeNull()
  })

  it('lists the mailed liens the window still shows, the newest mailing first, and none that are voided or unserved', () => {
    const more: LienServeDeskData = { ...data, filingsByJob: { ...data.filingsByJob, 'job-5': [filing('5', { served_at: '2026-11-16' })], 'job-6': [filing('6', { served_at: '2026-11-15', voided_at: '2026-11-16T00:00:00Z' })] } }
    expect(lienServeMailedJobsFromDesk(more, () => true).map((j) => j.filing.id)).toEqual(['5', '2'])
    // The window's own test: only a lien that still lacks a number or a receipt.
    expect(lienServeMailedJobsFromDesk(more, (j) => j.filing.id === '2').map((j) => j.filing.id)).toEqual(['2'])
    expect(lienServeMailedJobsFromDesk(data, () => false)).toEqual([])
  })
})
