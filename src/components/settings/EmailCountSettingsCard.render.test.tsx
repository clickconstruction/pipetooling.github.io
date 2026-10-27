// @vitest-environment jsdom
/**
 * Quickfill's Email station (punch list #159): Settings → Phone and texts → Mail the app counts over a fake io. The
 * owner reads the switch, the limit, the shared boxes and the people with what the last count found; turning it on
 * asks first; a box and a person are added; a box's labels are saved; a label the box does not have is said in words;
 * a remove asks first; the lead is picked; a refused change keeps its words.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COUNT_ADMIN_STEP, COUNT_CONFIRM, COUNT_NOT_SAVED, COUNT_ON_TOAST, type CountPerson, type WatchView } from '../../lib/emailIn/countCard'
import type { EmailCountIo } from '../../lib/emailIn/countCardIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { EmailCountSettingsCard } from './EmailCountSettingsCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

// Fri Oct 23, 2026, 9:55 AM in Chicago. Made-up boxes and people.
const NOW = '2026-10-23T14:55:00.000Z'
const row = (over: Partial<WatchView> & { id: string; address: string }): WatchView => ({
  user_id: null,
  labels: ['Inbox', 'Follow Up', 'Next Actions'],
  is_on: true,
  labels_state: null,
  last_ok_at: null,
  last_error: null,
  created_at: '2026-10-23T13:00:00Z',
  added_by: null,
  ...over,
})
const PEOPLE: CountPerson[] = [
  { id: 'u-dale', name: 'Dale', email: 'dale@clickplumbing.example' },
  { id: 'u-marisol', name: 'Marisol', email: 'marisol@clickplumbing.example' },
]
const BIDS = row({
  id: 'w-bids',
  address: 'bids@clickconstruction.example',
  last_ok_at: '2026-10-23T14:07:00Z',
  labels_state: { Inbox: { at: NOW, total: 2 }, 'Follow Up': { at: NOW, total: 0 }, 'Next Actions': { at: NOW, missing: true } },
})
const MARISOL = row({ id: 'w-marisol', user_id: 'u-marisol', address: 'marisol@clickplumbing.example', created_at: '2026-10-23T13:30:00Z' })

function fakeIo(rows: WatchView[], over: Partial<EmailCountIo> = {}, on = false): EmailCountIo {
  return {
    load: vi.fn(async () => ({ on, leadId: null, limitDays: 3, rows, people: PEOPLE })),
    setOn: vi.fn(async () => undefined),
    setLead: vi.fn(async () => undefined),
    setLimit: vi.fn(async () => undefined),
    addShared: vi.fn(async (address: string) => row({ id: 'w-new', address })),
    addPerson: vi.fn(async (p: CountPerson) => row({ id: 'w-p', user_id: p.id, address: p.email! })),
    remove: vi.fn(async () => undefined),
    setRowOn: vi.fn(async () => undefined),
    setLabels: vi.fn(async () => undefined),
    ...over,
  }
}

const card = () => within(document.querySelector<HTMLElement>('[data-settings-email-count]')!)

afterEach(cleanup)

describe('EmailCountSettingsCard', () => {
  it('reads the switch, the shared boxes and the people with what the last count found', async () => {
    renderWithProviders(<EmailCountSettingsCard io={fakeIo([BIDS, MARISOL])} nowIso={NOW} />)
    const toggle = await screen.findByRole('switch', { name: 'Mail the app counts' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    const bids = within(document.querySelector<HTMLElement>('[data-count-row="bids@clickconstruction.example"]')!)
    expect(bids.getByText('Inbox 2 · Follow Up 0 · Next Actions ?')).toBeTruthy()
    expect(bids.getByText('Last counted today at 9:07 AM. No label named Next Actions.')).toBeTruthy()
    const marisol = within(document.querySelector<HTMLElement>('[data-count-row="marisol@clickplumbing.example"]')!)
    expect(marisol.getByText('Marisol')).toBeTruthy()
    expect(marisol.getByText('Not counted yet.')).toBeTruthy()
  })

  it('says the admin step while no box has been counted, and nothing once one has', async () => {
    renderWithProviders(<EmailCountSettingsCard io={fakeIo([MARISOL])} nowIso={NOW} />)
    expect(await screen.findByText(COUNT_ADMIN_STEP)).toBeTruthy()
    cleanup()
    renderWithProviders(<EmailCountSettingsCard io={fakeIo([BIDS])} nowIso={NOW} />)
    await screen.findByRole('switch', { name: 'Mail the app counts' })
    expect(screen.queryByText(COUNT_ADMIN_STEP)).toBeNull()
  })

  it('asks before it turns counting on, and turns it on only on a yes', async () => {
    const io = fakeIo([BIDS])
    renderWithProviders(<EmailCountSettingsCard io={io} nowIso={NOW} />)
    const toggle = await screen.findByRole('switch', { name: 'Mail the app counts' })
    fireEvent.click(toggle)
    const ask = await screen.findByRole('alertdialog')
    expect(within(ask).getByText(COUNT_CONFIRM.message)).toBeTruthy()
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(io.setOn).not.toHaveBeenCalled()
    fireEvent.click(toggle)
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: COUNT_CONFIRM.confirmLabel }))
    await waitFor(() => expect(io.setOn).toHaveBeenCalledWith(true))
    expect(await screen.findByText(COUNT_ON_TOAST)).toBeTruthy()
  })

  it('adds a shared box, refusing a bad or repeated address in words, and adds a person', async () => {
    const io = fakeIo([BIDS, MARISOL])
    renderWithProviders(<EmailCountSettingsCard io={io} nowIso={NOW} />)
    const address = await screen.findByLabelText("A shared box's address")
    fireEvent.change(address, { target: { value: 'work' } })
    expect(card().getByText('That does not look like an email address.')).toBeTruthy()
    fireEvent.change(address, { target: { value: 'BIDS@clickconstruction.example' } })
    expect(card().getByText('That address is on the list already.')).toBeTruthy()
    fireEvent.change(address, { target: { value: ' Work@ClickPlumbing.example ' } })
    fireEvent.click(card().getByRole('button', { name: 'Add a shared box' }))
    await waitFor(() => expect(io.addShared).toHaveBeenCalledWith('work@clickplumbing.example'))

    const pick = card().getByLabelText('A person to count') as HTMLSelectElement
    // Marisol is on the list already; Dale is the one to add.
    expect(Array.from(pick.options).map((o) => o.textContent)).toEqual(['Pick someone', 'Dale'])
    fireEvent.change(pick, { target: { value: 'u-dale' } })
    fireEvent.click(card().getByRole('button', { name: 'Add a person' }))
    await waitFor(() => expect(io.addPerson).toHaveBeenCalledWith(PEOPLE[0]))
  })

  it('saves a box’s labels, switches a box, and asks before it removes one', async () => {
    const io = fakeIo([BIDS, MARISOL])
    renderWithProviders(<EmailCountSettingsCard io={io} nowIso={NOW} />)
    const labels = await screen.findByLabelText('Marisol: labels')
    expect((labels as HTMLInputElement).value).toBe('Inbox, Follow Up, Next Actions')
    fireEvent.change(labels, { target: { value: 'Inbox, Waiting' } })
    const marisol = within(document.querySelector<HTMLElement>('[data-count-row="marisol@clickplumbing.example"]')!)
    fireEvent.click(marisol.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(io.setLabels).toHaveBeenCalledWith('w-marisol', ['Inbox', 'Waiting']))

    fireEvent.click(marisol.getByRole('switch', { name: 'Count Marisol' }))
    await waitFor(() => expect(io.setRowOn).toHaveBeenCalledWith('w-marisol', false))

    fireEvent.click(marisol.getByRole('button', { name: 'Remove' }))
    const ask = await screen.findByRole('alertdialog')
    expect(within(ask).getByText('Stop counting Marisol?')).toBeTruthy()
    fireEvent.click(within(ask).getByRole('button', { name: 'Stop counting' }))
    await waitFor(() => expect(io.remove).toHaveBeenCalledWith('w-marisol'))
  })

  it('picks the lead and saves the limit', async () => {
    const io = fakeIo([BIDS])
    renderWithProviders(<EmailCountSettingsCard io={io} nowIso={NOW} />)
    const lead = (await screen.findByLabelText('Who sees everyone’s rows')) as HTMLSelectElement
    expect(lead.value).toBe('')
    fireEvent.change(lead, { target: { value: 'u-dale' } })
    await waitFor(() => expect(io.setLead).toHaveBeenCalledWith('u-dale'))
    const limit = card().getByLabelText('Past the limit after')
    fireEvent.change(limit, { target: { value: '0' } })
    expect((card().getByRole('button', { name: 'Save the limit' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(limit, { target: { value: '5' } })
    fireEvent.click(card().getByRole('button', { name: 'Save the limit' }))
    await waitFor(() => expect(io.setLimit).toHaveBeenCalledWith(5))
  })

  it('keeps the switch and says why when a change is refused', async () => {
    const io = fakeIo([BIDS], { setOn: vi.fn(async () => Promise.reject(new Error(COUNT_NOT_SAVED))) }, true)
    renderWithProviders(<EmailCountSettingsCard io={io} nowIso={NOW} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Mail the app counts' }))
    expect((await screen.findByRole('alert')).textContent).toContain(COUNT_NOT_SAVED)
    expect(screen.getByRole('switch', { name: 'Mail the app counts' }).getAttribute('aria-checked')).toBe('true')
  })

  it('with nothing counted yet, each empty list names the row under it that adds one (punch list #184)', async () => {
    renderWithProviders(<EmailCountSettingsCard io={fakeIo([])} nowIso={NOW} />)
    await screen.findByLabelText("A shared box's address")
    expect([...document.querySelectorAll<HTMLElement>('[data-empty-state]')].map((el) => el.textContent)).toEqual([
      'No shared box yet. Type its address below and press Add a shared box.',
      'No one yet. Pick someone below and press Add a person.',
    ])
  })
})
