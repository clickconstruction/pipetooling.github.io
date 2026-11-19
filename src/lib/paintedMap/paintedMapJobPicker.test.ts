/**
 * Which job is it for? (punch list #392, step 4): the picker's lists, its words for a day, which
 * jobs a person may paint on, Your last jobs and the job the start sheet opens on with no
 * question. Every job here is made up.
 */
import { describe, expect, it } from 'vitest'
import { PICKER_LAST_MAX, PICKER_LAST_READ, PICKER_NEAR_ADDRESSES, PICKER_NEAR_MAX, PICKER_NEAR_MAX_M, PICKER_NEAR_NO_FIX, PICKER_NEAR_NO_FIX_DESK, PICKER_SOON_MAX, pickerDayPlus, pickerDayWords, pickerGuess, pickerGuessWords, pickerHome, pickerLastOrder, pickerNearBox, pickerNearJobsFilter, pickerNearRows, pickerNearestPlaced, pickerPaintable, pickerPlan, pickerSearchRows, pickerSections, pickerSoonWords, pickerStopWords, type PickerJob, type PickerLast, type PickerSoon } from './paintedMapJobPicker'

const job = (id: string, number: string, name: string, over: Partial<PickerJob> = {}): PickerJob => ({ id, number, name, address: `${number} Made Up Road`, ...over })
const cedar = job('j-cedar', 'J2417', 'Cedar Hollow 12')
const marlowe = job('j-marlowe', 'J2398', 'Marlowe Dental')
const pinto = job('j-pinto', 'J2431', 'Pinto Ridge 3')
const billing = job('j-bill', 'J2000', 'Billing only', { billingOnly: true })
const office = job('j-office', '000', 'Office', { office: true })
const all = new Set([cedar.id, marlowe.id, pinto.id, billing.id, office.id])

describe('pickerDayWords', () => {
  // 2026-11-18 is a Wednesday.
  it('says today, yesterday, a weekday inside a week, then the day', () => {
    expect(pickerDayWords('2026-11-18', '2026-11-18')).toBe('today')
    expect(pickerDayWords('2026-11-17', '2026-11-18')).toBe('yesterday')
    expect(pickerDayWords('2026-11-13', '2026-11-18')).toBe('Friday')
    expect(pickerDayWords('2026-11-12', '2026-11-18')).toBe('Thursday')
    expect(pickerDayWords('2026-11-11', '2026-11-18')).toBe('Nov 11')
    expect(pickerDayWords('2026-10-05', '2026-11-18')).toBe('Oct 5')
  })

  it('crosses a month and a year with no clock', () => {
    expect(pickerDayWords('2026-10-31', '2026-11-01')).toBe('yesterday')
    expect(pickerDayWords('2026-12-31', '2027-01-01')).toBe('yesterday')
  })

  it('says the year of a day in another year, since a last job may be an old one', () => {
    expect(pickerDayWords('2025-11-12', '2026-11-18')).toBe('Nov 12, 2025')
    expect(pickerDayWords('2026-12-20', '2027-01-04')).toBe('Dec 20, 2026')
    expect(pickerDayWords('2026-01-02', '2026-11-18')).toBe('Jan 2')
  })

  it('says nothing for a day that is not one, or one ahead', () => {
    expect(pickerDayWords('', '2026-11-18')).toBe('')
    expect(pickerDayWords('2026-11-19', '2026-11-18')).toBe('')
  })
})

describe('pickerSoonWords', () => {
  const today = '2026-11-19' // a Thursday
  it('says tomorrow, a weekday inside a week, then the day', () => {
    expect(pickerSoonWords('2026-11-20', today)).toBe('tomorrow')
    expect(pickerSoonWords('2026-11-23', today)).toBe('Monday')
    expect(pickerSoonWords('2026-11-25', today)).toBe('Wednesday')
    // A week on is the same weekday as today, so it is said as a day.
    expect(pickerSoonWords('2026-11-26', today)).toBe('Nov 26')
    expect(pickerSoonWords('2027-01-08', '2026-12-30')).toBe('Jan 8, 2027')
  })

  it('says nothing for today, a day behind, or a day that is not one', () => {
    expect(pickerSoonWords(today, today)).toBe('')
    expect(pickerSoonWords('2026-11-18', today)).toBe('')
    expect(pickerSoonWords('soon', today)).toBe('')
  })

  it('counts days on with no clock', () => {
    expect(pickerDayPlus('2026-11-19', 14)).toBe('2026-12-03')
    expect(pickerDayPlus('2026-12-25', 14)).toBe('2027-01-08')
    expect(pickerDayPlus('never', 14)).toBe('')
  })
})

