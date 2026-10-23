// @vitest-environment jsdom
/**
 * Render smoke for Messages' one-row header (punch list #151 PR 2): the bar pinned with the title, the kind picker
 * opening its menu and reading the pick, Show's two radios with their counts, the search glass, the strip inside the
 * bar, 7 days flipping; the phone's split (the controls apart from the strip); a dark render.
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

  it('renders under the dark theme as it does in light', () => {
    document.documentElement.dataset.theme = 'dark'
    bar()
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeTruthy()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
