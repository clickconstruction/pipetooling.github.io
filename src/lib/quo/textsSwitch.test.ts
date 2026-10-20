import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  TEXTS_NOT_SAVED,
  TEXTS_OFF,
  TEXTS_OFF_TOAST,
  TEXTS_ON_TOAST,
  TEXTS_SWITCH_ALWAYS,
  TEXTS_SWITCH_CONFIRM,
  TEXTS_SWITCH_FIRST,
  TEXTS_SWITCH_KEY,
  TEXTS_SWITCH_TITLE,
  TEXTS_SWITCH_WHAT,
  canSwitchTexts,
  switchGates,
  textsAreOn,
} from './textsSwitch'
import { APP_SETTINGS_KEY_MESSAGES_TEXTS_ON_V1 } from '../appSettingsKeys'

describe('the texts switch', () => {
  it('reads on only for the word true, so a missing or empty row keeps texts off', () => {
    expect(textsAreOn('true')).toBe(true)
    for (const v of ['false', '', 'TRUE', 'yes', ' true', null, undefined]) expect(textsAreOn(v)).toBe(false)
  })

  it('holds back a person’s text and the app’s reminder, never the answer to HELP or a stop’s confirmation', () => {
    expect(switchGates('reply')).toBe(true)
    expect(switchGates('nudge')).toBe(true)
    expect(switchGates('answer')).toBe(false)
    expect(switchGates('confirm')).toBe(false)
  })

  it('is the owner’s and a dev’s to change, as the policy allows', () => {
    expect(canSwitchTexts('master_technician')).toBe(true)
    expect(canSwitchTexts('dev')).toBe(true)
    for (const r of ['assistant', 'controller', 'estimator', 'primary', null, undefined]) expect(canSwitchTexts(r)).toBe(false)
  })

  it('names the same row as the app’s settings keys', () => {
    expect(TEXTS_SWITCH_KEY).toBe(APP_SETTINGS_KEY_MESSAGES_TEXTS_ON_V1)
  })

  it('says each thing in plain words', () => {
    const words = [TEXTS_OFF, TEXTS_SWITCH_TITLE, TEXTS_SWITCH_WHAT, TEXTS_SWITCH_ALWAYS, TEXTS_SWITCH_FIRST, TEXTS_SWITCH_CONFIRM.title, TEXTS_SWITCH_CONFIRM.message, TEXTS_ON_TOAST, TEXTS_OFF_TOAST, TEXTS_NOT_SAVED]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})
