import { describe, expect, it } from 'vitest'
import {
  buildCustomerTimeline,
  emptyCustomerTimelineInput,
  timelineCardShown,
  timelineDayOfDate,
  timelineDayOfInstant,
  timelineHoursWords,
  timelineJobLabel,
  timelineMoney,
  timelineNoteSide,
  timelinePaymentTitle,
  timelineSpanWords,
  type CustomerTimeline,
  type CustomerTimelineInput,
  type TimelineCard,
  type TimelineClockInput,
  type TimelineJobInput,
  type TimelineRow,
} from './customerTimeline'

// A made-up GC: two open jobs of its own, one job it is GC on (the owner pays, in Collections),
// one imported job, and two paid jobs from last year.
const TODAY = '2026-10-07'
const NOW = Date.parse('2026-10-07T17:00:00Z')
const CUST = { id: 'c-ridge', name: 'Ridgeway Builders', createdAt: '2024-11-12T16:00:00Z', dateMet: null }

const at = (ymd: string, hhmm = '15:00') => `${ymd}T${hhmm}:00Z`

function job(p: Partial<TimelineJobInput> & { id: string }): TimelineJobInput {
  return {
    hcpNumber: null,
    clickNumber: null,
    jobName: null,
    jobAddress: null,
    status: 'working',
    revenue: null,
    paymentsMade: null,
    createdAt: null,
    customerId: CUST.id,
    customerName: CUST.name,
    gcCustomerId: null,
    collectionsAt: null,
    collectionsNote: null,
    uncollectibleAt: null,
    uncollectibleReason: null,
    ...p,
  }
}

function session(id: string, jobId: string, ymd: string, hours: number, userName = 'Ana Ruiz', notes: string | null = null): TimelineClockInput {
  const inIso = at(ymd, '13:00')
  return { id, jobId, userName, workDate: ymd, clockedInAt: inIso, clockedOutAt: new Date(Date.parse(inIso) + hours * 3_600_000).toISOString(), notes }
}

