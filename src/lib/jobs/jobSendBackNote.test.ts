import { describe, expect, it } from 'vitest'
import {
  JOB_SEND_BACK_NOTE_PREFIX,
  composeSendBackNoteBody,
  parseSendBackNoteBody,
  sendBackLineForCard,
  sendBackReasonError,
} from './jobSendBackNote'

describe('sendBackReasonError', () => {
  it('requires a non-trivial reason', () => {
    expect(sendBackReasonError('')).toMatch(/why/i)
    expect(sendBackReasonError('   ')).toMatch(/why/i)
    expect(sendBackReasonError('ok')).toMatch(/few words/i)
    expect(sendBackReasonError('Need the tunnel footage attached')).toBeNull()
  })
})

describe('compose/parse round trip', () => {
  it('round-trips a reason through the note body', () => {
    const body = composeSendBackNoteBody('  Missing parts list  ')
    expect(body).toBe(`${JOB_SEND_BACK_NOTE_PREFIX}Missing parts list`)
    expect(parseSendBackNoteBody(body)).toBe('Missing parts list')
  })

  it('caps the body at 2000 chars', () => {
    expect(composeSendBackNoteBody('x'.repeat(3000)).length).toBe(2000)
  })

  it('returns null for non-send-back bodies', () => {
    expect(parseSendBackNoteBody('100% complete — from field report')).toBeNull()
    expect(parseSendBackNoteBody('Sent back to Working —   ')).toBeNull()
    expect(parseSendBackNoteBody('sent back to working — lowercase prefix')).toBeNull()
  })
})

describe('sendBackLineForCard', () => {
  const base = {
    jobStatus: 'working',
    noteBody: `${JOB_SEND_BACK_NOTE_PREFIX}Customer wants the trim redone`,
    noteCreatedAtIso: '2026-08-19T12:00:00Z',
    byName: 'Roxi',
    nowIso: '2026-08-21T12:00:00Z',
  }

  it('shows on a recent send-back while the job is Working', () => {
    expect(sendBackLineForCard(base)).toEqual({ reason: 'Customer wants the trim redone', byName: 'Roxi' })
  })

  it('hides once the job leaves Working', () => {
    expect(sendBackLineForCard({ ...base, jobStatus: 'ready_to_bill' })).toBeNull()
    expect(sendBackLineForCard({ ...base, jobStatus: null })).toBeNull()
  })

  it('hides stale send-backs (>14 days)', () => {
    expect(sendBackLineForCard({ ...base, noteCreatedAtIso: '2026-08-01T12:00:00Z' })).toBeNull()
  })

  it('ignores bodies that are not send-back notes and bad dates', () => {
    expect(sendBackLineForCard({ ...base, noteBody: '55% complete' })).toBeNull()
    expect(sendBackLineForCard({ ...base, noteCreatedAtIso: 'not-a-date' })).toBeNull()
  })

  it('blank author renders as empty byName', () => {
    expect(sendBackLineForCard({ ...base, byName: null })).toEqual({
      reason: 'Customer wants the trim redone',
      byName: '',
    })
  })
})