describe('pickerStopWords', () => {
  it('writes a stop time as the app says a time', () => {
    expect(pickerStopWords('07:30:00')).toBe('7:30 AM')
    expect(pickerStopWords('13:00:00')).toBe('1:00 PM')
    expect(pickerStopWords('00:15:00')).toBe('12:15 AM')
    expect(pickerStopWords('12:00:00')).toBe('12:00 PM')
    expect(pickerStopWords('')).toBe('')
  })
})

const clock = (j: PickerJob, day: string): PickerLast => ({ job: j, how: 'clock', day })
const sched = (j: PickerJob, day: string): PickerLast => ({ job: j, how: 'schedule', day })
const changed = (j: PickerJob, day: string): PickerLast => ({ job: j, how: 'changed', day })
const team = (j: PickerJob, joined: string | null = null): PickerLast => ({ job: j, how: 'team', day: joined })
const soonOn = (j: PickerJob, day: string): PickerSoon => ({ job: j, day })
/** The signs as the read hands them on: each job once, in the list's own order. */
const inOrder = (signs: PickerLast[]): PickerLast[] => {
  const jobs = new Map(signs.map((l) => [l.job.id, l.job] as const))
  return pickerLastOrder(signs.map((l) => ({ jobId: l.job.id, how: l.how, day: l.day }))).map((m) => ({ job: jobs.get(m.jobId)!, how: m.how, day: m.day, there: m.there }))
}

describe('pickerLastOrder', () => {
  it('lists the jobs newest first by their newest sign, a team’s being the day the person joined it', () => {
    const got = pickerLastOrder([
      { jobId: 't-old', how: 'team', day: '2026-08-09' },
      { jobId: 'c1', how: 'clock', day: '2026-09-18' },
      { jobId: 's1', how: 'schedule', day: '2026-11-14' },
      { jobId: 't-new', how: 'team', day: '2026-11-18' },
      { jobId: 'c2', how: 'clock', day: '2026-11-17' },
    ])
    // A job the office put the person on last week is above one they clocked onto in September.
    expect(got.map((m) => m.jobId)).toEqual(['t-new', 'c2', 's1', 'c1', 't-old'])
  })

  it('puts a team with no day last, in the order read', () => {
    const got = pickerLastOrder([
      { jobId: 't1', how: 'team', day: null },
      { jobId: 'c1', how: 'clock', day: '2025-03-01' },
      { jobId: 't2', how: 'team', day: null },
    ])
    expect(got.map((m) => m.jobId)).toEqual(['c1', 't1', 't2'])
  })

  it('names each job once by its best sign: a clock or a scheduled day over the team, the later day, a clock on one day', () => {
    const got = pickerLastOrder([
      { jobId: 'a', how: 'team', day: '2026-11-01' },
      { jobId: 'a', how: 'schedule', day: '2026-11-10' },
      { jobId: 'a', how: 'clock', day: '2026-11-10' },
      { jobId: 'b', how: 'clock', day: '2026-10-01' },
      { jobId: 'b', how: 'schedule', day: '2026-11-12' },
      { jobId: 'c', how: 'clock', day: '2026-11-11' },
      { jobId: 'c', how: 'team', day: '2026-11-05' },
    ])
    expect(got.map(({ jobId, how, day }) => ({ jobId, how, day }))).toEqual([
      { jobId: 'b', how: 'schedule', day: '2026-11-12' },
      { jobId: 'c', how: 'clock', day: '2026-11-11' },
      { jobId: 'a', how: 'clock', day: '2026-11-10' },
    ])
  })

  it('places a job by a newer team day and still names it by its clock', () => {
    // Clocked onto in September, put back on the team yesterday: it leads, and it still says the day they were there.
    const got = pickerLastOrder([
      { jobId: 'b', how: 'schedule', day: '2026-11-14' },
      { jobId: 'a', how: 'clock', day: '2026-09-18' },
      { jobId: 'a', how: 'team', day: '2026-11-18' },
    ])
    expect(got.map(({ jobId, how, day }) => ({ jobId, how, day }))).toEqual([
      { jobId: 'a', how: 'clock', day: '2026-09-18' },
      { jobId: 'b', how: 'schedule', day: '2026-11-14' },
    ])
  })

  it('counts a day the person changed the job: it places the job, and names it when it is the later day', () => {
    const got = pickerLastOrder([
      { jobId: 'a', how: 'clock', day: '2026-09-18' },
      { jobId: 'a', how: 'changed', day: '2026-11-18' },
      { jobId: 'b', how: 'schedule', day: '2026-11-14' },
      { jobId: 'c', how: 'changed', day: '2026-11-17' },
      { jobId: 'c', how: 'team', day: '2026-11-18' },
      // One day, three signs: the clock names it.
      { jobId: 'd', how: 'changed', day: '2026-11-10' },
      { jobId: 'd', how: 'schedule', day: '2026-11-10' },
      { jobId: 'd', how: 'clock', day: '2026-11-10' },
    ])
    expect(got.map((m) => [m.jobId, m.how, m.day])).toEqual([
      ['a', 'changed', '2026-11-18'],
      ['c', 'changed', '2026-11-17'],
      ['b', 'schedule', '2026-11-14'],
      ['d', 'clock', '2026-11-10'],
    ])
  })

  it('keeps a job’s newest clock or scheduled day beside its name, for the guess', () => {
    const got = pickerLastOrder([
      { jobId: 'a', how: 'changed', day: '2026-11-18' },
      { jobId: 'a', how: 'clock', day: '2026-09-18' },
      { jobId: 'a', how: 'schedule', day: '2026-11-14' },
      { jobId: 'b', how: 'changed', day: '2026-11-17' },
      { jobId: 'c', how: 'team', day: '2026-11-16' },
    ])
    expect(got.map((m) => [m.jobId, m.how, m.there ?? null])).toEqual([
      ['a', 'changed', { how: 'schedule', day: '2026-11-14' }],
      ['b', 'changed', null],
      ['c', 'team', null],
    ])
  })

  it('takes a clock or a scheduled day that is not a day as no sign, and a job with no id as no job', () => {
    expect(pickerLastOrder([{ jobId: 'a', how: 'clock', day: '' }, { jobId: 'b', how: 'schedule', day: null }, { jobId: '', how: 'team', day: null }])).toEqual([])
    expect(pickerLastOrder([{ jobId: 'a', how: 'team', day: 'soon' }])).toEqual([{ jobId: 'a', how: 'team', day: null }])
  })
})

