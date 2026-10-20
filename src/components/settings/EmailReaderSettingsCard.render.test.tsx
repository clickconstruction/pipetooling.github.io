// @vitest-environment jsdom
/**
 * Messages, cut 6: Settings → Phone and texts → Read bids@ over a fake io. The owner reads the switch and how the reader
 * is doing; turning it on asks first and turning it off does not; a refused change keeps its words and the switch.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { READER_CONFIRM, READER_NOT_SAVED, READER_OFF_TOAST, READER_ON_TOAST, type ReaderHealth } from '../../lib/messages/emailReader'
import type { EmailReaderIo } from '../../lib/messages/emailReaderIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { EmailReaderSettingsCard } from './EmailReaderSettingsCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

// Monday, October 12, 2026, 7:30 PM in Chicago.
const NOW = '2026-10-13T00:30:00.000Z'
const READ_OK: ReaderHealth = { last_ok_at: '2026-10-13T00:12:00.000Z', last_error: null }

function fakeIo(on: boolean, health: ReaderHealth | null, over: Partial<EmailReaderIo> = {}, teamHealth: ReaderHealth | null = null): EmailReaderIo {
  return { load: vi.fn(async () => ({ on, health, teamHealth })), setOn: vi.fn(async () => undefined), ...over }
}

const card = () => within(document.querySelector<HTMLElement>('[data-settings-read-bids]')!)

afterEach(cleanup)

describe('EmailReaderSettingsCard', () => {
  it('reads the switch and how the reader is doing', async () => {
    renderWithProviders(<EmailReaderSettingsCard io={fakeIo(true, READ_OK)} nowIso={NOW} />)
    const toggle = await screen.findByRole('switch', { name: 'Read bids@' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(card().getByText('Last read today at 7:12 PM. Nothing wrong.')).toBeTruthy()
    cleanup()
    renderWithProviders(<EmailReaderSettingsCard io={fakeIo(true, { last_ok_at: READ_OK.last_ok_at, last_error: 'Gmail 403: Delegation denied.' })} nowIso={NOW} />)
    expect(await screen.findByText('Last read today at 7:12 PM. The last run stopped: Gmail 403: Delegation denied.')).toBeTruthy()
  })

  it('shows the team box under bids@ once it has been read, and nothing for it before (R6)', async () => {
    renderWithProviders(<EmailReaderSettingsCard io={fakeIo(true, READ_OK)} nowIso={NOW} />)
    await screen.findByRole('switch', { name: 'Read bids@' })
    expect(document.querySelector('[data-reader-health-team]')).toBeNull()
    cleanup()
    const stopped = { last_ok_at: null, last_error: 'Gmail 403: Delegation denied.' }
    renderWithProviders(<EmailReaderSettingsCard io={fakeIo(true, READ_OK, {}, stopped)} nowIso={NOW} />)
    expect(await screen.findByText('The team box: Not read yet. The last run stopped: Gmail 403: Delegation denied.')).toBeTruthy()
    expect(card().getByText('Last read today at 7:12 PM. Nothing wrong.')).toBeTruthy()
  })

  it('asks before it turns the reader on, and turns it on only on a yes', async () => {
    const io = fakeIo(false, null)
    renderWithProviders(<EmailReaderSettingsCard io={io} nowIso={NOW} />)
    const toggle = await screen.findByRole('switch', { name: 'Read bids@' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(card().getByText('Not read yet.')).toBeTruthy()

    fireEvent.click(toggle)
    const ask = await screen.findByRole('alertdialog')
    expect(within(ask).getByText(READER_CONFIRM.message)).toBeTruthy()
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(io.setOn).not.toHaveBeenCalled()

    fireEvent.click(toggle)
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: READER_CONFIRM.confirmLabel }))
    await waitFor(() => expect(io.setOn).toHaveBeenCalledWith(true))
    expect(await screen.findByText(READER_ON_TOAST)).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Read bids@' }).getAttribute('aria-checked')).toBe('true')
  })

  it('turns the reader off without asking', async () => {
    const io = fakeIo(true, READ_OK)
    renderWithProviders(<EmailReaderSettingsCard io={io} nowIso={NOW} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Read bids@' }))
    await waitFor(() => expect(io.setOn).toHaveBeenCalledWith(false))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(await screen.findByText(READER_OFF_TOAST)).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Read bids@' }).getAttribute('aria-checked')).toBe('false')
  })

  it('keeps the switch and says why when the change is refused', async () => {
    const io = fakeIo(true, READ_OK, { setOn: vi.fn(async () => Promise.reject(new Error(READER_NOT_SAVED))) })
    renderWithProviders(<EmailReaderSettingsCard io={io} nowIso={NOW} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Read bids@' }))
    expect((await screen.findByRole('alert')).textContent).toContain(READER_NOT_SAVED)
    expect(screen.getByRole('switch', { name: 'Read bids@' }).getAttribute('aria-checked')).toBe('true')
  })
})
