/**
 * Punch list #195 PR 2: the Missed calls card's words, draft and list over the to-do's made-up calls, on Friday Oct 23,
 * 2026 at 4:30 PM in Chicago.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { MISSED_REPLY_DEFAULTS, parseMissedReply } from '../quo/missedReply'
import {
  canSetMissedReply,
  claimLines,
  draftFrom,
  draftProblem,
  LINE_FIELD,
  LINE_KEYS,
  MISSED_CLAIMS_SHOWN,
  MISSED_LINE_MAX,
  MISSED_REPLY_WORDS as W,
  sameDraft,
  serializeLines,
  serializeSwitch,
  settingsAfterSave,
  type ClaimRow,
} from './missedReplyCard'

const NOW = '2026-10-23T21:30:00.000Z'
const ON = { ...MISSED_REPLY_DEFAULTS, on: true }

const claim = (over: Partial<ClaimRow> = {}): ClaimRow => ({
  call_quo_id: 'CA-1',
  called_at: '2026-10-23T21:11:00.000Z',
  outcome: 'sent',
  line: 'in_hours',
  reason: null,
  words: MISSED_REPLY_DEFAULTS.inHours,
  decided_at: '2026-10-23T21:12:00.000Z',
  contact: { name: '(512) 555-0187' },
  ...over,
})

describe('who sets it', () => {
  it('is the owner and a dev', () => {
    expect(canSetMissedReply('master_technician')).toBe(true)
    expect(canSetMissedReply('dev')).toBe(true)
    expect(canSetMissedReply('estimator')).toBe(false)
    expect(canSetMissedReply(null)).toBe(false)
  })
})

describe('the draft', () => {
  it('starts from the lines, knows when nothing changed, and names each field', () => {
    const draft = draftFrom(ON)
    expect(draft).toEqual({ inHours: ON.inHours, afterHours: ON.afterHours, voicemail: ON.voicemail })
    expect(sameDraft(draft, { ...draft, voicemail: `${draft.voicemail}  ` })).toBe(true)
    expect(sameDraft(draft, { ...draft, voicemail: 'We will call you back.' })).toBe(false)
    expect(LINE_KEYS.map((k) => LINE_FIELD[k])).toEqual(['inHours', 'afterHours', 'voicemail'])
  })

  it('refuses an empty line and a line too long for a text', () => {
    expect(draftProblem(draftFrom(ON))).toBeNull()
    expect(draftProblem({ ...draftFrom(ON), afterHours: '  ' })).toBe(W.emptyLine)
    expect(draftProblem({ ...draftFrom(ON), inHours: 'x'.repeat(MISSED_LINE_MAX + 1) })).toBe(W.longLine)
    expect(draftProblem({ ...draftFrom(ON), inHours: 'x'.repeat(MISSED_LINE_MAX) })).toBeNull()
  })

  it('writes the lines with the switch as it is, and the switch with the lines as saved', () => {
    const lines = serializeLines(ON, { ...draftFrom(ON), voicemail: ' We will call you back. ' }, NOW)
    expect(JSON.parse(lines)).toEqual({ on: true, inHours: ON.inHours, afterHours: ON.afterHours, voicemail: 'We will call you back.', savedAt: NOW })
    expect(settingsAfterSave(lines)).toEqual({ ...ON, voicemail: 'We will call you back.' })
    const off = serializeSwitch(parseMissedReply(lines), false, NOW)
    expect(parseMissedReply(off)).toEqual({ ...ON, on: false, voicemail: 'We will call you back.' })
  })
})

describe('the last texts back', () => {
  it('words each call, newest first, and keeps ten', () => {
    const rows = [
      claim(),
      claim({ call_quo_id: 'CA-2', called_at: '2026-10-23T19:05:00.000Z', outcome: 'not_sent', line: null, reason: 'recent-text', words: 'We texted this number at 1:40 PM.', contact: { name: 'Ridgeway Builders' } }),
      claim({ call_quo_id: 'CA-3', called_at: '2026-10-23T16:31:00.000Z', outcome: 'not_sent', line: null, reason: 'stopped', words: 'They sent STOP.', contact: { name: '(512) 555-0101' } }),
      claim({ call_quo_id: 'CA-4', called_at: '2026-10-22T01:40:00.000Z', outcome: 'sent', line: 'voicemail', contact: null }),
      claim({ call_quo_id: 'CA-5', called_at: '2026-10-21T15:00:00.000Z', outcome: 'claimed', line: null, words: '', decided_at: null, contact: { name: '  ' } }),
    ]
    expect(claimLines(rows, NOW)).toEqual([
      { key: 'CA-1', when: 'today · 4:11 PM', who: '(512) 555-0187', words: 'Sent, in office hours.', tone: 'green' },
      { key: 'CA-2', when: 'today · 2:05 PM', who: 'Ridgeway Builders', words: 'Not sent. We texted this number at 1:40 PM.', tone: 'amber' },
      { key: 'CA-3', when: 'today · 11:31 AM', who: '(512) 555-0101', words: 'Not sent. They sent STOP.', tone: 'amber' },
      { key: 'CA-4', when: 'Wed, Oct 21 · 8:40 PM', who: 'Someone', words: 'Sent, with a voicemail.', tone: 'green' },
      { key: 'CA-5', when: 'Wed, Oct 21 · 10:00 AM', who: 'Someone', words: 'The app did not finish.', tone: 'muted' },
    ])
    const many = Array.from({ length: 14 }, (_, i) => claim({ call_quo_id: `CA-${i}`, called_at: `2026-10-${String(10 + i).padStart(2, '0')}T15:00:00.000Z` }))
    expect(claimLines(many, NOW)).toHaveLength(MISSED_CLAIMS_SHOWN)
    expect(claimLines(many, NOW)[0]?.key).toBe('CA-13')
    expect(claimLines([claim({ outcome: 'not_sent', words: ' ' })], NOW)[0]?.words).toBe('Not sent. The reason was not kept.')
  })
})

describe('plain words', () => {
  it('every sentence the card shows reads plainly', () => {
    const words = [W.note, W.on, W.off, W.gates, W.empty, W.notAllowed, W.emptyLine, W.longLine, W.saved, W.notSaved, W.onToast, W.offToast, W.confirm.message, ...claimLines([claim()], NOW).map((r) => r.words)]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})
