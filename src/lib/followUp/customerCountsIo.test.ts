import { describe, expect, it, vi } from 'vitest'
import { loadCustomerMessagesCounts } from './customerCountsIo'
import type { FollowUpContactRow, FollowUpMessageRow, FollowUpRows } from './followUpRows'

const contact = (id: string, patch: Partial<FollowUpContactRow>): FollowUpContactRow => ({
  id,
  kind: 'customer',
  customer_id: null,
  customer_contact_person_id: null,
  gc_company_id: null,
  gc_company_person_id: null,
  person_id: null,
  name: null,
  goes_by: null,
  off_since: null,
  off_why: null,
  off_by: null,
  prospect_id: null,
  supply_house_id: null,
  supply_house_contact_id: null,
  team_prospect_id: null,
  state: 'waiting',
  snoozed_until: null,
  has_user_id: null,
  has_since: null,
  has_how: null,
  ...patch,
})

const line = (id: string, contactId: string): FollowUpMessageRow => ({
  id,
  contact_id: contactId,
  channel_id: null,
  bid_id: null,
  project_id: null,
  jobs_ledger_id: null,
  channel: 'text',
  direction: 'in',
  who_user_id: null,
  who_text: '',
  at: '2026-10-02T14:00:00.000Z',
  subject: null,
  body: 'Can you do Thursday?',
  optout_line: null,
  back_on: null,
  back_by: null,
  back_words: null,
  back_done_at: null,
})

/** Dana Whitfield, a residential customer from the mockups, waiting on a reply. Nothing here is a real row. */
const ROWS: FollowUpRows = {
  contacts: [contact('dana', { customer_id: 'cust-dana' })],
  channels: [],
  records: { customers: [{ id: 'cust-dana', name: 'Dana Whitfield' }] },
  messages: [line('d1', 'dana')],
  heard: [],
  owed: [],
}

const NOW = '2026-10-02T17:00:00.000Z'

describe('loadCustomerMessagesCounts', () => {
  it('reads Follow up’s rows for the day and counts them through the queue', async () => {
    const loadQueue = vi.fn(async () => ROWS)
    // Dana has nobody on her, so she waits in New to be sorted, not in Needs a reply: one person, counted once.
    expect(await loadCustomerMessagesCounts('2026-10-02', { loadQueue }, NOW)).toEqual({ needReply: 0, weOwe: 0, toSort: 1 })
    expect(loadQueue).toHaveBeenCalledWith('2026-10-02')
  })

  it('counts Dana as needing a reply once someone has her, and never a sender nobody has named', async () => {
    const held: FollowUpRows = {
      ...ROWS,
      contacts: [contact('dana', { customer_id: 'cust-dana', has_user_id: 'u-rosa', has_since: '2026-10-01T15:00:00.000Z', has_how: 'took' }), contact('unk1', { kind: 'unknown' })],
      messages: [line('d1', 'dana'), line('u1', 'unk1')],
    }
    expect(await loadCustomerMessagesCounts('2026-10-02', { loadQueue: async () => held }, NOW)).toEqual({ needReply: 1, weOwe: 0, toSort: 0 })
  })

  it('is null when nobody is waiting', async () => {
    const quiet: FollowUpRows = { ...ROWS, contacts: [contact('dana', { customer_id: 'cust-dana', state: 'done' })] }
    expect(await loadCustomerMessagesCounts('2026-10-02', { loadQueue: async () => quiet })).toBeNull()
  })
})
