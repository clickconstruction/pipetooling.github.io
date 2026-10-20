// @vitest-environment jsdom
/**
 * Residential R5's push: Settings → Phone and texts → Reply push over a fake io. The owner reads the switch and what it
 * means; turning it on asks first and turning it off does not; a refused change keeps its words and the switch.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OFFICE_WAIT_BAD, OFFICE_WAIT_NOT_SAVED, OFFICE_WAIT_SAVED_TOAST, REPLY_PUSH_CONFIRM, REPLY_PUSH_NOT_SAVED, REPLY_PUSH_OFF_TOAST, REPLY_PUSH_ON_TOAST } from '../../lib/messages/replyPushSwitch'
import type { ReplyPushSwitchIo } from '../../lib/messages/replyPushSwitchIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { ReplyPushSettingsCard } from './ReplyPushSettingsCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

function fakeIo(on: boolean, over: Partial<ReplyPushSwitchIo> = {}, waitMinutes = 15): ReplyPushSwitchIo {
  return { load: vi.fn(async () => ({ on, waitMinutes })), setOn: vi.fn(async () => undefined), setWait: vi.fn(async () => undefined), ...over }
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

  it('reads the office’s wait and says what it means (v2.5540)', async () => {
    renderWithProviders(<ReplyPushSettingsCard io={fakeIo(true)} />)
    const field = (await screen.findByRole('spinbutton', { name: 'Minutes before the office hears' })) as HTMLInputElement
    expect(field.value).toBe('15')
    expect(card().getByText('The office hears after 15 minutes when nobody writes back.')).toBeTruthy()
    expect((card().getByRole('button', { name: 'Save the wait' }) as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    renderWithProviders(<ReplyPushSettingsCard io={fakeIo(true, {}, 0)} />)
    expect(await screen.findByText('The office hears at once, with whoever has it.')).toBeTruthy()
  })

  it('saves a typed wait, 0 for at once, and refuses a number that is not one', async () => {
    const io = fakeIo(true)
    renderWithProviders(<ReplyPushSettingsCard io={io} />)
    const field = await screen.findByRole('spinbutton', { name: 'Minutes before the office hears' })
    const save = card().getByRole('button', { name: 'Save the wait' }) as HTMLButtonElement

    fireEvent.change(field, { target: { value: '0' } })
    expect(card().getByText('The office hears at once, with whoever has it.')).toBeTruthy()
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(io.setWait).toHaveBeenCalledWith(0))
    expect(await screen.findByText(OFFICE_WAIT_SAVED_TOAST)).toBeTruthy()
    await waitFor(() => expect((card().getByRole('button', { name: 'Save the wait' }) as HTMLButtonElement).disabled).toBe(true))

    fireEvent.change(field, { target: { value: '-3' } })
    expect(card().getByText(OFFICE_WAIT_BAD)).toBeTruthy()
    expect((card().getByRole('button', { name: 'Save the wait' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(field, { target: { value: '500' } })
    expect(card().getByText(OFFICE_WAIT_BAD)).toBeTruthy()
    expect(io.setWait).toHaveBeenCalledTimes(1)
  })

  it('keeps the wait and says why when its change is refused', async () => {
    const io = fakeIo(true, { setWait: vi.fn(async () => Promise.reject(new Error(OFFICE_WAIT_NOT_SAVED))) })
    renderWithProviders(<ReplyPushSettingsCard io={io} />)
    fireEvent.change(await screen.findByRole('spinbutton', { name: 'Minutes before the office hears' }), { target: { value: '30' } })
    fireEvent.click(card().getByRole('button', { name: 'Save the wait' }))
    expect((await screen.findByRole('alert')).textContent).toContain(OFFICE_WAIT_NOT_SAVED)
    expect((card().getByRole('button', { name: 'Save the wait' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('says why when the switch cannot be read', async () => {
    renderWithProviders(<ReplyPushSettingsCard io={fakeIo(false, { load: vi.fn(async () => Promise.reject(new Error('Could not read the reply push switch.'))) })} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Could not read the reply push switch.')
    expect(screen.queryByRole('switch')).toBeNull()
  })
})
