// @vitest-environment jsdom
/**
 * useLegalPacketData: a contact's day is customer_contacts.contact_date (a timestamptz) read on the
 * company calendar (v2.4465), the same day the legal-portal function holds or shares it by.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob } from '../../../test/renderSmokeMocks'
import { groupCollectionsByPayer, type LegalAccountSummary } from '../../../lib/legal/legalPacket'
import { useLegalPacketData } from './useLegalPacketData'

const db = vi.hoisted(() => ({ contacts: [] as Array<Record<string, unknown>> }))

vi.mock('../../../lib/supabase', () => {
  function builder(table: string): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'not', 'order', 'limit']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: null, error: null })
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: table === 'customer_contacts' ? db.contacts : [], error: null }).then(onFulfilled, onRejected)
    return b
  }
  return { supabase: { from: (table: string) => builder(table), rpc: () => Promise.resolve({ data: [], error: null }) } }
})

afterEach(cleanup)

const job = makeJob({
  id: 'job-a',
  hcp_number: '717',
  status: 'billed',
  customer_id: 'tle',
  customer_name: 'The Learning Experience',
  collections_at: '2026-08-20T15:00:00Z',
  // The first bill: noon UTC on Apr 17, the morning of Apr 17 in Central.
  invoices: [makeInvoice({ id: 'inv-a', amount: 500, status: 'billed', billed_at: '2026-04-17T12:00:00Z', sequence_order: 1 })],
})
const account = groupCollectionsByPayer([job], new Map(), '2026-09-11')[0] as LegalAccountSummary
const users: Array<{ id: string; name: string | null }> = []

describe('useLegalPacketData — a contact is dated on the company calendar', () => {
  it('a call logged at 7:30 pm CDT the evening before the first bill is that evening, and held', async () => {
    db.contacts = [{ id: 'c1', contact_date: '2026-04-17T00:30:00+00:00', contact_method: 'Phone', details: 'Walked the scope.', created_by: null }]
    const { result } = renderHook(() => useLegalPacketData(account, users, true))
    await waitFor(() => expect(result.current.packet).not.toBeNull())
    const entry = result.current.packet!.theirWord.timeline.find((e) => e.key === 'contact:c1')
    expect(entry).toEqual(expect.objectContaining({ ymd: '2026-04-16', sharedByDefault: false, shared: false }))
  })
})
