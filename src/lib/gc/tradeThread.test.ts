/**
 * Punch list #205, PR 5: a trade partner's thread as the edge lets it read (`_shared/gcTradeThread.ts`), and how its
 * portal's Messages tab words each line and merges the emails we sent (`tradePortalThread.ts`). Made-up lines.
 */
import { describe, expect, it } from 'vitest'
import { isTradeLine, TRADE_THREAD_LINES, tradeThreadLines, type ThreadRow } from '../../../supabase/functions/_shared/gcTradeThread'
import { gcTradePortalSampleThread } from '../../../supabase/functions/_shared/gcTradePortalSample'
import type { SentMessage } from './tradePortalPage'
import { mergedThread, parseTradeThread, sentMessageText, threadJobs, TRADE_LINE_CUT, tradeThreadRows, urgentName } from './tradePortalThread'

const row = (over: Partial<ThreadRow> = {}): ThreadRow => ({
  id: 'm1',
  channel: 'text',
  direction: 'out',
  project_id: null,
  bid_id: null,
  jobs_ledger_id: null,
  who_text: 'Jordan Reyes · on site',
  at: '2026-10-07T15:05:00Z',
  subject: null,
  body: 'The framing inspection passed this morning.',
  ...over,
})
const JOBS = new Set(['p-dental'])

describe('what the company’s portal may read of its thread', () => {
  it('reads a text, an email and a line from the portal, each way', () => {
    expect(isTradeLine(row(), JOBS)).toBe(true)
    expect(isTradeLine(row({ channel: 'email', direction: 'in' }), JOBS)).toBe(true)
    expect(isTradeLine(row({ channel: 'portal', direction: 'in' }), JOBS)).toBe(true)
  })

  it('never reads a team note or event, a call, a voicemail or a missed call', () => {
    expect(isTradeLine(row({ channel: 'note', direction: 'team' }), JOBS)).toBe(false)
    expect(isTradeLine(row({ channel: 'event', direction: 'team' }), JOBS)).toBe(false)
    for (const channel of ['call', 'voicemail', 'missed']) expect(isTradeLine(row({ channel, direction: 'in' }), JOBS)).toBe(false)
  })

  it('reads a line tied to a job only when the company has an invite on it, and never one tied to a bid or a Pipeline job', () => {
    expect(isTradeLine(row({ project_id: 'p-dental' }), JOBS)).toBe(true)
    expect(isTradeLine(row({ project_id: 'p-other-company-job' }), JOBS)).toBe(false)
    expect(isTradeLine(row({ bid_id: 'b-1' }), JOBS)).toBe(false)
    expect(isTradeLine(row({ jobs_ledger_id: 'l-1' }), JOBS)).toBe(false)
  })

  it('passes only our writer’s first name, an email’s subject, and the newest lines oldest first', () => {
    const lines = tradeThreadLines(
      [
        row({ id: 'm2', at: '2026-10-08T10:00:00Z', channel: 'email', subject: 'Rough-in start', who_text: 'Avery Lin' }),
        row({ id: 'm1', subject: 'kept off a text' }),
        row({ id: 'm3', at: '2026-10-08T11:00:00Z', channel: 'portal', direction: 'in', who_text: 'Dana' }),
        row({ id: 'm4', channel: 'note', direction: 'team', body: 'Office only.' }),
        row({ id: 'm5', at: '2026-10-08T12:00:00Z', project_id: 'p-other-company-job', body: 'Another trade’s line.' }),
      ],
      JOBS,
    )
    expect(lines.map((l) => [l.id, l.dir, l.door, l.who, l.subject])).toEqual([
      ['m1', 'out', 'text', 'Jordan', null],
      ['m2', 'out', 'email', 'Avery', 'Rough-in start'],
      ['m3', 'in', 'portal', null, null],
    ])
    expect(JSON.stringify(lines)).not.toContain('Reyes')
    expect(JSON.stringify(lines)).not.toContain('Office only')
    expect(JSON.stringify(lines)).not.toContain('Another trade')
  })

  it('keeps the newest 200', () => {
    const many = Array.from({ length: 250 }, (_, i) => row({ id: `m${i}`, at: new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString() }))
    const lines = tradeThreadLines(many, JOBS)
    expect(lines).toHaveLength(TRADE_THREAD_LINES)
    expect(lines[0]!.id).toBe('m50')
  })
})

