// @vitest-environment jsdom
/**
 * Messages, cut 5: Settings → Phone and texts → Send texts over a fake io. The owner reads the switch; turning texts on
 * asks first and turning them off does not; a refused change keeps its words and the switch.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TEXTS_NOT_SAVED, TEXTS_OFF_TOAST, TEXTS_ON_TOAST, TEXTS_SWITCH_ALWAYS, TEXTS_SWITCH_CONFIRM } from '../../lib/quo/textsSwitch'
import type { TextsSwitchIo } from '../../lib/quo/textsSwitchIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { TextsSwitchSettingsCard } from './TextsSwitchSettingsCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

function fakeIo(on: boolean, over: Partial<TextsSwitchIo> = {}): TextsSwitchIo {
  return { load: vi.fn(async () => on), setOn: vi.fn(async () => undefined), ...over }
}

const card = () => within(document.querySelector<HTMLElement>('[data-settings-send-texts]')!)

afterEach(cleanup)

describe('TextsSwitchSettingsCard', () => {
  it('reads the switch and says what goes even when it is off', async () => {
    renderWithProviders(<TextsSwitchSettingsCard io={fakeIo(false)} />)
    const toggle = await screen.findByRole('switch', { name: 'Send texts' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(card().getByText(TEXTS_SWITCH_ALWAYS)).toBeTruthy()
  })

  it('asks before it turns texts on, and turns them on only on a yes', async () => {
    const io = fakeIo(false)
    renderWithProviders(<TextsSwitchSettingsCard io={io} />)
    const toggle = await screen.findByRole('switch', { name: 'Send texts' })

    fireEvent.click(toggle)
    const ask = await screen.findByRole('alertdialog')
    expect(within(ask).getByText(TEXTS_SWITCH_CONFIRM.message)).toBeTruthy()
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(io.setOn).not.toHaveBeenCalled()

    fireEvent.click(toggle)
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: TEXTS_SWITCH_CONFIRM.confirmLabel }))
    await waitFor(() => expect(io.setOn).toHaveBeenCalledWith(true))
    expect(await screen.findByText(TEXTS_ON_TOAST)).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Send texts' }).getAttribute('aria-checked')).toBe('true')
  })

  it('turns texts off without asking', async () => {
    const io = fakeIo(true)
    renderWithProviders(<TextsSwitchSettingsCard io={io} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Send texts' }))
    await waitFor(() => expect(io.setOn).toHaveBeenCalledWith(false))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(await screen.findByText(TEXTS_OFF_TOAST)).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Send texts' }).getAttribute('aria-checked')).toBe('false')
  })

  it('keeps the switch and says why when the change is refused', async () => {
    const io = fakeIo(true, { setOn: vi.fn(async () => Promise.reject(new Error(TEXTS_NOT_SAVED))) })
    renderWithProviders(<TextsSwitchSettingsCard io={io} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Send texts' }))
    expect((await screen.findByRole('alert')).textContent).toContain(TEXTS_NOT_SAVED)
    expect(screen.getByRole('switch', { name: 'Send texts' }).getAttribute('aria-checked')).toBe('true')
  })
})
