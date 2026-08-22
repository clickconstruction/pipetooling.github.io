import { describe, expect, it } from 'vitest'
import {
  dowOfYmd,
  materializeDates,
  planEditRegeneration,
  type MaterializeConfig,
  type RegenInstanceLite,
} from './checklistMaterialize'

const weekly = (days: number[], over: Partial<MaterializeConfig> = {}): MaterializeConfig => ({
  repeat_type: 'day_of_week',
  repeat_days_of_week: days,
  start_date: '2026-08-21',
  repeat_end_date: null,
  ...over,
})

describe('dowOfYmd', () => {
  it('is timezone-inert: 2026-08-21 is a Friday everywhere', () => {
    expect(dowOfYmd('2026-08-21')).toBe(5)
    expect(dowOfYmd('2026-08-23')).toBe(0)
  })
})

describe('materializeDates', () => {
  it('weekly: every matching weekday in the window, from start_date', () => {
    // Mondays (1) and Thursdays (4); start Fri Aug 21.
    expect(materializeDates(weekly([1, 4]), '2026-08-21', '2026-09-03')).toEqual([
      '2026-08-24',
      '2026-08-27',
      '2026-08-31',
      '2026-09-03',
    ])
  })

  it('weekly: never emits a date before start_date (the old UTC-anchor bug)', () => {
    // Start Fri Aug 21, choose Thursday: first hit must be Aug 27, not Aug 20.
    const dates = materializeDates(weekly([4]), '2026-08-14', '2026-08-31')
    expect(dates[0]).toBe('2026-08-27')
  })

  it('weekly: honors repeat_end_date', () => {
    expect(materializeDates(weekly([1], { repeat_end_date: '2026-08-30' }), '2026-08-21', '2026-09-30')).toEqual([
      '2026-08-24',
    ])
  })

  it('once / after-completion: only the start date, only when in window', () => {
    const once: MaterializeConfig = { repeat_type: 'once', repeat_days_of_week: null, start_date: '2026-09-01', repeat_end_date: null }
    expect(materializeDates(once, '2026-08-21', '2026-09-30')).toEqual(['2026-09-01'])
    expect(materializeDates(once, '2026-08-21', '2026-08-31')).toEqual([])
    const chain: MaterializeConfig = { ...once, repeat_type: 'days_after_completion' }
    expect(materializeDates(chain, '2026-08-21', '2026-09-30')).toEqual(['2026-09-01'])
  })

  it('empty windows and empty day sets are empty', () => {
    expect(materializeDates(weekly([]), '2026-08-21', '2026-09-30')).toEqual([])
    expect(materializeDates(weekly([1]), '2026-09-30', '2026-08-21')).toEqual([])
  })
})

describe('planEditRegeneration', () => {
  const today = '2026-08-21'
  const inst = (over: Partial<RegenInstanceLite>): RegenInstanceLite => ({
    id: 'i1',
    scheduled_date: '2026-08-28',
    completed_at: null,
    hasEvents: false,
    ...over,
  })

  it('once: moves the open occurrence to the new date, keeping its identity', () => {
    const plan = planEditRegeneration(
      { repeat_type: 'once', repeat_days_of_week: null, start_date: '2026-09-04', repeat_end_date: null },
      [inst({ id: 'open1', scheduled_date: '2026-08-25' })],
      today,
    )
    expect(plan).toEqual({ deleteIds: [], createDates: [], moveInstanceId: 'open1', moveTo: '2026-09-04' })
  })

  it('once: leaves a completed occurrence alone', () => {
    const plan = planEditRegeneration(
      { repeat_type: 'once', repeat_days_of_week: null, start_date: '2026-09-04', repeat_end_date: null },
      [inst({ completed_at: '2026-08-20T12:00:00Z' })],
      today,
    )
    expect(plan.moveInstanceId).toBeNull()
    expect(plan.createDates).toEqual([])
  })

  it('after-completion: in-flight chains (any completion) are untouched', () => {
    const plan = planEditRegeneration(
      { repeat_type: 'days_after_completion', repeat_days_of_week: null, start_date: '2026-09-04', repeat_end_date: null },
      [inst({ id: 'done', completed_at: 'x', scheduled_date: '2026-08-10' }), inst({ id: 'open', scheduled_date: '2026-08-24' })],
      today,
    )
    expect(plan).toEqual({ deleteIds: [], createDates: [], moveInstanceId: null, moveTo: null })
  })

  it('weekly: deletes future clean strays, creates missing wanted dates, keeps past + discussed', () => {
    const plan = planEditRegeneration(
      weekly([1]), // Mondays only now
      [
        inst({ id: 'past-thu', scheduled_date: '2026-08-20' }), // past — untouched
        inst({ id: 'fut-thu-clean', scheduled_date: '2026-08-27' }), // wrong day, clean → delete
        inst({ id: 'fut-thu-notes', scheduled_date: '2026-09-03', hasEvents: true }), // wrong day but discussed → keep
        inst({ id: 'fut-mon', scheduled_date: '2026-08-24' }), // right day → keep
      ],
      today,
      14,
    )
    expect(plan.deleteIds).toEqual(['fut-thu-clean'])
    expect(plan.createDates).toEqual(['2026-08-31'])
    expect(plan.moveInstanceId).toBeNull()
  })
})
