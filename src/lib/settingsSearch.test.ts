import { describe, expect, it } from 'vitest'
import { SETTINGS_SEARCH_INDEX, searchSettings, type SettingsSearchEntry } from './settingsSearch'

const ALL_TABS = [...new Set(SETTINGS_SEARCH_INDEX.map((e) => e.tabId))]

describe('searchSettings', () => {
  it('empty and whitespace queries return nothing', () => {
    expect(searchSettings('', ALL_TABS)).toEqual([])
    expect(searchSettings('   ', ALL_TABS)).toEqual([])
  })

  it('ranks label prefix over word-start over substring', () => {
    const index: SettingsSearchEntry[] = [
      { label: 'Compass', tabId: 't1' },
      { label: 'My passwords', tabId: 't1' },
      { label: 'Password', tabId: 't1' },
    ]
    const hits = searchSettings('pass', ['t1'], index)
    expect(hits.map((h) => h.entry.label)).toEqual(['Password', 'My passwords', 'Compass'])
    expect(hits[0]).toMatchObject({ matchStart: 0, matchLen: 4 })
  })

  it('keyword matches rank last and carry the matched keyword as a hint', () => {
    const hits = searchSettings('vacation', ALL_TABS)
    expect(hits[0]?.entry.label).toBe('Personal time off')
    expect(hits[0]?.matchStart).toBe(-1)
    expect(hits[0]?.matchedKeyword).toBe('vacation')
  })

  it('never returns entries from tabs the viewer cannot see', () => {
    const visibleToEstimator = ['settings-recent-push', 'settings-account', 'settings-dashboard', 'settings-catalogs', 'settings-guides', 'settings-release-notes']
    const hits = searchSettings('user management', visibleToEstimator)
    expect(hits).toEqual([])
    const devHits = searchSettings('user management', ALL_TABS)
    expect(devHits[0]?.entry.tabId).toBe('settings-people')
  })

  it('caps the result count', () => {
    expect(searchSettings('e', ALL_TABS).length).toBeLessThanOrEqual(8)
  })

  it('index integrity: labels unique, tab ids well-formed, keywords lowercase', () => {
    const labels = SETTINGS_SEARCH_INDEX.map((e) => e.label)
    expect(new Set(labels).size).toBe(labels.length)
    for (const e of SETTINGS_SEARCH_INDEX) {
      expect(e.tabId.startsWith('settings-')).toBe(true)
      for (const k of e.keywords ?? []) expect(k).toBe(k.toLowerCase())
    }
  })
})
