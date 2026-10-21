// @vitest-environment jsdom
/**
 * Punch list #140 PR 2: the switch card over a fake read. The line reads the true count; opening lists the eight
 * switches with their state and a door to each one still off; Later folds it for a week on the device; all eight on
 * draws nothing, and so does a read that fails.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { SWITCH_LATER_STORAGE_KEY, SWITCH_WORDS, type SwitchRaw } from '../../lib/messages/switchCard'
import type { SwitchCardIo } from '../../lib/messages/switchCardIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SwitchOnCard } from './SwitchOnCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const row = (value_text: string | null): SwitchRaw => ({ value_text, value_num: null })
const THREE_ON: Record<string, SwitchRaw> = {
  messages_texts_on_v1: row('true'),
  messages_reply_push_on_v1: row('true'),
  messages_office_hours_v1: row(JSON.stringify({ days: [1, 2, 3, 4, 5], opens: '07:30', closes: '17:00', techUntil: '17:00', emergency: null, savedAt: '2026-10-21T15:00:00.000Z' })),
}
const ALL_ON: Record<string, SwitchRaw> = {
  ...THREE_ON,
  gmail_sync_on_v1: row('true'),
  messages_assign_rule_v1: row(JSON.stringify({ customer: '11111111-1111-4111-8111-111111111111', trade: '22222222-2222-4222-8222-222222222222', arch: null })),
  messages_boxes_v1: row(JSON.stringify({ team: { address: 'team@clickplumbing.example', phone: '', numberId: '' }, bids: { address: '', phone: '', numberId: '' } })),
  messages_quo_seats_v1: row(JSON.stringify({ US1: '11111111-1111-4111-8111-111111111111' })),
  messages_nudge_app_sends_v1: row(JSON.stringify({ residential: { approved: 'offer', paid: 'offer' } })),
}
const NOW = '2026-10-21T15:00:00.000Z'
const fakeIo = (raw: Record<string, SwitchRaw> | Error): SwitchCardIo => ({ load: vi.fn(async () => (raw instanceof Error ? Promise.reject(raw) : raw)) })

beforeEach(() => localStorage.removeItem(SWITCH_LATER_STORAGE_KEY))
afterEach(cleanup)

describe('SwitchOnCard (punch list #140 PR 2)', () => {
  it('reads the count into the line, and opening lists the eight switches with a door to each one still off', async () => {
    renderWithProviders(<SwitchOnCard io={fakeIo(THREE_ON)} now={() => NOW} />)
    const lineButton = await screen.findByRole('button', { name: /Finish switching Messages on · 3 of 8 on/ })
    expect(screen.queryByRole('region', { name: SWITCH_WORDS.title })).toBeNull()
    fireEvent.click(lineButton)
    const open = within(screen.getByRole('region', { name: SWITCH_WORDS.title }))
    expect(open.getByText('3 of 8 on. The page works before all eight. The loop closes when they are on.')).toBeTruthy()
    const rows = [...document.querySelectorAll('[data-switch-row]')].map((li) => `${li.getAttribute('data-switch-row')}:${li.getAttribute('data-switch-state')}`)
    expect(rows).toEqual(['texts:on', 'reader:off', 'assign:nobody', 'teamBox:not_set', 'replyPush:on', 'seats:nobody', 'reminders:off', 'hours:on'])
    expect(open.getAllByRole('link').map((a) => a.textContent)).toEqual(['Turn it on ›', 'Pick the seats ›', 'Set the address ›', 'Pick the seats ›', 'Offer them ›'])
    expect(open.getByRole('link', { name: 'Offer them ›' }).getAttribute('href')).toBe('/settings?tab=settings-phone-texts#settings-phone-texts-reminders')
    expect(open.getByRole('link', { name: 'Set the address ›' }).getAttribute('href')).toBe('/settings?tab=settings-phone-texts#settings-phone-texts-boxes')
    expect(open.getByText(SWITCH_WORDS.footer)).toBeTruthy()
  })

  it('says the team inbox is named but not read, in red', async () => {
    renderWithProviders(<SwitchOnCard io={fakeIo({ ...ALL_ON, gmail_sync_on_v1: row('false') })} now={() => NOW} />)
    fireEvent.click(await screen.findByRole('button', { name: /6 of 8 on/ }))
    expect(document.querySelector('[data-switch-row="teamBox"]')!.getAttribute('data-switch-state')).toBe('not_read')
    expect(within(document.querySelector<HTMLElement>('[data-switch-row="teamBox"]')!).getByText('Not read')).toBeTruthy()
  })

  it('Later folds it for a week on this device', async () => {
    renderWithProviders(<SwitchOnCard io={fakeIo(THREE_ON)} now={() => NOW} />)
    fireEvent.click(await screen.findByRole('button', { name: /3 of 8 on/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    await waitFor(() => expect(document.querySelector('[data-switch-card]')).toBeNull())
    expect(localStorage.getItem(SWITCH_LATER_STORAGE_KEY)).toBe('2026-10-28T15:00:00.000Z')
    cleanup()
    renderWithProviders(<SwitchOnCard io={fakeIo(THREE_ON)} now={() => '2026-10-24T15:00:00.000Z'} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(document.querySelector('[data-switch-card]')).toBeNull()
    cleanup()
    renderWithProviders(<SwitchOnCard io={fakeIo(THREE_ON)} now={() => '2026-10-29T15:00:00.000Z'} />)
    expect(await screen.findByRole('button', { name: /3 of 8 on/ })).toBeTruthy()
  })

  it('draws nothing once all eight are on, and nothing when the read fails', async () => {
    const io = fakeIo(ALL_ON)
    renderWithProviders(<SwitchOnCard io={io} now={() => NOW} />)
    await waitFor(() => expect(io.load).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(document.querySelector('[data-switch-card]')).toBeNull()
    cleanup()
    const failing = fakeIo(new Error('permission denied'))
    renderWithProviders(<SwitchOnCard io={failing} now={() => NOW} />)
    await waitFor(() => expect(failing.load).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(document.querySelector('[data-switch-card]')).toBeNull()
  })
})
