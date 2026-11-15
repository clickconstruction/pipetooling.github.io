// @vitest-environment jsdom
/**
 * Render smokes for None needed on the new-job question: the press opens the reason step and
 * writes nothing; the button counts the houses and stays dead until a reason is given; a
 * one-tap reason or the office's own words is what each row carries as its note.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import JobAccountsAfterCreatePrompt from './JobAccountsAfterCreatePrompt'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'assistant' }) }))

const HOUSES = [
  ['ferguson', 'ZZ Ferguson'],
  ['moore', 'ZZ Moore'],
  ['reece', 'ZZ Reece'],
] as const
const stripRow = (houseId: string, houseName: string) => ({
  job_id: 'j1',
  supply_house_id: houseId,
  house_name: houseName,
  policy: 'expects',
  account_id: null,
  status: null,
  account_ref: null,
  opened_via: null,
  opened_at: null,
  requested_at: null,
  requested_from_counter: null,
  account_note: null,
  rep_contact_id: null,
  rep_name: null,
  rep_phone: null,
})

const upserts = vi.hoisted(() => ({ calls: [] as Array<{ table: string; rows: unknown; options: unknown }> }))
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (name: string) =>
      Promise.resolve(
        name === 'job_account_job_identity'
          ? { data: [{ id: 'j1', hcp_number: '9302', click_number: null, job_name: 'ZZ Test job', job_address: null, bid_id: null }], error: null }
          : { data: HOUSES.map(([id, houseName]) => stripRow(id, houseName)), error: null },
      ),
    from: (table: string) => ({
      upsert: (rows: unknown, options: unknown) => {
        upserts.calls.push({ table, rows, options })
        return Promise.resolve({ error: null })
      },
    }),
  },
}))

afterEach(() => {
  upserts.calls = []
})

async function openWhy() {
  const close = vi.fn()
  renderWithProviders(<JobAccountsAfterCreatePrompt jobId="j1" onClose={close} />)
  expect(await screen.findByText('Job accounts for 9302 · ZZ Test job?')).toBeTruthy()
  fireEvent.click(screen.getByTestId('job-accounts-prompt-none'))
  const save = (await screen.findByTestId('job-accounts-prompt-none-save')) as HTMLButtonElement
  return { close, save }
}

describe('JobAccountsAfterCreatePrompt, None needed asks why', () => {
  it('opens the reason step and writes nothing until a reason is given', async () => {
    const { close, save } = await openWhy()
    expect(save.textContent).toBe('Mark 3 houses not needed')
    expect(save.disabled).toBe(true)
    fireEvent.click(save)
    expect(upserts.calls).toEqual([])
    expect(close).not.toHaveBeenCalled()
  })

  it('a one-tap reason marks every house with that reason as its note', async () => {
    const { close, save } = await openWhy()
    fireEvent.click(screen.getByRole('button', { name: 'Service call' }))
    await waitFor(() => expect(save.disabled).toBe(false))
    fireEvent.click(save)
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1))
    expect(upserts.calls).toEqual([
      {
        table: 'job_supply_house_accounts',
        rows: HOUSES.map(([id]) => ({ job_id: 'j1', supply_house_id: id, status: 'not_needed', note: 'Service call' })),
        options: { onConflict: 'job_id,supply_house_id', ignoreDuplicates: true },
      },
    ])
    expect(await screen.findByText('Marked not needed: Service call. No job account signals for this job.')).toBeTruthy()
  })

  it('takes the office’s own words', async () => {
    const { close, save } = await openWhy()
    fireEvent.change(screen.getByTestId('job-accounts-prompt-why-input'), { target: { value: ' The GC buys the parts ' } })
    await waitFor(() => expect(save.disabled).toBe(false))
    fireEvent.click(save)
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1))
    expect((upserts.calls[0]!.rows as Array<{ note: string }>).map((r) => r.note)).toEqual(['The GC buys the parts', 'The GC buys the parts', 'The GC buys the parts'])
  })
})
