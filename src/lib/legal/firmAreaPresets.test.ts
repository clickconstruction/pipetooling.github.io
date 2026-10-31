import { describe, expect, it } from 'vitest'
import { AREA_PRESETS, andList, applyArea, areaChipWords, areaWords, extendChangeWords, gapChipWords } from './firmAreaPresets'
import { countyChanges } from './firmCounties'

const names: Record<string, string> = { snell: 'Snell', alamo: 'Alamo Collections Law' }
const nameOf = (id: string) => names[id] ?? 'another firm'

describe('firmAreaPresets', () => {
  it('names two metros in the map file’s spelling', () => {
    expect(AREA_PRESETS.map((p) => p.key)).toEqual(['austin', 'san_antonio'])
    expect(AREA_PRESETS[0]!.counties).toEqual(['Bastrop', 'Caldwell', 'Hays', 'Travis', 'Williamson'])
    expect(AREA_PRESETS[1]!.counties).toContain('Bexar')
    expect(areaChipWords(AREA_PRESETS[0]!)).toBe('Austin area · 5')
  })

  it('an area colors the free counties, keeps the firm’s own and leaves another firm’s alone', () => {
    const draft = new Map([['Travis', 'snell'], ['Hays', 'alamo']])
    const a = applyArea(draft, AREA_PRESETS[0]!.counties, 'snell')
    expect(a.colored).toEqual(['Bastrop', 'Caldwell', 'Williamson'])
    expect(a.kept).toEqual(['Travis'])
    expect(a.held).toEqual([{ county: 'Hays', byFirmId: 'alamo' }])
    expect([...a.next.entries()].sort()).toEqual([['Bastrop', 'snell'], ['Caldwell', 'snell'], ['Hays', 'alamo'], ['Travis', 'snell'], ['Williamson', 'snell']])
    // The draft it was given is untouched.
    expect(draft.size).toBe(2)
  })

  it('the toast says what was added, what was already the firm’s and what another firm holds', () => {
    expect(areaWords('Austin area', { colored: ['Bastrop', 'Caldwell', 'Williamson'], kept: ['Travis'], held: [{ county: 'Hays', byFirmId: 'alamo' }] }, 'Snell', nameOf)).toBe(
      'Austin area: 3 counties added for Snell once you save. Travis was already Snell’s. Hays is Alamo Collections Law’s. Press it on the map to move it.',
    )
    expect(areaWords('Austin area', { colored: [], kept: ['Bastrop', 'Travis'], held: [] }, 'Snell', nameOf)).toBe('Austin area: nothing new to add for Snell. Bastrop and Travis were already Snell’s.')
    expect(areaWords('Austin area', { colored: ['Bastrop'], kept: [], held: [] }, 'Snell', nameOf)).toBe('Austin area: 1 county added for Snell once you save.')
  })

  it('lists names the way a sentence does', () => {
    expect(andList([])).toBe('')
    expect(andList(['Bell'])).toBe('Bell')
    expect(andList(['Bell', 'Hays'])).toBe('Bell and Hays')
    expect(andList(['Bell', 'Hays', 'Travis'])).toBe('Bell, Hays and Travis')
  })

  it('the gap chip counts the counties with a case and no firm, and hides at none', () => {
    expect(gapChipWords([])).toBeNull()
    expect(gapChipWords(['Gonzales'])).toBe('Counties with a case and no firm · 1')
  })

  it('what a save will change, from the firm’s side', () => {
    const saved = new Map([['Bell', 'snell'], ['Comal', 'alamo'], ['Travis', 'snell']])
    const draft = new Map([['Bastrop', 'snell'], ['Comal', 'snell'], ['Hays', 'snell'], ['Travis', 'snell']])
    expect(extendChangeWords(countyChanges(saved, draft), 'snell', nameOf)).toEqual([
      'Adds Bastrop County and Hays County.',
      'Takes off Bell County.',
      'Moves Comal County from Alamo Collections Law.',
    ])
    expect(extendChangeWords([], 'snell', nameOf)).toEqual([])
  })
})