describe('pickerPlan', () => {
  const none = { todayYmd: '2026-11-19', officeJobId: 'j-office', todayJobIds: [] as string[], clocks: [], blocks: [], changes: [], teams: [] }

  it('splits the schedule at today: days ahead are coming up, days behind are last jobs, and today is neither', () => {
    const got = pickerPlan({
      ...none,
      blocks: [
        { jobId: 'far', day: '2026-11-25' },
        { jobId: 'near', day: '2026-11-21' },
        { jobId: 'near', day: '2026-11-20' },
        { jobId: 'now', day: '2026-11-19' },
        { jobId: 'near', day: '2026-11-14' },
        { jobId: 'old', day: '2026-11-10' },
        { jobId: null, day: '2026-11-20' },
        { jobId: 'bad', day: 'soon' },
      ],
    })
    // Each job once, at its soonest day, soonest first.
    expect(got.soon).toEqual([
      { jobId: 'near', day: '2026-11-20', time: null },
      { jobId: 'far', day: '2026-11-25', time: null },
    ])
    expect(got.order.map((m) => [m.jobId, m.how, m.day])).toEqual([
      ['near', 'schedule', '2026-11-14'],
      ['old', 'schedule', '2026-11-10'],
    ])
  })

  it('puts the jobs of one day ahead in order of start, each at its first stop', () => {
    const got = pickerPlan({
      ...none,
      blocks: [
        { jobId: 'late', day: '2026-11-20', time: '13:00:00' },
        { jobId: 'early', day: '2026-11-20', time: '10:30:00' },
        { jobId: 'early', day: '2026-11-20', time: '07:00:00' },
        { jobId: 'untimed', day: '2026-11-20', time: null },
        { jobId: 'later-day', day: '2026-11-21', time: '06:00:00' },
      ],
    })
    expect(got.soon.map((s) => [s.jobId, s.time])).toEqual([
      ['early', '07:00:00'],
      ['late', '13:00:00'],
      ['untimed', null],
      ['later-day', '06:00:00'],
    ])
  })

  it('reads the four signs together: a change and a team place a job, and a change with no day is no sign', () => {
    const got = pickerPlan({
      ...none,
      clocks: [{ jobId: 'a', day: '2026-09-18' }],
      changes: [{ jobId: 'b', day: '2026-11-18' }, { jobId: 'a', day: '2026-11-17' }, { jobId: 'c', day: null }],
      teams: [{ jobId: 'd', day: '2026-11-16' }, { jobId: 'e', day: null }],
    })
    expect(got.order.map((m) => [m.jobId, m.how])).toEqual([
      ['b', 'changed'],
      ['a', 'changed'],
      ['d', 'team'],
      ['e', 'team'],
    ])
    expect(got.order[1]!.there).toEqual({ how: 'clock', day: '2026-09-18' })
  })

  it('leaves out the office job and the jobs on today’s schedule, from both lists', () => {
    const got = pickerPlan({
      ...none,
      todayJobIds: ['today'],
      clocks: [{ jobId: 'j-office', day: '2026-11-18' }, { jobId: 'today', day: '2026-11-17' }, { jobId: 'a', day: '2026-11-16' }],
      blocks: [{ jobId: 'j-office', day: '2026-11-20' }, { jobId: 'today', day: '2026-11-20' }, { jobId: 'b', day: '2026-11-20' }],
    })
    expect(got.order.map((m) => m.jobId)).toEqual(['a'])
    expect(got.soon.map((s) => s.jobId)).toEqual(['b'])
  })

  it('reads the job the sheet may open on even when newer changes fill the read', () => {
    const changes = Array.from({ length: PICKER_LAST_READ + 3 }, (_, i) => ({ jobId: `c${i}`, day: '2026-11-18' }))
    const got = pickerPlan({ ...none, changes, clocks: [{ jobId: 'was-there', day: '2026-06-01' }, { jobId: 'older', day: '2026-05-01' }] })
    expect(got.order).toHaveLength(PICKER_LAST_READ + 1)
    expect(got.order[got.order.length - 1]).toMatchObject({ jobId: 'was-there', how: 'clock' })
  })
})

