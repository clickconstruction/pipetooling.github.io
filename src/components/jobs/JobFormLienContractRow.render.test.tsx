// @vitest-environment jsdom
/**
 * Edit Job → Our contract on this job: the day our contract ended saves a finished date
 * only. A year half typed writes nothing; a finished date writes once; while the contract
 * is still open the date waits for a state to be picked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobFormLienContractRow } from './JobFormLienContractRow'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const writes: Array<Record<string, unknown>> = []
const state: { job: Record<string, unknown> } = { job: {} }

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.job, error: null }) }) }),
      update: (patch: Record<string, unknown>) => ({
        eq: () => {
          writes.push(patch)
          return Promise.resolve({ error: null })
        },
      }),
    }),
  },
}))

beforeEach(() => {
  writes.length = 0
})
afterEach(cleanup)

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

async function mount(job: Record<string, unknown>) {
  state.job = { last_work_date: '2026-09-12', lien_contract_ended_on: null, lien_contract_ended_how: null, lien_retainage_held: null, lien_payment_bond: null, ...job }
  renderWithProviders(<JobFormLienContractRow jobId="j1" gcName="Acme GC" expanded onToggle={() => {}} flash={false} />)
  return (await screen.findByLabelText('Day our contract ended')) as HTMLInputElement
}

describe('JobFormLienContractRow · the day our contract ended', () => {
  it('on an ended contract a half-typed year writes nothing and a finished date writes once', async () => {
    const box = await mount({ lien_contract_ended_on: '2026-09-10', lien_contract_ended_how: 'complete' })
    expect(box.value).toBe('2026-09-10')
    fireEvent.change(box, { target: { value: '0002-09-30' } })
    await settle()
    expect(writes).toHaveLength(0)
    fireEvent.change(box, { target: { value: '2026-09-30' } })
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({ lien_contract_ended_on: '2026-09-30' })
    await settle()
    expect(writes).toHaveLength(1)
    // The box stays open while its save runs.
    expect(box.disabled).toBe(false)
  })

  it('typed one digit at a time, the year saves once — when the box is left', async () => {
    const box = await mount({ lien_contract_ended_on: '2026-09-10', lien_contract_ended_how: 'terminated' })
    for (const [key, value] of [['2', '0002-09-30'], ['0', '0020-09-30'], ['2', '0202-09-30'], ['6', '2026-09-30']] as const) {
      fireEvent.keyDown(box, { key })
      fireEvent.change(box, { target: { value } })
    }
    await settle()
    expect(writes).toHaveLength(0)
    fireEvent.blur(box)
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({ lien_contract_ended_on: '2026-09-30' })
  })

  it('left half typed, the date is dropped: nothing is written and the box shows the saved day', async () => {
    const box = await mount({ lien_contract_ended_on: '2026-09-10', lien_contract_ended_how: 'complete' })
    fireEvent.keyDown(box, { key: '2' })
    fireEvent.change(box, { target: { value: '0002-09-10' } })
    fireEvent.blur(box)
    await settle()
    expect(writes).toHaveLength(0)
    expect(box.value).toBe('2026-09-10')
    expect(screen.getByText(/That date was not finished, so it was not saved/)).toBeTruthy()
  })

  it('still open: a date waits for the state, and a half-typed year never reaches it', async () => {
    const box = await mount({})
    // Suggested from the last approved clock day.
    expect(box.value).toBe('2026-09-12')
    fireEvent.keyDown(box, { key: '2' })
    fireEvent.change(box, { target: { value: '0002-09-20' } })
    // Clicking a state leaves the box first: the unfinished date is dropped, and the suggestion is what is saved.
    fireEvent.blur(box)
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({ lien_contract_ended_on: '2026-09-12', lien_contract_ended_how: 'complete' })
  })

  it('still open: a finished date writes nothing on its own, then goes out with the state', async () => {
    const box = await mount({})
    fireEvent.change(box, { target: { value: '2026-09-20' } })
    await settle()
    expect(writes).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Terminated' }))
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({ lien_contract_ended_on: '2026-09-20', lien_contract_ended_how: 'terminated' })
  })

  it('a date saved while another save is running is queued, not lost', async () => {
    const box = await mount({ lien_contract_ended_on: '2026-09-10', lien_contract_ended_how: 'complete' })
    fireEvent.click(screen.getByRole('button', { name: 'Unknown' }))
    fireEvent.change(box, { target: { value: '2026-09-30' } })
    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[0]).toMatchObject({ lien_payment_bond: 'unknown' })
    expect(writes[1]).toMatchObject({ lien_contract_ended_on: '2026-09-30' })
  })
})
