import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { ContactOwedRow, MessagePromiseRow } from '../followUp/followUpRows'
import type { JobActivityMessage } from './jobActivityMessages'
import { SUMMARY_WORDS, buildThreadSummary, customerContactIds, keepFolded, lastWordLine, readFolded, type ThreadSummaryInputs } from './threadSummary'

/** Dana and job 1104 are the mock-up's made-up people. Now is Mon 2026-10-26 8:10 AM Chicago. */
const NOW = '2026-10-26T13:10:00.000Z'
const TODAY = '2026-10-26'
const DANA = { name: 'Dana Whitfield', goesBy: null, kind: 'customer' as const }

function line(p: Partial<JobActivityMessage> & Pick<JobActivityMessage, 'id' | 'channel' | 'direction' | 'at'>): JobActivityMessage {
  return { contactId: 'c-dana', contact: DANA, who: p.direction === 'out' ? 'Rosa' : '', body: '', tied: true, ...p }
}

const SAT_TEXT_IN = line({ id: 'm-sat', channel: 'text', direction: 'in', at: '2026-10-24T21:12:00.000Z' })
const SAT_TEXT_OUT = line({ id: 'm-sat-out', channel: 'text', direction: 'out', at: '2026-10-24T14:40:00.000Z' })
const FRI_CALL_IN = line({ id: 'm-fri-call', channel: 'call', direction: 'in', at: '2026-10-23T19:51:00.000Z' })
const NOTE = line({ id: 'm-note', channel: 'note', direction: 'team', at: '2026-10-25T10:00:00.000Z', who: 'Rosa' })

const PROMISE: MessagePromiseRow = {
  id: 'p1',
  message_id: 'm-fri-call',
  kind: 'decision',
  state: 'written',
  day: '2026-10-29',
  day_words: null,
  writes: null,
  decided_by: null,
  decided_at: '2026-10-23T20:00:00.000Z',
  message: { contact_id: 'c-dana', at: '2026-10-23T19:51:00.000Z' },
}

const OWED: ContactOwedRow = {
  id: 'o1',
  contact_id: 'c-dana',
  what: 'a start date',
  by_day: '2026-11-02',
  by_words: null,
  marked_by: 'u-rosa',
  marked_at: '2026-10-23T20:05:00.000Z',
  done_at: null,
  done_how: null,
  done_note_message_id: null,
}

function inputs(p: Partial<ThreadSummaryInputs> = {}): ThreadSummaryInputs {
  return {
    customer: DANA,
    job: { status: 'working', pctComplete: 34 },
    lines: [SAT_TEXT_IN, SAT_TEXT_OUT, FRI_CALL_IN, NOTE],
    eventCount: 12,
    owed: [OWED],
    promises: [PROMISE],
    nowIso: NOW,
    todayYmd: TODAY,
    ...p,
  }
}

