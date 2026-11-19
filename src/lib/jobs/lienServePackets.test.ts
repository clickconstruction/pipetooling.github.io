import { describe, expect, it } from 'vitest'
import type { JobLienFilingRow } from './lienDeadlines'
import { lienServeClock, lienServeHeldLine, lienServeJobsFromDesk, lienServeMailedJobsFromDesk, lienServeMailSheet, lienServePlan, lienServePlanRead, lienServePlanWords, lienServeRunWords, type LienServeDeskData, type LienServeJob } from './lienServePackets'
import { LIEN_COPY_BROKEN_HOLD, type LienCopyRead } from './lienStampedCopy'
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
  ({ id, job_id: `job-${id}`, kind: 'affidavit', fields: FIELDS, county: 'Hays', recording_number: `2026-00${id}`, filed_at: '2026-11-13', serve_due: '2026-11-18', served_at: null, voided_at: null, sends: [], document_url: `https://drive.google.com/file/d/1SampleStampedScan${id}/view`, ...over }) as unknown as JobLienFilingRow

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

  it('leaves out a served filing, and prints one that keeps no fields with no letter', () => {
    const plan = lienServePlan([job('1', { served_at: '2026-11-14' }), job('2', { fields: null }, { to: { owner: { name: 'Hollow Creek Holdings LLC', address: '1 Way, Austin, TX 78701' }, contractor: { name: 'Brightline Builders', address: '12 Example Pkwy, Buda, TX 78610' } } })], CTX)
    expect(plan.held).toEqual([])
    expect(plan.ready.map((r) => [r.job.jobNumber, r.letter, r.envelopes.length])).toEqual([['2', false, 2]])
  })

  it('holds a lien with no stamped copy, or one that is a typed link, and prints the rest', () => {
    const plan = lienServePlan([job('1'), job('2', { document_url: '' }), job('3', { document_url: 'https://example.com/scan.pdf' }), job('4', { document_url: 'in the red folder' })], CTX)
    expect(plan.ready.map((r) => [r.job.jobNumber, r.copy.fileId, r.letter])).toEqual([['1', '1SampleStampedScan1', true]])
    expect(plan.held.map((h) => [h.job.jobNumber, h.holds.map((x) => x.key).join()])).toEqual([
      ['2', 'no_saved_copy'],
      ['3', 'copy_not_drive'],
      ['4', 'no_saved_copy'],
    ])
    expect(plan.held[0]?.holds[0]).toMatchObject({ door: 'scan', act: 'Add the clerk’s stamped scan on the job’s Lien window.' })
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

describe('the plan once the saved copies are read', () => {
  const ok = (pages: number, bytes = 450_000): LienCopyRead => ({ state: 'ok', file: { kind: 'pdf', pages, bytes, sha256: 'abc' } })
  const plan = lienServePlan([job('2291'), job('2104', { serve_due: '2026-11-11', fields: { ...FIELDS, isSub: false } }, { isSub: false }), job('2340', { recording_number: '' }), job('2400', { serve_due: '2026-11-20' })], CTX)

  it('waits on a copy still being read, and the press says how many', () => {
    const run = lienServePlanRead(plan, { '2104': ok(2), '2291': { state: 'reading' } })
    expect(run.ready.map((r) => r.job.jobNumber)).toEqual(['2104'])
    expect(run.reading).toBe(2)
    const words = lienServeRunWords(run, TODAY)
    expect(words).toMatchObject({ button: 'Reading 2 stamped copies…', dead: true })
    // The lead counts every lien that owes its copies, read or not.
    expect(words.lead).toBe('4 filed liens owe their copies. The soonest was due Nov 11.')
    expect(lienServeRunWords(lienServePlanRead(plan, { '2104': ok(2), '2291': ok(2) }), TODAY).button).toBe('Reading 1 stamped copy…')
  })

  it('prints what is read, and holds a copy the app cannot print with its reason while the rest print', () => {
    const run = lienServePlanRead(plan, { '2104': ok(2), '2291': { state: 'held', hold: LIEN_COPY_BROKEN_HOLD }, '2400': ok(3) })
    expect(run.reading).toBe(0)
    expect(run.ready.map((r) => [r.job.jobNumber, r.file.pages])).toEqual([['2104', 2], ['2400', 3]])
    expect(run.held.map((h) => [h.job.jobNumber, h.holds[0]?.key])).toEqual([['2291', 'copy_broken'], ['2340', 'no_recording_number']])
    expect(run.envelopes).toBe(3)
    expect(lienServeRunWords(run, TODAY)).toMatchObject({ button: 'Print 2 liens’ copies · 2 held ▸', dead: false })
  })

  it('holds a copy that looks like more than one lien until a person says it is this lien alone', () => {
    const reads = { '2104': ok(2), '2291': ok(18), '2400': ok(2, 9_000_000) }
    const run = lienServePlanRead(plan, reads)
    expect(run.ready.map((r) => r.job.jobNumber)).toEqual(['2104'])
    expect(run.held.find((h) => h.job.jobNumber === '2291')?.holds[0]).toMatchObject({ key: 'copy_several', ask: true, words: 'the saved copy has 18 pages, and a stamped lien is usually 2' })
    expect(run.held.find((h) => h.job.jobNumber === '2400')?.holds[0]?.words).toBe('the saved copy is 8.6 MB, several times a usual scan')
    const said = lienServePlanRead(plan, reads, new Set(['2291']))
    expect(said.ready.map((r) => r.job.jobNumber)).toEqual(['2104', '2291'])
    // A person's word lifts the question about pages, never a hold of another kind.
    expect(lienServePlanRead(plan, reads, new Set(['2340'])).held.some((h) => h.job.jobNumber === '2340')).toBe(true)
  })
})

describe('the mail sheet', () => {
  const ok = (pages: number): LienCopyRead => ({ state: 'ok', file: { kind: 'pdf', pages, bytes: 450_000, sha256: 'abc' } })
  const plan = lienServePlan([job('2291'), job('2104', { serve_due: '2026-11-11', fields: { ...FIELDS, isSub: false } }, { isSub: false }), job('2340', { recording_number: '' })], CTX)
  const run = lienServePlanRead(plan, { '2291': ok(2), '2104': ok(3) })

  it('lists every envelope in the order it prints with its pages, then what was left out', () => {
    const sheet = lienServeMailSheet(run, { printedOn: 'November 16, 2026', letter: true })
    expect(sheet.title).toBe('Copies of filed lien affidavits: 3 envelopes')
    expect(sheet.printed).toBe('Printed November 16, 2026')
    expect(sheet.rows.map((r) => [r.n, r.job, r.to, r.pages, r.mailBy])).toEqual([
      [1, '2104 · Sample Job', 'Owner', '4', 'Nov 11 · late'],
      [2, '2291 · Sample Job', 'Owner', '3', 'Nov 18'],
      [3, '2291 · Sample Job', 'Original contractor', '3', 'Nov 18'],
    ])
    expect(sheet.rows[0]).toMatchObject({ name: 'Hollow Creek Holdings LLC', address: '88 Sample Ridge Rd, Austin, TX 78700' })
    expect(sheet.held).toEqual([{ job: '2340 · Sample Job', words: 'Not printed: no recording number yet.', act: 'Type the number the clerk gave.' }])
    expect(sheet.steps[0]).toBe('Each envelope takes its letter and the clerk’s stamped copy behind it. They come off the printer in the order below.')
    expect(sheet.foot).toEqual(['Mail sheet printed November 16, 2026', 'The first letter is the next page'])
    expect(sheet.columns).toEqual(['#', 'Job', 'Copy to', 'Name and address on the envelope', 'Pages', 'Mail by', 'Certified mail number'])
  })

  it('counts the stamped copy alone when the letters are left out, and says so', () => {
    const sheet = lienServeMailSheet(run, { printedOn: '', letter: false })
    expect(sheet.rows.map((r) => r.pages)).toEqual(['3', '2', '2'])
    expect(sheet.steps[0]).toBe('Each envelope takes one clerk’s stamped copy. They come off the printer in the order below.')
    expect(sheet.foot).toEqual(['Mail sheet', 'The first copy is the next page'])
  })

  it('names a lien the run could not put in the stack after all', () => {
    const sheet = lienServeMailSheet({ ready: run.ready.slice(0, 1), held: [] }, { printedOn: '', letter: true, notPrinted: [{ job: run.ready[1]!.job, reason: 'its papers could not be put together.' }] })
    expect(sheet.rows).toHaveLength(1)
    expect(sheet.held).toEqual([{ job: '2291 · Sample Job', words: 'Not printed: its papers could not be put together.', act: 'Print this lien again from the Lien desk.' }])
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
