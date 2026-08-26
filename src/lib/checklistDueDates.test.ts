import { describe, expect, it } from 'vitest'
import { doneLateLabel, dueChipLabel, effectiveDueDate } from './checklistDueDates'

describe('effectiveDueDate', () => {
  it('due date wins; falls back to the scheduled date', () => {
    expect(effectiveDueDate('2026-09-04', '2026-08-31')).toBe('2026-09-04')
    expect(effectiveDueDate(null, '2026-08-31')).toBe('2026-08-31')
    expect(effectiveDueDate(undefined, '2026-08-31')).toBe('2026-08-31')
    expect(effectiveDueDate('', '2026-08-31')).toBe('2026-08-31')
  })
})

describe('dueChipLabel', () => {
  it('window → due day → late; empty without a due date', () => {
    expect(dueChipLabel('2026-09-04', '2026-08-31')).toBe('due Fri, Sep 4')
    expect(dueChipLabel('2026-09-04', '2026-09-04')).toBe('due today')
    expect(dueChipLabel('2026-09-04', '2026-09-05')).toBe('1 day late')
    expect(dueChipLabel('2026-09-04', '2026-09-09')).toBe('5 days late')
    expect(dueChipLabel(null, '2026-09-04')).toBe('')
    expect(dueChipLabel(undefined, '2026-09-04')).toBe('')
  })
})

describe('doneLateLabel', () => {
  it('flags completions past the due day; on-time and no-due stay quiet', () => {
    expect(doneLateLabel('2026-09-06T15:30:00Z', '2026-09-04')).toMatch(/^done [12] days? late$/)
    expect(doneLateLabel('2026-09-04T12:00:00', '2026-09-04')).toBe('')
    expect(doneLateLabel('2026-09-01T12:00:00', '2026-09-04')).toBe('')
    expect(doneLateLabel('2026-09-06T12:00:00', null)).toBe('')
    expect(doneLateLabel(null, '2026-09-04')).toBe('')
  })
  it('late by exactly one calendar day', () => {
    expect(doneLateLabel('2026-09-05T08:00:00', '2026-09-04')).toBe('done 1 day late')
  })
})
