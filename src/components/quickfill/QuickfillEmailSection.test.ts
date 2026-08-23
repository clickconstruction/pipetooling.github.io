import { describe, expect, it } from 'vitest'
import { composeEmailMarkNote, countEmailNoteLines } from './QuickfillEmailSection'

describe('QuickfillEmailSection note', () => {
  it('joins non-empty rows with their labels; empty → empty string', () => {
    expect(composeEmailMarkNote({ inbox: ' clear ', 'follow-up': '', 'next-actions': 'call Reece\nPO 118' })).toBe('Inbox: clear\nNext Actions: call Reece\nPO 118')
    expect(composeEmailMarkNote({ inbox: '', 'follow-up': '  ', 'next-actions': '' })).toBe('')
  })
  it('counts lines across rows for the N open metric', () => {
    expect(countEmailNoteLines({ inbox: 'a\nb', 'follow-up': '', 'next-actions': 'c' })).toBe(3)
  })
})
