// @vitest-environment jsdom
/**
 * Render smokes for Is it as told? in Job Mode (punch list #382, PR 10): nothing while there is nothing to ask, the
 * bullets nobody of ours has seen, Yes all as told in one press, a No named by its count, what the card says once
 * answered, a failure that keeps the card, and a read that comes back with the signal. Every name here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { ArrivalAsk } from '../../lib/startChecks/startChecksIo'
import { JobModeArrivalCheck } from './JobModeArrivalCheck'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// The refused read is drawn on OfflineRetryPanel, which reads who is signed in for its telemetry.
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'helpers' })
})

const ASK: ArrivalAsk = { fixtureId: 'fx-1', name: 'Rough In', bullets: [{ id: 'b1', words: 'The slab is poured.' }, { id: 'b2', words: 'The trench is open.' }] }
function io(first: ArrivalAsk | null, fail = false) {
  let ask = first
  const sent: Array<{ fixtureId: string; no: string[]; shown: string[] }> = []
  return {
    sent,
    readArrival: vi.fn(async () => ask),
    arrive: vi.fn(async (fixtureId: string, no: readonly string[], shown: readonly string[]) => {
      if (fail) throw new Error('The list has changed. Open it again.')
      sent.push({ fixtureId, no: [...no], shown: [...shown] })
      ask = null
      return { dispatchRequestId: no.length ? 'dr-1' : null, pushed: true }
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
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={{ readArrival: async () => Promise.reject(new Error('no signal')), arrive: async () => ({ dispatchRequestId: null, pushed: true }) }} />)
    await settle()
    expect(screen.queryByTestId('job-mode-arrival-check')).toBeNull()
  })

  it('lists what nobody of ours has seen, every one as told until pressed, and Yes all as told keeps it in one press', async () => {
    const mem = io(ASK)
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={mem} />)
    await screen.findByRole('region', { name: 'Is it as told?' })
    // The lead holds for a bullet somebody told us and for one still open: it claims nobody's word.
    const card = screen.getByRole('region', { name: 'Is it as told?' })
    expect(card.textContent).toContain('Look before you unload. These must be true before Rough In.')
    // Values in place: the stage is a value the app works out, drawn apart from the words around it.
    expect(Array.from(card.querySelectorAll('[data-value="worked-out"]')).map((v) => v.textContent)).toEqual(['Rough In'])
    expect(Array.from(document.querySelectorAll('[data-arrival-bullet]')).map((r) => (r as HTMLElement).dataset.answer)).toEqual(['as-told', 'as-told'])
    // Each bullet's press is the word No, never a state to read: nothing on it says As told.
    expect(Array.from(document.querySelectorAll('.scArrivalNo')).map((b) => b.textContent)).toEqual(['No', 'No'])
    fireEvent.click(screen.getByRole('button', { name: 'Yes, all as told' }))
    // The send carries the list the card showed: the door marks those bullets and no other.
    await waitFor(() => expect(mem.sent).toEqual([{ fixtureId: 'fx-1', no: [], shown: ['b1', 'b2'] }]))
    // Asked once a stage: the card says what it kept, and asks nothing more.
    const said = await screen.findByRole('status', { name: 'Is it as told?' })
    expect(said.textContent).toBe('Saved: all as told.Keep working either way.')
    expect(screen.queryByRole('button', { name: 'Yes, all as told' })).toBeNull()
    expect(mem.readArrival).toHaveBeenCalledTimes(1)
  })

  it('a No is named by its count on the one send, can be taken back before it, and the card then says Dispatch has it', async () => {
    const mem = io(ASK)
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={mem} />)
    await screen.findByRole('region', { name: 'Is it as told?' })
    const slab = screen.getByRole('button', { name: 'No: The slab is poured.' })
    const trench = screen.getByRole('button', { name: 'No: The trench is open.' })
    expect(slab.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(slab)
    fireEvent.click(trench)
    expect(slab.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Tell Dispatch: 2 things not as told' })).toBeTruthy()
    fireEvent.click(trench)
    fireEvent.click(screen.getByRole('button', { name: 'Tell Dispatch: 1 thing not as told' }))
    await waitFor(() => expect(mem.sent).toEqual([{ fixtureId: 'fx-1', no: ['b1'], shown: ['b1', 'b2'] }]))
    const said = await screen.findByRole('status', { name: 'Is it as told?' })
    expect(said.textContent).toBe('Dispatch has it: 1 thing not as told.Keep working either way.')
    expect(said.dataset.arrivalSaid).toBe('no')
  })

  it('a No whose push to the phones failed says so: the line is in the inbox, call Dispatch too', async () => {
    // The line is kept before the push goes out, so a failed push loses nothing but the ring. Dropped without a word,
    // the crew would think a dispatcher was on it.
    const arrive = vi.fn(async () => ({ dispatchRequestId: 'dr-1', pushed: false }))
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={{ readArrival: async () => ASK, arrive }} />)
    await screen.findByRole('region', { name: 'Is it as told?' })
    fireEvent.click(screen.getByRole('button', { name: 'No: The slab is poured.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tell Dispatch: 1 thing not as told' }))
    const said = await screen.findByRole('status', { name: 'Is it as told?' })
    expect(said.textContent).toBe('Dispatch has it: 1 thing not as told.The line is in the inbox, but no phone rang. Call Dispatch too.Keep working either way.')
    expect(said.querySelector('[data-arrival-not-pushed]')).toBeTruthy()
    cleanup()
    // A Yes, all as told sends no line and so no push: nothing to say about a phone.
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={{ readArrival: async () => ASK, arrive: async () => ({ dispatchRequestId: null, pushed: false }) }} />)
    await screen.findByRole('region', { name: 'Is it as told?' })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, all as told' }))
    const yes = await screen.findByRole('status', { name: 'Is it as told?' })
    expect(yes.textContent).toBe('Saved: all as told.Keep working either way.')
  })

  it('a send that is refused says why and keeps the card', async () => {
    const mem = io(ASK, true)
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={mem} />)
    await screen.findByRole('region', { name: 'Is it as told?' })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, all as told' }))
    await waitFor(() => expect(mem.arrive).toHaveBeenCalled())
    await settle()
    expect(await screen.findByText('The list has changed. Open it again.')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Is it as told?' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Yes, all as told' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('a send refused because one of the crew answered first says why, reads again, and the card leaves', async () => {
    // Two of ours had the card open. The other one answered Yes, all as told: nothing is left to look at, the door's
    // own words for it, and the stage is asked about once, so this card is over.
    let answered = false
    const readArrival = vi.fn(async () => (answered ? null : ASK))
    const arrive = vi.fn(async () => {
      answered = true
      throw new Error('There is nothing left to look at on this stage.')
    })
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={{ readArrival, arrive }} />)
    await screen.findByRole('region', { name: 'Is it as told?' })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, all as told' }))
    expect(await screen.findByText('There is nothing left to look at on this stage.')).toBeTruthy()
    await waitFor(() => expect(screen.queryByTestId('job-mode-arrival-check')).toBeNull())
    expect(readArrival).toHaveBeenCalledTimes(2)
    expect(arrive).toHaveBeenCalledTimes(1)
  })

  it('a send refused because the list changed reads again and shows the list as it is now, with a No kept on a bullet still there', async () => {
    let changed = false
    const NOW: ArrivalAsk = { ...ASK, bullets: [{ id: 'b1', words: 'The slab is poured.' }, { id: 'b3', words: 'Power is on.' }] }
    const readArrival = vi.fn(async () => (changed ? NOW : ASK))
    const arrive = vi.fn(async () => {
      changed = true
      throw new Error('The list has changed. Open it again.')
    })
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={{ readArrival, arrive }} />)
    await screen.findByRole('region', { name: 'Is it as told?' })
    fireEvent.click(screen.getByRole('button', { name: 'No: The slab is poured.' }))
    fireEvent.click(screen.getByRole('button', { name: 'No: The trench is open.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tell Dispatch: 2 things not as told' }))
    expect(await screen.findByText('The list has changed. Open it again.')).toBeTruthy()
    await screen.findByRole('button', { name: 'No: Power is on.' })
    expect(screen.queryByRole('button', { name: 'No: The trench is open.' })).toBeNull()
    // The No on the slab is still pressed, and the send counts only what is on the card.
    expect(screen.getByRole('button', { name: 'No: The slab is poured.' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Tell Dispatch: 1 thing not as told' })).toBeTruthy()
  })

  it('a later read that fails keeps the card that is up, with its Nos', async () => {
    let fail = false
    const readArrival = vi.fn(async () => {
      if (fail) throw new Error('no signal')
      return ASK
    })
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={{ readArrival, arrive: async () => ({ dispatchRequestId: null, pushed: true }) }} />)
    await screen.findByRole('region', { name: 'Is it as told?' })
    fireEvent.click(screen.getByRole('button', { name: 'No: The slab is poured.' }))
    fail = true
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(readArrival).toHaveBeenCalledTimes(2))
    await settle()
    expect(screen.getByRole('region', { name: 'Is it as told?' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'No: The slab is poured.' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('a read that failed with no signal reads again when the signal comes back', async () => {
    let fail = true
    const readArrival = vi.fn(async () => {
      if (fail) throw new Error('no signal')
      return ASK
    })
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={{ readArrival, arrive: async () => ({ dispatchRequestId: null, pushed: true }) }} />)
    await settle()
    expect(screen.queryByTestId('job-mode-arrival-check')).toBeNull()
    fail = false
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(await screen.findByRole('region', { name: 'Is it as told?' })).toBeTruthy()
    expect(readArrival).toHaveBeenCalledTimes(2)
  })

  it('a first read the app refuses says so with its reason and no Retry, and a read that lands takes it away', async () => {
    let refuse = true
    const readArrival = vi.fn(async () => {
      // A refusal as the database gives it: a code and its words, never a lost signal.
      if (refuse) throw { code: 'P0001', message: 'The stage line has no days.' }
      return ASK
    })
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={{ readArrival, arrive: async () => ({ dispatchRequestId: null, pushed: true }) }} />)
    const card = await screen.findByRole('region', { name: 'Is it as told?' })
    expect(card.getAttribute('data-arrival-refused')).toBe('yes')
    expect(card.textContent).toContain('The app could not read what to look at here: The stage line has no days.')
    expect(card.textContent).toContain('Keep working either way.')
    // A refusal is ours to mend: no press on the card would change the answer, so it offers none.
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Yes, all as told' })).toBeNull()
    refuse = false
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(await screen.findByRole('button', { name: 'Yes, all as told' })).toBeTruthy()
    expect(document.querySelector('[data-arrival-refused]')).toBeNull()
  })

  it('a first read lost to the signal stays silent, as a fetch that never left', async () => {
    const readArrival = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={{ readArrival, arrive: async () => ({ dispatchRequestId: null, pushed: true }) }} />)
    await settle()
    expect(readArrival).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('job-mode-arrival-check')).toBeNull()
  })

  it('a later read the app refuses keeps the card that is up', async () => {
    let refuse = false
    const readArrival = vi.fn(async () => {
      if (refuse) throw { code: 'P0001', message: 'The stage line has no days.' }
      return ASK
    })
    renderWithProviders(<JobModeArrivalCheck jobId="job-1" io={{ readArrival, arrive: async () => ({ dispatchRequestId: null, pushed: true }) }} />)
    await screen.findByRole('button', { name: 'Yes, all as told' })
    refuse = true
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(readArrival).toHaveBeenCalledTimes(2))
    await settle()
    expect(screen.getByRole('button', { name: 'Yes, all as told' })).toBeTruthy()
    expect(document.querySelector('[data-arrival-refused]')).toBeNull()
  })
})
