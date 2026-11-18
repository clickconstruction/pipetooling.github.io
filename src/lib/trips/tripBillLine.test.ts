import { describe, expect, it } from 'vitest'
import {
  canPutTripOnBill,
  lineTripDoors,
  lineTripIds,
  tripDeleteLineWords,
  tripSheetLineNote,
  parseTripBillLineReply,
  parseTripLineAmount,
  tripAlreadyOnLinesWords,
  tripBillJobChoices,
  tripBillLineFromRow,
  tripBillLinesByTrip,
  tripBillStanding,
  tripBillTotalsWords,
  tripBillWindowState,
  tripBillWindowTitle,
  tripDollars,
  tripLineName,
  tripLineWords,
  tripOnLinesWords,
  tripPutOnBillShows,
  TRIP_LINE_NAME_MAX,
  type TripBillLine,
  type TripBillLineRow,
} from './tripBillLine'
import type { TripRecord, TripRecordPerson } from './tripRecord'

// Every site, person, job, date and figure here is made up.
const TODAY = '2026-11-18'
const person = (name: string, days: Record<string, 'ready' | 'road' | 'site'>): TripRecordPerson => ({ personId: null, userId: null, name, days })
const trip = (over: Partial<TripRecord> = {}): TripRecord => ({
  id: 't-14',
  tripNumber: 14,
  developmentId: 'dev-1',
  jobId: null,
  purpose: 'Reset the riser the framers moved',
  askedBy: 'them',
  askedWho: 'Walt',
  askedHow: 'by phone',
  outcome: '',
  billing: 'extra',
  via: 'app',
  people: [person('Dana', { '2026-11-02': 'road', '2026-11-03': 'site' }), person('Luis', { '2026-11-03': 'site' }), person('Omar', { '2026-11-03': 'site' }), person('Priya', { '2026-11-08': 'road' })],
  jobIds: ['job-1'],
  createdAt: null,
  ...over,
})
const line = (over: Partial<TripBillLine> = {}): TripBillLine => ({ fixtureId: 'fx-1', tripId: 't-14', jobId: 'job-1', amount: 6800, invoiceStatus: null, ...over })
const row = (over: Partial<TripBillLineRow> = {}): TripBillLineRow => ({ id: 'fx-1', trip_id: 't-14', job_id: 'job-1', count: 1, line_unit_price: 6800, invoice_id: null, jobs_ledger_invoices: null, ...over })
const JOBS = [
  { id: 'job-1', label: 'J2101', name: 'Heron Point Clubhouse' },
  { id: 'job-2', label: 'J2140', name: 'Heron Point Pool House' },
]

describe('who may put a trip on a bill', () => {
  it('the four roles that may add a discount to a job, and nobody else', () => {
    expect(['dev', 'master_technician', 'assistant', 'controller'].map(canPutTripOnBill)).toEqual([true, true, true, true])
    expect(['primary', 'superintendent', 'helpers', 'estimator', 'subcontractor', '', null, undefined].map(canPutTripOnBill)).toEqual([false, false, false, false, false, false, false, false])
  })
})

describe('tripLineName', () => {
  it('says the number, the crew and the days', () => {
    expect(tripLineName(trip(), TODAY)).toBe('Trip 14, crew of 4, Nov 2 to 8')
  })

  it('one person is a person, not a crew, and one day is one day', () => {
    expect(tripLineName(trip({ people: [person('Dana', { '2026-11-03': 'site' })] }), TODAY)).toBe('Trip 14, 1 person, Nov 3')
  })

  it('a trip across a month end names both months', () => {
    expect(tripLineName(trip({ people: [person('Dana', { '2026-10-30': 'road', '2026-11-02': 'site' }), person('Luis', { '2026-11-02': 'site' })] }), TODAY)).toBe('Trip 14, crew of 2, Oct 30 to Nov 2')
  })

  it('a trip made before numbers is told by its days', () => {
    expect(tripLineName(trip({ tripNumber: null }), TODAY)).toBe('Trip of Nov 2 to 8, crew of 4')
  })

  it('a person with no name is not counted, and a trip with no day still has a name', () => {
    expect(tripLineName(trip({ people: [person('Dana', { '2026-11-03': 'site' }), person('  ', {})] }), TODAY)).toBe('Trip 14, 1 person, Nov 3')
    expect(tripLineName(trip({ tripNumber: null, people: [] }), TODAY)).toBe('Trip')
  })

  it('never passes the line’s own length', () => {
    expect(tripLineName(trip(), TODAY).length).toBeLessThanOrEqual(TRIP_LINE_NAME_MAX)
  })
})

