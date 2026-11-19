/**
 * Which job is it for? (punch list #392, step 4): the picker's lists, its words for a day, and
 * which jobs a person may paint on. Every job here is made up.
 */
import { describe, expect, it } from 'vitest'
import { PICKER_LATELY_MAX, PICKER_NEAR_ADDRESSES, PICKER_NEAR_MAX, PICKER_NEAR_MAX_M, pickerHome, pickerLatelyWords, pickerNearBox, pickerNearJobsFilter, pickerNearRows, pickerNearestPlaced, pickerPaintable, pickerSearchRows, pickerSections, pickerStopWords, type PickerJob } from './paintedMapJobPicker'

const job = (id: string, number: string, name: string, over: Partial<PickerJob> = {}): PickerJob => ({ id, number, name, address: `${number} Made Up Road`, ...over })
const cedar = job('j-cedar', 'J2417', 'Cedar Hollow 12')
const marlowe = job('j-marlowe', 'J2398', 'Marlowe Dental')
const pinto = job('j-pinto', 'J2431', 'Pinto Ridge 3')
const billing = job('j-bill', 'J2000', 'Billing only', { billingOnly: true })
const all = new Set([cedar.id, marlowe.id, pinto.id, billing.id])

describe('pickerLatelyWords', () => {
  // 2026-11-18 is a Wednesday.
  it('says today, yesterday, a weekday inside a week, then the day', () => {
    expect(pickerLatelyWords('2026-11-18', '2026-11-18')).toBe('today')
    expect(pickerLatelyWords('2026-11-17', '2026-11-18')).toBe('yesterday')
    expect(pickerLatelyWords('2026-11-13', '2026-11-18')).toBe('Friday')
    expect(pickerLatelyWords('2026-11-12', '2026-11-18')).toBe('Thursday')
    expect(pickerLatelyWords('2026-11-11', '2026-11-18')).toBe('Nov 11')
    expect(pickerLatelyWords('2026-10-05', '2026-11-18')).toBe('Oct 5')
  })

  it('crosses a month and a year with no clock', () => {
    expect(pickerLatelyWords('2026-10-31', '2026-11-01')).toBe('yesterday')
    expect(pickerLatelyWords('2026-12-31', '2027-01-01')).toBe('yesterday')
  })

  it('says nothing for a day that is not one, or one ahead', () => {
    expect(pickerLatelyWords('', '2026-11-18')).toBe('')
    expect(pickerLatelyWords('2026-11-19', '2026-11-18')).toBe('')
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

describe('pickerSections', () => {
  it('leads with today in order of start, then lately newest first, each job once', () => {
    const got = pickerSections({
      todayStops: [
        { job: pinto, timeStart: '13:00:00', timeEnd: '15:00:00' },
        { job: cedar, timeStart: '09:30:00', timeEnd: '12:00:00' },
        { job: cedar, timeStart: '15:30:00', timeEnd: '16:00:00' },
      ],
      lately: [
        { job: marlowe, lastOn: '2026-11-13' },
        { job: cedar, lastOn: '2026-11-17' },
      ],
      todayYmd: '2026-11-18',
      paintable: all,
    })
    expect(got.today.map((r) => [r.label, r.tag])).toEqual([
      ['J2417 · Cedar Hollow 12', '9:30 AM'],
      ['J2431 · Pinto Ridge 3', '1:00 PM'],
    ])
    // Cedar Hollow is already under Today, so Lately does not say it again.
    expect(got.lately.map((r) => [r.label, r.tag])).toEqual([['J2398 · Marlowe Dental', 'Friday']])
    expect(got.today[0]!.sub).toBe('J2417 Made Up Road')
  })

  it('leaves out a billing-only job and a job the person may not paint on', () => {
    const got = pickerSections({
      todayStops: [{ job: billing, timeStart: '08:00:00', timeEnd: '09:00:00' }],
      lately: [
        { job: cedar, lastOn: '2026-11-17' },
        { job: pinto, lastOn: '2026-11-16' },
      ],
      todayYmd: '2026-11-18',
      paintable: new Set([cedar.id, billing.id]),
    })
    expect(got.today).toEqual([])
    expect(got.lately.map((r) => r.job.id)).toEqual(['j-cedar'])
  })

  it('holds Lately to its cap', () => {
    const many = Array.from({ length: PICKER_LATELY_MAX + 4 }, (_, i) => ({ job: job(`j${i}`, `J${i}`, `Lot ${i}`), lastOn: `2026-11-${String(17 - i).padStart(2, '0')}` }))
    const got = pickerSections({ todayStops: [], lately: many, todayYmd: '2026-11-18', paintable: new Set(many.map((m) => m.job.id)) })
    expect(got.lately).toHaveLength(PICKER_LATELY_MAX)
    expect(got.lately[0]!.job.id).toBe('j0')
  })

  it('names a job with no words as a job', () => {
    const bare: PickerJob = { id: 'j-bare', number: null, name: null, address: null }
    const got = pickerSections({ todayStops: [], lately: [{ job: bare, lastOn: '2026-11-17' }], todayYmd: '2026-11-18', paintable: new Set(['j-bare']) })
    expect(got.lately[0]).toMatchObject({ label: 'A job', sub: null, tag: 'yesterday', paintable: true })
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
