import { describe, expect, it } from 'vitest'
import { SETTINGS_SEARCH_INDEX, searchSettings, type SettingsSearchEntry, settingsSearchGuideQuery, settingsSearchIndexFor, settingsSearchTrail } from './settingsSearch'
import { getZonedSettingsGroups } from './settingsGroups'
import { ROLES } from './userRoles'

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

describe('a card drawn for fewer roles than its tab (v2.7139, punch list #313)', () => {
  const find = (role: (typeof ROLES)[number], query: string) =>
    searchSettings(query, getZonedSettingsGroups(role).map((g) => g.id), settingsSearchIndexFor(role)).map((h) => h.entry)

  it('Card and footer looks: the owner and a dev find it on People & teams, the rest of the office does not', () => {
    for (const role of ['master_technician', 'dev'] as const) {
      expect(find(role, 'card and footer looks')[0]).toMatchObject({ label: 'Card and footer looks', tabId: 'settings-people', anchorId: 'settings-card-looks' })
      expect(find(role, 'card sizes').some((e) => e.anchorId === 'settings-card-looks')).toBe(true)
    }
    for (const role of ROLES.filter((r) => r !== 'master_technician' && r !== 'dev')) {
      expect(find(role, 'card and footer looks').some((e) => e.anchorId === 'settings-card-looks'), role).toBe(false)
      expect(find(role, 'looks').some((e) => e.anchorId === 'settings-card-looks'), role).toBe(false)
    }
  })

  it('Your card and footer: every role but a subcontractor finds it on Your account', () => {
    for (const role of ROLES) {
      const found = find(role, 'business card').some((e) => e.tabId === 'settings-account' && e.anchorId === 'settings-card-and-footer')
      expect(found, role).toBe(role !== 'subcontractor')
    }
    expect(find('assistant', 'your card')[0]?.label).toBe('Your card and footer')
  })

  it('settingsSearchIndexFor keeps every entry with no seenBy, and drops a gated one for no role', () => {
    const open = SETTINGS_SEARCH_INDEX.filter((e) => !e.seenBy)
    expect(settingsSearchIndexFor(null)).toEqual(open)
    expect(settingsSearchIndexFor('dev')).toHaveLength(SETTINGS_SEARCH_INDEX.length)
    const index: SettingsSearchEntry[] = [
      { label: 'Open', tabId: 't1' },
      { label: 'Gated', tabId: 't1', seenBy: (r) => r === 'controller' },
    ]
    expect(settingsSearchIndexFor('controller', index).map((e) => e.label)).toEqual(['Open', 'Gated'])
    expect(settingsSearchIndexFor('assistant', index).map((e) => e.label)).toEqual(['Open'])
  })
})

describe('the finder finds itself (v2.2902, J28-F4)', () => {
  it('"search" ranks the global-search guide entry first for a viewer who can see Guides', () => {
    const hits = searchSettings('search', ['settings-guides', 'settings-account'])
    expect(hits[0]?.entry.label).toBe('Search for jobs, bids, customers, and estimates')
    expect(hits[0]?.entry.guideSlug).toBe('global-search')
    expect(hits[0]?.matchStart).toBe(0)
  })

  it('every guideSlug entry lives on the Guides tab', () => {
    for (const e of SETTINGS_SEARCH_INDEX) {
      if (e.guideSlug) expect(e.tabId).toBe('settings-guides')
    }
  })

  it('settingsSearchGuideQuery sets ?tab= and the guide param, keeps other params, and is null for plain entries', () => {
    const entry = SETTINGS_SEARCH_INDEX.find((e) => e.guideSlug === 'global-search')!
    const q = settingsSearchGuideQuery('?tab=settings-account&x=1', entry)
    expect(q).not.toBeNull()
    const params = new URLSearchParams(q!)
    expect(params.get('tab')).toBe('settings-guides')
    expect(params.get('g')).toBe('global-search')
    expect(params.get('x')).toBe('1')
    expect(settingsSearchGuideQuery('', { label: 'Plain', tabId: 'settings-account' })).toBeNull()
  })
})

describe('settingsSearchTrail — where the pick lands, never the title twice (v2.6512)', () => {
  it('a card inside a tab reads "in <tab>"', () => {
    expect(settingsSearchTrail({ label: 'Merge users', tabId: 'settings-people' }, 'People & teams')).toBe('in People & teams')
    expect(settingsSearchTrail({ label: 'Page pins', tabId: 'settings-dashboard', anchorId: 'settings-page-pins' }, 'Your dashboard')).toBe('in Your dashboard')
  })

  it('a door that is the whole tab reads "a tab"', () => {
    expect(settingsSearchTrail({ label: 'How fast a change ships', tabId: 'settings-ship-pace' }, 'How fast a change ships')).toBe('a tab')
    expect(settingsSearchTrail({ label: 'Training', tabId: 'settings-training' }, 'Training')).toBe('a tab')
  })

  it('a guide or an anchor named like its tab still says where it is', () => {
    expect(settingsSearchTrail({ label: 'Guides', tabId: 'settings-guides', guideSlug: 'global-search' }, 'Guides')).toBe('in Guides')
  })

  it('falls back to the tab id when the viewer has no label for it', () => {
    expect(settingsSearchTrail({ label: 'Claim code', tabId: 'settings-advanced-tools' }, undefined)).toBe('in settings-advanced-tools')
  })
})
