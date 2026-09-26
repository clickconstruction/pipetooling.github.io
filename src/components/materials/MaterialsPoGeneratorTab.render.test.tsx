// @vitest-environment jsdom
/**
 * Render-smoke tests for the PO Generator tab's after-mint claim (v2.3718,
 * to-dos/po-generator-stated-need PR 2): the just-minted card asks "What did
 * they say they need?" when the box before Generate was left blank, a ledger
 * row with nothing written down offers "add what it was for…", and both write
 * through setPoCodeStatedNeed and rewrite the row in place.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const smoke = vi.hoisted(() => ({
  ledger: [] as Array<Record<string, unknown>>,
  setCalls: [] as Array<[string, string | null | undefined]>,
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const generic = makeSupabaseStub()
  function builder(rows: () => unknown): Record<string, unknown> {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'or', 'order', 'limit']) b[m] = () => b
    b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows(), error: null, count: 0 }).then(f, r)
    return b
  }
  const TABLES: Record<string, () => unknown> = {
    material_po_generator_entries: () => smoke.ledger,
    jobs_ledger: () => [{ id: 'job-1', service_type_id: 'st-1' }],
    users: () => [{ id: 'u-1', name: 'Marcus Delgado', email: 'marcus@example.com' }],
  }
  const RPCS: Record<string, () => unknown> = {
    search_jobs_ledger: () => [{ id: 'job-1', hcp_number: '964', click_number: null, job_name: 'Oak Ridge townhomes', job_address: '1 Oak Ridge Dr', service_type_name: 'Plumbing' }],
    insert_material_po_generator_entry: () => [{ out_id: 'e-new', out_po_code: 48213 }],
  }
  return {
    supabase: {
      ...generic,
      from: (t: string) => (TABLES[t] ? builder(TABLES[t]) : (generic.from as () => unknown)()),
      rpc: (fn: string) => (RPCS[fn] ? builder(RPCS[fn]) : (generic.rpc as () => unknown)()),
    },
  }
})

vi.mock('../../lib/materials/setPoCodeStatedNeed', () => ({
  setPoCodeStatedNeed: async (id: string, text: string | null | undefined) => {
    smoke.setCalls.push([id, text])
    const t = (text ?? '').trim()
    return t ? t : null
  },
}))

vi.mock('../../hooks/useJobBidSearchEvidence', () => ({
  useJobBidSearchEvidence: () => ({ jobEvidence: new Map(), evidenceMode: 'none' }),
}))

import { MaterialsPoGeneratorTab } from './MaterialsPoGeneratorTab'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

function row(p: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'e-1',
    po_code: 14233,
    notes: null,
    created_at: '2026-09-21T15:54:44Z',
    jobs_ledger: { job_name: 'Aguirre Well', hcp_number: '1022', click_number: null, service_type_id: 'st-1' },
    for_user: { name: 'Paige', email: null },
    supply_houses: { name: 'Reece' },
    created_by_user: { name: 'Taunya', email: null },
    ...p,
  }
}

function renderTab() {
  return renderWithProviders(
    <MaterialsPoGeneratorTab active myRole="dev" supplyHouses={[]} selectedServiceTypeId="st-1" onError={() => {}} />,
  )
}

describe('MaterialsPoGeneratorTab — what they said they need, after the code (v2.3718)', () => {
  it('a ledger row with nothing written down offers the add link; writing it rewrites the row in place', async () => {
    smoke.ledger = [row(), row({ id: 'e-2', po_code: 31877, notes: 'trim' })]
    smoke.setCalls = []
    renderTab()
    await waitFor(() => expect(screen.getByText('14233')).toBeTruthy())
    expect(screen.getAllByRole('button', { name: 'add what it was for…' })).toHaveLength(1)
    expect(screen.getByText('trim')).toBeTruthy()
    // The ledger resolved outside act, so the editors' mount effects may still be pending;
    // settle them before clicking or the effect's reset lands after the click's setOpen(true)
    // and the box never opens (ejected #3565 and #3568 from the merge queue, 2026-09-22).
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'add what it was for…' }))
    const box = await waitFor(() => screen.getByLabelText('Said they need'))
    fireEvent.change(box, { target: { value: ' two tubes ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Write it down' }))
    await waitFor(() => expect(screen.getByText('two tubes')).toBeTruthy())
    expect(smoke.setCalls).toEqual([['e-1', 'two tubes']])
    expect(screen.queryByRole('button', { name: 'add what it was for…' })).toBeNull()
    // Newest-first order is kept: the rewritten row is still the first.
    const codes = screen.getAllByRole('row').slice(1).map((r) => r.textContent?.slice(0, 5))
    expect(codes).toEqual(['14233', '31877'])
  })

  it('Generate with the box blank → the just-minted card asks the question, and Write it down lands the claim on the card and the ledger', async () => {
    smoke.ledger = []
    smoke.setCalls = []
    renderTab()
    fireEvent.change(screen.getByPlaceholderText('Search by HCP #, job name, or address…'), { target: { value: 'oak' } })
    await waitFor(() => expect(screen.getByText(/Oak Ridge townhomes/)).toBeTruthy(), { timeout: 3000 })
    fireEvent.click(screen.getByText(/Oak Ridge townhomes/).closest('button')!)
    fireEvent.change(screen.getByPlaceholderText('Search name or email (2+ chars)…'), { target: { value: 'mar' } })
    await waitFor(() => expect(screen.getByText(/Marcus Delgado/)).toBeTruthy(), { timeout: 3000 })
    fireEvent.click(screen.getByText(/Marcus Delgado/).closest('button')!)
    // The ledger reload after Generate returns the new row (the mock reads the list at query time).
    smoke.ledger = [row({ id: 'e-new', po_code: 48213, jobs_ledger: { job_name: 'Oak Ridge townhomes', hcp_number: '964', click_number: null, service_type_id: 'st-1' }, for_user: { name: 'Marcus Delgado', email: null } })]
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(screen.getByText('48213', { selector: '[data-po-generator-result] *' })).toBeTruthy())
    const ask = screen.getByLabelText('What did they say they need?')
    expect(ask).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Write it down' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(ask, { target: { value: '40 ft of ¾" PEX' } })
    fireEvent.click(screen.getByRole('button', { name: 'Write it down' }))
    await waitFor(() => expect(smoke.setCalls).toEqual([['e-new', '40 ft of ¾" PEX']]))
    // The card and the ledger row both read it, with no refetch.
    await waitFor(() => expect(screen.getAllByText('40 ft of ¾" PEX')).toHaveLength(2))
    expect(screen.queryByLabelText('What did they say they need?')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByText('Purchase order')).toBeNull()
  })

  it('Generate with the claim typed first → the card shows it under its label, no question', async () => {
    smoke.ledger = []
    renderTab()
    fireEvent.change(screen.getByPlaceholderText('Search by HCP #, job name, or address…'), { target: { value: 'oak' } })
    await waitFor(() => expect(screen.getByText(/Oak Ridge townhomes/)).toBeTruthy(), { timeout: 3000 })
    fireEvent.click(screen.getByText(/Oak Ridge townhomes/).closest('button')!)
    fireEvent.change(screen.getByPlaceholderText('Search name or email (2+ chars)…'), { target: { value: 'mar' } })
    await waitFor(() => expect(screen.getByText(/Marcus Delgado/)).toBeTruthy(), { timeout: 3000 })
    fireEvent.click(screen.getByText(/Marcus Delgado/).closest('button')!)
    fireEvent.change(screen.getByLabelText('What they said they need'), { target: { value: 'a 2" drain machine' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(screen.getByText('a 2" drain machine')).toBeTruthy())
    expect(screen.queryByLabelText('What did they say they need?')).toBeNull()
    expect(screen.getByRole('button', { name: 'change' })).toBeTruthy()
  })
})