describe('pickerSections', () => {
  it('leads with today in order of start, then your last jobs newest first, each job once', () => {
    const got = pickerSections({
      todayStops: [
        { job: pinto, timeStart: '13:00:00', timeEnd: '15:00:00' },
        { job: cedar, timeStart: '09:30:00', timeEnd: '12:00:00' },
        { job: cedar, timeStart: '15:30:00', timeEnd: '16:00:00' },
      ],
      last: inOrder([clock(marlowe, '2026-11-13'), clock(cedar, '2026-11-17')]),
      todayYmd: '2026-11-18',
      paintable: all,
    })
    expect(got.today.map((r) => [r.label, r.tag])).toEqual([
      ['J2417 · Cedar Hollow 12', '9:30 AM'],
      ['J2431 · Pinto Ridge 3', '1:00 PM'],
    ])
    // Cedar Hollow is already under Today, so Your last jobs does not say it again.
    expect(got.last.map((r) => [r.label, r.how ?? null, r.tag])).toEqual([['J2398 · Marlowe Dental', null, 'Friday']])
    expect(got.today[0]!.sub).toBe('J2417 Made Up Road')
  })

  it('says how it knows on a row that is not a clock: scheduled over its day, and on the team with no day shown', () => {
    const got = pickerSections({ todayStops: [], last: inOrder([team(pinto, '2026-08-01'), clock(cedar, '2026-09-18'), sched(marlowe, '2026-11-10')]), todayYmd: '2026-11-19', paintable: all })
    expect(got.last.map((r) => [r.job.id, r.how ?? null, r.tag])).toEqual([
      ['j-marlowe', 'scheduled', 'Nov 10'],
      ['j-cedar', null, 'Sep 18'],
      ['j-pinto', null, 'on the team'],
    ])
    expect(got.last.map((r) => r.last?.how)).toEqual(['schedule', 'clock', 'team'])
  })

  it('says changed over the day the person changed a job in the app', () => {
    const got = pickerSections({ todayStops: [], last: inOrder([changed(cedar, '2026-11-18'), clock(marlowe, '2026-11-13'), changed(marlowe, '2026-11-12')]), todayYmd: '2026-11-19', paintable: all })
    expect(got.last.map((r) => [r.job.id, r.how ?? null, r.tag])).toEqual([
      ['j-cedar', 'changed', 'yesterday'],
      ['j-marlowe', null, 'Friday'],
    ])
  })

  it('lists Coming up soonest first, each job once, under Today and over Your last jobs', () => {
    const got = pickerSections({
      todayStops: [{ job: pinto, timeStart: '13:00:00', timeEnd: '15:00:00' }],
      soon: [soonOn(marlowe, '2026-11-24'), soonOn(cedar, '2026-11-20'), soonOn(marlowe, '2026-11-21'), soonOn(pinto, '2026-11-20')],
      last: inOrder([clock(cedar, '2026-11-17'), clock(marlowe, '2026-11-13')]),
      todayYmd: '2026-11-19',
      paintable: all,
    })
    expect(got.today.map((r) => r.job.id)).toEqual(['j-pinto'])
    // Pinto Ridge is under Today. Marlowe is said once, at its soonest day.
    expect(got.soon.map((r) => [r.label, r.tag, r.paintable])).toEqual([
      ['J2417 · Cedar Hollow 12', 'tomorrow', true],
      ['J2398 · Marlowe Dental', 'Saturday', true],
    ])
    // A job under Coming up is not said again under Your last jobs.
    expect(got.last).toEqual([])
  })

  it('holds Coming up to its cap and to two weeks, and leaves out a job the person may not paint on', () => {
    const lots = Array.from({ length: PICKER_SOON_MAX + 2 }, (_, i) => soonOn(job(`s${i}`, `J7${i}`, `Soon lot ${i}`), `2026-11-${20 + i}`))
    const full = pickerSections({ todayStops: [], soon: lots, last: [], todayYmd: '2026-11-19', paintable: new Set(lots.map((l) => l.job.id)) })
    expect(full.soon.map((r) => r.job.id)).toEqual(['s0', 's1', 's2', 's3'])
    const far = pickerSections({ todayStops: [], soon: [soonOn(cedar, '2026-12-03'), soonOn(marlowe, '2026-12-04'), soonOn(pinto, '2026-11-20'), soonOn(billing, '2026-11-20')], last: [], todayYmd: '2026-11-19', paintable: new Set([cedar.id, marlowe.id, billing.id]) })
    expect(far.soon.map((r) => [r.job.id, r.tag])).toEqual([['j-cedar', 'Dec 3']])
  })

  it('offers the office job in no list: not today, not coming up, not as a last job', () => {
    const got = pickerSections({
      todayStops: [{ job: office, timeStart: '08:00:00', timeEnd: '17:00:00' }],
      soon: [soonOn(office, '2026-11-20')],
      last: inOrder([clock(office, '2026-11-18'), changed(cedar, '2026-11-17')]),
      todayYmd: '2026-11-19',
      paintable: all,
    })
    expect(got.today).toEqual([])
    expect(got.soon).toEqual([])
    expect(got.last.map((r) => r.job.id)).toEqual(['j-cedar'])
    // A day at the office is no last job to open on.
    expect(got.guess).toBeNull()
  })

  it('keeps the order it is handed', () => {
    const got = pickerSections({ todayStops: [], last: [team(pinto, '2026-11-18'), clock(cedar, '2026-09-18')], todayYmd: '2026-11-19', paintable: all })
    expect(got.last.map((r) => r.job.id)).toEqual(['j-pinto', 'j-cedar'])
  })

  it('leaves out a billing-only job and a job the person may not paint on', () => {
    const got = pickerSections({
      todayStops: [{ job: billing, timeStart: '08:00:00', timeEnd: '09:00:00' }],
      last: inOrder([clock(cedar, '2026-11-17'), clock(pinto, '2026-11-16'), team(billing)]),
      todayYmd: '2026-11-18',
      paintable: new Set([cedar.id, billing.id]),
    })
    expect(got.today).toEqual([])
    expect(got.last.map((r) => r.job.id)).toEqual(['j-cedar'])
  })

  it('holds Your last jobs to its cap, and fills it from the team when the days run out', () => {
    const many = Array.from({ length: PICKER_LAST_MAX + 4 }, (_, i) => clock(job(`j${i}`, `J${i}`, `Lot ${i}`), `2026-11-${String(17 - i).padStart(2, '0')}`))
    const full = pickerSections({ todayStops: [], last: inOrder(many), todayYmd: '2026-11-18', paintable: new Set(many.map((m) => m.job.id)) })
    expect(full.last).toHaveLength(PICKER_LAST_MAX)
    expect(full.last[0]!.job.id).toBe('j0')
    // One clock this month and seven teams: six rows, not one.
    const teams = Array.from({ length: 7 }, (_, i) => team(job(`t${i}`, `J9${i}`, `Team lot ${i}`)))
    const short = pickerSections({ todayStops: [], last: inOrder([...teams, clock(cedar, '2026-11-03')]), todayYmd: '2026-11-18', paintable: new Set([cedar.id, ...teams.map((t) => t.job.id)]) })
    expect(short.last.map((r) => r.job.id)).toEqual(['j-cedar', 't0', 't1', 't2', 't3', 't4'])
  })

  it('leaves out a job whose clock or scheduled day is ahead of today', () => {
    const got = pickerSections({ todayStops: [], last: inOrder([sched(cedar, '2026-11-20'), clock(marlowe, '2026-11-18')]), todayYmd: '2026-11-18', paintable: all })
    expect(got.last.map((r) => [r.job.id, r.tag])).toEqual([['j-marlowe', 'today']])
  })

  it('names a job with no words as a job', () => {
    const bare: PickerJob = { id: 'j-bare', number: null, name: null, address: null }
    const got = pickerSections({ todayStops: [], last: [clock(bare, '2026-11-17')], todayYmd: '2026-11-18', paintable: new Set(['j-bare']) })
    expect(got.last[0]).toMatchObject({ label: 'A job', sub: null, tag: 'yesterday', paintable: true })
  })
})

