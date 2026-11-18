// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LAND_ON_FADE_MS, LAND_ON_HOLD_MS, landOn, landOnWhenThere } from './landOn'

describe('landing on a place', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
  })
  afterEach(() => vi.useRealTimers())

  it('scrolls to the place, lights it, puts the cursor in its control, and lets the light go after the hold and the fade', () => {
    document.body.innerHTML = '<div id="row"><input type="text" /><button>Add the receipt</button></div>'
    const row = document.getElementById('row')!
    const scroll = vi.fn()
    row.scrollIntoView = scroll
    landOn(row, { focus: 'button', reducedMotion: false })
    expect(scroll).toHaveBeenCalledWith({ block: 'center', inline: 'nearest', behavior: 'smooth' })
    expect(row.getAttribute('data-landed')).toBe('yes')
    expect(document.activeElement?.tagName).toBe('BUTTON')
    vi.advanceTimersByTime(LAND_ON_HOLD_MS + LAND_ON_FADE_MS - 1)
    expect(row.getAttribute('data-landed')).toBe('yes')
    vi.advanceTimersByTime(1)
    expect(row.hasAttribute('data-landed')).toBe(false)
  })

  it('under reduced motion jumps with no glide and holds a steady light for the hold alone', () => {
    document.body.innerHTML = '<div id="row"></div>'
    const row = document.getElementById('row')!
    const scroll = vi.fn()
    row.scrollIntoView = scroll
    landOn(row, { reducedMotion: true })
    expect(scroll).toHaveBeenCalledWith({ block: 'center', inline: 'nearest', behavior: 'auto' })
    vi.advanceTimersByTime(LAND_ON_HOLD_MS)
    expect(row.hasAttribute('data-landed')).toBe(false)
  })

  it('waits for a place that is not drawn yet, and gives up quietly', () => {
    const find = () => document.getElementById('late')
    landOnWhenThere(find, { reducedMotion: true })
    vi.advanceTimersByTime(300)
    document.body.innerHTML = '<div id="late"></div>'
    vi.advanceTimersByTime(100)
    expect(document.getElementById('late')!.getAttribute('data-landed')).toBe('yes')
    // A place that never comes: the look stops after its tries.
    const never = vi.fn(() => null)
    landOnWhenThere(never, { tries: 3 })
    vi.advanceTimersByTime(5000)
    expect(never).toHaveBeenCalledTimes(4)
  })

  it('takes the light off early when undone', () => {
    document.body.innerHTML = '<div id="row"></div>'
    const row = document.getElementById('row')!
    const undo = landOn(row, { reducedMotion: true })
    undo()
    expect(row.hasAttribute('data-landed')).toBe(false)
  })
})