const sent = (over: Partial<SentMessage> = {}): SentMessage => ({ id: 'tm1', on: '2026-10-06', at: '2026-10-06T15:00:00Z', subject: 'Click asks you to quote', lines: ['We would like your quote.', { title: 'The lines', items: ['Service', 'Panels'] }], to: ['Dana Ortiz'], ...over })

describe('the tab’s rows', () => {
  it('reads the answer’s thread, dropping a bad line, and none from an older function', () => {
    const lines = gcTradePortalSampleThread('2026-10-08')
    expect(parseTradeThread(lines)).toEqual(lines)
    expect(parseTradeThread([...lines, { id: 'bad', at: 1 }, { id: 'x', at: 'y', body: 'z', dir: 'sideways', door: 'portal' }])).toEqual(lines)
    expect(parseTradeThread(undefined)).toBeNull()
    expect(parseTradeThread(null)).toBeNull()
  })

  it('merges the emails we sent as our email lines, oldest first, and never one the thread already holds', () => {
    const lines = gcTradePortalSampleThread('2026-10-08')
    const merged = mergedThread(lines, [sent(), sent({ id: 'tm2', on: '2026-09-29', at: '2026-09-29T15:40:00Z', subject: 'Rough-in start on Sample Dental Office', lines: ['Monday works.'] })])
    // The sample's three lines run Sep 29 to Oct 5; the quote email went Oct 6, and the Sep 29 email is already in the thread.
    expect(merged.map((l) => l.id)).toEqual([lines[0]!.id, lines[1]!.id, lines[2]!.id, 'sent:tm1'])
    expect(merged[3]).toMatchObject({ dir: 'out', door: 'email', subject: 'Click asks you to quote', body: 'We would like your quote.\nThe lines\n• Service\n• Panels' })
    expect(sentMessageText(sent())).toBe('Click asks you to quote\nWe would like your quote.\nThe lines\n• Service\n• Panels')
  })

  it('words each line with who, the day and how it came, and cuts a long one at a word', () => {
    const long = 'word '.repeat(80).trim()
    const rows = tradeThreadRows('en', [
      { id: 'a', at: '2026-10-08T14:12:00Z', dir: 'in', door: 'text', who: null, subject: null, body: 'We can start Monday.' },
      { id: 'b', at: '2026-10-08T15:40:00Z', dir: 'out', door: 'email', who: 'Avery', subject: 'Rough-in start', body: 'Monday works.' },
      { id: 'c', at: '2026-10-08T16:05:00Z', dir: 'out', door: 'portal', who: null, subject: null, body: long },
    ])
    expect(rows.map((r) => [r.mine, r.small])).toEqual([
      [true, 'You · Thu Oct 8 · by text'],
      [false, 'Avery · Thu Oct 8 · by email'],
      [false, 'Click · Thu Oct 8 · from the portal'],
    ])
    expect(rows[1]!.text).toBe('Rough-in start\nMonday works.')
    expect(rows[2]!.short.length).toBeLessThanOrEqual(TRADE_LINE_CUT + 1)
    expect(rows[2]!.short.endsWith('…')).toBe(true)
    expect(rows[2]!.text).toBe(long)
    expect(tradeThreadRows('es', [{ id: 'a', at: '2026-10-08T14:12:00Z', dir: 'in', door: 'text', who: null, subject: null, body: 'Hola.' }])[0]!.small).toBe('Usted · jue 8 oct · por mensaje de texto')
  })

  it('names who to call for something urgent, and the jobs the box can be about', () => {
    const projects = [
      { id: 'p1', name: 'Dental', lostOn: null, team: [{ role: 'projectManager' as const, name: 'Avery Lin', phone: '' }, { role: 'superintendent' as const, name: 'Jordan Reyes', phone: '' }] },
      { id: 'p2', name: 'Lost one', lostOn: '2026-09-01', team: [] },
    ]
    expect(urgentName(projects)).toBe('Jordan Reyes')
    expect(urgentName([{ team: [{ role: 'projectManager', name: 'Avery Lin', phone: '' }] }])).toBe('Avery Lin')
    expect(urgentName([{ team: [] }])).toBe('Click')
    expect(threadJobs(projects)).toEqual([{ id: 'p1', name: 'Dental' }])
  })
})