function ridgeway(): CustomerTimelineInput {
  const input = emptyCustomerTimelineInput(CUST)
  input.jobs = [
    job({ id: 'j612', hcpNumber: '612', jobName: 'Oak Hill shell', jobAddress: '400 Oak Hill Dr, Austin, TX', status: 'paid', revenue: 18400, paymentsMade: 18400, createdAt: at('2025-02-03') }),
    job({ id: 'j688', hcpNumber: '688', jobName: 'Oak Hill trim', jobAddress: '400 Oak Hill Dr, Austin, TX', status: 'paid', revenue: 9850, paymentsMade: 9850, createdAt: at('2025-06-10') }),
    job({ id: 'j200', hcpNumber: '200', jobName: 'Ranch house', jobAddress: '9 Ranch Rd, Dripping Springs, TX', status: 'paid', revenue: 6200, paymentsMade: 6200, createdAt: at('2026-02-26') }),
    job({ id: 'j901', hcpNumber: '901', jobName: 'Bluff Springs clinic', jobAddress: '12 Bluff Springs Rd, Austin, TX', status: 'billed', revenue: 53250, paymentsMade: 22000, createdAt: at('2026-03-02') }),
    job({ id: 'j944', hcpNumber: '944', jobName: 'Clinic add-on', jobAddress: '12 Bluff Springs Rd, Austin, TX', status: 'working', revenue: 4200, createdAt: at('2026-09-08') }),
    job({
      id: 'j350',
      hcpNumber: '350',
      jobName: 'Ridgeway Builders',
      jobAddress: '77 Pecan St, Kyle, TX',
      status: 'billed',
      revenue: 2400,
      createdAt: at('2026-08-01'),
      customerId: 'c-owner',
      customerName: 'Lee Park',
      gcCustomerId: CUST.id,
      collectionsAt: at('2026-09-20'),
      collectionsNote: 'Owner says the GC owes it.',
    }),
  ]
  input.statusEvents = [
    { jobId: 'j612', fromStatus: 'working', toStatus: 'billed', changedAt: at('2025-04-01') },
    { jobId: 'j612', fromStatus: 'billed', toStatus: 'paid', changedAt: at('2025-05-01') },
    { jobId: 'j688', fromStatus: 'waiting', toStatus: 'working', changedAt: at('2025-07-07') },
    { jobId: 'j688', fromStatus: 'working', toStatus: 'billed', changedAt: at('2025-08-04') },
    { jobId: 'j688', fromStatus: 'billed', toStatus: 'paid', changedAt: at('2025-11-17') },
    { jobId: 'j901', fromStatus: 'waiting', toStatus: 'working', changedAt: at('2026-03-16') },
    { jobId: 'j901', fromStatus: 'working', toStatus: 'billed', changedAt: at('2026-07-20') },
    { jobId: 'j944', fromStatus: 'waiting', toStatus: 'working', changedAt: at('2026-09-29') },
    { jobId: 'j350', fromStatus: 'working', toStatus: 'billed', changedAt: at('2026-08-10') },
  ]
  input.invoices = [
    { id: 'inv612', jobId: 'j612', status: 'paid', amount: 18400, billedAt: at('2025-04-01'), sentToCustomerAt: null, channel: 'stripe' },
    { id: 'inv688', jobId: 'j688', status: 'paid', amount: 9850, billedAt: at('2025-08-04'), sentToCustomerAt: null, channel: 'stripe' },
    { id: 'inv901a', jobId: 'j901', status: 'paid', amount: 22000, billedAt: at('2026-05-05'), sentToCustomerAt: null, channel: 'stripe' },
    { id: 'inv901b', jobId: 'j901', status: 'billed', amount: 31250, billedAt: at('2026-07-20'), sentToCustomerAt: at('2026-09-02'), channel: 'stripe' },
    { id: 'inv350', jobId: 'j350', status: 'billed', amount: 2400, billedAt: at('2026-08-10'), sentToCustomerAt: null, channel: 'stripe' },
  ]
  const pay = (id: string, jobId: string, invoiceId: string | null, amount: number, paidOn: string, paymentType: string | null, ref: string | null, deposit: string | null) => ({
    id,
    jobId,
    invoiceId,
    amount,
    paidOn,
    paymentType,
    referenceNumber: ref,
    depositPostedAt: deposit ? at(deposit) : null,
    depositFrom: deposit ? 'Ridgeway Builders' : null,
  })
  input.payments = [
    pay('p612', 'j612', 'inv612', 18400, '2025-04-28', 'check', '3612', '2025-05-01'),
    pay('p688a', 'j688', 'inv688', 5000, '2025-09-02', 'ach', null, null),
    pay('p688b', 'j688', 'inv688', 4850, '2025-11-17', 'check', '3980', '2025-11-17'),
    pay('p200', 'j200', null, 6200, '2025-10-10', null, null, null),
    pay('p901', 'j901', 'inv901a', 22000, '2026-06-01', 'checkDeposit', '4471', '2026-06-03'),
  ]
  input.clockSessions = [
    session('s1', 'j612', '2025-02-10', 8),
    session('s2', 'j612', '2025-03-27', 6, 'Ben Ortiz'),
    session('s3', 'j688', '2025-07-07', 8),
    session('s4', 'j688', '2025-07-30', 8),
    session('s5', 'j901', '2026-03-16', 8, 'Ana Ruiz', 'Under-slab starts.'),
    session('s6', 'j901', '2026-03-17', 8),
    session('s7', 'j901', '2026-03-20', 6, 'Ben Ortiz', 'Under-slab passed.'),
    session('s8', 'j901', '2026-07-16', 4.5),
    session('s9', 'j944', '2026-09-29', 3, 'Ana Ruiz', 'Waiting on the regulator.'),
    session('s10', 'j944', '2026-10-03', 14 / 3),
    session('s11', 'j944', '2026-10-03', 14 / 3, 'Ben Ortiz'),
    session('s12', 'j944', '2026-10-05', 43 / 6, 'Ana Ruiz', 'Set the regulator. Test tomorrow.'),
  ]
  input.supplyTickets = [
    { id: 't1', jobId: 'j612', invoiceDate: '2025-02-12', amount: 612.5, supplyHouse: 'Ferguson', invoiceNumber: 'F-1' },
    { id: 't2', jobId: 'j901', invoiceDate: '2026-03-20', amount: 6210, supplyHouse: 'Ferguson', invoiceNumber: 'F-2' },
    { id: 't3', jobId: 'j901', invoiceDate: '2026-05-12', amount: 2730, supplyHouse: 'Winsupply', invoiceNumber: 'W-3' },
    { id: 't4', jobId: 'j944', invoiceDate: '2026-09-30', amount: 610, supplyHouse: 'Ferguson', invoiceNumber: 'F-4' },
  ]
  input.notes = [
    { id: 'n1', jobId: 'j612', body: 'GC moved the break-room wall. Re-ran the vent.', createdAt: at('2025-02-14'), authorName: 'Ben Ortiz', authorRole: 'master_technician' },
    { id: 'n2', jobId: 'j901', body: 'Change order #2 approved.', createdAt: at('2026-07-09'), authorName: 'Cora Lane', authorRole: 'assistant' },
    { id: 'n3', jobId: 'j901', body: 'lien', createdAt: at('2026-09-21'), authorName: 'Cora Lane', authorRole: 'assistant' },
    { id: 'n4', jobId: 'j350', body: 'lien', createdAt: at('2026-09-21', '15:01'), authorName: 'Cora Lane', authorRole: 'assistant' },
    { id: 'n5', jobId: 'j944', body: 'lien', createdAt: at('2026-09-21', '15:02'), authorName: 'Cora Lane', authorRole: 'assistant' },
  ]
  input.testReports = [{ id: 'tr1', jobId: 'j944', testDate: '2026-10-03', createdAt: at('2026-10-03'), testType: 'gas', result: 'passed', system: 'clinic gas line' }]
  input.promises = [{ id: 'pr1', jobId: 'j901', createdAt: at('2026-10-06'), promisedDate: '2026-10-15', note: 'Check run is on the 15th.', saidBy: 'Dana' }]
  input.statements = [{ id: 'st1', sentAt: at('2026-09-02', '16:00'), sentByName: 'Cora Lane', jobCount: 2, total: 33650 }]
  input.lienFilings = [
    { id: 'lf1', jobId: 'j901', kind: 'notice_53_056', createdAt: at('2026-09-15'), amount: 31250, sends: [{ method: 'certified_mail', recipient: 'owner', sentOn: '2026-09-15' }] },
  ]
  return input
}

