import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from './plainWords'
import {
  UPDATE_PILL_CONFIRM,
  UPDATE_PILL_DOUBLE_PRESS_MS,
  UPDATE_PILL_PRESS,
  UPDATE_PILL_READY_WORDS,
  UPDATE_PILL_TYPED_WORDS,
  UPDATE_PILL_WARNED_PRESS_MIN_HEIGHT,
  UPDATE_PILL_BAND_PX,
  updatePillIgnoresPress,
  updatePillPress,
  updatePillSide,
  updatePillView,
} from './updatePillWarn'

describe('updatePillPress: what a press on the pill does', () => {
  it('with nothing typed, Reload reloads, as it always did', () => {
    expect(updatePillPress('ready', false)).toBe('reload')
  })
  it('with words typed, Reload reloads nothing: it shows what was typed', () => {
    expect(updatePillPress('ready', true)).toBe('show')
  })
  it('while the page is being shown the press is dead, so a double press on Reload is not the confirm', () => {
    expect(updatePillPress('showing', true)).toBe('nothing')
    expect(updatePillPress('showing', false)).toBe('nothing')
  })
  it('once it was shown, Reload anyway reloads: the person saw what goes and said yes', () => {
    expect(updatePillPress('shown', true)).toBe('reload')
    // The words were sent in the meantime: there is nothing left to lose.
    expect(updatePillPress('shown', false)).toBe('reload')
  })
})

describe('updatePillView: what the pill says', () => {
  it('ready is the pill as it was', () => {
    expect(updatePillView('ready')).toEqual({ words: UPDATE_PILL_READY_WORDS, press: UPDATE_PILL_PRESS, pressDead: false, warned: false })
  })
  it('over typed words it warns, and the press names what it does', () => {
    expect(updatePillView('showing')).toEqual({ words: UPDATE_PILL_TYPED_WORDS, press: UPDATE_PILL_CONFIRM, pressDead: true, warned: true })
    expect(updatePillView('shown')).toEqual({ words: UPDATE_PILL_TYPED_WORDS, press: UPDATE_PILL_CONFIRM, pressDead: false, warned: true })
  })
  it('the press never says OK, and the warning is plain words', () => {
    expect(UPDATE_PILL_CONFIRM).toBe('Reload anyway')
    expect(plainWordsFailures(UPDATE_PILL_TYPED_WORDS)).toEqual([])
    expect(plainWordsFailures(UPDATE_PILL_READY_WORDS)).toEqual([])
    // It says what is lost, in the person's own terms.
    expect(UPDATE_PILL_TYPED_WORDS).toMatch(/what you typed/)
  })
})

describe('updatePillIgnoresPress: a double press on Reload', () => {
  it('a press right behind the warning is the double press’s second half, and is ignored', () => {
    // Seen in the built app at a phone’s width: the warned pill is laid out afresh, and the second press landed on Not now.
    expect(updatePillIgnoresPress('showing', 120)).toBe(true)
    expect(updatePillIgnoresPress('showing', UPDATE_PILL_DOUBLE_PRESS_MS - 1)).toBe(true)
  })
  it('a press after that is a choice', () => {
    expect(updatePillIgnoresPress('showing', UPDATE_PILL_DOUBLE_PRESS_MS)).toBe(false)
    expect(updatePillIgnoresPress('shown', 5_000)).toBe(false)
  })
  it('the pill as it always was ignores nothing', () => {
    expect(updatePillIgnoresPress('ready', 0)).toBe(false)
    expect(updatePillIgnoresPress('ready', null)).toBe(false)
    expect(updatePillIgnoresPress('showing', null)).toBe(false)
  })
  it('the warned pill’s presses are a thumb tall', () => {
    expect(UPDATE_PILL_WARNED_PRESS_MIN_HEIGHT).toBeGreaterThanOrEqual(44)
  })
})

describe('updatePillSide: the pill never sits on the words it warns about', () => {
  const screen = 844
  it('a place in the middle of the screen leaves the pill at the foot', () => {
    expect(updatePillSide([{ top: 380, bottom: 440 }], screen)).toBe('bottom')
  })
  it('a message box at the foot of the page sends the pill to the top', () => {
    // Seen in the built app: the last box on a page cannot be brought to the middle, and the pill sat on it.
    expect(updatePillSide([{ top: 760, bottom: 824 }], screen)).toBe('top')
    expect(updatePillSide([{ top: 300, bottom: 360 }, { top: screen - UPDATE_PILL_BAND_PX + 1 - 60, bottom: screen - UPDATE_PILL_BAND_PX + 1 }], screen)).toBe('top')
  })
  it('a place just clear of the band leaves it at the foot', () => {
    expect(updatePillSide([{ top: 600, bottom: screen - UPDATE_PILL_BAND_PX }], screen)).toBe('bottom')
  })
  it('a place off the screen does not count', () => {
    expect(updatePillSide([{ top: 3000, bottom: 3060 }], screen)).toBe('bottom')
    expect(updatePillSide([{ top: -500, bottom: -440 }], screen)).toBe('bottom')
    expect(updatePillSide([], screen)).toBe('bottom')
  })
  it('places at the top and the foot at once: the pill stays at the foot, where it is known', () => {
    expect(updatePillSide([{ top: 20, bottom: 80 }, { top: 770, bottom: 830 }], screen)).toBe('bottom')
    // One box taller than the screen.
    expect(updatePillSide([{ top: -40, bottom: 900 }], screen)).toBe('bottom')
  })
})
