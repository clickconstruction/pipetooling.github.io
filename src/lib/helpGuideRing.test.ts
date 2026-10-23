// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from './plainWords'
import { RING_IDLE_SUB, RING_IDLE_WORD, RING_STEPS, RING_STEP_SUB, ringAfter, ringState, stepHelpRing } from './helpGuideRing'
import { helpGuideMarkdownToSafeHtml } from './helpGuideHtml'

describe('ringState (v2.5747)', () => {
  it('starts empty, fills one segment a tap, and is done at seven', () => {
    expect(ringState(0)).toMatchObject({ at: 0, word: RING_IDLE_WORD, sub: RING_IDLE_SUB, nextLabel: 'Next step', done: false })
    expect(ringState(0).segments.every((s) => !s)).toBe(true)
    const three = ringState(3)
    expect(three.word).toBe('Reading the sheets')
    expect(three.segments).toEqual([true, true, true, false, false, false, false])
    expect(three.chips).toEqual(['on', 'on', 'now', '', '', '', ''])
    const seven = ringState(7)
    expect(seven).toMatchObject({ at: 7, word: 'Questions for you', nextLabel: 'Done', done: true })
    expect(seven.segments.every(Boolean)).toBe(true)
    expect(ringState(99).at).toBe(RING_STEPS)
    expect(ringState(-2).at).toBe(0)
    expect(ringState(Number.NaN).at).toBe(0)
  })

  it('moves one step a press, never past seven, and resets to the start', () => {
    expect(ringAfter(0, 'next')).toBe(1)
    expect(ringAfter(7, 'next')).toBe(7)
    expect(ringAfter(5, 'reset')).toBe(0)
  })

  it('speaks in plain words', () => {
    for (const s of Object.values(RING_STEP_SUB)) expect(plainWordsFailures(s), s).toEqual([])
    expect(plainWordsFailures(RING_IDLE_SUB)).toEqual([])
  })
})

describe('stepHelpRing on a drawn ring', () => {
  function drawn(): Element {
    const host = document.createElement('div')
    host.innerHTML = helpGuideMarkdownToSafeHtml('Before.\n\n:::ring\n:::\n\nAfter.')
    const ring = host.querySelector('.help-ring')
    expect(ring).not.toBeNull()
    return ring!
  }

  it('draws seven segments and seven chips, none lit', () => {
    const ring = drawn()
    expect(ring.querySelectorAll('.help-ring-seg')).toHaveLength(7)
    expect(ring.querySelectorAll('.help-ring-steps li')).toHaveLength(7)
    expect(ring.querySelectorAll('.help-ring-seg.on')).toHaveLength(0)
    expect(ring.querySelector('[data-ring-word]')?.textContent).toBe(RING_IDLE_WORD)
  })

  it('lights the segments and the chips press by press, and Start over clears them', () => {
    const ring = drawn()
    expect(stepHelpRing(ring, 'next')).toBe(1)
    expect(stepHelpRing(ring, 'next')).toBe(2)
    expect(stepHelpRing(ring, 'next')).toBe(3)
    expect(ring.getAttribute('data-at')).toBe('3')
    expect(ring.querySelectorAll('.help-ring-seg.on')).toHaveLength(3)
    expect(ring.querySelector('.help-ring-steps li.now')?.textContent).toBe('Reading the sheets')
    expect(ring.querySelector('[data-ring-word]')?.textContent).toBe('Reading the sheets')
    for (let i = 0; i < 10; i += 1) stepHelpRing(ring, 'next')
    expect(ring.getAttribute('data-at')).toBe('7')
    const next = ring.querySelector<HTMLButtonElement>('button[data-help-ring="next"]')!
    expect(next.disabled).toBe(true)
    expect(next.textContent).toBe('Done')
    expect(stepHelpRing(ring, 'reset')).toBe(0)
    expect(ring.querySelectorAll('.help-ring-seg.on')).toHaveLength(0)
    expect(next.disabled).toBe(false)
    expect(next.textContent).toBe('Next step')
  })
})
