import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { ESTIMATE_DOOR_WORDS, estimateDoorFor, estimateDoorHref, textDoorsFrom } from './estimateDoor'

const SUBJECT = 'Estimate #166 — Estimate for Evan Johnson — $6,250 · Click Plumbing and Electrical'
const line = (set: Partial<{ channel: string; direction: string; subject: string | null; body: string }> = {}) => ({ channel: 'email', direction: 'out', subject: SUBJECT, body: SUBJECT, ...set })

describe('estimateDoorFor (v2.5698, punch list #139)', () => {
  it('reads the number off our estimate email, and knows when the words only repeat the subject', () => {
    expect(estimateDoorFor(line())).toEqual({ kind: 'estimate', number: 166, duplicate: true })
    expect(estimateDoorFor(line({ body: 'Hi Evan, here is the estimate.\nEstimate #166 …' }))).toEqual({ kind: 'estimate', number: 166, duplicate: false })
    expect(estimateDoorFor(line({ subject: 'Change order #80 — Added cleanout — $450 · Click Plumbing', body: 'Change order #80 — Added cleanout — $450 · Click Plumbing' }))).toEqual({ kind: 'change-order', number: 80, duplicate: true })
  })
  it('draws no door on anything else: their email, a text, a plain subject, no subject', () => {
    expect(estimateDoorFor(line({ direction: 'in' }))).toBeNull()
    expect(estimateDoorFor(line({ channel: 'text' }))).toBeNull()
    expect(estimateDoorFor(line({ subject: 'Re: Thursday' }))).toBeNull()
    expect(estimateDoorFor(line({ subject: null }))).toBeNull()
    expect(estimateDoorFor(line({ subject: 'Estimate #0 — nothing' }))).toBeNull()
  })
  it('a text’s door comes from its link’s token hash naming an estimate; a dead or unknown link names none (v2.5706)', () => {
    const doors = textDoorsFrom(
      [
        { id: 't1', hashes: ['AAA'] },
        { id: 't2', hashes: ['dead', 'bbb'] },
        { id: 't3', hashes: ['nope'] },
        { id: 't4', hashes: [] },
      ],
      [
        { number: 166, tokenHash: 'aaa', changeOrder: false },
        { number: 80, tokenHash: 'bbb', changeOrder: true },
      ],
    )
    expect([...doors.entries()]).toEqual([
      ['t1', { kind: 'estimate', number: 166, duplicate: false }],
      ['t2', { kind: 'change-order', number: 80, duplicate: false }],
    ])
  })
  it('names the press and the page, in plain words', () => {
    const d = estimateDoorFor(line())!
    expect(ESTIMATE_DOOR_WORDS.open(d)).toBe('Open estimate #166')
    expect(ESTIMATE_DOOR_WORDS.open({ kind: 'change-order', number: 80, duplicate: false })).toBe('Open change order #80')
    expect(estimateDoorHref(d)).toBe('/estimates/166')
    for (const words of [ESTIMATE_DOOR_WORDS.open(d), ESTIMATE_DOOR_WORDS.tip]) expect(plainWordsFailures(words), words).toEqual([])
  })
})