const build = (input: CustomerTimelineInput = ridgeway()): CustomerTimeline => buildCustomerTimeline(input, TODAY, NOW)

type DayRow = Extract<TimelineRow, { kind: 'day' }>
function day(t: CustomerTimeline, ymd: string): DayRow {
  const row = t.rows.find((r): r is DayRow => r.kind === 'day' && r.ymd === ymd)
  if (!row) throw new Error(`no day row ${ymd}`)
  return row
}
const cards = (row: DayRow): TimelineCard[] => [...row.office, ...row.field]
const jobOf = (t: CustomerTimeline, id: string) => {
  const j = t.jobs.find((x) => x.id === id)
  if (!j) throw new Error(`no job ${id}`)
  return j
}

describe('words', () => {
  it('reads a date column as its own day and an instant in the company calendar', () => {
    expect(timelineDayOfDate('2026-06-11')).toBe('2026-06-11')
    expect(timelineDayOfDate(null)).toBe('')
    // 9 PM Central on May 5 is May 6 in UTC.
    expect(timelineDayOfInstant('2026-05-06T02:00:00Z')).toBe('2026-05-05')
  })

  it('names a job by its street when the name only repeats the customer, the payer or the GC', () => {
    expect(timelineJobLabel('Ridgeway Builders', '77 Pecan St, Kyle, TX', ['Ridgeway Builders'])).toBe('77 Pecan St')
    expect(timelineJobLabel('Ridgeway', '77 Pecan St, Kyle, TX', ['RMC- Ridgeway Builders'])).toBe('77 Pecan St')
    // On the owner's timeline, a job named after its GC.
    expect(timelineJobLabel('Ridgeway Builders', '77 Pecan St, Kyle, TX', ['Lee Park', 'Lee Park', 'RMC- Ridgeway Builders'])).toBe('77 Pecan St')
    expect(timelineJobLabel('Ridgeway - Pecan St', '77 Pecan St, Kyle, TX', ['Ridgeway Builders'])).toBe('Ridgeway - Pecan St')
    expect(timelineJobLabel('Bluff Springs clinic', '12 Bluff Springs Rd, Austin', ['Ridgeway Builders'])).toBe('Bluff Springs clinic')
    expect(timelineJobLabel(null, null, ['Ridgeway Builders'])).toBe('job')
  })

  it('titles a payment by its kind and a check by its number', () => {
    expect(timelinePaymentTitle('checkDeposit', '4471')).toBe('Check #4471')
    expect(timelinePaymentTitle('Cheque', '6dc77af0-3aa5-11f1-88ca-87d4bee5f4b0')).toBe('Check')
    expect(timelinePaymentTitle('ach', null)).toBe('ACH')
    expect(timelinePaymentTitle(null, null)).toBe('Payment')
  })

  it('says spans, money and hours the way the cards do', () => {
    expect(timelineSpanWords(9)).toBe('9 days')
    expect(timelineSpanWords(44)).toBe('6 weeks')
    expect(timelineSpanWords(105)).toBe('4 months')
    expect(timelineMoney(31250)).toBe('$31,250')
    expect(timelineMoney(612.5)).toBe('$613')
    expect(timelineMoney(45.5)).toBe('$45.50')
    expect(timelineHoursWords(70.77)).toBe('70h 46m')
  })

  it('puts the people doing the work on the field side and everyone else on the office side', () => {
    expect(timelineNoteSide('helpers')).toBe('field')
    expect(timelineNoteSide('master_technician')).toBe('field')
    expect(timelineNoteSide('assistant')).toBe('office')
    expect(timelineNoteSide(null)).toBe('office')
  })
})

