import { describe, expect, it } from 'vitest'
import { BID_FORM_FOCUS_ELEMENT_ID, focusForRobotGap, needsDoorFor } from './bidFormFocus'
import type { RobotGap } from './robotRowState'

const gap = (key: RobotGap['key'], extra: Partial<RobotGap> = {}): RobotGap => ({ key, label: key, fix: 'fix', required: true, ...extra })

describe('bidFormFocus (v2.3334)', () => {
  it('every focus names an element id on the Edit bid form', () => {
    for (const id of Object.values(BID_FORM_FOCUS_ELEMENT_ID)) expect(id).toMatch(/^bid-form-/)
    expect(BID_FORM_FOCUS_ELEMENT_ID.plansLink).toBe('bid-form-plans-link')
  })

  it('a robot gap lands on the field that fixes it; distance has no field', () => {
    expect(focusForRobotGap('plans')).toBe('plansLink')
    expect(focusForRobotGap('plans-unreadable')).toBe('plansLink')
    expect(focusForRobotGap('gc')).toBe('gcBuilder')
    expect(focusForRobotGap('service-type')).toBe('serviceType')
    expect(focusForRobotGap('due-date')).toBe('dueDate')
    expect(focusForRobotGap('distance')).toBeNull()
    expect(focusForRobotGap(null)).toBeNull()
  })

  it('"Paste the plans" with nothing asked goes straight to Edit bid on Job Plans', () => {
    expect(needsDoorFor({ gap: gap('plans'), questions: 0 })).toEqual({ kind: 'edit-bid', focus: 'plansLink' })
  })

  it('unshared plans, questions, or a plans gap with a question keep the needs sheet', () => {
    expect(needsDoorFor({ gap: gap('plans-unreadable', { copyIntake: true }), questions: 0 })).toEqual({ kind: 'needs-sheet' })
    expect(needsDoorFor({ gap: gap('plans'), questions: 1 })).toEqual({ kind: 'needs-sheet' })
    expect(needsDoorFor({ gap: null, questions: 2 })).toEqual({ kind: 'needs-sheet' })
    expect(needsDoorFor(null)).toEqual({ kind: 'needs-sheet' })
  })
})