describe('tripLineWords', () => {
  it('says what the trip was for and who asked', () => {
    expect(tripLineWords(trip())).toBe('Reset the riser the framers moved. Asked by Walt, by phone.')
  })

  it('keeps the purpose’s own full stop, and says how alone when nobody wrote who', () => {
    expect(tripLineWords(trip({ purpose: 'Reset the riser.', askedWho: '  ' }))).toBe('Reset the riser. Asked by phone.')
    expect(tripLineWords(trip({ askedHow: '' }))).toBe('Reset the riser the framers moved. Asked by Walt.')
  })

  it('names nobody on a trip we asked for, or one nobody has said about', () => {
    expect(tripLineWords(trip({ askedBy: 'us', askedWho: 'Walt', askedHow: 'by phone' }))).toBe('Reset the riser the framers moved.')
    expect(tripLineWords(trip({ askedBy: null }))).toBe('Reset the riser the framers moved.')
  })

  it('is empty when nothing was written', () => {
    expect(tripLineWords(trip({ purpose: ' ', askedBy: null }))).toBe('')
  })
})

describe('a trip’s line, read back', () => {
  it('a line on no bill', () => {
    expect(tripBillLineFromRow(row())).toEqual({ fixtureId: 'fx-1', tripId: 't-14', jobId: 'job-1', amount: 6800, invoiceStatus: null })
  })

  it('the bill’s status rides along, and a bill whose status did not come back still reads billed', () => {
    expect(tripBillLineFromRow(row({ invoice_id: 'inv-1', jobs_ledger_invoices: { status: 'ready_to_bill' } }))?.invoiceStatus).toBe('ready_to_bill')
    expect(tripBillLineFromRow(row({ invoice_id: 'inv-1', jobs_ledger_invoices: null }))?.invoiceStatus).toBe('billed')
  })

  it('the amount is count times price, from a number or text, and unknown with no price', () => {
    expect(tripBillLineFromRow(row({ count: 2, line_unit_price: '3400.25' }))?.amount).toBe(6800.5)
    expect(tripBillLineFromRow(row({ count: 0, line_unit_price: 100 }))?.amount).toBe(100)
    expect(tripBillLineFromRow(row({ line_unit_price: null }))?.amount).toBeNull()
  })

  it('a line with no trip is not a trip’s line', () => {
    expect(tripBillLineFromRow(row({ trip_id: null }))).toBeNull()
    expect([...tripBillLinesByTrip([row(), row({ id: 'fx-2', trip_id: null }), row({ id: 'fx-3', trip_id: 't-15', job_id: 'job-2' })]).keys()]).toEqual(['t-14', 't-15'])
  })
})

