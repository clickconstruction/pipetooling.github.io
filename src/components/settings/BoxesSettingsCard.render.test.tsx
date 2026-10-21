// @vitest-environment jsdom
/**
 * Residential R6's screens: Settings → Phone and texts → Inboxes over a fake io. The office reads each box, what it is
 * for, and what an empty field keeps; the owner types the team inbox and saves it, the phone kept as the company
 * number reads; what stops a save says so and saves nothing; Put them back undoes the typing; a refused save keeps its
 * words. Made-up addresses only. Since v2.5718, with the Quo connection's lists in hand the phone and the Quo number
 * id are one pick from Quo's numbers, with Type it by hand beside it.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoxSettings } from '../../lib/messages/boxes'
import { BOXES_NOT_SAVED, BOXES_SAVED_TOAST, EMPTY_BOXES } from '../../lib/messages/boxesCard'
import type { BoxesCardIo } from '../../lib/messages/boxesCardIo'
import { NO_QUO_KEY, type QuoDirectory, type QuoKeyStatus } from '../../lib/quo/connection'
import type { QuoConnectionIo } from '../../lib/quo/connectionIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BoxesSettingsCard } from './BoxesSettingsCard'
import { QuoConnectionProvider } from './QuoConnectionContext'

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

const SAVED: BoxSettings = {
  team: { address: '', phone: '', numberId: '' },
  bids: { address: 'bids@construction.example', phone: '', numberId: '' },
}

function fakeIo(boxes: BoxSettings = SAVED, over: Partial<BoxesCardIo> = {}): BoxesCardIo {
  return { load: vi.fn(async () => boxes), save: vi.fn(async () => undefined), ...over }
}

const card = () => document.querySelector<HTMLElement>('[data-settings-boxes]')!
const box = (b: 'team' | 'bids') => document.querySelector<HTMLElement>(`[data-settings-box="${b}"]`)!
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

const KEY_SAVED: QuoKeyStatus = { set: true, source: 'vault', last4: 'ab12', savedAt: '2026-10-21T19:30:00Z', savedBy: 'Robert' }
const DIRECTORY: QuoDirectory = {
  members: [],
  numbers: [
    { id: 'PNteam01', name: 'Team line', symbol: '🏡', number: '+15125550144', phone: '(512) 555-0144' },
    { id: 'PNbids02', name: 'Bids', symbol: '', number: '+15125550199', phone: '(512) 555-0199' },
  ],
}
function quoIo(over: Partial<QuoConnectionIo> = {}): QuoConnectionIo {
  return { status: vi.fn(async () => KEY_SAVED), save: vi.fn(async () => KEY_SAVED), directory: vi.fn(async () => DIRECTORY), ...over }
}
/** The card under a Quo connection whose lists came back. */
function drawWithQuo(io: BoxesCardIo, quo: QuoConnectionIo = quoIo()) {
  renderWithProviders(
    <QuoConnectionProvider io={quo} enabled>
      <BoxesSettingsCard io={io} />
    </QuoConnectionProvider>,
  )
}

beforeEach(() => {
  auth.role = 'master_technician'
})
afterEach(() => cleanup())

