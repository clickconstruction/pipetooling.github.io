// @vitest-environment jsdom
/**
 * Partnerships → Agreements: the "sign by" deadline saves a finished date only. The browser
 * hands over 0002-… while the year is typed; that writes nothing, and the finished date
 * writes once.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { PartnershipAgreementsTab } from './PartnershipAgreementsTab'

const writes: Array<{ table: string; patch: unknown }> = []
const TABLE_ROWS: Record<string, unknown[]> = {
  person_contract_documents: [{ id: 'd1', document_name: 'Partner Agreement', status: 'sent', sent_at: '2026-09-01T15:00:00Z', signed_at: null, sign_by: '2026-10-10', partnership_id: 'pt1', dashboard_prompt_after_clock_in: false, lineage_version: 2 }],
  partner_agreement_notices: [],
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string): Record<string, unknown> {
    const rows = TABLE_ROWS[table] ?? []
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) builder[m] = () => builder
    builder.update = (patch: unknown) => {
      writes.push({ table, patch })
      return builder
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected)
    return builder
  }
  return { supabase: { from: (table: string) => makeBuilder(table), rpc: () => Promise.resolve({ data: null, error: null }) } }
})

afterEach(cleanup)

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

describe('PartnershipAgreementsTab · the sign-by deadline', () => {
  it('a half-typed year writes nothing; a finished date writes once; a date left unfinished is dropped', async () => {
    renderWithProviders(<PartnershipAgreementsTab partnershipId="pt1" personId="p1" personName="Pat Partner" autoNoticeOn={false} />)
    const box = (await screen.findByLabelText('Partner Agreement sign by')) as HTMLInputElement
    expect(box.value).toBe('2026-10-10')

    fireEvent.change(box, { target: { value: '0002-10-31' } })
    await settle()
    expect(writes).toHaveLength(0)
    fireEvent.change(box, { target: { value: '2026-10-31' } })
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toEqual({ table: 'person_contract_documents', patch: { sign_by: '2026-10-31', partnership_id: 'pt1' } })
    await settle()

    writes.length = 0
    const again = screen.getByLabelText('Partner Agreement sign by') as HTMLInputElement
    fireEvent.keyDown(again, { key: '2' })
    fireEvent.change(again, { target: { value: '0002-10-10' } })
    fireEvent.blur(again)
    await settle()
    expect(writes).toHaveLength(0)
    expect(again.value).toBe('2026-10-10')
    expect(screen.getByText(/That date was not finished, so it was not saved/)).toBeTruthy()
  })
})
