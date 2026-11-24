import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from './plainWords'
import { UPDATE_PILL_CONFIRM, UPDATE_PILL_PRESS, UPDATE_PILL_READY_WORDS, UPDATE_PILL_TYPED_WORDS, updatePillPress, updatePillView } from './updatePillWarn'

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
