import { describe, expect, it } from 'vitest'
import {
  SUB_SHEET_STAGES,
  SUB_SHEET_STAGE_LABEL,
  describeSubSheetStageChange,
  isSubSheetStage,
  nextSubSheetStage,
  normalizeSubSheetStage,
  normalizeSubSheetStageSource,
  prevSubSheetStage,
  subSheetStageStamp,
} from './subSheetStage'

describe('subSheetStage', () => {
  it('orders the three stored stages and steps both ways', () => {
    expect(SUB_SHEET_STAGES).toEqual(['working', 'walkthrough', 'customer_pay'])
    expect(nextSubSheetStage('working')).toBe('walkthrough')
    expect(nextSubSheetStage('walkthrough')).toBe('customer_pay')
    expect(nextSubSheetStage('customer_pay')).toBeNull()
    expect(prevSubSheetStage('working')).toBeNull()
    expect(prevSubSheetStage('customer_pay')).toBe('walkthrough')
  })

  it('normalizes unknown values to working (the column default)', () => {
    expect(isSubSheetStage('walkthrough')).toBe(true)
    expect(isSubSheetStage('complete')).toBe(false)
    expect(normalizeSubSheetStage(null)).toBe('working')
    expect(normalizeSubSheetStage('in_progress')).toBe('working')
    expect(normalizeSubSheetStageSource('portal')).toBe('portal')
    expect(normalizeSubSheetStageSource('sub')).toBeNull()
  })

  it('describes a change in the office vocabulary', () => {
    expect(describeSubSheetStageChange('working', 'walkthrough')).toBe('Waiting on work → Waiting on walk-through')
    expect(SUB_SHEET_STAGE_LABEL.customer_pay).toBe('Waiting on customer')
  })

  it('stamps who moved it', () => {
    expect(
      subSheetStageStamp({ source: 'portal', changedAt: '2026-09-04T20:12:00Z', changedByName: null, contractorName: 'Danny Vasquez' }),
    ).toBe('Danny, from the portal · Sep 4')
    expect(
      subSheetStageStamp({ source: 'office', changedAt: '2026-09-06T14:40:00Z', changedByName: 'Malachi', contractorName: 'Danny Vasquez' }),
    ).toBe('Malachi · Sep 6')
    expect(subSheetStageStamp({ source: 'office', changedAt: null, changedByName: null, contractorName: null })).toBe('office')
    expect(subSheetStageStamp({ source: null, changedAt: null, changedByName: null, contractorName: null })).toBeNull()
  })
})
