// @vitest-environment jsdom
/**
 * useLegalPacketData, property per job (#85 item 6): the desk reads each job's own property record (by the
 * job's customer_address_id, whoever's record it is) and its owner override — the inputs the firm's function
 * sends — so the desk's Property record is the job site, never the GC's office list.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { makeInvoice, makeJob } from '../../../test/renderSmokeMocks'
import { groupCollectionsByPayer, type LegalAccountSummary } from '../../../lib/legal/legalPacket'
import { useLegalPacketData } from './useLegalPacketData'

const rows = vi.hoisted(() => ({ byTable: {} as Record<string, Array<Record<string, unknown>>> }))

vi.mock('../../../lib/supabase', () => {
  function builder(table: string): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'not', 'order', 'limit']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: null, error: null })
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows.byTable[table] ?? [], error: null }).then(onFulfilled, onRejected)
    return b
  }
  return { supabase: { from: (table: string) => builder(table), rpc: () => Promise.resolve({ data: [], error: null }) } }
})

afterEach(cleanup)

const job = makeJob({
  id: 'job-a', hcp_number: '1042', status: 'billed', job_address: '1200 Sample Pkwy, Kyle, TX',
  gc_customer_id: 'gc-1', gcCustomer: { id: 'gc-1', name: 'Sample Contracting' }, customer_id: 'owner-1', customer_name: 'Sample Holdings',
  collections_at: '2026-08-20T15:00:00Z',
  invoices: [makeInvoice({ id: 'inv-a', amount: 500, status: 'billed', billed_at: '2026-06-01T15:00:00Z', sequence_order: 1 })],
})
const account = groupCollectionsByPayer([job], new Map(), '2026-09-11')[0] as LegalAccountSummary

describe('useLegalPacketData — property per job', () => {
  it('reads the job\'s own record and owner override, not the payer\'s addresses', async () => {
    rows.byTable = {
      // The job site's record, on the owner's customer (the mock answers every customer_addresses read with it).
      customer_addresses: [
        { id: 'site', customer_id: 'owner-1', address: '1200 Sample Pkwy, Kyle, TX', county: 'Hays', legal_description: 'Lot 4', owner_mode: 'building_owner', owner_name: '', owner_company: 'Old Owner LLC', owner_mailing_address: 'PO Box 9', parcel_id: 'R1', homestead: false, property_kind: 'non_residential' },
      ],
      jobs_ledger: [{ id: 'job-a', customer_address_id: 'site' }],
      job_property_owners: [{ job_id: 'job-a', owner_mode: 'building_owner', owner_name: '', company_name: 'Sample Holdings LLC', mailing_address: 'PO Box 1' }],
    }
    const { result } = renderHook(() => useLegalPacketData(account, [], true))
    await waitFor(() => expect(result.current.packet).not.toBeNull())
    const p = result.current.packet!
    expect(p.account.properties).toHaveLength(1)
    expect(p.account.properties[0]).toEqual(expect.objectContaining({ address: '1200 Sample Pkwy, Kyle, TX', county: 'Hays', owner: 'Sample Holdings LLC', source: 'linked', ownerSource: 'job_override', jobLabels: ['1042'] }))
    expect(p.account.jobs[0]?.property.propertyKind).toBe('non_residential')
    expect(result.current.failed).toEqual([])
  })
})
