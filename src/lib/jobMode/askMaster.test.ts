import { describe, expect, it } from 'vitest'
import { ASK_MASTER_WORDS, askFirstName, askMasterFactsLine, askMasterNoteBody, askMasterQuickQuestions, askMasterReady, askedLine, mastersToAsk } from './askMaster'
import type { NoteTagRow, TaggablePerson } from '../jobs/noteTags'
import { plainWordsFailures } from '../plainWords'

const person = (p: Partial<TaggablePerson> & { userId: string; name: string }): TaggablePerson => ({ role: 'master_technician', onJob: false, ...p })
const facts = { pct: 25, hoursWords: '9 of 70 h', finishWords: 'Fri, Nov 20' }

describe('mastersToAsk', () => {
  it('offers the masters on the job, by name', () => {
    const people = [person({ userId: 'm2', name: 'Rae Ortiz', onJob: true }), person({ userId: 'm1', name: 'Dana Whitfield', onJob: true }), person({ userId: 'm3', name: 'Office Master' }), person({ userId: 'a1', name: 'Ana', role: 'assistant' })]
    expect(mastersToAsk(people, 'me').map((p) => p.userId)).toEqual(['m1', 'm2'])
  })

  it('falls back to the masters in the office when the job names none he can tag', () => {
    const people = [person({ userId: 'm3', name: 'Office Master' }), person({ userId: 'h1', name: 'Helper', role: 'helpers', onJob: true })]
    expect(mastersToAsk(people, 'me').map((p) => p.userId)).toEqual(['m3'])
  })

  it('never offers the asker, and is empty with no master at all', () => {
    expect(mastersToAsk([person({ userId: 'me', name: 'Me', onJob: true })], 'me')).toEqual([])
    expect(mastersToAsk([person({ userId: 'a1', name: 'Ana', role: 'assistant' })], 'me')).toEqual([])
  })
})

describe('the note', () => {
  it('puts the card’s numbers in one line, with whatever the card has', () => {
    expect(askMasterFactsLine(facts)).toBe('25% done, 9 of 70 h, finish Fri, Nov 20')
    expect(askMasterFactsLine({ pct: null, hoursWords: '9 of 70 h', finishWords: null })).toBe('9 of 70 h')
    expect(askMasterFactsLine({ pct: null, hoursWords: null, finishWords: null })).toBe('')
  })

  it('posts the question, then the numbers on their own line', () => {
    expect(askMasterNoteBody('  Does rough-in include the roof drains? ', facts)).toBe('Does rough-in include the roof drains?\nPace card: 25% done, 9 of 70 h, finish Fri, Nov 20.')
    expect(askMasterNoteBody('Is this right?', { pct: null, hoursWords: null, finishWords: null })).toBe('Is this right?')
  })

  it('offers quick questions that fit what the card knows', () => {
    expect(askMasterQuickQuestions(facts)).toEqual(['Is 25% right?', 'What counts as done on this stage?', 'The planned finish looks wrong.'])
    // With a stage in hand on the rail, the question names it.
    expect(askMasterQuickQuestions({ ...facts, stage: 'Rough-in' })[1]).toBe('What counts as done on Rough-in?')
    expect(askMasterQuickQuestions({ pct: null, hoursWords: null, finishWords: null })).toEqual(['What should the percent read?', 'What counts as done on this stage?', 'When should this job finish?'])
  })

  it('sends only a question that has words and someone to go to', () => {
    const dana = person({ userId: 'm1', name: 'Dana Whitfield', onJob: true })
    expect(askMasterReady('Is 25% right?', dana)).toBe(true)
    expect(askMasterReady('   ', dana)).toBe(false)
    expect(askMasterReady('Is 25% right?', null)).toBe(false)
  })
})

describe('askedLine', () => {
  const row = (r: Partial<NoteTagRow>): NoteTagRow => ({ noteId: 'n1', taggedUserId: 'm1', taggedName: 'Dana Whitfield', taggerUserId: 'me', createdAt: '2026-11-18T15:00:00Z', clearedAt: null, clearedHow: null, ...r })
  const now = Date.parse('2026-11-18T18:00:00Z')

  it('says who the question waits on', () => {
    expect(askedLine([row({})], 'me', now)).toEqual({ words: 'Waiting on Dana.', waiting: true })
  })

  it('says an answer landed, for a few days', () => {
    expect(askedLine([row({ clearedAt: '2026-11-18T17:00:00Z', clearedHow: 'answered' })], 'me', now)).toEqual({ words: 'Dana answered. Open this job to read it.', waiting: false })
    expect(askedLine([row({ clearedAt: '2026-11-18T17:00:00Z', clearedHow: 'done' })], 'me', now)).toEqual({ words: 'Dana said no reply is needed.', waiting: false })
    expect(askedLine([row({ clearedAt: '2026-11-10T17:00:00Z', clearedHow: 'answered' })], 'me', now)).toBeNull()
  })

  it('reads only his own questions, and the newest one speaks', () => {
    expect(askedLine([row({ taggerUserId: 'someone-else' })], 'me', now)).toBeNull()
    const older = row({ noteId: 'n0', createdAt: '2026-11-17T15:00:00Z', clearedAt: '2026-11-17T16:00:00Z', clearedHow: 'answered' })
    const newer = row({ noteId: 'n2', taggedName: 'Rae Ortiz', createdAt: '2026-11-18T16:00:00Z' })
    expect(askedLine([older, newer], 'me', now)).toEqual({ words: 'Waiting on Rae.', waiting: true })
    expect(askedLine([], 'me', now)).toBeNull()
    expect(askedLine([row({})], null, now)).toBeNull()
  })
})

describe('the words', () => {
  it('names the person on the press and in the toast', () => {
    expect(askFirstName('Dana Whitfield')).toBe('Dana')
    expect(ASK_MASTER_WORDS.send('Dana Whitfield')).toBe('Send to Dana')
    expect(ASK_MASTER_WORDS.sent('Dana Whitfield')).toBe('Sent to Dana. The answer shows under You asked, on Jobs.')
  })

  it('keeps every sentence inside the plain words rules', () => {
    const lines = [ASK_MASTER_WORDS.title, ASK_MASTER_WORDS.reading, ASK_MASTER_WORDS.nobody, ASK_MASTER_WORDS.sent('Dana'), 'Waiting on Dana.', 'Dana answered. Open this job to read it.', 'Dana said no reply is needed.', ...askMasterQuickQuestions(facts)]
    for (const words of lines) expect(plainWordsFailures(words), words).toEqual([])
  })
})
