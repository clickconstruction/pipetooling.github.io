import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  GLOBAL_RELOAD_CONFIRM,
  GLOBAL_RELOAD_LEAD,
  GLOBAL_RELOAD_NOT_SENT,
  GLOBAL_RELOAD_PRESS,
  GLOBAL_RELOAD_SECTIONS,
  GLOBAL_RELOAD_SENT,
  GLOBAL_RELOAD_TITLE,
} from './globalReloadWords'

describe('Global Reload, in words', () => {
  const everyLine = [
    GLOBAL_RELOAD_LEAD,
    GLOBAL_RELOAD_CONFIRM.title,
    GLOBAL_RELOAD_CONFIRM.message,
    GLOBAL_RELOAD_SENT,
    GLOBAL_RELOAD_NOT_SENT,
    ...GLOBAL_RELOAD_SECTIONS.flatMap((s) => [s.heading, ...s.lines]),
  ]

  it('every line is plain words', () => {
    for (const line of everyLine) expect(plainWordsFailures(line), line).toEqual([])
  })

  it('the press keeps its name, and the window’s button names the act', () => {
    expect(GLOBAL_RELOAD_TITLE).toBe('Global Reload')
    expect(GLOBAL_RELOAD_PRESS).toBe('Global Reload')
    expect(GLOBAL_RELOAD_CONFIRM.confirmLabel).toBe('Reload everyone')
    expect(GLOBAL_RELOAD_CONFIRM.confirmLabel).not.toMatch(/^(ok|yes|confirm)$/i)
    expect(GLOBAL_RELOAD_CONFIRM.cancelLabel).not.toMatch(/^cancel$/i)
  })

  it('says when to press it first, then when to leave it, what it does to people, and who it reaches', () => {
    expect(GLOBAL_RELOAD_SECTIONS.map((s) => s.heading)).toEqual(['Press it when', 'Leave it alone when', 'What it does to people', 'Who it reaches'])
    for (const s of GLOBAL_RELOAD_SECTIONS) expect(s.lines.length, s.heading).toBeGreaterThanOrEqual(3)
  })

  it('the cases for pressing it are a fault doing harm, a database change the old app would misread, and many stuck at once', () => {
    const cases = GLOBAL_RELOAD_SECTIONS[0]!.lines.join(' ')
    expect(cases).toMatch(/fault in the app is doing harm/)
    expect(cases).toMatch(/database change the old app would misread/)
    expect(cases).toMatch(/Many people are stuck/)
  })

  it('says plainly that it loses typed words and does not ask, in the window and under the press', () => {
    expect(GLOBAL_RELOAD_CONFIRM.message).toMatch(/Words they typed and have not sent are lost/)
    const cost = GLOBAL_RELOAD_SECTIONS[2]!.lines.join(' ')
    expect(cost).toMatch(/does not ask first/)
    expect(cost).toMatch(/Words they typed and have not sent are lost/)
  })

  it('says the copy that pressed it stays, since the signal does not come back to its sender', () => {
    expect(GLOBAL_RELOAD_LEAD).toMatch(/every other open copy/)
    expect(GLOBAL_RELOAD_SENT).toMatch(/This copy stays/)
  })

  it('no line is said twice', () => {
    expect(new Set(everyLine).size).toBe(everyLine.length)
  })
})