describe('the jobs', () => {
  it('follows the GC link as well as the payer, and names who pays on a GC job', () => {
    const t = build()
    const gcJob = jobOf(t, 'j350')
    expect(gcJob.role).toBe('gc')
    expect(gcJob.payerName).toBe('Lee Park')
    expect(gcJob.label).toBe('77 Pecan St')
    expect(jobOf(t, 'j901').payerName).toBeNull()
  })

  it('starts an imported job at its first record, and closes a job on its last move to paid', () => {
    const t = build()
    const imported = jobOf(t, 'j200')
    expect(imported.firstSeenYmd).toBe('2025-10-10')
    expect(imported.imported).toBe(true)
    expect(imported.paidYmd).toBe('2025-10-10')
    const start = cards(day(t, '2025-10-10')).find((c) => c.kind === 'start')
    expect(start?.title).toBe('First record')
    expect(start?.lines).toEqual(['$6,200 job', 'card made Feb 26'])
    expect(jobOf(t, 'j612').paidYmd).toBe('2025-05-01')
    expect(jobOf(t, 'j612').imported).toBe(false)
  })

  it('ranks open jobs by what they owe, then paid jobs newest first, and packs paid history into free lanes', () => {
    const t = build()
    expect(t.jobs.map((j) => j.id)).toEqual(['j901', 'j350', 'j944', 'j688', 'j200', 'j612'])
    expect(t.jobs.map((j) => j.lane)).toEqual([0, 1, 2, 0, 1, 0])
    expect(t.laneCount).toBe(3)
    expect(t.hasOtherLane).toBe(false)
    // Jobs open at the same time never share a color.
    expect(t.jobs.map((j) => j.colorIndex)).toEqual([0, 1, 2, 3, 4, 5])
    expect(t.openToday.map((c) => c?.jobId ?? null)).toEqual(['j901', 'j350', 'j944'])
  })

  it('sends the jobs past four lanes to one grey lane', () => {
    const input = emptyCustomerTimelineInput(CUST)
    // Six open jobs at once; f is the quietest, so it rides the grey lane with e.
    input.jobs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => job({ id, hcpNumber: id, revenue: 1000, createdAt: at('2026-09-01') }))
    input.notes = [
      ...['a', 'b', 'c', 'd', 'e'].flatMap((id) => [
        { id: `n1${id}`, jobId: id, body: 'first', createdAt: at('2026-09-05'), authorName: 'Cora Lane', authorRole: 'assistant' },
        { id: `n2${id}`, jobId: id, body: 'second', createdAt: at('2026-09-06'), authorName: 'Cora Lane', authorRole: 'assistant' },
      ]),
      { id: 'nf', jobId: 'f', body: 'on the grey lane', createdAt: at('2026-09-10'), authorName: 'Cora Lane', authorRole: 'assistant' },
    ]
    const t = build(input)
    expect(t.laneCount).toBe(4)
    expect(t.hasOtherLane).toBe(true)
    expect(t.otherJobCount).toBe(2)
    expect(t.jobs.filter((j) => j.lane == null).map((j) => j.id)).toEqual(['e', 'f'])
    const lanes = day(t, '2026-09-10').lanes
    expect(lanes).toHaveLength(5)
    expect(lanes[4]).toMatchObject({ jobId: null, state: 'other', mark: 'dot' })
  })
})

