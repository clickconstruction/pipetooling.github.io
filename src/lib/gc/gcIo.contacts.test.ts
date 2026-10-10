/**
 * The call log's one write (`logGcAskContact`): a line on an ask, or since the Board's B2b-iv a line of the company's
 * own, logged on its window's Activity, with no ask. The client is a stub that keeps what each insert sent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sent = vi.hoisted(() => ({ rows: [] as { table: string; row: Record<string, unknown> }[] }))

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        sent.rows.push({ table, row })
        return { select: () => ({ single: () => Promise.resolve({ data: { id: 'n9' }, error: null }) }) }
      },
    }),
  },
}))

import { logGcAskContact } from './gcIo'

beforeEach(() => {
  sent.rows.length = 0
})

describe('logGcAskContact', () => {
  it('logs a line of the company’s own with no ask', async () => {
    await logGcAskContact({ companyId: 'hillside', inviteId: null, on: '2026-10-10', byName: 'Rosa', how: 'text', note: 'Crew free from the 20th.', promisedBy: null })
    expect(sent.rows).toEqual([
      { table: 'gc_company_contacts', row: { company_id: 'hillside', invite_id: null, contacted_on: '2026-10-10', by_name: 'Rosa', how: 'text', note: 'Crew free from the 20th.', promised_by: null } },
    ])
  })

  it('still logs a line on an ask with the day they promised', async () => {
    await logGcAskContact({ companyId: 'hillside', inviteId: 'i2', on: '2026-10-10', byName: 'Rosa', how: 'call', note: 'Quote by Monday.', promisedBy: '2026-10-12' })
    expect(sent.rows[0]?.row).toMatchObject({ invite_id: 'i2', promised_by: '2026-10-12' })
  })
})