describe('tripBillStanding: where the trip’s money stands', () => {
  const standing = (over: Partial<Parameters<typeof tripBillStanding>[0]> = {}) => tripBillStanding({ billing: 'extra', line: null, linesRead: true, jobShort: 'J2101', ...over })

  it('walks from not billed to paid', () => {
    expect(standing()?.words).toBe('Extra · not billed yet')
    expect(standing({ line: line() })?.words).toBe('Extra · on J2101’s lines, on no bill yet')
    expect(standing({ line: line({ invoiceStatus: 'ready_to_bill' }) })?.words).toBe('Extra · on a bill, not sent')
    expect(standing({ line: line({ invoiceStatus: 'billed' }) })?.words).toBe('Extra · billed')
    expect(standing({ line: line({ invoiceStatus: 'paid' }) })?.words).toBe('Extra · paid')
    expect([standing(), standing({ line: line() }), standing({ line: line({ invoiceStatus: 'ready_to_bill' }) }), standing({ line: line({ invoiceStatus: 'billed' }) }), standing({ line: line({ invoiceStatus: 'paid' }) })].map((s) => s?.kind)).toEqual(['not_billed', 'on_lines', 'on_bill', 'billed', 'paid'])
  })

  it('a status it does not know still reads billed: the line is on a bill', () => {
    expect(standing({ line: line({ invoiceStatus: 'uncollectible' }) })?.kind).toBe('billed')
  })

  it('a trip with a line has a door to it and the line’s figure; a trip with none has neither', () => {
    expect(standing({ line: line() })).toMatchObject({ door: 'Open J2101 on Bill', figure: '$6,800 · line' })
    expect(standing({ line: line({ amount: null }) })?.figure).toBeNull()
    expect(standing()).toMatchObject({ door: null, figure: null })
  })

  it('a job name that ends in s takes the apostrophe alone, and a job nobody can name is the job', () => {
    expect(standing({ line: line(), jobShort: 'Willows' })?.words).toBe('Extra · on Willows’ lines, on no bill yet')
    expect(standing({ line: line(), jobShort: null })).toMatchObject({ words: 'Extra · on a job’s lines, on no bill yet', door: 'Open the job on Bill' })
  })

  it('a trip moved off Extra still reads its line', () => {
    expect(standing({ billing: 'inside', line: line() })?.words).toBe('Inside the price · on J2101’s lines, on no bill yet')
    expect(standing({ billing: null, line: line({ invoiceStatus: 'paid' }) })?.words).toBe('No billing said · paid')
  })

  it('says nothing for a trip that is not Extra and holds no line, or while the lines are not read', () => {
    expect(standing({ billing: 'inside' })).toBeNull()
    expect(standing({ billing: 'ours' })).toBeNull()
    expect(standing({ billing: null })).toBeNull()
    expect(standing({ linesRead: false })).toBeNull()
  })
})

describe('tripPutOnBillShows', () => {
  const shows = (over: Partial<Parameters<typeof tripPutOnBillShows>[0]> = {}) => tripPutOnBillShows({ billing: 'extra', standing: 'back', role: 'assistant', line: null, linesRead: true, ...over })

  it('shows on an Extra trip that is out now or back, to the office', () => {
    expect(shows()).toBe(true)
    expect(shows({ standing: 'out' })).toBe(true)
  })

  it('never on a planned trip, a trip that is not Extra, or one that already holds a line', () => {
    expect(shows({ standing: 'planned' })).toBe(false)
    expect(shows({ billing: 'inside' })).toBe(false)
    expect(shows({ billing: 'ours' })).toBe(false)
    expect(shows({ billing: null })).toBe(false)
    expect(shows({ line: line() })).toBe(false)
  })

  it('never to a role outside the four, and not before the lines are read', () => {
    expect(shows({ role: 'primary' })).toBe(false)
    expect(shows({ role: 'superintendent' })).toBe(false)
    expect(shows({ role: null })).toBe(false)
    expect(shows({ linesRead: false })).toBe(false)
  })
})

describe('tripBillJobChoices', () => {
  it('a trip on one job picks it', () => {
    expect(tripBillJobChoices({ tripJobIds: ['job-1'], siteJobs: JOBS, siteName: 'Heron Point' })).toMatchObject({ jobs: [JOBS[0]], picked: 'job-1', noneWords: null })
  })

  it('a trip on two jobs offers the two, and the office picks', () => {
    expect(tripBillJobChoices({ tripJobIds: ['job-2', 'job-1', 'job-2'], siteJobs: JOBS, siteName: 'Heron Point' })).toMatchObject({ jobs: [JOBS[1], JOBS[0]], picked: null, askWords: 'Pick one of the trip’s jobs' })
  })

  it('a trip with no job named offers the site’s jobs', () => {
    expect(tripBillJobChoices({ tripJobIds: [], siteJobs: JOBS, siteName: 'Heron Point' })).toMatchObject({ jobs: JOBS, picked: null, askWords: 'Pick one of Heron Point’s jobs' })
    expect(tripBillJobChoices({ tripJobIds: [], siteJobs: JOBS, siteName: 'The Willows' }).askWords).toBe('Pick one of The Willows’ jobs')
    expect(tripBillJobChoices({ tripJobIds: [], siteJobs: JOBS, siteName: ' ' }).askWords).toBe('Pick one of the site’s jobs')
  })

  it('a job no longer on the site is left out, and a trip whose jobs all left offers the site’s', () => {
    expect(tripBillJobChoices({ tripJobIds: ['job-gone', 'job-2'], siteJobs: JOBS, siteName: 'Heron Point' })).toMatchObject({ jobs: [JOBS[1]], picked: 'job-2' })
    expect(tripBillJobChoices({ tripJobIds: ['job-gone'], siteJobs: JOBS, siteName: 'Heron Point' })).toMatchObject({ jobs: JOBS, picked: null })
  })

  it('a site with one job picks it, and a site with none says so', () => {
    expect(tripBillJobChoices({ tripJobIds: [], siteJobs: [JOBS[0]!], siteName: 'Heron Point' }).picked).toBe('job-1')
    expect(tripBillJobChoices({ tripJobIds: [], siteJobs: [], siteName: 'Heron Point' })).toMatchObject({ jobs: [], picked: null, noneWords: 'This site has no job yet. Add a job first, then put the trip on its lines.' })
  })
})

