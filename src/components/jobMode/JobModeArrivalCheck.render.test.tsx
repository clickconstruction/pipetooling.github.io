// @vitest-environment jsdom
/**
 * Render smokes for Is it as told? in Job Mode (punch list #382, PR 10): nothing while there is nothing to ask, the
 * bullets nobody of ours has seen, Yes all as told in one press, a No named by its count, and a failure that keeps
 * the card. Every name here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { ArrivalAsk } from '../../lib/startChecks/startChecksIo'
import { JobModeArrivalCheck } from './JobModeArrivalCheck'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const ASK: ArrivalAsk = { fixtureId: 'fx-1', name: 'Rough In', bullets: [{ id: 'b1', words: 'The slab is poured.' }, { id: 'b2', words: 'The trench is open.' }] }
function io(first: ArrivalAsk | null, fail = false) {
  let ask = first
  const sent: Array<{ fixtureId: string; no: string[] }> = []
  return {
    sent,
    readArrival: vi.fn(async () => ask),
    arrive: vi.fn(async (fixtureId: string, no: readonly string[]) => {
      if (fail) throw new Error('The list has changed. Open it again.')
      sent.push({ fixtureId, no: [...no] })
      ask = null
      return { dispatchRequestId: no.length ? 'dr-1' : null }
    }),
  }
}
afterEach(cleanup)

describe('JobModeArrivalCheck', () => {
  it('draws nothing while there is nothing to ask, or the read fails', async () => {
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={io(null)} />)
    await settle()
    expect(screen.queryByTestId('job-mode-arrival-check')).toBeNull()
    cleanup()
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={{ readArrival: async () => Promise.reject(new Error('no signal')), arrive: async () => ({ dispatchRequestId: null }) }} />)
    await settle()
    expect(screen.queryByTestId('job-mode-arrival-check')).toBeNull()
  })

  it('lists what nobody of ours has seen, every one as told until pressed, and Yes all as told keeps it in one press', async () => {
    const mem = io(ASK)
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={mem} />)
    await screen.findByRole('region', { name: 'Is it as told?' })
    expect(screen.getByText('Before Rough In, the customer said these were ready. Look, then answer.')).toBeTruthy()
    expect(Array.from(document.querySelectorAll('[data-arrival-bullet]')).map((r) => (r as HTMLElement).dataset.answer)).toEqual(['as-told', 'as-told'])
    fireEvent.click(screen.getByRole('button', { name: 'Yes, all as told' }))
    await waitFor(() => expect(mem.sent).toEqual([{ fixtureId: 'fx-1', no: [] }]))
    // Asked once a stage: the card reads again and goes.
    await waitFor(() => expect(screen.queryByTestId('job-mode-arrival-check')).toBeNull())
    expect(mem.readArrival).toHaveBeenCalledTimes(2)
  })

  it('a No is named by its count on the one send, and can be taken back before it', async () => {
    const mem = io(ASK)
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={mem} />)
    await screen.findByRole('region', { name: 'Is it as told?' })
    fireEvent.click(screen.getByRole('button', { name: 'No: The slab is poured.' }))
    fireEvent.click(screen.getByRole('button', { name: 'No: The trench is open.' }))
    expect(screen.getByRole('button', { name: 'Send: 2 are not as told' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'No: The trench is open.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send: 1 is not as told' }))
    await waitFor(() => expect(mem.sent).toEqual([{ fixtureId: 'fx-1', no: ['b1'] }]))
  })

  it('a send that is refused says why and keeps the card', async () => {
    const mem = io(ASK, true)
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={mem} />)
    await screen.findByRole('region', { name: 'Is it as told?' })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, all as told' }))
    await waitFor(() => expect(mem.arrive).toHaveBeenCalled())
    await settle()
    expect(screen.getByTestId('job-mode-arrival-check')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Yes, all as told' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
