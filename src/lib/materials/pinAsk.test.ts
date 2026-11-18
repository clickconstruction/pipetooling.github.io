import { describe, expect, it } from 'vitest'
import type { Container } from './onSite'
import { PIN_ASK_AFTER_DAYS, PIN_ASK_KEY, boxWantsPin, noteScannedBox, pinAskWords, pinAskedToday, rememberPinAsk, takePinAsk, takeScannedBox } from './pinAsk'

const NOW = new Date('2026-11-17T18:00:00Z')
const TODAY = '2026-11-17'
const box = (over: Partial<Container> = {}): Container => ({ id: 'a7', jobId: 'j1', label: 'A7', kind: 'cage', where: '', locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-10-20T15:00:00Z', ...over })
const mem = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}

describe('boxWantsPin', () => {
  it('a live box with no pin wants one', () => {
    expect(boxWantsPin(box(), NOW)).toBe(true)
    expect(boxWantsPin(box({ kind: 'loose' }), NOW)).toBe(true)
  })
  it('Unsorted and a retired box never do', () => {
    expect(boxWantsPin(box({ kind: 'unsorted' }), NOW)).toBe(false)
    expect(boxWantsPin(box({ retiredAt: '2026-11-01T00:00:00Z' }), NOW)).toBe(false)
  })
  it('a pin inside a week is left alone, and an older one is asked for again', () => {
    expect(PIN_ASK_AFTER_DAYS).toBe(7)
    expect(boxWantsPin(box({ lat: 29.5, lng: -98.4, pinnedAt: '2026-11-10T15:00:00Z' }), NOW)).toBe(false)
    expect(boxWantsPin(box({ lat: 29.5, lng: -98.4, pinnedAt: '2026-11-09T15:00:00Z' }), NOW)).toBe(true)
  })
  it('a pin from before its day was kept is asked for once more', () => {
    expect(boxWantsPin(box({ lat: 29.5, lng: -98.4, pinnedAt: null }), NOW)).toBe(true)
  })
})

describe('the day’s memory', () => {
  it('asks once a day for one box, whatever became of the ask', () => {
    const s = mem()
    expect(takePinAsk(box(), NOW, TODAY, s)).toBe(true)
    expect(takePinAsk(box(), NOW, TODAY, s)).toBe(false)
    expect(takePinAsk(box({ id: 'a8' }), NOW, TODAY, s)).toBe(true)
    expect(pinAskedToday('a7', TODAY, s)).toBe(true)
    // The next day the memory is empty again.
    expect(pinAskedToday('a7', '2026-11-18', s)).toBe(false)
    expect(takePinAsk(box(), new Date('2026-11-18T18:00:00Z'), '2026-11-18', s)).toBe(true)
    expect(JSON.parse(s.m.get(PIN_ASK_KEY)!)).toEqual({ day: '2026-11-18', ids: ['a7'] })
  })
  it('a box that wants no pin does not spend the day’s ask', () => {
    const s = mem()
    expect(takePinAsk(box({ lat: 29.5, lng: -98.4, pinnedAt: '2026-11-16T15:00:00Z' }), NOW, TODAY, s)).toBe(false)
    expect(pinAskedToday('a7', TODAY, s)).toBe(false)
  })
  it('a memory that does not parse, or a device with none, asks', () => {
    const s = mem()
    s.setItem(PIN_ASK_KEY, 'not json')
    expect(pinAskedToday('a7', TODAY, s)).toBe(false)
    expect(takePinAsk(box(), NOW, TODAY, null)).toBe(true)
    rememberPinAsk('a7', TODAY, null)
  })
})

describe('a scanned box', () => {
  it('is read once', () => {
    const s = mem()
    expect(takeScannedBox(s)).toBeNull()
    noteScannedBox('a7', s)
    expect(takeScannedBox(s)).toBe('a7')
    expect(takeScannedBox(s)).toBeNull()
  })
})

describe('pinAskWords', () => {
  it('names the box', () => {
    expect(pinAskWords('A7')).toBe('Pin A7 where you stand?')
  })
})
