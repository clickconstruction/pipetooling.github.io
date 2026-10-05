import { describe, expect, it } from 'vitest'
import { STAGE_BAND_COLOR, stageBarItems, stageColorVar, stagesActiveSection } from './stagesStageBar'

const counts = { waiting: '18', working: '29', readyToBill: '0', billed: '76', collections: '0' }
const totals = { waiting: '257.3k', working: '391.8k', readyToBill: '0', billed: '348.8k', collections: '0' }

describe('stageBarItems', () => {
  it('keeps an empty section in place, greyed, and hides an empty Collections', () => {
    const items = stageBarItems(counts, totals)
    expect(items.map((i) => i.key)).toEqual(['waiting', 'working', 'readyToBill', 'billed'])
    expect(items.map((i) => i.empty)).toEqual([false, false, true, false])
    expect(items[3]).toEqual({ key: 'billed', label: 'Billed Awaiting Payment', noun: 'rows', count: '76', total: '348.8k', empty: false })
    expect(items[0]!.noun).toBe('jobs')
  })

  it('shows Collections once it has rows, and passes "…" through while the numbers load', () => {
    const items = stageBarItems({ ...counts, billed: '…', collections: '8' }, { ...totals, billed: '…', collections: '24.6k' })
    expect(items.map((i) => i.key)).toEqual(['waiting', 'working', 'readyToBill', 'billed', 'collections'])
    expect(items[3]!.count).toBe('…')
    expect(items[3]!.empty).toBe(false)
    expect(items[4]!.total).toBe('24.6k')
  })
})

describe('stagesActiveSection', () => {
  const tops = (waiting: number | null, working: number | null, billed: number | null) => [
    { key: 'waiting' as const, top: waiting },
    { key: 'working' as const, top: working },
    { key: 'billed' as const, top: billed },
  ]

  it('is null at the top of the page, before any header reaches the line', () => {
    expect(stagesActiveSection(tops(600, 900, 2400), 60)).toBeNull()
  })

  it('is the last header that has reached the line', () => {
    expect(stagesActiveSection(tops(-300, 40, 1500), 60)).toBe('working')
    expect(stagesActiveSection(tops(-2000, -1700, 60), 60)).toBe('billed')
    expect(stagesActiveSection(tops(-2000, -1700, 61), 60)).toBe('working')
  })

  it('skips a header that is not drawn', () => {
    expect(stagesActiveSection(tops(-300, null, 1500), 60)).toBe('waiting')
    expect(stagesActiveSection([], 60)).toBeNull()
  })
})

describe('stage colors', () => {
  it('reads the map pins’ colors, with Collections in red', () => {
    expect(STAGE_BAND_COLOR.waiting).toBe('#f59e0b')
    expect(STAGE_BAND_COLOR.working).toBe('#3b82f6')
    expect(STAGE_BAND_COLOR.collections).toBe('#dc2626')
    expect(stageColorVar('billed')).toEqual({ '--stage-color': '#f97316' })
  })
})
