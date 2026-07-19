import { describe, expect, it } from 'vitest'
import {
  composePctCompleteNoteBody,
  pctNoteRequired,
  validatePctCommit,
} from './stagesPctNote'

describe('pctNoteRequired', () => {
  it('is required below 100', () => {
    expect(pctNoteRequired(0)).toBe(true)
    expect(pctNoteRequired(45)).toBe(true)
    expect(pctNoteRequired(99)).toBe(true)
  })
  it('is not required at exactly 100', () => {
    expect(pctNoteRequired(100)).toBe(false)
  })
})

describe('composePctCompleteNoteBody', () => {
  it('includes the note after a dash', () => {
    expect(composePctCompleteNoteBody(45, 'rough-in done')).toBe('45% complete — rough-in done')
  })
  it('trims the note', () => {
    expect(composePctCompleteNoteBody(30, '  waiting on parts  ')).toBe('30% complete — waiting on parts')
  })
  it('omits the dash when there is no note', () => {
    expect(composePctCompleteNoteBody(100, '')).toBe('100% complete')
    expect(composePctCompleteNoteBody(100, '   ')).toBe('100% complete')
  })
})

describe('validatePctCommit', () => {
  it('blocks a sub-100 set with no note', () => {
    expect(validatePctCommit(45, '')).toEqual({ ok: false, error: 'Add a note for anything under 100%.' })
    expect(validatePctCommit(45, '   ')).toEqual({ ok: false, error: 'Add a note for anything under 100%.' })
  })
  it('allows a sub-100 set with a note', () => {
    expect(validatePctCommit(45, 'framing done')).toEqual({ ok: true })
  })
  it('allows 100 with or without a note', () => {
    expect(validatePctCommit(100, '')).toEqual({ ok: true })
    expect(validatePctCommit(100, 'all wrapped up')).toEqual({ ok: true })
  })
})