describe('the amount', () => {
  it('reads plain dollars, with a sign, commas and cents', () => {
    expect([parseTripLineAmount('6800'), parseTripLineAmount('$6,800.00'), parseTripLineAmount(' 6,800.5 '), parseTripLineAmount('0')]).toEqual([6800, 6800, 6800.5, 0])
  })

  it('reads nothing else', () => {
    expect(['', 'abc', '-50', '6800.123', '6.8k', '1e5'].map(parseTripLineAmount)).toEqual([null, null, null, null, null, null])
  })

  it('says dollars whole, and with cents when there are some', () => {
    expect([tripDollars(6800), tripDollars(6800.5), tripDollars(184000), tripDollars(0)]).toEqual(['$6,800', '$6,800.50', '$184,000', '$0'])
  })
})

describe('tripBillWindowState: the button names the act and its figure', () => {
  const state = (over: Partial<Parameters<typeof tripBillWindowState>[0]> = {}) => tripBillWindowState({ jobId: 'job-1', amountTyped: '6,800.00', name: 'Trip 14, crew of 4, Nov 2 to 8', askWords: 'Pick one of Heron Point’s jobs', ...over })

  it('ready: the figure is on the button and nothing is wrong', () => {
    expect(state()).toEqual({ amount: 6800, confirmLabel: 'Add the line · $6,800', problem: null })
    expect(state({ amountTyped: '6800.5' }).confirmLabel).toBe('Add the line · $6,800.50')
  })

  it('dead until a job is picked, and says so in the pick’s own words', () => {
    expect(state({ jobId: null })).toMatchObject({ confirmLabel: 'Add the line · $6,800', problem: 'Pick one of Heron Point’s jobs.' })
  })

  it('dead with no amount, an amount that is not money, nothing, or too much', () => {
    expect(state({ amountTyped: ' ' })).toEqual({ amount: null, confirmLabel: 'Add the line', problem: 'Type the amount.' })
    expect(state({ amountTyped: 'lots' }).problem).toBe('The amount is dollars and cents, such as 6,800.00.')
    expect(state({ amountTyped: '0' })).toEqual({ amount: null, confirmLabel: 'Add the line', problem: 'The amount has to be more than nothing.' })
    expect(state({ amountTyped: '1,000,000.01' })).toEqual({ amount: null, confirmLabel: 'Add the line', problem: 'That amount is over $1,000,000. Check it.' })
    expect(state({ amountTyped: '1,000,000' }).problem).toBeNull()
  })

  it('dead with no name', () => {
    expect(state({ name: '  ' }).problem).toBe('Give the line a name.')
  })
})

describe('the window’s words', () => {
  it('the title names the trip and the job', () => {
    expect(tripBillWindowTitle('Trip 14', JOBS[0])).toBe('Put Trip 14 on J2101’s lines')
    expect(tripBillWindowTitle('Trip 14', null)).toBe('Put Trip 14 on a job’s lines')
    expect(tripBillWindowTitle('Trip 14', { id: 'j', label: ' ', name: 'Heron Point Clubhouse' })).toBe('Put Trip 14 on Heron Point Clubhouse’s lines')
  })

  it('what the press says, and what a second press says', () => {
    expect(tripOnLinesWords('Trip 14', JOBS[0])).toBe('Trip 14 is on J2101’s lines.')
    expect(tripOnLinesWords('Trip 14', null)).toBe('Trip 14 is on the job’s lines.')
    expect(tripAlreadyOnLinesWords('Trip 14', JOBS[0])).toBe('Trip 14 is already on J2101’s lines. Nothing was added.')
    expect(tripAlreadyOnLinesWords('Trip 14', undefined)).toBe('Trip 14 is already on a job’s lines. Nothing was added.')
  })
})

