import { describe, expect, it } from 'vitest'
import { isRowDefaultCollapsed, isSectionDefaultExpanded, isStepEmpty } from './stageCardDefaults'

describe('isRowDefaultCollapsed', () => {
  it('folds pending and finished steps', () => {
    for (const status of ['pending', 'completed', 'approved', 'skipped']) {
      expect(isRowDefaultCollapsed({ status })).toBe(true)
    }
  })

  it('opens the steps that need someone: in progress and rejected', () => {
    expect(isRowDefaultCollapsed({ status: 'in_progress' })).toBe(false)
    expect(isRowDefaultCollapsed({ status: 'rejected' })).toBe(false)
  })
})

describe('isStepEmpty', () => {
  const blank = { status: 'pending', assigned_to_name: null, notes: null, private_notes: null, started_at: null }

  it('is empty when pending with nothing on it', () => {
    expect(isStepEmpty(blank, 0)).toBe(true)
  })

  it('counts blank-only text as nothing', () => {
    expect(isStepEmpty({ ...blank, assigned_to_name: '  ', notes: '\n', private_notes: ' ' }, 0)).toBe(true)
  })

  it('is not empty with an assignee, a note, an office note, a line item or a start', () => {
    expect(isStepEmpty({ ...blank, assigned_to_name: 'Sam' }, 0)).toBe(false)
    expect(isStepEmpty({ ...blank, notes: 'call first' }, 0)).toBe(false)
    expect(isStepEmpty({ ...blank, private_notes: 'owes us' }, 0)).toBe(false)
    expect(isStepEmpty(blank, 1)).toBe(false)
    expect(isStepEmpty({ ...blank, started_at: '2026-09-07T12:00:00Z' }, 0)).toBe(false)
  })

  it('is not empty once it has left pending, even with nothing on it', () => {
    for (const status of ['in_progress', 'completed', 'approved', 'rejected', 'skipped']) {
      expect(isStepEmpty({ ...blank, status }, 0)).toBe(false)
    }
  })
})

describe('isSectionDefaultExpanded', () => {
  const written = { notes: 'call first', private_notes: 'owes us' }
  const unwritten = { notes: '  ', private_notes: null }

  it('starts line items open and Notify closed, whatever the step holds', () => {
    expect(isSectionDefaultExpanded(written, 'lineItems')).toBe(true)
    expect(isSectionDefaultExpanded(unwritten, 'lineItems')).toBe(true)
    expect(isSectionDefaultExpanded(written, 'notify')).toBe(false)
    expect(isSectionDefaultExpanded(unwritten, 'notify')).toBe(false)
  })

  it('opens each note only when it has been written', () => {
    expect(isSectionDefaultExpanded(written, 'notes')).toBe(true)
    expect(isSectionDefaultExpanded(written, 'privateNotes')).toBe(true)
    expect(isSectionDefaultExpanded(unwritten, 'notes')).toBe(false)
    expect(isSectionDefaultExpanded(unwritten, 'privateNotes')).toBe(false)
  })

  it('reads each note on its own', () => {
    expect(isSectionDefaultExpanded({ notes: 'x', private_notes: null }, 'privateNotes')).toBe(false)
    expect(isSectionDefaultExpanded({ notes: null, private_notes: 'x' }, 'notes')).toBe(false)
  })
})
