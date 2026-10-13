// @vitest-environment jsdom
/**
 * Residential R5's push: Settings → Phone and texts → Reply push over a fake io. The owner reads the switch and what it
 * means; turning it on asks first and turning it off does not; a refused change keeps its words and the switch.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { REPLY_PUSH_CONFIRM, REPLY_PUSH_NOT_SAVED, REPLY_PUSH_OFF_TOAST, REPLY_PUSH_ON_TOAST } from '../../lib/messages/replyPushSwitch'
import type { ReplyPushSwitchIo } from '../../lib/messages/replyPushSwitchIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { ReplyPushSettingsCard } from './ReplyPushSettingsCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

function fakeIo(on: boolean, over: Partial<ReplyPushSwitchIo> = {}): ReplyPushSwitchIo {
  return { load: vi.fn(async () => ({ on })), setOn: vi.fn(async () => undefined), ...over }
}

const card = () => within(document.querySelector<HTMLElement>('[data-settings-reply-push]')!)

afterEach(cleanup)

describe('ReplyPushSettingsCard', () => {
  it('reads the switch and what it means', async () => {
    renderWithProviders(<ReplyPushSettingsCard io={fakeIo(true)} />)
    const toggle = await screen.findByRole('switch', { name: 'Reply push' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(card().getByText('Pushes go out within a minute.')).toBeTruthy()
    cleanup()
    renderWithProviders(<ReplyPushSettingsCard io={fakeIo(false)} />)
    expect(await screen.findByText('Off: nobody is pushed when a customer answers.')).toBeTruthy()
  })

  it('asks before it turns the push on, and turns it on only on a yes', async () => {
    const io = fakeIo(false)
    renderWithProviders(<ReplyPushSettingsCard io={io} />)
    const toggle = await screen.findByRole('switch', { name: 'Reply push' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(toggle)
    const ask = await screen.findByRole('alertdialog')
    expect(within(ask).getByText(REPLY_PUSH_CONFIRM.message)).toBeTruthy()
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(io.setOn).not.toHaveBeenCalled()

    fireEvent.click(toggle)
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: REPLY_PUSH_CONFIRM.confirmLabel }))
    await waitFor(() => expect(io.setOn).toHaveBeenCalledWith(true))
    expect(await screen.findByText(REPLY_PUSH_ON_TOAST)).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Reply push' }).getAttribute('aria-checked')).toBe('true')
    expect(card().getByText('Pushes go out within a minute.')).toBeTruthy()
  })

  it('turns the push off without asking', async () => {
    const io = fakeIo(true)
    renderWithProviders(<ReplyPushSettingsCard io={io} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Reply push' }))
    await waitFor(() => expect(io.setOn).toHaveBeenCalledWith(false))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(await screen.findByText(REPLY_PUSH_OFF_TOAST)).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Reply push' }).getAttribute('aria-checked')).toBe('false')
  })

  it('keeps the switch and says why when the change is refused', async () => {
    const io = fakeIo(true, { setOn: vi.fn(async () => Promise.reject(new Error(REPLY_PUSH_NOT_SAVED))) })
    renderWithProviders(<ReplyPushSettingsCard io={io} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Reply push' }))
    expect((await screen.findByRole('alert')).textContent).toContain(REPLY_PUSH_NOT_SAVED)
    expect(screen.getByRole('switch', { name: 'Reply push' }).getAttribute('aria-checked')).toBe('true')
  })

  it('says why when the switch cannot be read', async () => {
    renderWithProviders(<ReplyPushSettingsCard io={fakeIo(false, { load: vi.fn(async () => Promise.reject(new Error('Could not read the reply push switch.'))) })} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Could not read the reply push switch.')
    expect(screen.queryByRole('switch')).toBeNull()
  })
})
