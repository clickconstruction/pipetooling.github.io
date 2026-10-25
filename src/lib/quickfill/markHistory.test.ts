import { describe, expect, it } from 'vitest'
import {
  formatHourLabel,
  markHistoryBoxes,
  markHistoryRhythmWorkdays,
  workdaysBetweenYmd,
  markHistoryCellTitle,
  markHistoryHabit,
  markHistoryHasNotes,
  markHistoryHour,
  markHistoryRows,
  markHistoryTiles,
  markHistoryTint,
  markHistoryUsual,
  markHistoryWeeks,
  mondayOnOrBefore,
  parseMarkHistoryBoxItems,
  type MarkHistoryEvent,
} from './markHistory'

// Today is Saturday 2026-10-24 (Central). Times below are Central daylight time, written as UTC (+5).
const TODAY = '2026-10-24'
let seq = 0
function mark(ymd: string, hhmm: string, who: string | null = 'Dana', count: number | null = 0, note: string | null = null): MarkHistoryEvent {
  const [h, m] = hhmm.split(':').map(Number)
  const utc = new Date(`${ymd}T${String(h! + 5).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`)
  seq++
  return { id: `e${seq}`, marked_at: utc.toISOString(), outstanding_count: count, note_text: note, marked_by: who ? `u-${who}` : null, marked_by_name: who }
}

/** Every workday from Aug 31 to Oct 23 with a mark at 9:30, except the gaps; counts 0, or 3 on a few days. */
function dailyStation(): MarkHistoryEvent[] {
  const gaps = new Set(['2026-09-07', '2026-09-09', '2026-10-02'])
  const threes = new Set(['2026-09-04', '2026-09-25', '2026-09-28', '2026-10-08', '2026-10-19', '2026-10-20'])
  const out: MarkHistoryEvent[] = []
  const d = new Date('2026-08-31T00:00:00')
  while (d.getTime() <= new Date('2026-10-23T00:00:00').getTime()) {
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5 && !gaps.has(ymd)) out.push(mark(ymd, '09:30', ymd === '2026-09-03' ? 'Marisol' : 'Dana', threes.has(ymd) ? 3 : 0))
    d.setDate(d.getDate() + 1)
  }
  return out
}

