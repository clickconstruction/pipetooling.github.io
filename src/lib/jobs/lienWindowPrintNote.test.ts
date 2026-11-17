import { describe, expect, it } from 'vitest'
import { LIEN_WINDOW_PRINT_NOTE_PRESS, lienWindowPrintNote } from './lienWindowPrintNote'
import { plainWordsFailures } from '../plainWords'

describe('the Lien window says when the desk holds the approved notice (v2.7516)', () => {
  it('an approved notice waiting to print: print the desk’s, and why', () => {
    const note = lienWindowPrintNote('ready')!
    expect(note.lead).toBe('The Lien desk holds this job’s approved notice.')
    expect(note.words).toContain('Print that one from the desk, under Just this one.')
    expect(note.words).toContain('A print from this tab is a new copy with no signature.')
    expect(note.press).toBe(LIEN_WINDOW_PRINT_NOTE_PRESS)
  })

  it('a printed notice waiting on its mail numbers: enter them on the desk', () => {
    const note = lienWindowPrintNote('printed')!
    expect(note.lead).toBe('The Lien desk has printed this job’s notice.')
    expect(note.words).toContain('Enter them on the desk.')
  })

  it('says nothing for a notice that is not approved yet, one already sent, or a job the opener knows nothing of', () => {
    for (const state of ['', 'needs_owner', 'to_draft', 'awaiting', 'held', 'sent', null, undefined] as const) expect(lienWindowPrintNote(state)).toBeNull()
  })

  it('keeps to the plain-words rules', () => {
    for (const state of ['ready', 'printed'] as const) {
      const note = lienWindowPrintNote(state)!
      expect(plainWordsFailures(note.lead)).toEqual([])
      expect(plainWordsFailures(note.words)).toEqual([])
    }
  })
})
