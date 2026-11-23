// @vitest-environment jsdom
/**
 * Render smoke for a sub's company on People → Contracts (punch list #403, step 6, PR 1). A sub with a company sits
 * under the company's row, which names its workers. A sub with no company and a teammate draw as before. The find
 * box finds a worker by the company's name. On a sub's opened row the office keeps *Their company*: **Same as their
 * name** makes the company in one press, a name we have links it, and emptying the box takes them off. Anyone outside
 * the office's four roles reads no link and sees no control. Every name here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import PeopleContractsTab from './PeopleContractsTab'
import { makeUseAuthValue, renderWithProviders } from '../../test/renderSmokeMocks'

const seen = vi.hoisted(() => ({ role: 'dev', tables: [] as string[], rpcs: [] as Array<{ fn: string; args: unknown }> }))

vi.mock('../../hooks/useAuth', () => {
  const value = () => makeUseAuthValue({ role: seen.role })
  return { useAuth: value, useOptionalAuth: value, AuthProvider: ({ children }: { children: unknown }) => children }
})

const MECH = { id: 'c-mech', name: 'ZZ Sample Mechanical LLC' }
const PIPE = { id: 'c-pipe', name: 'Sample Pipe Co' }

const TABLE_ROWS: Record<string, unknown[]> = {
  contract_templates: [],
  contract_template_documents: [],
  person_contract_assignments: [],
  person_contract_documents: [],
  person_trade_companies: [
    { person_id: 'p-pat', company_id: MECH.id, title: 'Owner' },
    { person_id: 'p-lee', company_id: MECH.id, title: null },
  ],
  gc_companies: [MECH, PIPE],
}

vi.mock('../../lib/supabase', () => {
  function makeBuilder(rows: unknown[]): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'is', 'in', 'or', 'not', 'order', 'range', 'limit']) {
      builder[m] = () => builder
    }
    builder.maybeSingle = () => builder
    builder.single = builder.maybeSingle
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null, count: rows.length }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => {
        seen.tables.push(table)
        return makeBuilder(TABLE_ROWS[table] ?? [])
      },
      rpc: (fn: string, args: unknown) => {
        seen.rpcs.push({ fn, args })
        return Promise.resolve({ data: fn === 'person_trade_company_enter' ? 'c-new' : null, error: null })
      },
      functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
      storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
    },
  }
})

const person = (id: string, name: string, kind: string) => ({ id, master_user_id: 'm1', kind, name, email: null, phone: null, notes: null })
const people = [
  person('p-amy', 'Amy Staff', 'assistant'),
  person('p-kim', 'Kim Sample', 'sub'),
  person('p-lee', 'Lee Sample', 'sub'),
  person('p-pat', 'Pat Sample', 'sub'),
]

/** Opens the tab and waits for its first read of the papers, which it starts on a short timer and which redraws the table. */
async function open() {
  const view = renderWithProviders(<PeopleContractsTab people={people} users={[]} canDeletePeopleContracts={false} />)
  await waitFor(() => expect(seen.tables).toContain('person_contract_documents'))
  await waitFor(() => expect(view.container.querySelector('[data-contracts-person-row="Amy Staff"]')).toBeTruthy())
  return view
}

beforeEach(() => {
  seen.role = 'dev'
  seen.tables = []
  seen.rpcs = []
  window.localStorage.clear()
})
afterEach(cleanup)

