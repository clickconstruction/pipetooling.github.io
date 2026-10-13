// @vitest-environment jsdom
/**
 * Messages, cut 5's screens: Settings → Phone and texts → Company phone seats over a fake io. The office reads the
 * seats with their people; the owner adds, changes and removes a seat, saves or puts them back; what stops a save
 * says so; a refused save keeps its words. The people are the prototype's demo people.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SEATS_NOT_SAVED, SEAT_GONE } from '../../lib/messages/assignRule'
import { QUO_SEATS_NONE, QUO_SEATS_SAVED_TOAST, type QuoSeatRow } from '../../lib/quo/seatsCard'
import type { QuoSeatsIo } from '../../lib/quo/seatsCardIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { QuoSeatsSettingsSection } from './QuoSeatsSettingsSection'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const auth = vi.hoisted(() => ({ role: 'master_technician' }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: auth.role })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const ROSA = '00000000-0000-4000-8000-0000000000a1'
const ROBERT = '00000000-0000-4000-8000-0000000000a2'
const TEAM = [
  { id: ROBERT, name: 'Robert', role: 'estimator' },
  { id: ROSA, name: 'Rosa', role: 'assistant' },
]

function fakeIo(seats: QuoSeatRow[] = [{ quoUserId: 'USrosa2', userId: ROSA }], over: Partial<QuoSeatsIo> = {}): QuoSeatsIo {
  return { load: vi.fn(async () => ({ seats, team: TEAM })), save: vi.fn(async () => undefined), ...over }
}

const card = () => document.querySelector<HTMLElement>('[data-settings-quo-seats]')!

beforeEach(() => {
  auth.role = 'master_technician'
})
afterEach(() => cleanup())

describe('Company phone seats (Settings → Phone and texts, Messages cut 5)', () => {
  it('shows the office each seat with its person, and who sets them', async () => {
    auth.role = 'assistant'
    renderWithProviders(<QuoSeatsSettingsSection io={fakeIo()} />)
    await waitFor(() => expect(card().textContent).toContain('USrosa2'))
    expect(card().textContent).toContain('Rosa')
    expect(card().textContent).toContain('The owner or a dev sets the seats.')
    expect(within(card()).queryByRole('button', { name: 'Save the seats' })).toBeNull()
  })

  it('says when there are no seats yet', async () => {
    auth.role = 'assistant'
    renderWithProviders(<QuoSeatsSettingsSection io={fakeIo([])} />)
    expect(await within(card()).findByText(QUO_SEATS_NONE)).toBeTruthy()
  })

  it('lets the owner add a seat, pick its person and save it, as the functions read it', async () => {
    const io = fakeIo()
    renderWithProviders(<QuoSeatsSettingsSection io={io} />)
    // The seat loads in an effect and Add a seat draws before it: wait for the loaded seat, or Add makes Seat 1 (CI flake).
    await within(card()).findByRole('textbox', { name: 'Seat 1: Quo user id' })
    fireEvent.click(within(card()).getByRole('button', { name: 'Add a seat' }))
    fireEvent.change(await within(card()).findByRole('textbox', { name: 'Seat 2: Quo user id' }), { target: { value: ' USrobert1 ' } })
    fireEvent.change(within(card()).getByRole('combobox', { name: 'Seat 2: who answers on it' }), { target: { value: ROBERT } })
    fireEvent.click(within(card()).getByRole('button', { name: 'Save the seats' }))
    await waitFor(() =>
      expect(io.save).toHaveBeenCalledWith([
        { quoUserId: 'USrosa2', userId: ROSA },
        { quoUserId: 'USrobert1', userId: ROBERT },
      ]),
    )
    expect(await screen.findByText(QUO_SEATS_SAVED_TOAST)).toBeTruthy()
  })

  it('says what stops a save, and saves nothing', async () => {
    const io = fakeIo()
    renderWithProviders(<QuoSeatsSettingsSection io={io} />)
    // The seat loads in an effect and Add a seat draws before it: wait for the loaded seat, or Add makes Seat 1 (CI flake).
    await within(card()).findByRole('textbox', { name: 'Seat 1: Quo user id' })
    fireEvent.click(within(card()).getByRole('button', { name: 'Add a seat' }))
    fireEvent.change(await within(card()).findByRole('textbox', { name: 'Seat 2: Quo user id' }), { target: { value: 'robert' } })
    fireEvent.click(within(card()).getByRole('button', { name: 'Save the seats' }))
    expect(within(card()).getByRole('alert').textContent).toBe('Give each seat its Quo user id. They start with US.')
    expect(io.save).not.toHaveBeenCalled()
  })

  it('removes a seat, and puts the seats back', async () => {
    renderWithProviders(<QuoSeatsSettingsSection io={fakeIo()} />)
    await waitFor(() => expect(within(card()).getByRole('button', { name: 'Remove seat 1' })).toBeTruthy())
    fireEvent.click(within(card()).getByRole('button', { name: 'Remove seat 1' }))
    expect(card().textContent).toContain(QUO_SEATS_NONE)
    fireEvent.click(within(card()).getByRole('button', { name: 'Put them back' }))
    expect((within(card()).getByRole('textbox', { name: 'Seat 1: Quo user id' }) as HTMLInputElement).value).toBe('USrosa2')
  })

  it('keeps a refused save’s words', async () => {
    const io = fakeIo([], { save: vi.fn(async () => Promise.reject(new Error(SEATS_NOT_SAVED))) })
    renderWithProviders(<QuoSeatsSettingsSection io={io} />)
    // Wait for the empty load to land, or its setDraft([]) wipes the seat Add made (CI flake).
    await waitFor(() => expect(card().textContent).toContain(QUO_SEATS_NONE))
    fireEvent.click(within(card()).getByRole('button', { name: 'Add a seat' }))
    fireEvent.change(await within(card()).findByRole('textbox', { name: 'Seat 1: Quo user id' }), { target: { value: 'USrosa2' } })
    fireEvent.change(within(card()).getByRole('combobox', { name: 'Seat 1: who answers on it' }), { target: { value: ROSA } })
    fireEvent.click(within(card()).getByRole('button', { name: 'Save the seats' }))
    expect((await within(card()).findByRole('alert')).textContent).toBe(SEATS_NOT_SAVED)
  })

  it('names a seat whose person left the team', async () => {
    auth.role = 'assistant'
    renderWithProviders(<QuoSeatsSettingsSection io={fakeIo([{ quoUserId: 'USgone9', userId: 'u-gone' }])} />)
    await waitFor(() => expect(card().textContent).toContain('USgone9'))
    expect(card().textContent).toContain(SEAT_GONE)
  })
})