describe('Inboxes (Settings → Phone and texts, residential R6)', () => {
  it('shows the office each box, who it is for, what an empty field keeps, and who sets them', async () => {
    auth.role = 'assistant'
    renderWithProviders(<BoxesSettingsCard io={fakeIo()} />)
    await waitFor(() => expect(box('bids').textContent).toContain('bids@construction.example'))
    expect(box('team').textContent).toContain('For customers, leads, subs and candidates.')
    expect(box('team').textContent).toContain('Empty means the app keeps using today’s company number.')
    expect(box('bids').textContent).toContain('For trade partners, architects and supply houses.')
    expect(box('bids').textContent).toContain('Empty means the app keeps using today’s bids@.')
    expect(card().textContent).toContain('The app starts using these once the two inboxes are switched on.')
    expect(card().textContent).toContain('The owner or a dev sets the inboxes.')
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByText('Save the inboxes')).toBeNull()
  })

  it('lets the owner type the team inbox and save it, the phone kept as the company number reads', async () => {
    const io = fakeIo()
    renderWithProviders(<BoxesSettingsCard io={io} />)
    await screen.findByLabelText('Team inbox: Email address')
    type('Team inbox: Email address', ' office@plumbing.example ')
    type('Team inbox: Phone', '512.555.0144')
    type('Team inbox: Quo number id', ' PNteam01 ')
    fireEvent.click(screen.getByText('Save the inboxes'))
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(1))
    expect(io.save).toHaveBeenCalledWith({
      team: { address: 'office@plumbing.example', phone: '(512) 555-0144', numberId: 'PNteam01' },
      bids: { address: 'bids@construction.example', phone: '', numberId: '' },
    })
    expect(await screen.findByText(BOXES_SAVED_TOAST)).toBeTruthy()
    expect((screen.getByLabelText('Team inbox: Phone') as HTMLInputElement).value).toBe('(512) 555-0144')
  })

  it('says what stops a save and saves nothing', async () => {
    const io = fakeIo(EMPTY_BOXES)
    renderWithProviders(<BoxesSettingsCard io={io} />)
    await screen.findByLabelText('Team inbox: Phone')
    type('Team inbox: Phone', '5125550144')
    fireEvent.click(screen.getByText('Save the inboxes'))
    expect((await screen.findByRole('alert')).textContent).toBe('Give the Team inbox its phone and its Quo number id together, or neither.')
    expect(io.save).not.toHaveBeenCalled()
  })

  it('puts the typing back', async () => {
    renderWithProviders(<BoxesSettingsCard io={fakeIo()} />)
    await screen.findByLabelText('Bids inbox: Email address')
    type('Bids inbox: Email address', 'new@construction.example')
    fireEvent.click(screen.getByText('Put them back'))
    expect((screen.getByLabelText('Bids inbox: Email address') as HTMLInputElement).value).toBe('bids@construction.example')
    expect(screen.queryByText('Put them back')).toBeNull()
  })

  it('keeps the words of a refused save', async () => {
    const io = fakeIo(SAVED, { save: vi.fn(async () => Promise.reject(new Error(BOXES_NOT_SAVED))) })
    renderWithProviders(<BoxesSettingsCard io={io} />)
    await screen.findByLabelText('Bids inbox: Email address')
    type('Bids inbox: Email address', 'office@construction.example')
    fireEvent.click(screen.getByText('Save the inboxes'))
    expect((await screen.findByRole('alert')).textContent).toContain(BOXES_NOT_SAVED)
  })

  it('picks a box’s number from Quo’s numbers once the connection has its lists, filling the phone and the id together (v2.5718)', async () => {
    const io = fakeIo(EMPTY_BOXES)
    drawWithQuo(io)
    const pick = (await screen.findByLabelText('Team inbox: Quo number')) as HTMLSelectElement
    expect(pick.value).toBe('')
    expect(Array.from(pick.options).map((o) => o.textContent)).toEqual(['Pick a Quo number', '🏡 Team line, (512) 555-0144', 'Bids, (512) 555-0199', 'Type it by hand'])
    expect(screen.queryByLabelText('Team inbox: Phone')).toBeNull()
    expect(screen.queryByLabelText('Team inbox: Quo number id')).toBeNull()
    type('Team inbox: Quo number', 'PNteam01')
    expect(box('team').querySelector('code')?.textContent).toBe('PNteam01')
    type('Bids inbox: Quo number', 'PNbids02')
    fireEvent.click(screen.getByText('Save the inboxes'))
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(1))
    expect(io.save).toHaveBeenCalledWith({
      team: { address: '', phone: '(512) 555-0144', numberId: 'PNteam01' },
      bids: { address: '', phone: '(512) 555-0199', numberId: 'PNbids02' },
    })
  })

  it('types a number by hand beside the picker, and a number Quo does not list stays typed', async () => {
    drawWithQuo(fakeIo({ team: { address: '', phone: '(512) 555-0100', numberId: 'PNelsewhere' }, bids: { address: '', phone: '', numberId: '' } }))
    // A number the list does not hold is typed as before, with a way back to the list.
    expect(((await screen.findByLabelText('Team inbox: Quo number id')) as HTMLInputElement).value).toBe('PNelsewhere')
    expect((screen.getByLabelText('Team inbox: Phone') as HTMLInputElement).value).toBe('(512) 555-0100')
    fireEvent.click(screen.getByLabelText('Team inbox: pick from Quo'))
    expect(((await screen.findByLabelText('Team inbox: Quo number')) as HTMLSelectElement).value).toBe('')
    type('Bids inbox: Quo number', '__by_hand__')
    expect(await screen.findByLabelText('Bids inbox: Quo number id')).toBeTruthy()
    expect(screen.getByLabelText('Bids inbox: Phone')).toBeTruthy()
  })

  it('types both as before without a key, saying the pickers come with the key', async () => {
    drawWithQuo(fakeIo(), quoIo({ status: vi.fn(async () => NO_QUO_KEY) }))
    expect(await screen.findByLabelText('Team inbox: Quo number id')).toBeTruthy()
    await waitFor(() => expect(card().textContent).toContain('Paste the Quo key above and the seats and inboxes become pickers.'))
    expect(screen.queryByLabelText('Team inbox: pick from Quo')).toBeNull()
  })
})
