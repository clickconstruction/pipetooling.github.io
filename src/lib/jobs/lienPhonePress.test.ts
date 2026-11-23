import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PHONE_PRESS_MIN_HEIGHT } from '../phonePress'
import { lienGateHoldWords } from './lienNextUp'
import {
  LIEN_PHONE_PRESS_MIN_HEIGHT,
  LIEN_PHONE_PRESS_NARROW_AT_PX,
  LIEN_PHONE_PRESS_NARROW_PX,
  LIEN_PHONE_PRESS_PX,
  LIEN_PHONE_PRESS_VAR,
  LIEN_PHONE_QUIET_MIN_HEIGHT,
  lienPhonePressShortened,
  lienPhonePressWords,
  lienPhoneRowColumns,
} from './lienPhonePress'

describe('a phone’s To do row on the Lien desk: one press column', () => {
  it('the press is a fingertip tall, and the quiet line under the words a thumb can press', () => {
    expect(LIEN_PHONE_PRESS_MIN_HEIGHT).toBe(PHONE_PRESS_MIN_HEIGHT)
    expect(LIEN_PHONE_QUIET_MIN_HEIGHT).toBeGreaterThanOrEqual(32)
  })

  it('the row is two columns: the words take what is left and the press keeps one width', () => {
    expect(lienPhoneRowColumns()).toBe('minmax(0, 1fr) var(--lien-phone-press, 116px)')
    expect(LIEN_PHONE_PRESS_NARROW_PX).toBeLessThan(LIEN_PHONE_PRESS_PX)
  })

  it('the stylesheet holds the same widths, since only it can ask the screen’s width', () => {
    const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
    expect(css).toContain(`.lienPhoneRow { ${LIEN_PHONE_PRESS_VAR}: ${LIEN_PHONE_PRESS_PX}px; }`)
    expect(css).toContain(`@media (max-width: ${LIEN_PHONE_PRESS_NARROW_AT_PX}px) { .lienPhoneRow { ${LIEN_PHONE_PRESS_VAR}: ${LIEN_PHONE_PRESS_NARROW_PX}px; } }`)
  })

  it('the three long presses take a shorter form, matched whole', () => {
    expect(lienPhonePressWords('Answer the homestead question')).toBe('Answer it')
    expect(lienPhonePressWords('Open the property record')).toBe('Open the record')
    expect(lienPhonePressWords('Fix the property record')).toBe('Fix the record')
    expect(lienPhonePressShortened('Fix the property record')).toBe(true)
  })

  it('every other press keeps its words, and so does one that only starts like a long one', () => {
    for (const words of ['Print and mail 2', 'Enter mail numbers', 'Open the notice', 'Record the retainage', 'Note it', 'Open', 'Open the property record at the owner', 'Answer the homestead question ›']) {
      expect(lienPhonePressWords(words)).toBe(words)
      expect(lienPhonePressShortened(words)).toBe(false)
    }
  })

  it('the short forms are of the words the desk’s own kernel makes for a held affidavit', () => {
    // One fact missing names the fact, several name the record, and a finding opens the record.
    expect(lienPhonePressWords(lienGateHoldWords(['homestead_answer']).button)).toBe('Answer it')
    expect(lienPhonePressWords(lienGateHoldWords(['owner', 'legal']).button)).toBe('Fix the record')
    expect(lienPhonePressWords(lienGateHoldWords(['homestead']).button)).toBe('Open the record')
  })
})
