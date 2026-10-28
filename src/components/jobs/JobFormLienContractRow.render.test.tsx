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

// Punch list #165 (PR 3): the job's retainage as the kernel reads it, set per test; the release bill's write is watched.
const retainageState: { retainage: Record<string, unknown> | null } = { retainage: null }
vi.mock('../../hooks/useJobRetainage', () => ({ useJobRetainage: () => ({ retainage: retainageState.retainage, loading: false, error: null, reload: () => {} }) }))
const draftSpy = vi.fn((_args: Record<string, unknown>) => Promise.resolve({ invoiceId: 'b-new', ensureFailure: null }))
vi.mock('../../lib/ar/retainageHeldIo', () => ({ draftRetainageReleaseBill: (args: Record<string, unknown>) => draftSpy(args) }))

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

describe('JobFormLienContractRow · the release bill at job close (punch list #165, PR 3)', () => {
  const heldLine = (release: Record<string, unknown> = { state: 'none', applicationNumber: null, invoiceId: null }) => ({
    line: { jobId: 'j1', source: 'lien_details', applicationNumber: null, applicationSavedOn: null, held: 3120, released: 0, owed: 3120, release, finishedOn: '2026-09-30', ageDays: 26, cleared: false },
    figure: { source: 'lien_details', amount: 3120, applicationNumber: null },
    facts: { jobId: 'j1', label: 'C1377', name: '', address: '', heldBy: 'Acme GC', status: 'paid', billCount: 3 },
    jobStatus: 'paid',
  })
  afterEach(() => {
    retainageState.retainage = null
    draftSpy.mockClear()
  })

  it('an ended contract with retainage held and no pay application offers the release bill, and the press drafts it after a confirm', async () => {
    retainageState.retainage = heldLine()
    await mount({ lien_contract_ended_on: '2026-09-30', lien_contract_ended_how: 'complete', lien_retainage_held: 3120 })
    const offer = await screen.findByTestId('lien-retainage-release-offer')
    expect(offer.textContent).toContain('Acme GC still holds $3,120.00')
    fireEvent.click(screen.getByRole('button', { name: 'Draft the release bill…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Draft the bill' }))
    await waitFor(() => expect(draftSpy).toHaveBeenCalledTimes(1))
    expect(draftSpy.mock.calls[0]![0]).toEqual({ jobId: 'j1', amount: 3120, billCount: 3, jobStatus: 'paid' })
  })

  it('while the contract is still open there is no offer; once a release bill exists the row says where it stands', async () => {
    retainageState.retainage = heldLine()
    await mount({ lien_retainage_held: 3120 })
    await settle()
    expect(screen.queryByTestId('lien-retainage-release-offer')).toBeNull()
    cleanup()
    retainageState.retainage = heldLine({ state: 'billed', applicationNumber: null, invoiceId: 'b9' })
    await mount({ lien_contract_ended_on: '2026-09-30', lien_contract_ended_how: 'complete', lien_retainage_held: 3120 })
    expect((await screen.findByTestId('lien-retainage-release-state')).textContent).toBe('Retainage release: release billed · awaiting payment.')
    expect(screen.queryByTestId('lien-retainage-release-offer')).toBeNull()
  })
})