describe('the rails', () => {
  it('opens a rail at the first record and closes it on the paid day', () => {
    const t = build()
    expect(day(t, '2025-02-03').lanes[0]).toMatchObject({ jobId: 'j612', extent: 'top', mark: 'start', state: 'working' })
    expect(day(t, '2025-05-01').lanes[0]).toMatchObject({ jobId: 'j612', extent: 'bottom', mark: 'end', state: 'billed' })
    // Made and paid the same day: the node alone.
    expect(day(t, '2025-10-10').lanes[1]).toMatchObject({ jobId: 'j200', extent: 'none', mark: 'end' })
  })

  it('reads the state of each day and marks the jobs a day touches', () => {
    const t = build()
    expect(day(t, '2026-07-20').lanes[0]).toMatchObject({ jobId: 'j901', state: 'billed', mark: 'dot' })
    expect(day(t, '2026-07-09').lanes[0]).toMatchObject({ jobId: 'j901', state: 'working', mark: 'dot' })
    const sep21 = day(t, '2026-09-21')
    expect(sep21.lanes.map((c) => c?.mark)).toEqual(['dot', 'dot', 'dot'])
    expect(sep21.lanes[1]).toMatchObject({ jobId: 'j350', state: 'collections' })
    expect(day(t, '2026-09-08').lanes[2]).toMatchObject({ jobId: 'j944', mark: 'start', state: 'waiting' })
  })
})

