import { describe, expect, it } from 'vitest'
import { getZonedSettingsGroups } from './settingsGroups'
import { SETTINGS_RECENT_TABS_KEY, hiddenTabsCount, hiddenTabsNote, landingTab, pushRecentTab, readRecentTabs, recentChips, rememberTab } from './settingsRail'

function fakeStorage(seed: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> & { data: Record<string, string> } {
  const data = { ...seed }
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }
}

describe('settingsRail — the rail, recent tabs and the honest role note (v2.3539)', () => {
  const dev = getZonedSettingsGroups('dev')
  const assistant = getZonedSettingsGroups('assistant')

  it('recent tabs: newest first, no duplicates, capped at three, only ids the role can see', () => {
    expect(pushRecentTab([], 'a')).toEqual(['a'])
    expect(pushRecentTab(['a', 'b'], 'b')).toEqual(['b', 'a'])
    expect(pushRecentTab(['a', 'b', 'c'], 'd')).toEqual(['d', 'a', 'b'])
    const s = fakeStorage({ [SETTINGS_RECENT_TABS_KEY]: JSON.stringify(['settings-usage', 'settings-account', 'nope']) })
    expect(readRecentTabs(s, dev)).toEqual(['settings-usage', 'settings-account'])
    expect(readRecentTabs(s, assistant)).toEqual(['settings-account']) // Usage is dev-only
    expect(readRecentTabs(fakeStorage({ [SETTINGS_RECENT_TABS_KEY]: '{bad' }), dev)).toEqual([])
    expect(readRecentTabs(null, dev)).toEqual([])
  })

  it('remembering a tab writes the list and returns it; storage failures are swallowed', () => {
    const s = fakeStorage()
    expect(rememberTab(s, [], 'settings-company')).toEqual(['settings-company'])
    expect(JSON.parse(s.data[SETTINGS_RECENT_TABS_KEY]!)).toEqual(['settings-company'])
    const broken = { getItem: () => null, setItem: () => { throw new Error('quota') } }
    expect(rememberTab(broken, ['x'], 'y')).toEqual(['y', 'x'])
  })

  it('landing: the last tab opened here when the role can see it, else the first tab', () => {
    expect(landingTab(dev, [])).toBe('settings-account')
    expect(landingTab(dev, ['settings-what-customers-see'])).toBe('settings-what-customers-see')
    expect(landingTab(assistant, ['settings-usage'])).toBe('settings-account')
    expect(landingTab([], ['x'])).toBeNull()
  })

  it('the role note counts the tabs a dev has that this role does not, and says so plainly', () => {
    expect(hiddenTabsCount('dev')).toBe(0)
    expect(hiddenTabsNote(hiddenTabsCount('dev'))).toBeNull()
    const n = hiddenTabsCount('assistant')
    expect(n).toBeGreaterThan(0)
    expect(hiddenTabsNote(n)).toBe(`${n} more tabs are for masters and devs.`)
    expect(hiddenTabsNote(1)).toBe('1 more tab is for masters and devs.')
    expect(hiddenTabsCount(null)).toBe(0)
  })

  it('recent chips leave out the tab already open', () => {
    const chips = recentChips(['settings-account', 'settings-company'], 'settings-account', dev)
    expect(chips.map((c) => c.id)).toEqual(['settings-company'])
  })
})
