import { describe, expect, it } from 'vitest'
import {
  EMPTY_LABOR_CELL_SAVE_MAP,
  beginLaborCellSaves,
  finishLaborCellSaves,
  laborCellAriaLabel,
  laborCellStatusTitle,
  markLaborCellPending,
} from './laborCellSaveState'

describe('labor cell save state (J11-F8)', () => {
  it('pending → saving → gone across one autosave round', () => {
    let m = markLaborCellPending(EMPTY_LABOR_CELL_SAVE_MAP, 'labor:r1:rough_in')
    m = markLaborCellPending(m, 'rate:labor')
    expect(m).toEqual({ 'labor:r1:rough_in': 'pending', 'rate:labor': 'pending' })
    m = beginLaborCellSaves(m)
    expect(m).toEqual({ 'labor:r1:rough_in': 'saving', 'rate:labor': 'saving' })
    m = finishLaborCellSaves(m)
    expect(m).toEqual({})
  })

  it('an edit during the save stays pending for the next round', () => {
    let m = beginLaborCellSaves(markLaborCellPending(EMPTY_LABOR_CELL_SAVE_MAP, 'a'))
    m = markLaborCellPending(m, 'a') // re-edited while in flight
    m = markLaborCellPending(m, 'b')
    expect(m).toEqual({ a: 'pending', b: 'pending' })
    expect(finishLaborCellSaves(m)).toEqual({ a: 'pending', b: 'pending' })
  })

  it('returns the same map when nothing changes (cheap re-renders)', () => {
    const m = markLaborCellPending(EMPTY_LABOR_CELL_SAVE_MAP, 'a')
    expect(markLaborCellPending(m, 'a')).toBe(m)
    expect(finishLaborCellSaves(m)).toBe(m)
    expect(beginLaborCellSaves(EMPTY_LABOR_CELL_SAVE_MAP)).toBe(EMPTY_LABOR_CELL_SAVE_MAP)
  })

  it('names a cell by column, row and section', () => {
    expect(laborCellAriaLabel('Rough In hours per unit', 'Water Closet')).toBe('Rough In hours per unit — Water Closet')
    expect(laborCellAriaLabel('Trim Set dollars', 'Excavator', 'Equipment & Tool Rental')).toBe('Trim Set dollars — Excavator (Equipment & Tool Rental)')
    expect(laborCellAriaLabel('Top Out dollars', '  ', 'Permits')).toBe('Top Out dollars — untitled row (Permits)')
  })

  it('has a status title only while unsaved or saving', () => {
    expect(laborCellStatusTitle('pending')).toMatch(/Unsaved/)
    expect(laborCellStatusTitle('saving')).toBe('Saving…')
    expect(laborCellStatusTitle(undefined)).toBeUndefined()
  })
})