describe('the calendar helpers', () => {
  it('finds the Monday on or before a day', () => {
    expect(mondayOnOrBefore('2026-10-24')).toBe('2026-10-19') // Saturday
    expect(mondayOnOrBefore('2026-10-25')).toBe('2026-10-19') // Sunday
    expect(mondayOnOrBefore('2026-10-19')).toBe('2026-10-19') // Monday
  })
  it('counts workdays between days and reads a rhythm in them, rounded down', () => {
    expect(workdaysBetweenYmd('2026-10-16', '2026-10-19')).toBe(1) // Friday to Monday
    expect(workdaysBetweenYmd('2026-10-15', '2026-10-16')).toBe(1)
    expect(workdaysBetweenYmd('2026-10-09', '2026-10-16')).toBe(5)
    expect(markHistoryRhythmWorkdays(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'])).toBe(1)
    expect(markHistoryRhythmWorkdays(['2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20', '2026-10-22'])).toBe(1) // one miss does not slow it
    expect(markHistoryRhythmWorkdays(['2026-09-25', '2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23'])).toBe(5) // every Friday
    expect(markHistoryRhythmWorkdays(['2026-10-22', '2026-10-23'])).toBe(1) // too few to call
  })
  it('reads the hour in the company time zone', () => {
    expect(markHistoryHour('2026-10-20T14:37:00Z')).toBeCloseTo(9 + 37 / 60, 5) // 9:37 AM CDT
    expect(markHistoryHour('2026-01-20T15:00:00Z')).toBe(9) // 9:00 AM CST
    expect(markHistoryHour('nope')).toBeNull()
    expect(formatHourLabel(9.5)).toBe('9:30 AM')
    expect(formatHourLabel(13.25)).toBe('1:15 PM')
    expect(formatHourLabel(0)).toBe('12:00 AM')
  })
})

describe('markHistoryWeeks', () => {
  it('draws eight weeks ending on the week that holds today, oldest first, with month labels at each change', () => {
    const weeks = markHistoryWeeks(dailyStation(), TODAY)
    expect(weeks).toHaveLength(8)
    expect(weeks[0]!.mondayYmd).toBe('2026-08-31')
    expect(weeks[7]!.mondayYmd).toBe('2026-10-19')
    expect(weeks.map((w) => w.month)).toEqual(['Aug', 'Sep', null, null, null, 'Oct', null, null])
    expect(weeks[0]!.cells.map((c) => c.ymd)).toEqual(['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'])
  })
  it('a marked day carries its last mark; a due workday with no mark is a gap; weekends and the future are off', () => {
    const weeks = markHistoryWeeks(dailyStation(), TODAY)
    const cell = (ymd: string) => weeks.flatMap((w) => w.cells).find((c) => c.ymd === ymd)!
    expect(cell('2026-10-20')).toMatchObject({ kind: 'marked', count: 3, tint: 'some', who: 'Dana', marks: 1, due: true, today: false })
    expect(cell('2026-10-21')).toMatchObject({ kind: 'marked', count: 0, tint: 'none' })
    expect(cell('2026-09-07')).toMatchObject({ kind: 'gap', due: true, count: null, tint: null })
    expect(cell('2026-09-05')).toMatchObject({ kind: 'off', due: false })
    expect(cell('2026-10-24')).toMatchObject({ kind: 'off', today: true, due: false })
    expect(cell('2026-10-25')).toMatchObject({ kind: 'off', today: false })
  })
  it('a weekend mark lands in its cell, and two marks a day keep the last one with the count of marks', () => {
    const events = [...dailyStation(), mark('2026-10-17', '08:00', 'Marisol', 1), mark('2026-10-22', '15:10', 'Marisol', 2)]
    const weeks = markHistoryWeeks(events, TODAY)
    const cell = (ymd: string) => weeks.flatMap((w) => w.cells).find((c) => c.ymd === ymd)!
    expect(cell('2026-10-17')).toMatchObject({ kind: 'marked', who: 'Marisol', count: 1 })
    expect(cell('2026-10-22')).toMatchObject({ kind: 'marked', who: 'Marisol', count: 2, marks: 2 })
  })
  it('days before the station’s first mark have no box, and a station with no count ticks', () => {
    const events = [mark('2026-10-07', '09:00', 'Dana', null), mark('2026-10-08', '09:00', 'Dana', null), mark('2026-10-09', '09:00', 'Dana', null), mark('2026-10-13', '09:00', 'Dana', null)]
    const weeks = markHistoryWeeks(events, TODAY)
    const cell = (ymd: string) => weeks.flatMap((w) => w.cells).find((c) => c.ymd === ymd)!
    expect(cell('2026-10-06')).toMatchObject({ kind: 'off', due: false })
    expect(cell('2026-10-07')).toMatchObject({ kind: 'marked', tint: 'tick', count: null })
    expect(cell('2026-10-12')).toMatchObject({ kind: 'gap', due: true })
    expect(cell('2026-10-14')).toMatchObject({ kind: 'gap', due: true })
  })
  it('a weekly station is due only when its rhythm says so', () => {
    const events = ['2026-08-28', '2026-09-04', '2026-09-11', '2026-09-18', '2026-09-25', '2026-10-02', '2026-10-09'].map((d) => mark(d, '10:00', 'Dana', 4))
    const weeks = markHistoryWeeks(events, TODAY)
    const cell = (ymd: string) => weeks.flatMap((w) => w.cells).find((c) => c.ymd === ymd)!
    expect(cell('2026-10-05')).toMatchObject({ kind: 'off', due: false }) // three days after a look
    expect(cell('2026-10-09')).toMatchObject({ kind: 'marked', due: true })
    expect(cell('2026-10-14')).toMatchObject({ kind: 'off', due: false }) // five days after
    expect(cell('2026-10-16')).toMatchObject({ kind: 'gap', due: true }) // seven days after, no look
    expect(cell('2026-10-19')).toMatchObject({ kind: 'gap', due: true }) // still due
  })
  it('the third tint marks a count above the window’s usual, and only when asked', () => {
    const events = [mark('2026-10-19', '09:00', 'Dana', 50), mark('2026-10-20', '09:00', 'Dana', 52), mark('2026-10-21', '09:00', 'Dana', 60), mark('2026-10-22', '09:00', 'Dana', 48)]
    expect(markHistoryUsual(events)).toBe(51)
    const plain = markHistoryWeeks(events, TODAY).flatMap((w) => w.cells).find((c) => c.ymd === '2026-10-21')!
    expect(plain.tint).toBe('some')
    const third = markHistoryWeeks(events, TODAY, { thirdTint: true }).flatMap((w) => w.cells).find((c) => c.ymd === '2026-10-21')!
    expect(third.tint).toBe('many')
    expect(markHistoryTint(null, 3, true)).toBe('tick')
    expect(markHistoryTint(0, 3, true)).toBe('none')
    expect(markHistoryTint(3, 3, true)).toBe('some')
    expect(markHistoryTint(4, 3, false)).toBe('some')
  })
})

describe('markHistoryTiles', () => {
  it('this week, the streak and the missed days, workdays only', () => {
    const tiles = markHistoryTiles(markHistoryWeeks(dailyStation(), TODAY), TODAY)
    expect(tiles.thisWeek).toEqual({ marked: 5, due: 5 })
    expect(tiles.streak).toBe(15) // Oct 5 to Oct 23, the Friday Oct 2 gap stops it
    expect(tiles.missed).toBe(3)
    expect(tiles.due).toBe(40)
  })
  it('an unfinished today never breaks the streak, and a gap yesterday does', () => {
    const friday = '2026-10-23'
    const weeks = markHistoryWeeks(dailyStation().filter((e) => !e.marked_at.startsWith('2026-10-23')), friday)
    expect(markHistoryTiles(weeks, friday).streak).toBe(14)
    const thursday = '2026-10-22'
    const noWed = dailyStation().filter((e) => !e.marked_at.startsWith('2026-10-21'))
    expect(markHistoryTiles(markHistoryWeeks(noWed, thursday), thursday).streak).toBe(1)
  })
  it('an empty station has empty tiles', () => {
    expect(markHistoryTiles(markHistoryWeeks([], TODAY), TODAY)).toEqual({ thisWeek: { marked: 0, due: 0 }, streak: 0, missed: 0, due: 0 })
  })
})

describe('markHistoryHabit', () => {
  it('names who marks it, most first, with the usual hour and the count’s drift', () => {
    const habit = markHistoryHabit(dailyStation())
    expect(habit.people).toEqual([{ name: 'Dana', count: 36 }, { name: 'Marisol', count: 1 }])
    expect(habit.medianHour).toBeCloseTo(9.5, 5)
    expect(habit.sentence).toBe('Dana marked it 36 times and Marisol once. The usual time is about 9:30 AM.')
    expect(habit.countSentence).toBe('Nothing open at 31 of 37 looks. Lately about 1 open at a look, up from about 0.')
  })
  it('reads a falling count', () => {
    const events = [5, 4, 4, 3, 1, 1, 0, 0].map((n, i) => mark(`2026-10-${String(12 + i).padStart(2, '0')}`, '09:00', 'Dana', n))
    expect(markHistoryHabit(events).countSentence).toBe('Nothing open at 2 of 8 looks. Lately about 1 open at a look, down from about 4.')
  })
  it('a station where something is always open says so, and a flat zero drift says nothing', () => {
    const ones = [1, 1, 1, 1].map((n, i) => mark(`2026-10-${String(19 + i).padStart(2, '0')}`, '09:00', 'Dana', n))
    expect(markHistoryHabit(ones).countSentence).toBe('Something was open at every one of the 4 looks. About 1 open at a look, as before.')
    const mostlyZero = [0, 0, 0, 0, 1, 0, 0, 0].map((n, i) => mark(`2026-10-${String(12 + i).padStart(2, '0')}`, '09:00', 'Dana', n))
    expect(markHistoryHabit(mostlyZero).countSentence).toBe('Nothing open at 7 of 8 looks.')
  })
  it('says so when the station has no count, and when nothing was ever open', () => {
    expect(markHistoryHabit([mark('2026-10-20', '09:00', 'Dana', null)]).countSentence).toBe('This station has no count. A mark is a look.')
    expect(markHistoryHabit([mark('2026-10-20', '09:00', 'Dana', 0), mark('2026-10-21', '09:00', 'Dana', 0)]).countSentence).toBe('Nothing was open at any of the 2 looks.')
    expect(markHistoryHabit([]).sentence).toBe('No marks in these weeks.')
  })
  it('a nameless marker is Someone', () => {
    expect(markHistoryHabit([mark('2026-10-20', '09:00', null, 0)]).sentence).toBe('Someone marked it once. The usual time is about 9:00 AM.')
  })
})

describe('the rows and the notes', () => {
  it('splits the last seven days from the rest, newest first', () => {
    const { recent, older } = markHistoryRows(dailyStation(), TODAY)
    expect(recent.map((e) => e.marked_at.slice(0, 10))).toEqual(['2026-10-23', '2026-10-22', '2026-10-21', '2026-10-20', '2026-10-19'])
    expect(older).toHaveLength(32)
    expect(older[0]!.marked_at.slice(0, 10)).toBe('2026-10-16')
  })
  it('the Note column only when a mark carries a note', () => {
    expect(markHistoryHasNotes(dailyStation())).toBe(false)
    expect(markHistoryHasNotes([mark('2026-10-20', '09:00', 'Dana', 0, 'still owe Reece a call')])).toBe(true)
    expect(markHistoryHasNotes([mark('2026-10-20', '09:00', 'Dana', 0, '  ')])).toBe(false)
  })
  it('a cell’s words', () => {
    const weeks = markHistoryWeeks(dailyStation(), TODAY)
    const cell = (ymd: string) => weeks.flatMap((w) => w.cells).find((c) => c.ymd === ymd)!
    expect(markHistoryCellTitle(cell('2026-10-20'))).toBe('Tue, Oct 20 · 9:30 AM · Dana · 3 open')
    expect(markHistoryCellTitle(cell('2026-10-02'))).toBe('Fri, Oct 2 · no mark')
    expect(markHistoryCellTitle(cell('2026-10-24'))).toBe('Sat, Oct 24')
  })
})

describe('the boxes band', () => {
  const items = parseMarkHistoryBoxItems(JSON.stringify([{ id: 'a', label: 'Schedule conflicts flagged' }, { id: 'b', label: 'Email inbox clear' }, { id: 'c', label: 'Trash out when leaving' }, { id: '', label: 'no id' }, { label: 'no id either' }]))
  it('parses the items as app_settings stores them, dropping the broken ones', () => {
    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(parseMarkHistoryBoxItems('not json')).toEqual([])
    expect(parseMarkHistoryBoxItems(null)).toEqual([])
  })
  it('one row a box over the last four weeks’ due workdays, keyed on work_date, naming the boxes left unticked', () => {
    const weeks = markHistoryWeeks(dailyStation(), TODAY)
    const ticks = weeks
      .slice(4)
      .flatMap((w) => w.cells)
      .filter((c) => c.kind === 'marked')
      .flatMap((c) => [
        { item_id: 'a', work_date: c.ymd, checked_at: c.at!, checked_by_name: 'Dana' },
        { item_id: 'b', work_date: c.ymd, checked_at: c.at!, checked_by_name: 'Dana' },
      ])
    ticks.push({ item_id: 'c', work_date: '2026-10-16', checked_at: '2026-10-16T14:40:00Z', checked_by_name: 'Marisol' })
    ticks.push({ item_id: 'c', work_date: '2026-10-23', checked_at: '2026-10-23T14:40:00Z', checked_by_name: 'Dana' })
    const band = markHistoryBoxes(items, ticks, weeks)
    expect(band.days).toHaveLength(20)
    expect(band.days[0]).toBe('2026-09-28')
    expect(band.days[19]).toBe('2026-10-23')
    expect(band.rows.map((r) => [r.label, r.ticked, r.due, r.low])).toEqual([
      ['Schedule conflicts flagged', 19, 20, false],
      ['Email inbox clear', 19, 20, false],
      ['Trash out when leaving', 2, 20, true],
    ])
    const friday = band.rows[0]!.cells.find((c) => c.ymd === '2026-10-02')!
    expect(friday).toMatchObject({ on: false, marked: false })
    const trash = band.rows[2]!.cells.find((c) => c.ymd === '2026-10-16')!
    expect(trash).toMatchObject({ on: true, who: 'Marisol' })
    expect(band.tickedBy).toBe('Dana')
    expect(band.sentence).toBe('Dana ticks the boxes.')
    expect(band.leftSentence).toBe('Left unticked most days: Trash out when leaving, 18 of 20.')
  })
  it('a box counts from its first tick on record: the days before draw no box and do not count', () => {
    const weeks = markHistoryWeeks(dailyStation(), TODAY)
    const lights = { id: 'd', label: 'Turn on the lights' }
    const ticks = [
      { item_id: 'a', work_date: '2026-09-28', checked_at: '2026-09-28T14:30:00Z', checked_by_name: 'Dana' },
      { item_id: 'a', work_date: '2026-10-23', checked_at: '2026-10-23T14:30:00Z', checked_by_name: 'Dana' },
      { item_id: 'd', work_date: '2026-10-23', checked_at: '2026-10-23T14:30:00Z', checked_by_name: 'Dana' },
    ]
    const band = markHistoryBoxes([items[0]!, lights], ticks, weeks, 4, { a: '2026-05-11', d: '2026-10-23' })
    const [a, d] = band.rows
    expect(a).toMatchObject({ ticked: 2, due: 20, since: null, low: true })
    expect(d).toMatchObject({ ticked: 1, due: 1, since: '2026-10-23', low: false })
    expect(d!.cells.filter((c) => c.before)).toHaveLength(19)
    expect(d!.cells.find((c) => c.ymd === '2026-10-23')).toMatchObject({ on: true, before: false })
    expect(band.newerSentence).toBe('One box counts from its first tick on Fri, Oct 23.')
    expect(band.leftSentence).toBe('Left unticked most days: Schedule conflicts flagged, 18 of 20.')
    const two = markHistoryBoxes([lights, { id: 'e', label: 'Mop' }], [...ticks, { item_id: 'e', work_date: '2026-10-23', checked_at: '2026-10-23T14:31:00Z', checked_by_name: 'Dana' }], weeks, 4, { d: '2026-10-23', e: '2026-10-23' })
    expect(two.newerSentence).toBe('2 boxes count from their first tick on Fri, Oct 23.')
    const apart = markHistoryBoxes([lights, { id: 'e', label: 'Mop' }], ticks, weeks, 4, { d: '2026-10-23', e: '2026-10-14' })
    expect(apart.newerSentence).toBe('2 boxes count from their first tick, the first on Wed, Oct 14.')
  })
  it('says so with no boxes, and with boxes nobody ticked', () => {
    const weeks = markHistoryWeeks(dailyStation(), TODAY)
    expect(markHistoryBoxes([], [], weeks).sentence).toBe('This station has no boxes.')
    const band = markHistoryBoxes(items, [], weeks)
    expect(band.sentence).toBe('No box was ticked in these weeks.')
    expect(band.leftUnticked).toHaveLength(3)
  })
})

describe('markHistory · the outcome on a mark (punch list #176, change 1)', () => {
  it('a question outranks the count: the cell is a ? whatever was open, and the title says asked', () => {
    expect(markHistoryTint(268, 50, false, 'question')).toBe('question')
    expect(markHistoryTint(0, null, false, 'done')).toBe('none')
    expect(markHistoryTint(3, null, false, 'worked')).toBe('some')
    const asked = { ...mark('2026-10-21', '09:49', 'Dana', 268), outcome: 'question' as const }
    const worked = { ...mark('2026-10-20', '09:40', 'Dana', 268), outcome: 'worked' as const }
    const weeks = markHistoryWeeks([worked, asked], TODAY, { weeks: 1 })
    const cells = weeks.flatMap((w) => w.cells)
    const wed = cells.find((c) => c.ymd === '2026-10-21')!
    const tue = cells.find((c) => c.ymd === '2026-10-20')!
    expect(wed.tint).toBe('question')
    expect(wed.outcome).toBe('question')
    expect(markHistoryCellTitle(wed)).toBe('Wed, Oct 21 · 9:49 AM · Dana · 268 open · asked')
    expect(tue.tint).toBe('some')
    expect(markHistoryCellTitle(tue)).toBe('Tue, Oct 20 · 9:40 AM · Dana · 268 open · worked')
  })

  it('a mark from before the column has no outcome and its title says nothing of it', () => {
    const old = mark('2026-10-22', '09:30', 'Dana', 2)
    const cell = markHistoryWeeks([old], TODAY, { weeks: 1 }).flatMap((w) => w.cells).find((c) => c.ymd === '2026-10-22')!
    expect(cell.outcome).toBeNull()
    expect(markHistoryCellTitle(cell)).toBe('Thu, Oct 22 · 9:30 AM · Dana · 2 open')
  })

  it('the habit counts the looks that ended in a question', () => {
    const events = [
      { ...mark('2026-10-19', '09:30', 'Dana', 268), outcome: 'worked' as const },
      { ...mark('2026-10-20', '09:30', 'Dana', 268), outcome: 'question' as const },
      { ...mark('2026-10-21', '09:30', 'Dana', 268), outcome: 'question' as const },
    ]
    expect(markHistoryHabit(events).questionSentence).toBe('Not sure what to do at 2 of 3 looks.')
    expect(markHistoryHabit([events[0]!]).questionSentence).toBe('')
  })
})
