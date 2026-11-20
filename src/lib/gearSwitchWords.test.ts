import { describe, expect, it } from 'vitest'
import { PIN_BAR_SWITCH_LABEL, TELL_THE_DEV_SWITCH_LABEL, switchRowAriaLabel, switchRowTip } from './gearSwitchWords'

describe('the gear menu’s show-or-hide switches', () => {
  it('names each row for the thing it shows, never as a mode', () => {
    expect(PIN_BAR_SWITCH_LABEL).toBe('Pin bar')
    expect(TELL_THE_DEV_SWITCH_LABEL).toBe('Tell the dev')
    for (const label of [PIN_BAR_SWITCH_LABEL, TELL_THE_DEV_SWITCH_LABEL]) expect(label).not.toMatch(/mode/i)
  })

  it('says what the next press does: hide while it shows, show while it is hidden', () => {
    expect(switchRowTip('pin', true)).toBe('Hide the pin bar')
    expect(switchRowTip('pin', false)).toBe('Show the pin bar at the bottom of pages')
    expect(switchRowTip('fix', true)).toBe('Hide the wrench that sends a note to the dev')
    expect(switchRowTip('fix', false)).toBe('Show the wrench that sends a note to the dev')
  })

  it('never calls a switch a mode in a tip or a screen reader’s name', () => {
    const words = [switchRowTip('pin', true), switchRowTip('pin', false), switchRowTip('fix', true), switchRowTip('fix', false), switchRowAriaLabel('pin'), switchRowAriaLabel('fix')]
    for (const w of words) expect(w).not.toMatch(/mode/i)
  })

  it('gives the wrench’s switch a name of its own, apart from the press that opens the box', () => {
    // On a narrow phone the gear menu holds both: the press is named Tell the dev.
    expect(switchRowAriaLabel('fix')).not.toBe('Tell the dev')
    expect(switchRowAriaLabel('fix')).toContain('wrench')
    expect(switchRowAriaLabel('pin')).toBe('Show the pin bar')
  })
})
