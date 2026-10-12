// @vitest-environment jsdom
/**
 * Messages, cut 2's screens, PR D: Settings → Phone and texts → Who gets a new message (v2.5311) over a fake io. The
 * office reads the rule with the seats' names; the owner picks a seat, saves it or puts it back; a seat whose person
 * left reads as such; a refused save keeps its words. The people are the prototype's demo people.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SEATS_NOT_SAVED, SEATS_SAVED_TOAST, SEAT_GONE } from '../../lib/messages/assignRule'
import type { AssignRuleIo } from '../../lib/messages/assignRuleIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { PhoneAndTextsSettingsSection } from './PhoneAndTextsSettingsSection'

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
  { id: 's1', name: 'Sam', role: 'superintendent' },
]

function fakeIo(over: Partial<AssignRuleIo> = {}, seats = { customer: ROSA, trade: ROBERT, arch: null as string | null }): AssignRuleIo {
  return { load: vi.fn(async () => ({ seats, team: TEAM })), save: vi.fn(async () => undefined), ...over }
}

const row = (key: string) => within(document.querySelector<HTMLElement>(`[data-seat-row="${key}"]`)!)

beforeEach(() => {
  auth.role = 'master_technician'
})
afterEach(cleanup)

describe('PhoneAndTextsSettingsSection', () => {
  it('the office reads the rule with the seats’ names, and who sets them', async () => {
    auth.role = 'assistant'
    renderWithProviders(<PhoneAndTextsSettingsSection io={fakeIo()} />)
    expect(await screen.findByText('Rosa')).toBeTruthy()
    expect(row('trade').getByText('Robert')).toBeTruthy()
    expect(row('arch').getByText("Robert, the trade partners' seat")).toBeTruthy()
    expect(row('unknown').getByText('Nobody. Whoever answers first takes it.')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('The owner or a dev sets the seats.')).toBeTruthy()
  })

  it('the owner picks a seat from the office team and saves it', async () => {
    const io = fakeIo()
    renderWithProviders(<PhoneAndTextsSettingsSection io={io} />)
    const customers = (await screen.findByRole('combobox', { name: 'Customers seat' })) as HTMLSelectElement
    expect([...customers.options].map((o) => o.text)).toEqual(['Nobody', 'Robert', 'Rosa'])
    const save = screen.getByRole('button', { name: 'Save the seats' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)

    fireEvent.change(customers, { target: { value: ROBERT } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(io.save).toHaveBeenCalledWith({ customer: ROBERT, trade: ROBERT, arch: null }))
    expect(await screen.findByText(SEATS_SAVED_TOAST)).toBeTruthy()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save the seats' }) as HTMLButtonElement).disabled).toBe(true))
  })

  it('an architect shares the trade partners’ seat until it has its own, and Put them back undoes a pick', async () => {
    renderWithProviders(<PhoneAndTextsSettingsSection io={fakeIo()} />)
    const architects = (await screen.findByRole('combobox', { name: 'Architects seat' })) as HTMLSelectElement
    expect(architects.options[architects.selectedIndex]!.text).toBe('Same as trade partners')
    expect(row('arch').getByText("Robert, the trade partners' seat")).toBeTruthy()

    fireEvent.change(architects, { target: { value: ROSA } })
    expect(row('arch').queryByText("Robert, the trade partners' seat")).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Put them back' }))
    expect((screen.getByRole('combobox', { name: 'Architects seat' }) as HTMLSelectElement).value).toBe('')
  })

  it('a seat whose person left the office reads as such until it is changed', async () => {
    renderWithProviders(<PhoneAndTextsSettingsSection io={fakeIo({}, { customer: '00000000-0000-4000-8000-0000000000ff', trade: null, arch: null })} />)
    const customers = (await screen.findByRole('combobox', { name: 'Customers seat' })) as HTMLSelectElement
    expect(customers.options[customers.selectedIndex]!.text).toBe(SEAT_GONE)
  })

  it('a refused save keeps its own words', async () => {
    const io = fakeIo({ save: vi.fn(async () => Promise.reject(new Error(SEATS_NOT_SAVED))) })
    renderWithProviders(<PhoneAndTextsSettingsSection io={io} />)
    fireEvent.change(await screen.findByRole('combobox', { name: 'Trade partners seat' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the seats' }))
    expect((await screen.findByRole('alert')).textContent).toBe(SEATS_NOT_SAVED)
  })
})
