// @vitest-environment jsdom
/**
 * Render smoke for People → Spending (punch list #52, PR 4b-2): the tab mounts on This month,
 * reads the window through the stub, draws the totals and one row per person, opens a person to
 * their jobs and the charges not on a job yet, offers *Put on a job* only where the write would
 * take it, opens today's Assign window the way Team purchases does for a held card, tells a
 * viewer without payroll access what is left out, and says so when the read is not pushed yet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'

type Row = Record<string, unknown>
const H = vi.hoisted(() => ({
  charges: [] as Row[],
  rpcError: null as { message: string; code?: string } | null,
  users: [] as Row[],
  tx: null as Row | null,
  assignProps: null as Record<string, unknown> | null,
}))

vi.mock('../../lib/supabase', () => {
  function builder(table: string) {
    let single = false
    const rows = (): Row[] => {
      if (table === 'mercury_category_tags') return [{ id: 'tag-fuel', name: 'Fuel & gas', icon: '⛽', color: 'amber', sort_order: 0, default_key: 'fuel_vehicle', show_as_cost_line: true, hide_from_picker: false }]
      if (table === 'mercury_category_tag_members') return [{ tag_id: 'tag-fuel', bank_category: 'FuelAndGas', label_id: null }]
      if (table === 'users') return H.users
      return []
    }
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'range', 'limit']) b[m] = () => b
    b.maybeSingle = () => {
      single = true
      return b
    }
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      const data = single ? (table === 'mercury_transactions' ? H.tx : null) : rows()
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
    }
    return b
  }
  function rpc(name: string) {
    const b: Record<string, unknown> = {}
    b.range = () => b
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      if (name === 'list_card_charges_window' && H.rpcError) return Promise.resolve({ data: null, error: H.rpcError }).then(onFulfilled, onRejected)
      const data = name === 'list_card_charges_window' ? H.charges : []
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected)
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table), rpc } }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})

vi.mock('../MercuryTransactionAllocationsModal', () => ({
  MercuryTransactionAllocationsModal: (props: Record<string, unknown>) => {
    H.assignProps = props
    const tx = props.transaction as { id: string } | null
    return <div role="dialog" aria-label="Assign window">{`Assign ${tx?.id ?? ''}`}</div>
  },
}))

import PeopleSpendingTab from './PeopleSpendingTab'

const POSTED = new Date().toISOString()

function rpcRow(over: Row): Row {
  return {
    mercury_transaction_id: 'tx',
    posted_at: POSTED,
    amount: -10,
    counterparty_name: 'Store',
    kind: 'debitCardTransaction',
    status: 'sent',
    bank_category: 'Retail',
    debit_card_id: null,
    card_nickname: null,
    card_role: null,
    holder_user_id: null,
    holder_name: null,
    attributed_user_id: null,
    attributed_person_id: null,
    label_id: null,
    label_default_key: null,
    payroll_marked: false,
    job_splits: [],
    invoice_links: [],
    sorted_at: null,
    sorted_by_name: null,
    viewer_can_sort: true,
    ...over,
  }
}

const JOB_101 = { job_id: 'j-101', amount: -120, hcp_number: '101', click_number: null, job_name: 'Main St remodel', service_type_id: null }

describe('PeopleSpendingTab', () => {
  beforeEach(() => {
    H.users = [
      { id: 'u-malachi', name: 'Malachi R.' },
      { id: 'u-jorge', name: 'Jorge L.' },
    ]
    H.charges = [
      rpcRow({ mercury_transaction_id: 'tx-1', amount: -120, attributed_user_id: 'u-malachi', job_splits: [JOB_101] }),
      rpcRow({ mercury_transaction_id: 'tx-2', amount: -45, attributed_user_id: 'u-malachi', bank_category: 'FuelAndGas', counterparty_name: 'Shell', holder_user_id: 'u-malachi', holder_name: 'Malachi R.', debit_card_id: 'card-m', card_nickname: 'Malachi card' }),
      rpcRow({ mercury_transaction_id: 'tx-3', amount: -30, counterparty_name: 'Lowes', holder_user_id: 'u-jorge', holder_name: 'Jorge L.', debit_card_id: 'card-j', viewer_can_sort: false }),
      rpcRow({ mercury_transaction_id: 'tx-4', amount: -15, counterparty_name: 'Parking' }),
    ]
    H.rpcError = null
    H.tx = { id: 'tx-2', amount: -45, posted_at: POSTED, counterparty_name: 'Shell', mercury_account_id: 'acct', raw: null }
    H.assignProps = null
  })
  afterEach(() => cleanup())

  it('draws the totals and a row per person, Not tied to anyone last', async () => {
    await renderSettled(<PeopleSpendingTab canSeePayroll={false} />, { loaded: () => screen.findByRole('table', { name: 'Card spend by person' }) })
    expect(screen.getByRole('button', { name: 'This month' }).getAttribute('aria-pressed')).toBe('true')
    const totals = screen.getByLabelText('Totals')
    expect(totals.textContent).toContain('$210.00')
    expect(totals.textContent).toContain('$45.00')
    expect(totals.textContent).toContain('3 charges, $45.00 of it fuel')
    const table = screen.getByRole('table', { name: 'Card spend by person' })
    const names = within(table).getAllByRole('row').map((r) => r.textContent ?? '')
    expect(names[1]).toContain('Malachi R.')
    expect(names[1]).toContain('$165.00')
    expect(names.some((t) => t.includes('Jorge L.') && t.includes('$30.00'))).toBe(true)
    expect(names[names.length - 2]).toContain('Not tied to anyone')
    expect(names[names.length - 1]).toContain('Everyone')
    expect(screen.getByText(/settled through payroll are not shown to you/)).toBeTruthy()
  })

  it('opens a person to their jobs and the charges not on a job yet, with Put on a job for a held card', async () => {
    await renderSettled(<PeopleSpendingTab canSeePayroll />, { loaded: () => screen.findByRole('button', { name: 'Show Malachi R.' }) })
    expect(screen.queryByText(/settled through payroll are not shown to you/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show Malachi R.' }))
    expect(await screen.findByRole('button', { name: /101 · Main St remodel|J101|101/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'See the charges' }))
    const list = await screen.findByRole('list', { name: 'Malachi R.: charges not on a job yet' })
    expect(list.textContent).toContain('Shell')
    expect(list.textContent).toContain('Malachi card')
    fireEvent.click(within(list).getByRole('button', { name: 'Put on a job' }))
    expect(await screen.findByRole('dialog', { name: 'Assign window' })).toBeTruthy()
    await waitFor(() => expect(H.assignProps).not.toBeNull())
    expect(H.assignProps).toMatchObject({ tallySelfService: true, tallyActAsUserId: 'u-malachi', tallyActAsDisplayName: 'Malachi R.' })
  })

  it('says who can sort a charge the viewer’s write would refuse, with no button', async () => {
    await renderSettled(<PeopleSpendingTab canSeePayroll />, { loaded: () => screen.findByRole('button', { name: 'Show Jorge L.' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Show Jorge L.' }))
    fireEvent.click(await screen.findByRole('button', { name: 'See the charges' }))
    const list = await screen.findByRole('list', { name: 'Jorge L.: charges not on a job yet' })
    expect(within(list).queryByRole('button', { name: 'Put on a job' })).toBeNull()
    expect(list.textContent).toContain('A dev or someone who works with Jorge L. can put this on a job.')
    expect(screen.getByText(/1 charge counts here because the card is theirs/)).toBeTruthy()
  })

  it('says the read is not live yet when the database does not have it', async () => {
    H.rpcError = { message: 'Could not find the function public.list_card_charges_window(p_end_ymd, p_start_ymd) in the schema cache', code: 'PGRST202' }
    await renderSettled(<PeopleSpendingTab canSeePayroll />, { loaded: () => screen.findByText(/not live in the database yet/) })
    expect(screen.queryByRole('table')).toBeNull()
  })
})
