import { describe, expect, it } from 'vitest'
import type { JobThreadActivityItem } from '../../components/JobThreadNotesPanel'
import { countActivityByFilter, filterActivity } from '../jobActivityFilter'
import type { JobActivityMessage } from './jobActivityMessages'
import { countJobUpdates, customerLinesForJobUpdates, filterJobUpdates, mergeJobUpdates } from './jobUpdatesCustomerLines'

// Dana Whitfield's water heater job: made-up people. Luis on the job, Rosa in the office.
const dana = { name: 'Dana Whitfield', kind: 'customer' as const }
const msg = (id: string, at: string, extra: Partial<JobActivityMessage> = {}): JobActivityMessage => ({
  id,
  contactId: 'contact-dana',
  contact: dana,
  channel: 'text',
  direction: 'in',
  at,
  who: '',
  body: `line ${id}`,
  tied: true,
  ...extra,
})
const note = (id: string, at: string): JobThreadActivityItem => ({ kind: 'note', note: { id, body: `note ${id}`, created_at: at, author: { name: 'Luis Ortega' } } })
const crew = (id: string, at: string): JobThreadActivityItem => ({
  kind: 'event',
  event: { dedupeKey: `ev:${id}`, type: 'crew_added', occurredAt: at, actorName: null, summary: 'Luis added to crew', financial: false },
})

describe('customerLinesForJobUpdates', () => {
  it('keeps her lines and ours to her, oldest first, and leaves out notes, events, office-only rows and anyone else', () => {
    const lines = customerLinesForJobUpdates([
      msg('out', '2026-10-13T15:00:00Z', { direction: 'out', who: 'Rosa' }),
      msg('in', '2026-10-13T14:00:00Z'),
      msg('team', '2026-10-13T14:30:00Z', { channel: 'note', direction: 'team' }),
      msg('hidden', '2026-10-13T14:40:00Z', { channel: 'note', direction: 'team', officeOnly: true }),
      msg('event', '2026-10-13T14:50:00Z', { channel: 'event', direction: 'team' }),
      msg('supplier', '2026-10-13T14:45:00Z', { contact: { name: 'Ferguson', kind: 'supply_house' } }),
    ])
    expect(lines.map((l) => l.id)).toEqual(['in', 'out'])
  })
})

describe('mergeJobUpdates', () => {
  const items = [crew('a', '2026-10-13T13:00:00Z'), note('b', '2026-10-13T15:00:00Z')]

  it('puts each line before the first newer item, a tie after the item, and the rest at the end', () => {
    const lines = [msg('1', '2026-10-13T14:00:00Z'), msg('2', '2026-10-13T15:00:00Z'), msg('3', '2026-10-13T16:00:00Z')]
    const order = mergeJobUpdates(items, lines).map((e) => (e.kind === 'item' ? (e.item.kind === 'note' ? e.item.note.id : 'crew') : `m${e.line.id}`))
    expect(order).toEqual(['crew', 'm1', 'b', 'm2', 'm3'])
  })

  it('with no lines is the activity as it was, and so are its pills', () => {
    const entries = mergeJobUpdates(items, [])
    expect(entries.map((e) => (e.kind === 'item' ? e.item : null))).toEqual(items)
    const counts = countJobUpdates(entries)
    expect(counts).toEqual({ ...countActivityByFilter([...items]), customer: 0 })
    expect(filterJobUpdates(entries, 'notes').map((e) => (e.kind === 'item' ? e.item : null))).toEqual(filterActivity([...items], 'notes'))
  })
})

describe('the Customer pill', () => {
  it('counts and shows only the customer lines, and the other pills never show one', () => {
    const entries = mergeJobUpdates([note('b', '2026-10-13T15:00:00Z')], [msg('1', '2026-10-13T14:00:00Z'), msg('2', '2026-10-13T16:00:00Z')])
    expect(countJobUpdates(entries)).toEqual({ all: 3, notes: 1, reports: 0, status: 0, billing: 0, crew: 0, customer: 2 })
    expect(filterJobUpdates(entries, 'customer').every((e) => e.kind === 'customer')).toBe(true)
    expect(filterJobUpdates(entries, 'notes').every((e) => e.kind === 'item')).toBe(true)
  })
})
