import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { MyMailRow } from './contract'
import { JOB_DOOR_MAX, JOB_DOOR_WORDS, jobDoorHref, jobDoorQuery, jobDoorRowFacts, jobDoorRows } from './jobDoor'

/** My email's door on the job (punch list #263 PR A): the search, the rows the line draws and its words. Dale and 4 Elm Ct are made up. */
const ELM = 'pipeline:0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a01'
const HARBOR = 'bid:0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a02'
const chip = (key: string, num: string) => ({ kind: key.split(':')[0] as 'bid' | 'pipeline', id: key.split(':')[1]!, key, num, name: 'a job' })

const row = (gmailId: string, threadId: string, at: string, over: Partial<MyMailRow> = {}): MyMailRow => ({
  gmailId,
  threadId,
  direction: 'in',
  who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' },
  subject: 'Re: 4 Elm Ct water heater',
  snippet: '',
  at,
  files: 0,
  folded: null,
  tagged: null,
  guess: null,
  inMessages: null,
  ...over,
})

describe('jobDoorQuery', () => {
  it('writes from and to for each address once, then the job number quoted, flat with no braces', () => {
    expect(jobDoorQuery(['Dale@Ridgeway.example', 'dale@ridgeway.example', 'pm@ridgeway.example'], 'JP1077')).toBe(
      'from:dale@ridgeway.example OR to:dale@ridgeway.example OR from:pm@ridgeway.example OR to:pm@ridgeway.example OR "JP1077"',
    )
    expect(jobDoorQuery([], 'JP1077')).toBe('"JP1077"')
    expect(jobDoorQuery(['dale@ridgeway.example'], null)).toBe('from:dale@ridgeway.example OR to:dale@ridgeway.example')
  })

  it('leaves out an address that could break the fence, strips quotes and braces from the number, and answers nothing for nothing', () => {
    expect(jobDoorQuery(['dale (home) <dale@ridgeway.example>', 'not an address', ''], ' "JP(1077)" ')).toBe('"JP1077"')
    expect(jobDoorQuery([], '')).toBe('')
    expect(jobDoorQuery(['  '], '   ')).toBe('')
  })
})

describe('jobDoorHref', () => {
  it('opens the tab searched as the line searched', () => {
    expect(jobDoorHref('from:dale@ridgeway.example OR "JP1077"')).toBe('/messages?tab=my-email&q=from%3Adale%40ridgeway.example+OR+%22JP1077%22')
    expect(jobDoorHref('')).toBe('/messages?tab=my-email')
  })
})

describe('jobDoorRows', () => {
  it('groups the page by conversation, newest first, counts the mails in each, and drops what is on this job or folded', () => {
    const page = [
      row('m1', 't-elm', '2026-11-08T14:00:00Z'),
      row('m2', 't-elm', '2026-11-08T15:12:00Z', { files: 1 }),
      row('m3', 't-invoice', '2026-11-07T09:00:00Z', { subject: 'Invoice 88412' }),
      row('m4', 't-on-job', '2026-11-08T16:00:00Z', { tagged: { ...chip(ELM, 'JP1077'), messageId: 'l-1' } }),
      row('m5', 't-held', '2026-11-08T16:30:00Z', { inMessages: { messageId: 'l-2', jobKey: ELM } }),
      row('m6', 't-news', '2026-11-08T17:00:00Z', { folded: 'bulk' }),
      row('m7', 't-other', '2026-11-06T08:00:00Z', { tagged: { ...chip(HARBOR, 'BP523'), messageId: 'l-3' } }),
      row('m8', 't-held-elsewhere', '2026-11-05T08:00:00Z', { inMessages: { messageId: 'l-4', jobKey: HARBOR } }),
    ]
    const out = jobDoorRows(page, ELM)
    expect(out.rows.map((r) => [r.threadId, r.row.gmailId, r.count])).toEqual([
      ['t-elm', 'm2', 2],
      ['t-invoice', 'm3', 1],
      ['t-other', 'm7', 1],
    ])
    // Four conversations are not on this job: a conversation tagged onto another job and one a line holds on another job stay, since Yes moves them.
    expect(out.total).toBe(4)
    expect(out.more).toBe(1)
    expect(JOB_DOOR_MAX).toBe(3)
  })

  it('answers nothing for an empty page, and for a page whose every conversation is on the job', () => {
    expect(jobDoorRows([], ELM)).toEqual({ rows: [], more: 0, total: 0 })
    expect(jobDoorRows([row('m1', 't-elm', '2026-11-08T14:00:00Z', { tagged: { ...chip(ELM, 'JP1077'), messageId: null } })], ELM)).toEqual({ rows: [], more: 0, total: 0 })
  })
})

describe('the line’s words', () => {
  it('names the person and the count, and reads plain', () => {
    expect(JOB_DOOR_WORDS.head('Dale Okafor')).toBe('Your mail with Dale Okafor')
    expect(JOB_DOOR_WORDS.head('  ')).toBe('Your mail with them')
    expect(JOB_DOOR_WORDS.count(1)).toBe('1 conversation not on this job')
    expect(JOB_DOOR_WORDS.count(2)).toBe('2 conversations not on this job')
    expect(JOB_DOOR_WORDS.door('Dale')).toBe('All your mail with Dale ›')
    expect(JOB_DOOR_WORDS.done('JP1077')).toBe('on JP1077 ✓')
    expect(JOB_DOOR_WORDS.yesTip('JP1077')).toBe('Put this conversation on JP1077.')
    for (const words of [JOB_DOOR_WORDS.quiet, JOB_DOOR_WORDS.yesTip('JP1077'), `${JOB_DOOR_WORDS.count(2)}.`, `${JOB_DOOR_WORDS.head('Dale Okafor')}.`]) {
      expect(plainWordsFailures(words), words).toEqual([])
    }
  })

  it('writes a row’s small words: who, the day, how many in it, a clip for files', () => {
    const r = row('m2', 't-elm', '2026-11-08T15:12:00Z', { files: 1 })
    expect(jobDoorRowFacts({ threadId: 't-elm', row: r, count: 3 }, 'today')).toEqual(['Dale Okafor', 'today', '3 in it', '📎'])
    expect(jobDoorRowFacts({ threadId: 't-elm', row: { ...r, direction: 'out', files: 0 }, count: 1 }, 'Mon')).toEqual(['you', 'Mon'])
    expect(jobDoorRowFacts({ threadId: 't-elm', row: { ...r, who: { name: '', address: 'dale@ridgeway.example' }, files: 0 }, count: 1 }, 'Mon')).toEqual(['dale@ridgeway.example', 'Mon'])
  })
})
