// @vitest-environment jsdom
/**
 * Render smoke for the Settings finder's rows (v2.6512). Nothing loads — the hits are the kernel's — so no
 * supabase stub is needed. jsdom lays nothing out, so the line count a width gives a title is measured by
 * `e2e/settings-tabs.spec.ts` (*the finder's rows read at phone width*); this file holds the shape that makes
 * that true (a wrapping row, a title that grows with no fixed width, a trail that never shrinks, the keyword
 * last), the trail's words and the keyboard path.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import SettingsSearchBar from './SettingsSearchBar'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const GROUPS = [
  { id: 'settings-account', label: 'Your account' },
  { id: 'settings-people', label: 'People & teams' },
  { id: 'settings-guides', label: 'Guides' },
  { id: 'settings-ship-pace', label: 'How fast a change ships' },
]

function openWith(query: string) {
  const box = screen.getByRole('combobox', { name: 'Search settings' })
  fireEvent.focus(box)
  fireEvent.change(box, { target: { value: query } })
  return box
}

describe('SettingsSearchBar rows', () => {
  it('"merge" lists the card in its tab and the tab door with "a tab →", the keyword last', () => {
    renderWithProviders(<SettingsSearchBar groups={GROUPS} role="dev" onPick={() => {}} />)
    openWith('merge')
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.querySelector('[data-settings-search-title]')?.textContent)).toEqual(['Merge users', 'How fast a change ships'])
    expect(options[0]!.querySelector('[data-settings-search-trail]')?.textContent).toBe('in People & teams →')
    expect(options[0]!.querySelector('[data-settings-search-keyword]')).toBeNull()
    // The door that is the tab: the trail does not repeat the title.
    expect(options[1]!.querySelector('[data-settings-search-trail]')?.textContent).toBe('a tab →')
    const keyword = options[1]!.querySelector('[data-settings-search-keyword]')!
    expect(keyword.textContent).toBe('(merge)')
    expect(options[1]!.lastElementChild).toBe(keyword)
  })

  it('the row wraps, the title grows with no fixed width, and the trail never shrinks or breaks', () => {
    renderWithProviders(<SettingsSearchBar groups={GROUPS} role="dev" onPick={() => {}} />)
    openWith('merge')
    for (const row of screen.getAllByRole('option')) {
      const title = row.querySelector<HTMLElement>('[data-settings-search-title]')!
      const trail = row.querySelector<HTMLElement>('[data-settings-search-trail]')!
      expect(row.style.display).toBe('flex')
      expect(row.style.flexWrap).toBe('wrap')
      expect(title.style.width).toBe('')
      expect(title.style.flexGrow).toBe('1')
      expect(title.style.flexShrink).toBe('1')
      expect(title.style.flexBasis).toBe('auto')
      expect(title.style.minWidth).toBe('0')
      expect(trail.style.flexShrink).toBe('0')
      expect(trail.style.whiteSpace).toBe('nowrap')
      const keyword = row.querySelector<HTMLElement>('[data-settings-search-keyword]')
      if (keyword) expect(keyword.style.flexBasis).toBe('100%')
    }
  })

  it('a label hit bolds the match; a keyword hit shows the word that hit', () => {
    renderWithProviders(<SettingsSearchBar groups={GROUPS} role="dev" onPick={() => {}} />)
    openWith('merge')
    const [card, tab] = screen.getAllByRole('option')
    expect(card!.querySelector('[data-settings-search-title] b')?.textContent).toBe('Merge')
    expect(tab!.querySelector('[data-settings-search-title] b')).toBeNull()
  })

  it('↓ lights the next row, Enter picks it, and the box clears', () => {
    const onPick = vi.fn()
    renderWithProviders(<SettingsSearchBar groups={GROUPS} role="dev" onPick={onPick} />)
    const box = openWith('merge')
    const options = screen.getAllByRole('option')
    expect(options[0]!.getAttribute('aria-selected')).toBe('true')
    expect(box.getAttribute('aria-activedescendant')).toBe('settings-search-option-0')
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    const lit = screen.getAllByRole('option')
    expect(lit[1]!.getAttribute('aria-selected')).toBe('true')
    expect(lit[0]!.getAttribute('aria-selected')).toBe('false')
    expect(box.getAttribute('aria-activedescendant')).toBe('settings-search-option-1')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick.mock.calls[0]![0]).toMatchObject({ label: 'How fast a change ships', tabId: 'settings-ship-pace' })
    expect((box as HTMLInputElement).value).toBe('')
  })

  it('a card drawn for fewer roles than its tab is offered to those roles alone (v2.7139)', () => {
    const { unmount } = renderWithProviders(<SettingsSearchBar groups={GROUPS} role="master_technician" onPick={() => {}} />)
    openWith('card and footer')
    expect(screen.getAllByRole('option').map((o) => o.querySelector('[data-settings-search-title]')?.textContent)).toEqual(['Card and footer looks', 'Your card and footer'])
    unmount()
    // An assistant sees People & teams, where the owner's card is not drawn for her: her own card alone.
    renderWithProviders(<SettingsSearchBar groups={GROUPS} role="assistant" onPick={() => {}} />)
    openWith('card and footer')
    const rows = screen.getAllByRole('option')
    expect(rows.map((o) => o.querySelector('[data-settings-search-title]')?.textContent)).toEqual(['Your card and footer'])
    expect(rows[0]!.querySelector('[data-settings-search-trail]')?.textContent).toBe('in Your account →')
  })

  it('a press on a row picks it', () => {
    const onPick = vi.fn()
    renderWithProviders(<SettingsSearchBar groups={GROUPS} role="dev" onPick={onPick} />)
    openWith('merge')
    fireEvent.mouseDown(screen.getAllByRole('option')[0]!)
    expect(onPick.mock.calls[0]![0]).toMatchObject({ label: 'Merge users' })
  })
})