describe('pickerGuess', () => {
  const sections = (last: PickerLast[], stops: Array<{ job: PickerJob; timeStart: string; timeEnd: string }> = []) => pickerSections({ todayStops: stops, last: inOrder(last), todayYmd: '2026-11-19', paintable: all })

  it('is the job with the newest clock or scheduled day, and says how the app knows', () => {
    const byClock = pickerGuess(sections([clock(cedar, '2026-11-13'), sched(marlowe, '2026-11-10'), team(pinto)]))!
    expect(byClock.job.id).toBe('j-cedar')
    expect(pickerGuessWords(byClock, '2026-11-19')).toBe('The last job you clocked onto, Friday.')
    const bySchedule = pickerGuess(sections([clock(cedar, '2026-09-18'), sched(marlowe, '2026-11-10')]))!
    expect(bySchedule.job.id).toBe('j-marlowe')
    expect(pickerGuessWords(bySchedule, '2026-11-19')).toBe('The last job on your schedule, Nov 10.')
  })

  it('is that job even when newer teams sit above it, or push it off the list', () => {
    const above = pickerGuess(sections([team(pinto, '2026-11-18'), sched(marlowe, '2026-11-10')]))!
    expect(above.job.id).toBe('j-marlowe')
    const teams = Array.from({ length: PICKER_LAST_MAX + 2 }, (_, i) => team(job(`t${i}`, `J9${i}`, `Team lot ${i}`), '2026-11-18'))
    const got = pickerSections({ todayStops: [], last: inOrder([...teams, clock(cedar, '2026-11-08')]), todayYmd: '2026-11-19', paintable: new Set([cedar.id, ...teams.map((t) => t.job.id)]) })
    expect(got.last.map((r) => r.job.id)).not.toContain('j-cedar')
    expect(got.guess?.job.id).toBe('j-cedar')
    // A job clocked onto in September and put back on the team yesterday: the guess is by the day they were there.
    const older = pickerGuess(sections([clock(cedar, '2026-09-18'), team(cedar, '2026-11-18'), sched(marlowe, '2026-11-10')]))!
    expect(older.job.id).toBe('j-marlowe')
  })

  it('is none from the team alone, which says nothing of when', () => {
    expect(pickerGuess(sections([team(cedar, '2026-11-18'), team(pinto)]))).toBeNull()
  })

  it('is none from a day more than two weeks back: the person is asked, with that job in the list', () => {
    const old = pickerSections({ todayStops: [], last: inOrder([changed(pinto, '2026-11-19'), clock(cedar, '2026-08-21')]), todayYmd: '2026-11-19', paintable: all })
    expect(old.guess).toBeNull()
    expect(old.last.map((r) => [r.job.id, r.how ?? null, r.tag])).toEqual([
      ['j-pinto', 'changed', 'today'],
      ['j-cedar', null, 'Aug 21'],
    ])
    // Two weeks to the day still opens.
    expect(pickerGuess(sections([sched(cedar, '2026-11-05')]))?.job.id).toBe('j-cedar')
    expect(pickerGuess(sections([sched(cedar, '2026-11-04')]))).toBeNull()
  })

  it('is none from a change alone: a payment taken at a desk does not say where the map goes', () => {
    expect(pickerGuess(sections([changed(cedar, '2026-11-18'), changed(pinto, '2026-11-17')]))).toBeNull()
  })

  it('is by the day they were there, on a job changed since or one that is coming up', () => {
    // Clocked onto on Friday and changed yesterday: the row says changed, the guess says the clock.
    const since = pickerSections({ todayStops: [], last: inOrder([changed(cedar, '2026-11-18'), clock(cedar, '2026-11-13'), changed(pinto, '2026-11-18')]), todayYmd: '2026-11-19', paintable: all })
    expect(since.last.map((r) => [r.job.id, r.how ?? null, r.tag])).toContainEqual(['j-cedar', 'changed', 'yesterday'])
    expect(since.guess?.job.id).toBe('j-cedar')
    expect(pickerGuessWords(since.guess!, '2026-11-19')).toBe('The last job you clocked onto, Friday.')
    // On the schedule again more than a week out: it is under Coming up, and still the last job they were on.
    const again = pickerSections({ todayStops: [], soon: [soonOn(marlowe, '2026-11-30')], last: inOrder([sched(marlowe, '2026-11-10')]), todayYmd: '2026-11-19', paintable: all })
    expect(again.soon.map((r) => [r.job.id, r.tag])).toEqual([['j-marlowe', 'Nov 30']])
    expect(again.last).toEqual([])
    expect(pickerGuessWords(again.guess!, '2026-11-19')).toBe('The last job on your schedule, Nov 10.')
  })

  it('is the next job on the schedule inside a week, over the last job (the owner’s word of 2026-11-19, call 16)', () => {
    const next = (soon: PickerSoon[], last: PickerLast[] = [clock(pinto, '2026-11-18')]) => pickerSections({ todayStops: [], soon, last: inOrder(last), todayYmd: '2026-11-19', paintable: all })
    const tomorrow = next([soonOn(marlowe, '2026-11-23'), soonOn(cedar, '2026-11-20')])
    expect(tomorrow.guess?.job.id).toBe('j-cedar')
    expect(pickerGuessWords(tomorrow.guess!, '2026-11-19')).toBe('The next job on your schedule, tomorrow.')
    // Two jobs tomorrow: the first stop of the day.
    const two = next([{ job: marlowe, day: '2026-11-20', timeStart: '13:00:00' }, { job: cedar, day: '2026-11-20', timeStart: '07:30:00' }])
    expect(two.guess?.job.id).toBe('j-cedar')
    expect(two.soon.map((r) => r.job.id)).toEqual(['j-cedar', 'j-marlowe'])
    // Six days out is still inside a week, and said as its weekday.
    const wednesday = next([soonOn(marlowe, '2026-11-25')])
    expect(pickerGuessWords(wednesday.guess!, '2026-11-19')).toBe('The next job on your schedule, Wednesday.')
    // A week out or more is a plan: the last job leads again.
    const far = next([soonOn(marlowe, '2026-11-26')])
    expect(far.guess?.job.id).toBe('j-pinto')
    expect(pickerGuessWords(far.guess!, '2026-11-19')).toBe('The last job you clocked onto, yesterday.')
    // A person with a job tomorrow and no last job at all still opens on it.
    expect(next([soonOn(cedar, '2026-11-20')], []).guess?.job.id).toBe('j-cedar')
  })

  it('is never a next job the person may not paint on, the office job, or any job while one is on today', () => {
    const mine = pickerSections({ todayStops: [], soon: [soonOn(office, '2026-11-20'), soonOn(cedar, '2026-11-20'), soonOn(marlowe, '2026-11-21')], last: [], todayYmd: '2026-11-19', paintable: new Set([office.id, marlowe.id]) })
    expect(mine.guess?.job.id).toBe('j-marlowe')
    const today = pickerSections({ todayStops: [{ job: pinto, timeStart: '09:00:00', timeEnd: '10:00:00' }], soon: [soonOn(cedar, '2026-11-20')], last: [], todayYmd: '2026-11-19', paintable: all })
    expect(today.guess).toBeNull()
  })

  it('is none when a job is on today’s schedule: the person is asked which', () => {
    expect(pickerGuess(sections([clock(marlowe, '2026-11-18')], [{ job: cedar, timeStart: '09:30:00', timeEnd: '12:00:00' }]))).toBeNull()
  })

  it('is none for a person nobody has put on a job, and never a job they may not paint on', () => {
    expect(pickerGuess(sections([]))).toBeNull()
    const got = pickerGuess(pickerSections({ todayStops: [], last: inOrder([clock(cedar, '2026-11-18'), clock(pinto, '2026-11-10')]), todayYmd: '2026-11-19', paintable: new Set([pinto.id]) }))
    expect(got?.job.id).toBe('j-pinto')
  })
})