describe('the cards', () => {
  it('says when a payment came, how long after the bill, and where it was deposited', () => {
    const t = build()
    const check = day(t, '2026-06-01').office.find((c) => c.kind === 'payment')
    expect(check).toMatchObject({ title: 'Check #4471', amount: 22000, jobId: 'j901' })
    expect(check?.lines).toEqual(['27 days after the bill', 'deposited Jun 3', 'from Ridgeway Builders'])
    expect(day(t, '2025-11-17').office.find((c) => c.kind === 'payment')?.title).toBe('Check #3980 · paid in full')
    // Paid in full on a day with no payment: its own card.
    expect(day(t, '2025-05-01').office.map((c) => c.title)).toContain('Paid in full')
    expect(day(t, '2025-10-10').office.find((c) => c.kind === 'payment')?.lines).toContain('not tied to a bill')
  })

  it('shows a bill, its later send, the promise, the statement and the notice on the office side', () => {
    const t = build()
    expect(day(t, '2026-07-20').office.find((c) => c.kind === 'bill')).toMatchObject({ amount: 31250, lines: ['Stripe bill', 'open'] })
    expect(day(t, '2026-09-02').office.find((c) => c.kind === 'billSent')?.lines).toEqual(['44 days after it was billed'])
    expect(day(t, '2026-09-02').office.find((c) => c.kind === 'statement')).toMatchObject({ title: 'GC statement sent', amount: 33650, jobId: null })
    expect(day(t, '2026-10-06').office[0]).toMatchObject({ kind: 'promise', title: 'They said Oct 15', quote: 'Check run is on the 15th.', by: 'Dana' })
    expect(day(t, '2026-09-15').office[0]).toMatchObject({ kind: 'lien', title: 'Notice of unpaid balance mailed', lines: ['certified mail', 'to the owner'] })
    expect(day(t, '2026-09-20').office[0]).toMatchObject({ kind: 'collections', quote: 'Owner says the GC owes it.' })
  })

  it('folds a job’s crew days between office cards, and breaks on a long pause', () => {
    const t = build()
    const addOn = day(t, '2026-10-05').field.find((c) => c.kind === 'hours')
    expect(addOn).toMatchObject({ jobId: 'j944', title: '19h 30m', quote: 'Set the regulator. Test tomorrow.' })
    expect(addOn?.hours).toMatchObject({ days: 3, fromYmd: '2026-09-29', toYmd: '2026-10-05', crew: ['Ana', 'Ben'] })
    expect(addOn?.lines).toEqual(['Sep 29 → Oct 5 · 3 work days'])
    const slab = day(t, '2026-03-20').field.find((c) => c.kind === 'hours')
    expect(slab).toMatchObject({ title: '22h 00m', quote: 'Under-slab passed.' })
    expect(slab?.lines).toEqual(['Mar 16 → Mar 20 · 3 work days', "83% of the job's hours"])
    expect(day(t, '2026-07-16').field[0]).toMatchObject({ kind: 'hours', title: '4h 30m', lines: ['one day', "17% of the job's hours"] })
    expect(t.rows.some((r) => r.kind === 'day' && r.ymd === '2026-09-29')).toBe(false)
  })

  it('folds the same note on three jobs into one card with the words once', () => {
    const t = build()
    const sep21 = day(t, '2026-09-21')
    expect(sep21.office).toHaveLength(1)
    expect(sep21.office[0]).toMatchObject({ kind: 'note', title: '3 notes', by: 'Cora Lane', quote: 'lien', jobId: null })
    expect(sep21.office[0]?.lines).toEqual(['the same words on 3 jobs'])
    expect(sep21.office[0]?.items).toEqual(['901 · Bluff Springs clinic, 350 · 77 Pecan St, 944 · Clinic add-on'])
    expect(new Set(sep21.jobIds)).toEqual(new Set(['j901', 'j350', 'j944']))
  })

  it('folds different notes, three bills on one day, and one notice step on two jobs', () => {
    const input = emptyCustomerTimelineInput(CUST)
    input.jobs = ['a', 'b', 'c'].map((id) => job({ id, hcpNumber: id, jobName: `Job ${id}`, status: 'billed', revenue: 1000, createdAt: at('2026-08-01') }))
    input.notes = ['a', 'b', 'c'].map((id) => ({ id: `n${id}`, jobId: id, body: `note on ${id}`, createdAt: at('2026-09-01'), authorName: 'Cora Lane', authorRole: 'assistant' }))
    input.invoices = ['a', 'b', 'c'].map((id) => ({ id: `i${id}`, jobId: id, status: 'billed', amount: 1000, billedAt: at('2026-09-03'), sentToCustomerAt: null, channel: null }))
    input.lienFilings = ['a', 'b'].map((id) => ({ id: `f${id}`, jobId: id, kind: 'notice_53_056', createdAt: at('2026-09-20'), amount: 1000, sends: [{ method: 'certified_mail', recipient: 'owner', sentOn: '2026-09-20' }] }))
    const t = build(input)
    expect(day(t, '2026-09-01').office[0]?.items).toEqual(['a · Job a: “note on a”', 'b · Job b: “note on b”', 'c · Job c: “note on c”'])
    expect(day(t, '2026-09-03').office[0]).toMatchObject({ title: '3 bills billed', amount: 3000 })
    expect(day(t, '2026-09-20').office[0]).toMatchObject({ title: 'Notice of unpaid balance mailed · 2 jobs', amount: 2000 })
  })

  it('filters by Money and by Field', () => {
    const t = build()
    const all = t.rows.flatMap((r) => (r.kind === 'day' ? cards(r) : []))
    expect(all.filter((c) => timelineCardShown(c, 'money')).every((c) => c.money)).toBe(true)
    expect(all.filter((c) => timelineCardShown(c, 'field')).every((c) => c.side === 'field')).toBe(true)
    expect(all.find((c) => c.kind === 'note')?.money).toBe(false)
  })
})

describe('the rows', () => {
  it('runs newest first with a month label, a spacer that says how long, and a quiet fold', () => {
    const t = build()
    expect(t.rows[0]).toMatchObject({ kind: 'month', label: 'Oct 2026' })
    expect(t.rows[1]).toMatchObject({ kind: 'day', ymd: '2026-10-06' })
    // Nothing open between last year's trim job and the clinic.
    expect(t.rows.find((r) => r.kind === 'quiet' && r.fromYmd === '2025-11-17')).toMatchObject({ toYmd: '2026-03-02', label: '4 months quiet' })
    // The customer was added months before the first job.
    expect(t.rows.find((r) => r.kind === 'quiet' && r.fromYmd === '2024-11-12')).toBeTruthy()
    expect(t.rows.find((r) => r.kind === 'gap' && r.ymd === '2025-05-01')).toMatchObject({ days: 40, label: '6 weeks' })
    const ymds = t.rows.filter((r): r is DayRow => r.kind === 'day').map((r) => r.ymd)
    expect([...ymds].sort().reverse()).toEqual(ymds)
  })

  it('opens with how long it has been when the newest card is old', () => {
    const t = buildCustomerTimeline(ridgeway(), '2026-11-20', Date.parse('2026-11-20T17:00:00Z'))
    expect(t.rows[0]).toMatchObject({ kind: 'gap', days: 45, label: '6 weeks to today' })
  })
})

