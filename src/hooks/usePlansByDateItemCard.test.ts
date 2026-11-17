import { describe, expect, it } from 'vitest'
import { placeItemCard } from './usePlansByDateItemCard'

const win = { width: 1280, height: 900 }
const box = { width: 320, height: 300 }

describe('placeItemCard', () => {
  it('stands above its item, centred on it, when there is room', () => {
    expect(placeItemCard({ left: 600, top: 500, right: 624, bottom: 524 }, box, win)).toEqual({ left: 452, top: 192 })
  })
  it('drops below an item near the top of the window', () => {
    expect(placeItemCard({ left: 600, top: 100, right: 624, bottom: 124 }, box, win).top).toBe(132)
  })
  it('stays inside the window at either side', () => {
    expect(placeItemCard({ left: 4, top: 500, right: 28, bottom: 524 }, box, win).left).toBe(8)
    expect(placeItemCard({ left: 1260, top: 500, right: 1280, bottom: 524 }, box, win).left).toBe(1280 - 8 - 320)
  })
  it('pins to the bottom margin when it fits neither above nor below', () => {
    expect(placeItemCard({ left: 600, top: 200, right: 624, bottom: 700 }, { width: 320, height: 400 }, win).top).toBe(900 - 8 - 400)
  })
  it('stands at the right end of a line of the list, so the line’s words stay in view', () => {
    expect(placeItemCard({ left: 40, top: 500, right: 1200, bottom: 524 }, box, win, 'end').left).toBe(880)
  })
})
