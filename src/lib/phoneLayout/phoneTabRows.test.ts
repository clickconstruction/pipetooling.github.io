import { describe, expect, it } from 'vitest'
import {
  PHONE_PILL_FADE_SLACK_PX,
  PHONE_PILL_PEEK_PX,
  PHONE_PILL_PRESS_PX,
  PHONE_TAB_FADE_SLACK_PX,
  PHONE_TAB_PEEK_PX,
  phoneTabRows,
} from './phoneTabRows'
import { PHONE_BAR_PRESS_PX } from './phoneBar'
import { pageSubTabStyle, pageTabStyle } from '../pageTabStyle'

describe('phoneTabRows', () => {
  it('with the switch off the rows and the title are as they were, whatever the bar says', () => {
    expect(phoneTabRows({ phoneLayoutOn: false, barNamesPage: false })).toEqual({ oneLine: false, titleDrawn: true })
    // The bar names a page only with the switch on. Were it ever to say so with the switch off, the title still stays.
    expect(phoneTabRows({ phoneLayoutOn: false, barNamesPage: true })).toEqual({ oneLine: false, titleDrawn: true })
  })

  it('with the switch on the rows are one line each, and the title leaves while the bar names the page', () => {
    expect(phoneTabRows({ phoneLayoutOn: true, barNamesPage: true })).toEqual({ oneLine: true, titleDrawn: false })
  })

  it('keeps the title where the bar names no page: the role dock’s row', () => {
    expect(phoneTabRows({ phoneLayoutOn: true, barNamesPage: false })).toEqual({ oneLine: true, titleDrawn: true })
  })

  it('the title is never undrawn unless something else on the screen is saying it', () => {
    for (const phoneLayoutOn of [false, true]) {
      for (const barNamesPage of [false, true]) {
        const rows = phoneTabRows({ phoneLayoutOn, barNamesPage })
        if (!rows.titleDrawn) expect(barNamesPage).toBe(true)
      }
    }
  })
})

describe('the peek beside the open tab', () => {
  const px = (value: unknown): number => {
    const text = String(value)
    const first = text.split(' ').pop()!
    return first.endsWith('rem') ? parseFloat(first) * 16 : parseFloat(first)
  }

  it('reaches past a page tab’s padding, so the next tab shows letters and not a blank', () => {
    const padding = px(pageTabStyle(false).padding)
    expect(padding).toBe(24)
    expect(PHONE_TAB_PEEK_PX).toBeGreaterThanOrEqual(padding + 24)
  })

  it('reaches past a pill’s padding too', () => {
    const padding = px(pageSubTabStyle(false).padding)
    expect(padding).toBeCloseTo(12.8)
    expect(PHONE_PILL_PEEK_PX).toBeGreaterThanOrEqual(padding + 24)
  })

  it('an edge says nothing until it hides a letter: the slack is no more than the padding', () => {
    expect(PHONE_TAB_FADE_SLACK_PX).toBe(px(pageTabStyle(false).padding))
    expect(PHONE_PILL_FADE_SLACK_PX).toBeLessThanOrEqual(px(pageSubTabStyle(false).padding))
    expect(PHONE_PILL_FADE_SLACK_PX).toBeGreaterThan(0)
  })

  it('a pill’s press is as tall as a press of the top bar', () => {
    expect(PHONE_PILL_PRESS_PX).toBe(PHONE_BAR_PRESS_PX)
  })
})