describe('People → Contracts, a sub’s company', () => {
  it('draws the company once with its workers under it, and a sub with no company and a teammate as before', async () => {
    const { container } = await open()
    const head = await waitFor(() => {
      const row = container.querySelector(`[data-sub-company-row="${MECH.id}"]`) as HTMLElement | null
      expect(row).toBeTruthy()
      return row!
    })
    expect(within(head).getByText(MECH.name)).toBeTruthy()
    expect(within(head).getByText('Trade company')).toBeTruthy()
    expect(head.textContent).toContain('Workers Pat Sample, Owner · Lee Sample')
    // Each worker's name on the company's line is a value, drawn apart from the words.
    expect([...head.querySelectorAll('[data-value="worked-out"]')].map((b) => b.textContent)).toEqual(['Pat Sample', 'Lee Sample'])

    // The workers' rows follow the company's row; Kim and Amy keep their own places.
    const order = [...container.querySelectorAll('[data-sub-company-row], [data-contracts-person-row]')].map(
      (el) => (el as HTMLElement).dataset.subCompanyRow ?? (el as HTMLElement).dataset.contractsPersonRow,
    )
    expect(order).toEqual(['Amy Staff', 'Kim Sample', MECH.id, 'Pat Sample', 'Lee Sample'])
  })

  it('the find box finds a worker by the company’s name', async () => {
    const { container } = await open()
    await waitFor(() => expect(container.querySelector(`[data-sub-company-row="${MECH.id}"]`)).toBeTruthy())
    fireEvent.change(screen.getByPlaceholderText(/Search by person or contract name/), { target: { value: 'mechanical' } })
    await waitFor(() => {
      const names = [...container.querySelectorAll('[data-contracts-person-row]')].map((el) => (el as HTMLElement).dataset.contractsPersonRow)
      expect(names).toEqual(['Pat Sample', 'Lee Sample'])
    })
  })

  it('Same as their name makes the sub’s company in one press, with its trade', async () => {
    const { container } = await open()
    await waitFor(() => expect(container.querySelector(`[data-sub-company-row="${MECH.id}"]`)).toBeTruthy())
    fireEvent.click(container.querySelector('[data-contracts-person-row="Kim Sample"]')!)
    fireEvent.click(await screen.findByRole('button', { name: 'None on file, their company, press to change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Same as their name' }))
    await waitFor(() =>
      expect(seen.rpcs).toContainEqual({ fn: 'person_trade_company_enter', args: { p_person_id: 'p-kim', p_company: { name: 'Kim Sample', trades: ['Plumbing'] }, p_title: undefined } }),
    )
  })

  it('a company we have is linked, not made again, and an emptied box takes them off', async () => {
    const { container } = await open()
    await waitFor(() => expect(container.querySelector(`[data-sub-company-row="${MECH.id}"]`)).toBeTruthy())
    fireEvent.click(container.querySelector('[data-contracts-person-row="Kim Sample"]')!)
    fireEvent.click(await screen.findByRole('button', { name: 'None on file, their company, press to change' }))
    const box = screen.getByLabelText('their company')
    fireEvent.change(box, { target: { value: 'sample pipe co' } })
    expect(screen.getByText('A trade company we have.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(seen.rpcs).toContainEqual({ fn: 'person_trade_company_set', args: { p_person_id: 'p-kim', p_company_id: PIPE.id, p_title: undefined } }))
    expect(seen.rpcs.some((c) => c.fn === 'person_trade_company_enter')).toBe(false)

    // Pat works for the mechanical company: emptying the box takes Pat off it.
    fireEvent.click(container.querySelector('[data-contracts-person-row="Pat Sample"]')!)
    fireEvent.click(await screen.findByRole('button', { name: `${MECH.name}, their company, press to change` }))
    expect(screen.getByRole('button', { name: 'Owner, what they are there, press to change' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('their company'), { target: { value: '' } })
    expect(screen.getByText('Keep takes them off the company.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(seen.rpcs).toContainEqual({ fn: 'person_trade_company_set', args: { p_person_id: 'p-pat', p_company_id: null, p_title: 'Owner' } }))
  })

  it('a teammate’s opened row has no company control', async () => {
    const { container } = await open()
    await waitFor(() => expect(container.querySelector('[data-contracts-person-row="Amy Staff"]')).toBeTruthy())
    fireEvent.click(container.querySelector('[data-contracts-person-row="Amy Staff"]')!)
    await screen.findByRole('button', { name: '+ Add document' })
    expect(container.querySelector('[data-sub-company-lines]')).toBeNull()
  })

  it('outside the office’s four roles nothing reads the links and no control is drawn', async () => {
    seen.role = 'estimator'
    const { container } = await open()
    await waitFor(() => expect(container.querySelector('[data-contracts-person-row="Pat Sample"]')).toBeTruthy())
    expect(seen.tables).not.toContain('person_trade_companies')
    expect(container.querySelector('[data-sub-company-row]')).toBeNull()
    fireEvent.click(container.querySelector('[data-contracts-person-row="Kim Sample"]')!)
    await screen.findByRole('button', { name: '+ Add document' })
    expect(container.querySelector('[data-sub-company-lines]')).toBeNull()
  })
})