describe('the money', () => {
  it('owes what the bill-truth kernel owes: open bills, Collections in', () => {
    const s = build().summary
    expect(s.owed).toBe(33650)
    expect(s.openBillCount).toBe(2)
    expect(s.owedJobCount).toBe(2)
    expect(s.oldestOpenBillDays).toBe(79)
    expect(s.promise).toEqual({ promisedYmd: '2026-10-15', jobId: 'j901', kept: false, broken: false })
    expect(s.notYetBilled).toBe(4200)
    expect(s.notYetBilledJobCount).toBe(1)
    expect(s.booked).toBe(0)
    expect(s.openJobCount).toBe(3)
    expect(s.paidJobCount).toBe(3)
    expect(s.daysToPay?.samples).toBe(2)
  })

  it('counts the hours and supply tickets on jobs not yet paid in full', () => {
    const s = build().summary
    expect(s.unpaidHours).toBeCloseTo(46, 5)
    expect(s.unpaidCrewDays).toBe(7)
    expect(s.unpaidHoursJobCount).toBe(2)
    expect(s.unpaidMaterials).toBe(9550)
    expect(s.unpaidTicketCount).toBe(3)
  })

  it('replays what they owed, and the unpaid work, on any past day', () => {
    const t = build()
    expect(day(t, '2026-05-12').snapshot).toEqual({ owed: 22000, unpaidHours: 22, unpaidMaterials: 8940 })
    expect(day(t, '2026-06-01').snapshot.owed).toBe(0)
    expect(day(t, '2025-09-02').snapshot.owed).toBe(4850)
    // Paid jobs drop out of the unpaid work on their paid day.
    expect(day(t, '2025-05-01').snapshot).toEqual({ owed: 0, unpaidHours: 0, unpaidMaterials: 0 })
  })

  it('leaves a bill the office gave up on out of what they owe, from the day it was marked', () => {
    const input = emptyCustomerTimelineInput(CUST)
    input.jobs = [
      job({
        id: 'u',
        hcpNumber: '77',
        jobName: 'Old house',
        status: 'billed',
        revenue: 900,
        createdAt: at('2026-05-01'),
        collectionsAt: at('2026-07-01'),
        uncollectibleAt: at('2026-09-01'),
        uncollectibleReason: 'Owner moved away.',
      }),
    ]
    input.invoices = [{ id: 'iu', jobId: 'u', status: 'billed', amount: 900, billedAt: at('2026-05-10'), sentToCustomerAt: null, channel: 'stripe' }]
    input.notes = [{ id: 'nu', jobId: 'u', body: 'called', createdAt: at('2026-08-01'), authorName: 'Cora Lane', authorRole: 'assistant' }]
    const t = build(input)
    expect(t.summary.owed).toBe(0)
    expect(day(t, '2026-08-01').snapshot.owed).toBe(900)
    expect(day(t, '2026-09-01').snapshot.owed).toBe(0)
    expect(day(t, '2026-09-01').office[0]).toMatchObject({ kind: 'uncollectible', quote: 'Owner moved away.' })
    expect(day(t, '2026-05-10').office.find((c) => c.kind === 'bill')?.lines).toEqual(['Stripe bill', 'given up on'])
  })

  it('holds a job shell with no dated bill as owed while the job is billed', () => {
    const input = emptyCustomerTimelineInput(CUST)
    input.jobs = [job({ id: 'sh', hcpNumber: '60', status: 'billed', revenue: 1500, paymentsMade: 500, createdAt: at('2026-06-01') })]
    input.statusEvents = [{ jobId: 'sh', fromStatus: 'working', toStatus: 'billed', changedAt: at('2026-06-10') }]
    input.payments = [{ id: 'ps', jobId: 'sh', invoiceId: null, amount: 500, paidOn: '2026-07-01', paymentType: 'check', referenceNumber: '12', depositPostedAt: null, depositFrom: null }]
    const t = build(input)
    expect(t.summary.owed).toBe(1000)
    expect(day(t, '2026-06-10').office[0]).toMatchObject({ kind: 'bill', title: 'Marked billed', amount: 1500, lines: ['no bill line'] })
    expect(day(t, '2026-06-10').snapshot.owed).toBe(1500)
    expect(day(t, '2026-07-01').snapshot.owed).toBe(1000)
    expect(day(t, '2026-06-01').snapshot.owed).toBe(0)
  })
})
