import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { COMING_UP_DAYS, COMING_UP_EMPTY_TAIL, comingUpAddLabel, comingUpAgainWords, comingUpDays, comingUpEmptyMain, comingUpHint, comingUpLastDay } from './comingUp'

const TODAY = '2026-11-17'
const row = (id: string, ymd: string, title: string, repeat = 'once', item = `item-${id}`) => ({ id, checklist_item_id: item, scheduled_date: ymd, completed_at: null, checklist_items: { title, repeat_type: repeat } })

describe('comingUpLastDay', () => {
  it('is seven days after today', () => {
    expect(COMING_UP_DAYS).toBe(7)
    expect(comingUpLastDay(TODAY)).toBe('2026-11-24')
    expect(comingUpLastDay('2026-12-28')).toBe('2027-01-04')
  })
})

describe('comingUpDays', () => {
  it('lists the days in order and calls the first one tomorrow', () => {
    const days = comingUpDays([row('b', '2026-11-19', 'Meet the inspector'), row('a', '2026-11-18', 'Count the copper')], TODAY)
    expect(days.map((d) => d.ymd)).toEqual(['2026-11-18', '2026-11-19'])
    expect(days[0]?.label).toMatch(/^Tomorrow, Wed, Nov 18$/)
    expect(days[1]?.label).toBe('Thu, Nov 19')
    expect(days[0]?.tasks).toEqual([{ id: 'a', title: 'Count the copper', repeats: false }])
  })

  it('leaves out today, a day past the week and a task already done', () => {
    const rows = [row('today', TODAY, 'Today'), row('late', '2026-11-25', 'Past the week'), row('edge', '2026-11-24', 'The last day'), { ...row('done', '2026-11-18', 'Done early'), completed_at: '2026-11-17T15:00:00Z' }]
    const days = comingUpDays(rows, TODAY)
    expect(days.map((d) => d.ymd)).toEqual(['2026-11-24'])
  })

  it('names a repeating task once and counts it after that', () => {
    const rows = [
      row('o1', '2026-11-18', 'Check the compressor oil', 'day_of_week', 'item-oil'),
      row('o2', '2026-11-19', 'Check the compressor oil', 'day_of_week', 'item-oil'),
      row('g2', '2026-11-19', 'Open the shop gate', 'day_of_week', 'item-gate'),
      row('x', '2026-11-19', 'Meet the inspector'),
      row('o3', '2026-11-20', 'Check the compressor oil', 'day_of_week', 'item-oil'),
      row('g3', '2026-11-20', 'Open the shop gate', 'day_of_week', 'item-gate'),
    ]
    const days = comingUpDays(rows, TODAY)
    expect(days[0]).toMatchObject({ tasks: [{ id: 'o1', repeats: true }], again: 0 })
    expect(days[1]?.tasks.map((t) => t.id)).toEqual(['g2', 'x'])
    expect(days[1]?.again).toBe(1)
    expect(days[2]).toMatchObject({ tasks: [], again: 2 })
  })

  it('never leaves a title empty', () => {
    const days = comingUpDays([row('a', '2026-11-18', '')], TODAY)
    expect(days[0]?.tasks[0]?.title).toBe('Task')
  })

  it('answers no days for a week with nothing dated', () => {
    expect(comingUpDays([], TODAY)).toEqual([])
  })
})

describe('the words of Coming up', () => {
  it('counts the repeating tasks an earlier day named', () => {
    expect(comingUpAgainWords(1)).toBe('1 repeating task again')
    expect(comingUpAgainWords(3)).toBe('3 repeating tasks again')
  })

  it('names the person on the press that fills an empty week', () => {
    expect(comingUpAddLabel('June Park')).toBe('＋ Add task for June')
  })

  it('every line is plain words', () => {
    for (const s of [comingUpHint('Dana Whitlow'), comingUpEmptyMain(), `${comingUpEmptyMain()} Add task for June ${COMING_UP_EMPTY_TAIL}`, comingUpAgainWords(2)]) expect(plainWordsFailures(s)).toEqual([])
  })
})
