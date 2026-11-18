import { describe, expect, it } from 'vitest'
import { isAnswered, myNoteLine, readNotesKnown, readNotesSeenAt, unreadAnswerCount, writeNotesKnown, writeNotesSeenAt, type MyNote } from './myNotes'

function note(over: Partial<MyNote> = {}): MyNote {
  return { id: 'n1', kind: 'want', body: 'I want a search box', status: 'open', created_at: '2026-11-14T15:00:00Z', closed_at: null, closed_note: null, ...over }
}

function memoryStorage() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

describe('an answer', () => {
  it('is a note closed with words', () => {
    expect(isAnswered(note())).toBe(false)
    expect(isAnswered(note({ status: 'closed', closed_at: '2026-11-15T00:00:00Z' }))).toBe(false)
    expect(isAnswered(note({ status: 'closed', closed_at: '2026-11-15T00:00:00Z', closed_note: '  ' }))).toBe(false)
    expect(isAnswered(note({ status: 'closed', closed_at: '2026-11-15T00:00:00Z', closed_note: 'Shipped.' }))).toBe(true)
  })

  it('is unread until the box has listed the notes after it', () => {
    const answered = note({ status: 'closed', closed_at: '2026-11-15T12:00:00Z', closed_note: 'Shipped.' })
    expect(unreadAnswerCount([answered, note({ id: 'n2' })], null)).toBe(1)
    expect(unreadAnswerCount([answered], '2026-11-15T11:00:00Z')).toBe(1)
    expect(unreadAnswerCount([answered], '2026-11-15T13:00:00Z')).toBe(0)
  })

  it('a note closed with no words lights no dot', () => {
    expect(unreadAnswerCount([note({ status: 'closed', closed_at: '2026-11-15T12:00:00Z' })], null)).toBe(0)
  })
})

describe('myNoteLine', () => {
  it('says Sent with the day for a note still open', () => {
    expect(myNoteLine(note(), null, 'en-US')).toEqual({ id: 'n1', words: 'I want a search box', wordless: false, chip: 'Sent Nov 14', state: 'sent', answer: null, fresh: false })
  })

  it('says Answered with the day and carries the answer, fresh until seen', () => {
    const n = note({ status: 'closed', closed_at: '2026-11-15T18:00:00Z', closed_note: ' Shipped. It is under the bill’s code. ' })
    expect(myNoteLine(n, null, 'en-US')).toMatchObject({ chip: 'Answered Nov 15', state: 'answered', answer: 'Shipped. It is under the bill’s code.', fresh: true })
    expect(myNoteLine(n, '2026-11-16T00:00:00Z', 'en-US').fresh).toBe(false)
  })

  it('says Closed for a note closed with no words', () => {
    expect(myNoteLine(note({ status: 'closed', closed_at: '2026-11-15T18:00:00Z' }), null, 'en-US')).toMatchObject({ chip: 'Closed Nov 15', state: 'closed', answer: null, fresh: false })
  })

  it('stands in for a note sent with no words', () => {
    expect(myNoteLine(note({ kind: 'confusing', body: '' }), null, 'en-US')).toMatchObject({ words: 'No words. This page is confusing.', wordless: true })
  })

  it('still reads with no dates', () => {
    expect(myNoteLine(note({ created_at: null }), null, 'en-US').chip).toBe('Sent')
  })
})

describe('what this device remembers', () => {
  it('keeps when the notes were last listed, per person', () => {
    const s = memoryStorage()
    expect(readNotesSeenAt(s, 'u1')).toBeNull()
    writeNotesSeenAt(s, 'u1', '2026-11-15T00:00:00Z')
    expect(readNotesSeenAt(s, 'u1')).toBe('2026-11-15T00:00:00Z')
    expect(readNotesSeenAt(s, 'u2')).toBeNull()
    expect(readNotesSeenAt(s, null)).toBeNull()
  })

  it('knows a device that has sent or listed a note, so only it looks for answers', () => {
    const s = memoryStorage()
    expect(readNotesKnown(s, 'u1')).toBe(false)
    writeNotesKnown(s, 'u1')
    expect(readNotesKnown(s, 'u1')).toBe(true)
    expect(readNotesKnown(s, 'u2')).toBe(false)
  })
})