describe('the words for a phone that gives no place', () => {
  it('name the phone on a phone and never at a desk', () => {
    expect(PICKER_NEAR_NO_FIX.refused).toContain('phone')
    for (const words of Object.values(PICKER_NEAR_NO_FIX_DESK)) expect(words).not.toMatch(/phone/i)
  })
})

describe('pickerSearchRows', () => {
  it('lists every hit and marks the ones the person may not paint on', () => {
    const rows = pickerSearchRows([cedar, pinto, billing], new Set([cedar.id]))
    expect(rows.map((r) => [r.job.id, r.paintable])).toEqual([
      ['j-cedar', true],
      ['j-pinto', false],
    ])
  })
})

describe('pickerPaintable', () => {
  it('is the jobs a person can read and the jobs whose team they are on', () => {
    expect([...pickerPaintable(['a', 'b'], ['b', 'c'])].sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('pickerHome', () => {
  it('opens the start sheet on the job, changeable, with a lot keeping its development', () => {
    expect(pickerHome(cedar)).toMatchObject({ jobId: 'j-cedar', developmentId: null, label: 'J2417 · Cedar Hollow 12', address: 'J2417 Made Up Road', canChangeJob: true })
    expect(pickerHome({ ...cedar, developmentId: 'd1' }).developmentId).toBe('d1')
    expect(pickerHome({ id: 'x', number: null, name: null, address: '  ' })).toMatchObject({ label: 'This job', address: null })
  })
})

describe('Find the jobs near me (step 5)', () => {
  // A made-up spot. One degree of latitude is about 111 km, so 0.001 is about 111 m.
  const me = { lat: 30.0, lng: -97.0 }
  const placed = [
    { key: '9 pinto ridge ct', lat: 30.02, lng: -97.0 },
    { key: '1208 wrenfield loop', lat: 30.001, lng: -97.0 },
    { key: '1216 wrenfield loop', lat: 30.0014, lng: -97.0 },
    { key: 'across town', lat: 30.2, lng: -97.0 },
    { key: '1208 wrenfield loop', lat: 30.001, lng: -97.0 },
  ]

  it('reads a square of ground a little wider than the list looks', () => {
    const box = pickerNearBox(me)
    expect(box.latMin).toBeLessThan(me.lat)
    expect(box.latMax).toBeGreaterThan(me.lat)
    // The square reaches past the list's limit on every side.
    expect((box.latMax - me.lat) * 111_320).toBeGreaterThan(PICKER_NEAR_MAX_M)
    // A degree of longitude is shorter away from the equator, so the square is wider in degrees there.
    expect(box.lngMax - me.lng).toBeGreaterThan(box.latMax - me.lat)
  })

  it('keeps the placed addresses within reach, nearest first, each once', () => {
    const got = pickerNearestPlaced(me, placed)
    expect(got.map((g) => g.key)).toEqual(['1208 wrenfield loop', '1216 wrenfield loop', '9 pinto ridge ct'])
    expect(got[0]!.meters).toBeGreaterThan(100)
    expect(got[0]!.meters).toBeLessThan(120)
  })

  it('holds the addresses to its cap', () => {
    const many = Array.from({ length: PICKER_NEAR_ADDRESSES + 10 }, (_, i) => ({ key: `a${i}`, lat: 30 + i * 0.0001, lng: -97 }))
    expect(pickerNearestPlaced(me, many)).toHaveLength(PICKER_NEAR_ADDRESSES)
  })

  it('lists the jobs at those addresses nearest first, with how far, and never one the app has not placed', () => {
    const nearest = pickerNearestPlaced(me, placed)
    const jobs: PickerJob[] = [
      job('j-pinto', 'J2431', 'Pinto Ridge 3', { address: '9 Pinto Ridge Ct' }),
      job('j-cedar', 'J2417', 'Cedar Hollow 12', { address: ' 1208  Wrenfield Loop ' }),
      job('j-14', 'J2420', 'Cedar Hollow 14', { address: '1216 Wrenfield Loop' }),
      job('j-unplaced', 'J2500', 'Somewhere else', { address: '5 Unplaced Way' }),
      job('j-bill', 'J2000', 'Billing only', { address: '1208 Wrenfield Loop', billingOnly: true }),
    ]
    const rows = pickerNearRows(nearest, jobs, new Set(jobs.map((j) => j.id)))
    expect(rows.map((r) => r.job.id)).toEqual(['j-cedar', 'j-14', 'j-pinto'])
    expect(rows[0]!.tag).toBe('about 360 ft')
    expect(rows[2]!.tag).toBe('about 1.4 mi')
    expect(rows.every((r) => r.paintable)).toBe(true)
  })

  it('holds the list to its cap, and leaves out a job the person may not paint on', () => {
    const nearest = [{ key: '1 made up road', meters: 50 }]
    const jobs = Array.from({ length: PICKER_NEAR_MAX + 3 }, (_, i) => job(`j${i}`, `J${i}`, `Lot ${i}`, { address: '1 Made Up Road' }))
    const rows = pickerNearRows(nearest, jobs, new Set(jobs.slice(1).map((j) => j.id)))
    expect(rows).toHaveLength(PICKER_NEAR_MAX)
    // Jobs at one address keep the order they were read in, and the one that is not paintable is gone.
    expect(rows[0]!.job.id).toBe('j1')
  })

  it('writes the jobs filter with each address quoted, so its commas stay its own', () => {
    expect(pickerNearJobsFilter(['1208 wrenfield loop, austin, tx', '9 pinto ridge ct'])).toBe('job_address.ilike."1208 wrenfield loop, austin, tx",job_address.ilike."9 pinto ridge ct"')
  })

  it('escapes what the filter would read as its own, and leaves out an address with a star', () => {
    expect(pickerNearJobsFilter(['lot 5_a "rear" 100%'])).toBe('job_address.ilike."lot 5\\_a \\"rear\\" 100\\%"')
    expect(pickerNearJobsFilter(['unit *'])).toBeNull()
    expect(pickerNearJobsFilter([])).toBeNull()
  })
})
