import { describe, expect, it } from 'vitest'
import { FILE_PICKER_PAD, FOLD_LINE_PAD, IN_LINE_LINK_DRAWN, IN_LINE_PRESS_DRAWN, ONE_ROW_PILLS, PHONE_PILL_MIN_HEIGHT, PHONE_PRESS_MIN_HEIGHT, PHONE_SCREEN_MAX_WIDTH, activityPillStyle, activityPillsOnOneRow, phoneThumbPressesCss, thumbInLine } from './phonePress'

describe('phonePress', () => {
  it('holds the two heights the walk asked for', () => {
    expect(PHONE_PRESS_MIN_HEIGHT).toBe(44)
    expect(PHONE_PILL_MIN_HEIGHT).toBe(32)
  })

  it('grows the activity pills to 32 px on a phone and leaves the office chip alone', () => {
    expect(activityPillStyle(true).minHeight).toBe(32)
    expect(activityPillStyle(true).fontSize).toBe('0.75rem')
    expect(activityPillStyle(false).minHeight).toBeUndefined()
    expect(activityPillStyle(false).padding).toBe('0.15rem 0.5rem')
  })

  it('keeps the pills to one row only on a phone, and only on the row that carries Customer', () => {
    expect(activityPillsOnOneRow({ narrow: true, withCustomer: true })).toBe(true)
    expect(activityPillsOnOneRow({ narrow: true, withCustomer: false })).toBe(false)
    expect(activityPillsOnOneRow({ narrow: false, withCustomer: true })).toBe(false)
    expect(activityPillsOnOneRow({ narrow: false, withCustomer: false })).toBe(false)
  })

  it('trims the one row to the sides only: the height is the phone pill\'s own', () => {
    // The vertical half of each trim is the phone pill's, so the 32 px a fingertip needs holds.
    const tall = String(activityPillStyle(true).padding).split(' ')[0]
    expect(ONE_ROW_PILLS.pill.split(' ')[0]).toBe(tall)
    expect(ONE_ROW_PILLS.word.split(' ')[0]).toBe(tall)
    // A dim word's side padding and border are what the fade lets hide.
    expect(ONE_ROW_PILLS.fadeSlack).toBeGreaterThanOrEqual(5)
  })

  it('stands a press in a line a fingertip tall and gives the line back what the press grew by', () => {
    // A 28 px press grows by 16, so 8 comes off over it and 8 under it: the line stays 28.
    expect(thumbInLine(28)).toEqual({ minHeight: 44, marginTop: -8, marginBottom: -8 })
    expect(thumbInLine(27)).toEqual({ minHeight: 44, marginTop: -8.5, marginBottom: -8.5 })
    const { minHeight, marginTop, marginBottom } = thumbInLine(32)
    expect(minHeight + marginTop + marginBottom).toBe(32)
  })

  it('takes no margin from a press that is a fingertip tall already', () => {
    expect(thumbInLine(44)).toEqual({ minHeight: 44, marginTop: 0, marginBottom: 0 })
    expect(thumbInLine(60)).toEqual({ minHeight: 44, marginTop: 0, marginBottom: 0 })
  })
})

describe('phoneThumbPressesCss (finding 290)', () => {
  const css = phoneThumbPressesCss('[data-zz-shell]')

  it('is one rule for a phone and none for a desk', () => {
    expect(PHONE_SCREEN_MAX_WIDTH).toBe(640)
    expect(css.startsWith('@media (max-width: 640px) { ')).toBe(true)
    expect(css.endsWith(' }')).toBe(true)
    expect(css.match(/@media/g)).toHaveLength(1)
  })

  it('stands every button in the shell a fingertip tall, over a height the button set itself', () => {
    expect(css).toContain('[data-zz-shell] button { min-height: 44px !important; }')
  })

  it('gives a button in a line of words its growth back, so the line stays as drawn', () => {
    expect(IN_LINE_PRESS_DRAWN).toBe(18)
    expect(css).toContain('[data-zz-shell] button[data-press-in-line] { margin-top: -13px; margin-bottom: -13px; }')
  })

  it('grows what a finger can hit on a link by its padding, and gives the padding back in its margin', () => {
    expect(css).toContain('[data-zz-shell] a[href] { padding-top: 15px; padding-bottom: 15px; margin-top: -15px; margin-bottom: -15px; }')
    // The shortest link drawn, 14 px, is 44 px to a finger. A taller one is more.
    expect(IN_LINE_LINK_DRAWN + 15 + 15).toBe(PHONE_PRESS_MIN_HEIGHT)
  })

  it('grows the four presses that are not buttons or links: a tick by its label, a pick, a fold’s line and a file picker', () => {
    expect(css).toContain('[data-zz-shell] label:has(input[type="checkbox"]), [data-zz-shell] label:has(input[type="radio"]) { min-height: 44px !important; }')
    expect(css).toContain('[data-zz-shell] select { min-height: 44px !important; }')
    // A fold's line takes padding and no flex, which would lose its marker. 17 px of words in the middle of 44.
    expect(css).toContain('[data-zz-shell] summary { box-sizing: border-box; min-height: 44px; padding-top: 13px; padding-bottom: 13px; }')
    expect(css).not.toMatch(/summary \{[^}]*display/)
    expect(FOLD_LINE_PAD).toBe(13)
    expect(css).toContain('[data-zz-shell] input[type="file"] { box-sizing: border-box; min-height: 44px !important; padding-top: 11px; padding-bottom: 11px; }')
    expect(FILE_PICKER_PAD).toBe(11)
  })

  it('leaves a field a person types in as it is: no rule names a text box', () => {
    expect(css).not.toMatch(/input\[type="(text|number|date|email)"\]|textarea|input \{/)
  })

  it('names the shell on every selector, so a press outside it is left as it is', () => {
    const selectors = css.replace(/^@media[^{]*\{/, '').split('}').map((r) => r.split('{')[0]!.trim()).filter(Boolean)
    expect(selectors).toHaveLength(7)
    // A rule may name two selectors: each one names the shell.
    for (const s of selectors.flatMap((r) => r.split(',').map((x) => x.trim()))) expect(s.startsWith('[data-zz-shell] ')).toBe(true)
  })
})
