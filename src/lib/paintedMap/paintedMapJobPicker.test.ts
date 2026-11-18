/**
 * Which job is it for? (punch list #392, step 4): the picker's lists, its words for a day, and
 * which jobs a person may paint on. Every job here is made up.
 */
import { describe, expect, it } from 'vitest'
import { PICKER_LATELY_MAX, pickerHome, pickerLatelyWords, pickerPaintable, pickerSearchRows, pickerSections, pickerStopWords, type PickerJob } from './paintedMapJobPicker'

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
