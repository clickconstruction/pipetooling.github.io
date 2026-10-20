// The customer's thread on their page (Messages cut 8e): what the edge lets them read (`_shared/gcPortalThread.ts`), whose
// thread it is, and how the tab words each line. Made-up lines.
import { describe, expect, it } from 'vitest'
import { isTheirLine, pageContactOf, portalThreadLines, THREAD_LINES, type ThreadRow } from '../../../supabase/functions/_shared/gcPortalThread'
import { LINE_CUT, parsePortalThread, threadRows, urgentName } from './portalThread'

const row = (over: Partial<ThreadRow> = {}): ThreadRow => ({
  id: 'm1',
  channel: 'text',
  direction: 'out',
  project_id: null,
  bid_id: null,
  jobs_ledger_id: null,
  who_text: 'Wendi Park · on site',
  at: '2026-10-07T15:05:00Z',
  subject: null,
  body: 'The framing inspection passed this morning.',
  ...over,
})
const JOBS = { projects: new Set(['p-clinic']), bids: new Set(['b-1']), ledger: new Set(['l-1']) }

describe('what their page may read of the thread', () => {
  it('reads a text, an email and a line from their page, each way', () => {
    expect(isTheirLine(row(), JOBS)).toBe(true)
    expect(isTheirLine(row({ channel: 'email', direction: 'in' }), JOBS)).toBe(true)
    expect(isTheirLine(row({ channel: 'portal', direction: 'in' }), JOBS)).toBe(true)
  })

  it('never reads a team note or event, a call, a voicemail or a missed call', () => {
    expect(isTheirLine(row({ channel: 'note', direction: 'team' }), JOBS)).toBe(false)
    expect(isTheirLine(row({ channel: 'event', direction: 'team' }), JOBS)).toBe(false)
    for (const channel of ['call', 'voicemail', 'missed']) expect(isTheirLine(row({ channel, direction: 'in' }), JOBS)).toBe(false)
  })

  it('reads a line tied to a job only when the job is theirs', () => {
    expect(isTheirLine(row({ project_id: 'p-clinic' }), JOBS)).toBe(true)
    expect(isTheirLine(row({ project_id: 'p-other' }), JOBS)).toBe(false)
    expect(isTheirLine(row({ bid_id: 'b-1' }), JOBS)).toBe(true)
    expect(isTheirLine(row({ jobs_ledger_id: 'l-9' }), JOBS)).toBe(false)
  })

  it('passes only our writer’s first name, an email’s subject, and the newest lines oldest first', () => {
    const lines = portalThreadLines(
      [
        row({ id: 'm2', at: '2026-10-08T10:00:00Z', channel: 'email', subject: 'Coffee bar', who_text: 'Robert Lane' }),
        row({ id: 'm1', subject: 'kept off a text' }),
        row({ id: 'm3', at: '2026-10-08T11:00:00Z', channel: 'portal', direction: 'in', who_text: 'Priya' }),
        row({ id: 'm4', channel: 'note', direction: 'team', body: 'Office only.' }),
      ],
      JOBS,
    )
    expect(lines).toEqual([
      { id: 'm1', at: '2026-10-07T15:05:00Z', dir: 'out', door: 'text', who: 'Wendi', subject: null, body: 'The framing inspection passed this morning.' },
      { id: 'm2', at: '2026-10-08T10:00:00Z', dir: 'out', door: 'email', who: 'Robert', subject: 'Coffee bar', body: 'The framing inspection passed this morning.' },
      { id: 'm3', at: '2026-10-08T11:00:00Z', dir: 'in', door: 'portal', who: null, subject: null, body: 'The framing inspection passed this morning.' },
    ])
    const many = Array.from({ length: THREAD_LINES + 5 }, (_, i) => row({ id: `n${String(i).padStart(3, '0')}`, at: `2026-10-${String(1 + Math.floor(i / 24)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00Z` }))
    const kept = portalThreadLines(many, JOBS)
    expect(kept).toHaveLength(THREAD_LINES)
    expect(kept[0]?.id).toBe('n005')
  })

  it('reads the page’s contact: the customer’s own row, else the first person in the seed’s order', () => {
    expect(pageContactOf({ id: 'own' }, [{ id: 'p1', created_at: '2026-10-12T10:00:00Z' }])).toBe('own')
    expect(
      pageContactOf(null, [
        { id: 'p2', created_at: '2026-10-12T10:00:02Z' },
        { id: 'p1', created_at: '2026-10-12T10:00:01Z' },
      ]),
    ).toBe('p1')
    expect(pageContactOf(null, [])).toBeNull()
  })
})

describe('the Messages tab’s lines', () => {
  const lines = parsePortalThread([
    { id: 'm1', at: '2026-10-07T15:05:00Z', dir: 'out', door: 'text', who: 'Wendi', subject: null, body: 'The framing inspection passed this morning.' },
    { id: 'm2', at: '2026-10-08T21:30:00Z', dir: 'in', door: 'portal', who: null, subject: null, body: 'Can we look at the coffee bar on Friday?' },
    { id: 'm3', at: '2026-10-08T22:10:00Z', dir: 'out', door: 'email', who: null, subject: 'Coffee bar cabinet', body: 'x '.repeat(200) },
    { id: 'bad', at: '2026-10-08T22:10:00Z', dir: 'team', door: 'note', body: 'Office only.' },
  ])

  it('reads the answer’s thread, a bad line dropped, and none from an older function', () => {
    expect(lines?.map((l) => l.id)).toEqual(['m1', 'm2', 'm3'])
    expect(parsePortalThread(undefined)).toBeNull()
  })

  it('words each line with who, the day in Chicago and how it came, a long one cut at a word', () => {
    const rows = threadRows('en', lines ?? [], 'Click Construction')
    expect(rows.map((r) => [r.mine, r.small])).toEqual([
      [false, 'Wendi · Wed Oct 7 · by text'],
      [true, 'You · Thu Oct 8 · here'],
      [false, 'Click Construction · Thu Oct 8 · by email'],
    ])
    expect(rows[2]?.text.startsWith('Coffee bar cabinet: x x')).toBe(true)
    expect(rows[2]?.text.endsWith('…')).toBe(true)
    expect((rows[2]?.text.length ?? 0) <= LINE_CUT + 1).toBe(true)
    expect(threadRows('es', lines ?? [], 'Click Construction')[1]?.small).toBe('Usted · jue 8 oct · aquí')
  })

  it('names who to call on site: the superintendent, else the project manager, else our company', () => {
    expect(urgentName({ people: [{ role: 'pm', name: 'Robert' }, { role: 'super', name: 'Wendi' }] }, 'Click Construction')).toBe('Wendi')
    expect(urgentName({ people: [{ role: 'pm', name: 'Robert' }] }, 'Click Construction')).toBe('Robert')
    expect(urgentName({ people: [] }, 'Click Construction')).toBe('Click Construction')
  })
})