describe('buildThreadSummary', () => {
  it('reads the three lines from the facts, each a door to its line, with the stamp', () => {
    const s = buildThreadSummary(inputs())
    expect(s.lines.map((l) => l.label)).toEqual([SUMMARY_WORDS.stands, SUMMARY_WORDS.theirs, SUMMARY_WORDS.ours])
    expect(s.lines[0]?.text).toBe('The last word was Dana’s, a text last Saturday. The job is Working at 34%.')
    expect(s.lines[0]?.href).toBe('/messages?thread=c-dana&at=m-sat')
    expect(s.lines[0]?.doorWord).toBe('the text')
    expect(s.lines[1]?.text).toBe('Dana promised a decision by Thu Oct 29. Said last Friday.')
    expect(s.lines[1]?.href).toBe('/messages?thread=c-dana&at=m-fri-call')
    expect(s.lines[2]?.text).toBe('We owe Dana a start date by Mon Nov 2. Marked last Friday.')
    expect(s.lines[2]?.href).toBeNull()
    expect(s.counts).toEqual({ lines: 4, events: 12 })
    expect(s.stamp).toBe('Read 8:10 AM from 4 lines and 12 events.')
  })

  it('names our last word by who sent it, and a day given on a logged call as their word', () => {
    const ours = line({ id: 'm-mon', channel: 'call', direction: 'out', at: '2026-10-26T12:30:00.000Z', who: 'Rosa' })
    const s = buildThreadSummary(inputs({ lines: [SAT_TEXT_IN, ours], promises: [{ ...PROMISE, kind: 'said', message_id: 'm-mon', message: { contact_id: 'c-dana', at: ours.at } }] }))
    expect(s.lines[0]?.text).toBe('The last word was Rosa’s, a call today at 7:30 AM. The job is Working at 34%.')
    expect(s.lines[0]?.doorWord).toBe('the call')
    expect(s.lines[1]?.text).toBe('Dana gave Thu Oct 29 on the call. Said today at 7:30 AM.')
  })

  it('says plainly when nothing is written down, and when there are no lines yet', () => {
    const s = buildThreadSummary(inputs({ lines: [], owed: [], promises: [], job: { status: null, pctComplete: null }, eventCount: 1 }))
    expect(s.lines.map((l) => l.text)).toEqual([
      'No calls, texts or emails with Dana on this job yet.',
      'No day of Dana’s is written down.',
      'Nothing we owe is written down.',
    ])
    expect(s.lines.every((l) => l.href === null)).toBe(true)
    expect(s.stamp).toBe('Read 8:10 AM from 0 lines and 1 event.')
  })

  it('leaves out a promise whose day has passed, one still offered, and one on another person', () => {
    const passed = { ...PROMISE, day: '2026-10-20' }
    const offered = { ...PROMISE, id: 'p2', state: 'offered' }
    const theirs = { ...PROMISE, id: 'p3', message: { contact_id: 'c-greg', at: PROMISE.message!.at } }
    const s = buildThreadSummary(inputs({ promises: [passed, offered, theirs] }))
    expect(s.lines[1]?.text).toBe('No day of Dana’s is written down.')
  })

  it('writes the note as the title with the stamp, then the three lines', () => {
    const s = buildThreadSummary(inputs())
    expect(s.noteBody).toBe(
      [
        'Where it stands with Dana, read 8:10 AM from 4 lines and 12 events.',
        'Where it stands: The last word was Dana’s, a text last Saturday. The job is Working at 34%.',
        'Their word: Dana promised a decision by Thu Oct 29. Said last Friday.',
        'Our word: We owe Dana a start date by Mon Nov 2. Marked last Friday.',
      ].join('\n'),
    )
  })

  it('keeps every line and every word of the card to the plain-words rule', () => {
    const s = buildThreadSummary(inputs())
    for (const l of s.lines) expect(plainWordsFailures(l.text)).toEqual([])
    for (const w of [SUMMARY_WORDS.quiet, SUMMARY_WORDS.kept, SUMMARY_WORDS.failed, SUMMARY_WORDS.reading]) expect(plainWordsFailures(w)).toEqual([])
  })
})

describe('the helpers', () => {
  it('finds the last word between us and them, a team note never', () => {
    expect(lastWordLine([NOTE, SAT_TEXT_OUT, FRI_CALL_IN])?.id).toBe('m-sat-out')
    expect(lastWordLine([NOTE])).toBeNull()
  })

  it('lists the customer contacts on the lines once each', () => {
    const greg = line({ id: 'm-greg', channel: 'text', direction: 'in', at: NOW, contactId: 'c-greg', contact: { name: 'Greg', kind: 'trade' } })
    expect(customerContactIds([SAT_TEXT_IN, SAT_TEXT_OUT, greg])).toEqual(['c-dana'])
  })

  it('keeps the fold per browser and reads open when nothing is kept or storage refuses', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    expect(readFolded(storage)).toBe(false)
    keepFolded(true, storage)
    expect(readFolded(storage)).toBe(true)
    keepFolded(false, storage)
    expect(readFolded(storage)).toBe(false)
    const refusing = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') } }
    expect(readFolded(refusing)).toBe(false)
    expect(() => keepFolded(true, refusing)).not.toThrow()
  })
})
