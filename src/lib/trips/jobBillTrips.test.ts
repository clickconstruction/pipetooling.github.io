/**
 * Extra trips on a job's Bill tab: which of a site's trips a job is shown, which have the press, and what each row
 * says. Heron Point's made-up trips.
 */
import { describe, expect, it } from 'vitest'
import { JOB_BILL_TRIPS_NONE_WORDS, jobBillTrips, jobBillTripsReady, seesJobBillTrips } from './jobBillTrips'
import type { TripBillLine } from './tripBillLine'
import { newTripRecord, type TripRecord } from './tripRecord'

const TODAY = '2026-11-18'
const trip = (id: string, tripNumber: number, day: string, over: Partial<TripRecord> = {}): TripRecord => ({
  ...newTripRecord({ id, developmentId: 'd1' }),
  tripNumber,
  purpose: 'Reset the riser the framers moved',
  billing: 'extra',
  jobIds: ['j1'],
  people: [{ personId: null, userId: null, name: 'Luis', days: { [day]: 'site' } }],
  ...over,
})
const line = (tripId: string): TripBillLine => ({ fixtureId: `fx-${tripId}`, tripId, jobId: 'j1', amount: 6800, invoiceStatus: null })
const NONE = new Map<string, TripBillLine>()
const rows = (records: TripRecord[], over: { lines?: Map<string, TripBillLine> | null; role?: string | null; jobId?: string } = {}) =>
  jobBillTrips({ records, jobId: over.jobId ?? 'j1', lines: over.lines === undefined ? NONE : over.lines, role: over.role === undefined ? 'assistant' : over.role, todayYmd: TODAY })

describe('jobBillTrips', () => {
  it('shows an Extra trip that names the job and holds no line, with the press', () => {
    const [row] = rows([trip('t3', 3, '2026-11-09')])
    expect(row).toMatchObject({ id: 't3', name: 'Trip 3 · Nov 9', short: 'Trip 3', why: 'Reset the riser the framers moved', who: 'Luis', state: 'Extra · not billed yet', held: null, namesNoJob: false })
  })

  it('leaves out a trip that is not Extra, one that holds a line, and one that names other jobs alone', () => {
    const records = [trip('inside', 1, '2026-11-02', { billing: 'inside' }), trip('ours', 2, '2026-11-03', { billing: 'ours' }), trip('unsaid', 3, '2026-11-04', { billing: null }), trip('lined', 4, '2026-11-05'), trip('theirs', 5, '2026-11-06', { jobIds: ['j2'] }), trip('mine', 6, '2026-11-07')]
    expect(rows(records, { lines: new Map([['lined', line('lined')]]) }).map((r) => r.id)).toEqual(['mine'])
  })

  it('shows a trip that names no job, and says the press adds this one', () => {
    const [row] = rows([trip('t7', 7, '2026-11-10', { jobIds: [] })])
    expect(row).toMatchObject({ id: 't7', namesNoJob: true, held: null })
  })

  it('shows a trip that names this job among others', () => {
    expect(rows([trip('t8', 8, '2026-11-10', { jobIds: ['j2', 'j1'] })]).map((r) => r.id)).toEqual(['t8'])
    expect(rows([trip('t8', 8, '2026-11-10', { jobIds: ['j2', 'j1'] })], { jobId: 'j3' })).toEqual([])
  })

  it('lists a planned trip with why it has no press', () => {
    const [row] = rows([trip('t9', 9, '2026-12-01')])
    expect(row).toMatchObject({ state: 'Extra · planned', held: 'It can go on a bill once it has gone out.' })
  })

  it('gives a primary the list and no press', () => {
    const [row] = rows([trip('t3', 3, '2026-11-09')], { role: 'primary' })
    expect(row?.held).toBe('The office or a leader puts it on a bill.')
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) expect(rows([trip('t3', 3, '2026-11-09')], { role })[0]?.held).toBeNull()
  })

  it('shows nothing while the lines are not read: a trip that holds a line must not be offered again', () => {
    expect(rows([trip('t3', 3, '2026-11-09')], { lines: null })).toEqual([])
  })

  it('lists the trips oldest first, and counts the ones with a press', () => {
    const list = rows([trip('late', 6, '2026-11-12'), trip('planned', 7, '2026-12-01'), trip('early', 5, '2026-11-02')])
    expect(list.map((r) => r.id)).toEqual(['early', 'late', 'planned'])
    expect(jobBillTripsReady(list)).toBe(2)
  })

  it('says a trip with no purpose is a trip, and names one made before numbers by its days', () => {
    const [row] = rows([trip('old', 0, '2026-11-09', { tripNumber: null, purpose: '  ' })])
    expect(row).toMatchObject({ name: 'Nov 9', why: 'A trip' })
  })

  it('is seen by the roles that read every trip', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'primary']) expect(seesJobBillTrips(role)).toBe(true)
    for (const role of ['superintendent', 'estimator', 'helper', 'subcontractor', null, undefined]) expect(seesJobBillTrips(role)).toBe(false)
  })

  it('says nothing is waiting in the house’s words', () => {
    expect(JOB_BILL_TRIPS_NONE_WORDS).toBe('Nothing waiting on a bill.')
  })
})
