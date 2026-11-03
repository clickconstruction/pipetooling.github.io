/**
 * The morning run goes on past one person whose flow does not read (2026-11-03): they are left out and counted as
 * unread, and everyone after them is read. `personFlowFrom` is made to fail for Greg alone, who comes first.
 */
import { describe, expect, it, vi } from 'vitest'
import type { FlowRows } from './load'
import { nudgeRunReads, type NudgeRunRows, type RunContactRow } from './nudgeRunInputs'

vi.mock('./person', async (importOriginal) => {
  const real = await importOriginal<typeof import('./person')>()
  return {
    ...real,
    personFlowFrom: (input: Parameters<typeof real.personFlowFrom>[0]) => {
      if (input.id === 'greg') throw new Error('a row this code cannot read')
      return real.personFlowFrom(input)
    },
  }
})

/** The run's morning: Fri Oct 2, 9 AM Central. */
const MORNING = new Date('2026-10-02T14:00:00Z')

/** A trade partner invited Fri Sep 25, as `flow_rows` gives one. */
const tradeRows = (id: string, name: string, company: string): FlowRows => ({
  contact: { id, kind: 'trade', off_since: null, off_why: null, off_by: null },
  userNames: { 'u-rosa': 'Rosa' },
  company: { id: company, portal_opened_on: null },
  tradeMessages: [{ company_id: company, kind: 'invite', sent_on: '2026-09-25', sent_by: 'u-rosa' }],
  previewPath: `/t/${company}-token?preview=1`,
  card: { name, goes_by: null, company, trades: ['Mechanical'], gc_company_id: company },
})

const contact = (id: string, name: string): RunContactRow => ({ id, kind: 'trade', name, goes_by: null, snoozed_until: null })

const ROWS: NudgeRunRows = {
  contacts: [contact('greg', 'Greg Paulk'), contact('tom', 'Tom Riddle')],
  flowRows: { greg: tradeRows('greg', 'Greg Paulk', 'hillside'), tom: tradeRows('tom', 'Tom Riddle', 'bexar') },
  steps: [],
  holds: [],
  sent: [],
  notes: [],
  lines: [],
  owed: [],
  channels: [],
  quickReplies: [],
  appSends: {},
}

describe('nudgeRunReads: one person whose flow does not read', () => {
  it('is left out and counted as unread, and the person after them is read', () => {
    const { input, unread } = nudgeRunReads(ROWS, MORNING, { origin: 'https://clicktooling.com' })
    expect(input.people.map((p) => p.id)).toEqual(['tom'])
    expect(unread).toEqual(['greg'])
  })
})
