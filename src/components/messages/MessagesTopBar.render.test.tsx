// @vitest-environment jsdom
/**
 * Render smoke for Messages' one-row header (punch list #151 PR 2): the bar pinned with the title, the kind picker
 * opening its menu and reading the pick, Show's two radios with their counts, the search glass, the strip inside the
 * bar, 7 days flipping; the phone's split (the controls apart from the strip); a dark render. Since punch list #230
 * PR 3 the two tabs after the title, drawn while the switch is on, and My email's bar with Follow up's controls out.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { installDomShims } from '../../test/renderSmokeMocks'
import type { JumpCounts } from '../../lib/messages/jumpStrip'
import { MessagesTopBar, type MessagesTopBarProps } from './MessagesTopBar'

beforeAll(installDomShims)

const counts: JumpCounts = { new: 3, needsYou: 0, needsReply: 0, weOwe: 1, waiting: 3, wentOut: 9 }

function bar(more: Partial<MessagesTopBarProps> = {}) {
  const presses = { onPick: vi.fn(), onLens: vi.fn(), onSearch: vi.fn(), onWeek: vi.fn(), onJump: vi.fn() }
  render(
    <MessagesTopBar
      pill="all"
      lens="everyone"
      lensCount={{ mine: 1, everyone: 4 }}
      searchOpen={false}
      weekOpen={false}
      strip={{ counts, onJump: presses.onJump }}
      phone={false}
      {...presses}
      {...more}
    />,
  )
  return presses
}

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.theme
})

describe('MessagesTopBar', () => {
  it('is one pinned bar on a desktop: the title, the picker, Show, the glass, the strip and 7 days', () => {
    const presses = bar()
    const pinned = document.querySelector('[data-messages-pinned]')!
    expect(pinned.className).toBe('messagesTopBar')
    expect(within(pinned as HTMLElement).getByRole('heading', { name: 'Messages' })).toBeTruthy()
    expect(within(pinned as HTMLElement).getAllByTestId('jump-lane').length).toBe(5)
    expect(screen.getByTestId('kind-picker').textContent).toBe('All kinds ▾')
    expect(screen.getByRole('button', { name: 'All kinds' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open the search' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: '7 days' }).getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Open the search' }))
    expect(presses.onSearch).toHaveBeenCalledWith(true)
    fireEvent.click(screen.getByRole('button', { name: '7 days' }))
    expect(presses.onWeek).toHaveBeenCalledWith(true)
    fireEvent.click(within(pinned as HTMLElement).getByLabelText('Jump to Went out, 9 sends'))
    expect(presses.onJump).toHaveBeenCalledWith('wentOut')
  })

  it('opens the eight kinds from the picker, names the pick on the button, and closes on a pick or Escape', () => {
    const presses = bar()
    expect(screen.queryByRole('group', { name: 'Which people to show' })).toBeNull()
    fireEvent.click(screen.getByTestId('kind-picker'))
    const menu = within(screen.getByRole('group', { name: 'Which people to show' }))
    expect(menu.getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Customers', 'Trade partners', 'Architects', 'Leads', 'Subs', 'Our team', 'Supply houses and candidates'])
    expect(menu.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(menu.getByRole('button', { name: 'Customers' }))
    expect(presses.onPick).toHaveBeenCalledWith('customer')
    expect(screen.queryByRole('group', { name: 'Which people to show' })).toBeNull()
    cleanup()
    bar({ pill: 'customer' })
    expect(screen.getByRole('button', { name: 'Customers' })).toBeTruthy()
    fireEvent.click(screen.getByTestId('kind-picker'))
    expect(screen.getByRole('group', { name: 'Which people to show' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'Which people to show' })).toBeNull()
  })

  it('shows Mine and Everyone with their counts as two radios, and reads the glass and 7 days as open', () => {
    const presses = bar({ lens: 'mine', searchOpen: true, weekOpen: true })
    const show = within(screen.getByRole('radiogroup', { name: 'Show' }))
    expect(show.getByRole('radio', { name: 'Mine · 1' }).getAttribute('aria-checked')).toBe('true')
    expect(show.getByRole('radio', { name: 'Everyone · 4' }).getAttribute('aria-checked')).toBe('false')
    fireEvent.click(show.getByRole('radio', { name: 'Everyone · 4' }))
    expect(presses.onLens).toHaveBeenCalledWith('everyone')
    expect(screen.getByRole('button', { name: 'Close the search' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '7 days' }).textContent).toBe('7 days ▴')
    fireEvent.click(screen.getByRole('button', { name: 'Close the search' }))
    expect(presses.onSearch).toHaveBeenCalledWith(false)
  })

  it('leaves the strip out while the lanes are not drawn', () => {
    bar({ strip: undefined })
    expect(screen.queryByTestId('jump-lane')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeTruthy()
  })

  it('on a phone the controls scroll away and the strip sticks on its own', () => {
    bar({ phone: true })
    expect(document.querySelector('[data-messages-pinned]')).toBeNull()
    const controls = document.querySelector('[data-messages-top-bar]')!
    expect(controls.className).toBe('messagesTopBar isControls')
    expect(within(controls as HTMLElement).queryByTestId('jump-lane')).toBeNull()
    expect(screen.getAllByTestId('jump-lane').length).toBe(5)
  })

  it('draws the ? at the bar’s end when the page has a card for it, and none otherwise (v2.5802)', () => {
    const onToggle = vi.fn()
    bar({ legend: { open: false, onToggle } })
    const help = screen.getByRole('button', { name: 'What each lane holds' })
    expect(help.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(help)
    expect(onToggle).toHaveBeenCalledWith(true)
    cleanup()
    bar()
    expect(screen.queryByRole('button', { name: 'What each lane holds' })).toBeNull()
  })

  it('draws Follow up · My email after the title while the person’s switch is on, the open tab filled (punch list #230 PR 3)', () => {
    const onTab = vi.fn()
    bar({ tabs: { tab: 'followUp', onTab, myMailOn: true } })
    const tabs = within(screen.getByRole('tablist', { name: 'Follow up or your own mail' }))
    expect(tabs.getAllByRole('tab').map((t) => `${t.textContent}:${t.getAttribute('aria-selected')}`)).toEqual(['Follow up:true', 'My email:false'])
    expect(screen.getByRole('heading', { name: 'Messages' }).nextElementSibling?.getAttribute('role')).toBe('tablist')
    fireEvent.click(tabs.getByRole('tab', { name: 'Follow up' }))
    expect(onTab).not.toHaveBeenCalled()
    fireEvent.click(tabs.getByRole('tab', { name: 'My email' }))
    expect(onTab).toHaveBeenCalledWith('myMail')
    expect(screen.getByTestId('kind-picker')).toBeTruthy()
    expect(screen.getAllByTestId('jump-lane').length).toBe(5)
  })

  it('draws no tabs while the switch is off, the bar as it was', () => {
    bar({ tabs: { tab: 'followUp', onTab: vi.fn(), myMailOn: false } })
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByTestId('kind-picker')).toBeTruthy()
  })

  it('on My email keeps the title, the tabs and the ?, and leaves Follow up’s controls out', () => {
    const onTab = vi.fn()
    bar({ tabs: { tab: 'myMail', onTab, myMailOn: true }, legend: { open: false, onToggle: vi.fn() } })
    const pinned = document.querySelector('[data-messages-pinned]') as HTMLElement
    expect(within(pinned).getByRole('heading', { name: 'Messages' })).toBeTruthy()
    expect(within(pinned).getByRole('tab', { name: 'My email' }).getAttribute('aria-selected')).toBe('true')
    expect(within(pinned).getByRole('button', { name: 'What each lane holds' })).toBeTruthy()
    for (const id of ['kind-picker', 'search-glass', 'week-fold', 'jump-lane']) expect(screen.queryByTestId(id)).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Show' })).toBeNull()
    fireEvent.click(within(pinned).getByRole('tab', { name: 'Follow up' }))
    expect(onTab).toHaveBeenCalledWith('followUp')
  })

  it('on a phone the tabs sit in the controls row, and My email draws no strip under it', () => {
    bar({ phone: true, tabs: { tab: 'followUp', onTab: vi.fn(), myMailOn: true } })
    const controls = document.querySelector('[data-messages-top-bar]') as HTMLElement
    expect(within(controls).getByRole('tablist')).toBeTruthy()
    cleanup()
    bar({ phone: true, tabs: { tab: 'myMail', onTab: vi.fn(), myMailOn: true } })
    expect(document.querySelector('[data-messages-top-bar]')?.className).toBe('messagesTopBar isControls')
    expect(screen.queryByTestId('jump-lane')).toBeNull()
    expect(screen.getByRole('tab', { name: 'My email' })).toBeTruthy()
  })

  it('renders under the dark theme as it does in light', () => {
    document.documentElement.dataset.theme = 'dark'
    bar()
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeTruthy()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
