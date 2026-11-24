// @vitest-environment jsdom
/**
 * Global Reload in Settings → Advanced (v2.8527): the press, the window that asks first, and the cases for pressing
 * it written under it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const force = vi.hoisted(() => ({ forceEveryoneToReload: vi.fn(), connected: true }))
vi.mock('../../contexts/ForceReloadContext', () => ({
  useForceReload: () => (force.connected ? { forceEveryoneToReload: force.forceEveryoneToReload } : null),
}))

import GlobalReloadSettingsCard from './GlobalReloadSettingsCard'
import { GLOBAL_RELOAD_CONFIRM, GLOBAL_RELOAD_LEAD, GLOBAL_RELOAD_NOT_SENT, GLOBAL_RELOAD_SECTIONS, GLOBAL_RELOAD_SENT } from '../../lib/settings/globalReloadWords'
import { renderWithProviders } from '../../test/renderSmokeMocks'

describe('GlobalReloadSettingsCard', () => {
  beforeEach(() => {
    force.forceEveryoneToReload.mockClear()
    force.connected = true
  })
  afterEach(() => cleanup())

  const thePress = () => screen.getByRole('button', { name: 'Global Reload' })

  it('says what it is above the press, and when to press it under the press', () => {
    renderWithProviders(<GlobalReloadSettingsCard />)
    const card = document.getElementById('settings-global-reload')!
    expect(card.querySelector('h2')?.textContent).toBe('Global Reload')
    const text = card.textContent ?? ''
    // Reading order: the lead, the press, then every section with every one of its lines.
    let at = text.indexOf(GLOBAL_RELOAD_LEAD)
    expect(at).toBeGreaterThan(-1)
    const press = text.indexOf('Global Reload', at + GLOBAL_RELOAD_LEAD.length)
    expect(press).toBeGreaterThan(at)
    at = press
    for (const section of GLOBAL_RELOAD_SECTIONS) {
      for (const words of [section.heading, ...section.lines]) {
        const next = text.indexOf(words, at)
        expect(next, words).toBeGreaterThan(at)
        at = next
      }
    }
    expect(screen.getAllByRole('listitem').length).toBe(GLOBAL_RELOAD_SECTIONS.reduce((n, s) => n + s.lines.length, 0))
    // A thumb can find it, and nothing has been said yet.
    expect(thePress().style.minHeight).toBe('44px')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('the press sends nothing by itself: a window asks first, and says what people lose', async () => {
    renderWithProviders(<GlobalReloadSettingsCard />)
    fireEvent.click(thePress())
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain(GLOBAL_RELOAD_CONFIRM.title)
    expect(dialog.textContent).toContain(GLOBAL_RELOAD_CONFIRM.message)
    expect(force.forceEveryoneToReload).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: GLOBAL_RELOAD_CONFIRM.cancelLabel }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(force.forceEveryoneToReload).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('Reload everyone sends it once, and the card says this copy stays', async () => {
    renderWithProviders(<GlobalReloadSettingsCard />)
    fireEvent.click(thePress())
    fireEvent.click(await screen.findByRole('button', { name: GLOBAL_RELOAD_CONFIRM.confirmLabel }))
    await waitFor(() => expect(force.forceEveryoneToReload).toHaveBeenCalledTimes(1))
    expect((await screen.findByRole('status')).textContent).toBe(GLOBAL_RELOAD_SENT)
  })

  it('with no connection to send on, it says so and sends nothing', async () => {
    force.connected = false
    renderWithProviders(<GlobalReloadSettingsCard />)
    fireEvent.click(thePress())
    fireEvent.click(await screen.findByRole('button', { name: GLOBAL_RELOAD_CONFIRM.confirmLabel }))
    expect((await screen.findByRole('status')).textContent).toBe(GLOBAL_RELOAD_NOT_SENT)
    expect(force.forceEveryoneToReload).not.toHaveBeenCalled()
  })
})