describe('the press’s reply', () => {
  it('reads a dry run, a press and a duplicate', () => {
    expect(parseTripBillLineReply({ ok: true, duplicate: false, dry_run: true, fixture_id: null, job_id: 'job-1', revenue_before: 184000, revenue_after: 190800 })).toEqual({ duplicate: false, dryRun: true, fixtureId: null, jobId: 'job-1', revenueBefore: 184000, revenueAfter: 190800 })
    expect(parseTripBillLineReply({ ok: true, duplicate: true, dry_run: false, fixture_id: 'fx-1', job_id: 'job-1', revenue_before: '190800.00', revenue_after: '190800.00' })).toEqual({ duplicate: true, dryRun: false, fixtureId: 'fx-1', jobId: 'job-1', revenueBefore: 190800, revenueAfter: 190800 })
  })

  it('a reply that is not one reads as nothing known', () => {
    expect(parseTripBillLineReply(null)).toEqual({ duplicate: false, dryRun: false, fixtureId: null, jobId: null, revenueBefore: null, revenueAfter: null })
  })

  it('the totals strip says before and after, or nothing while either is unknown', () => {
    expect(tripBillTotalsWords({ revenueBefore: 184000, revenueAfter: 190800 })).toEqual({ before: '$184,000', after: '$190,800' })
    expect(tripBillTotalsWords({ revenueBefore: null, revenueAfter: 190800 })).toBeNull()
  })
})

describe('the door back from a line to its trip', () => {
  const lines = [
    { id: 'fx-bid', trip_id: null },
    { id: 'fx-trip', trip_id: 't-14' },
    { id: 'fx-old', trip_id: 't-9' },
    { id: 'fx-far', trip_id: 't-far' },
    { id: 'fx-closed', trip_id: 't-closed' },
    { id: 'fx-plain' },
  ]
  const trips = [
    { id: 't-14', tripNumber: 14, developmentId: 'dev-1' },
    { id: 't-9', tripNumber: null, developmentId: 'dev-1' },
    { id: 't-far', tripNumber: 2, developmentId: null },
  ]

  it('names the trips a job’s lines came from, each once', () => {
    expect(lineTripIds([...lines, { id: 'fx-again', trip_id: 't-14' }])).toEqual(['t-14', 't-9', 't-far', 't-closed'])
    expect(lineTripIds([{ trip_id: null }, {}])).toEqual([])
  })

  it('gives a line its trip’s door, by the trip’s number, on the trip’s site', () => {
    const doors = lineTripDoors({ lines, trips })
    expect(doors.get('fx-trip')).toEqual({ tripId: 't-14', developmentId: 'dev-1', label: 'Open Trip 14' })
    expect(doors.get('fx-old')).toEqual({ tripId: 't-9', developmentId: 'dev-1', label: 'Open this trip' })
  })

  it('gives no door to a plain line, a line whose trip is kept on a job with no site, or a trip the reader cannot read', () => {
    const doors = lineTripDoors({ lines, trips })
    expect([...doors.keys()]).toEqual(['fx-trip', 'fx-old'])
  })
})

describe('what a trip that holds a line says when it is deleted or its billing is changed', () => {
  it('the delete says the line stays, and that Undo does not tie it back', () => {
    expect(tripDeleteLineWords(line(), 'J2101')).toBe('Its line stays on J2101’s lines, with its words and its price. Undo puts the trip back, but the line is no longer tied to it.')
    expect(tripDeleteLineWords(line(), null)).toBe('Its line stays on the job’s lines, with its words and its price. Undo puts the trip back, but the line is no longer tied to it.')
  })

  it('the sheet says the line stays where it is', () => {
    expect(tripSheetLineNote(line(), 'J2101')).toBe('This trip is on J2101’s lines. Changing the billing leaves the line where it is.')
    expect(tripSheetLineNote(line(), ' ')).toBe('This trip is on a job’s lines. Changing the billing leaves the line where it is.')
  })

  it('a trip with no line adds nothing to either', () => {
    expect(tripDeleteLineWords(null, 'J2101')).toBeNull()
    expect(tripSheetLineNote(null, 'J2101')).toBeNull()
  })
})
