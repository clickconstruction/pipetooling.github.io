import { describe, expect, it } from 'vitest'
import { batchOutcomeWords, batchWords, countedLabel, pluralNoun } from './batchWords'
import { plainWordsFailures } from './plainWords'

describe('batchWords — a batch button says its count (punch list #184, sweep A)', () => {
  it('ready and nothing held: the verb and the count, no foot, live', () => {
    expect(batchWords({ verb: 'Send', ready: 4, held: 0 })).toEqual({ button: 'Send 4', foot: null, dead: false })
    expect(batchWords({ verb: 'Send', ready: 4, held: 0, noun: 'request' })).toEqual({ button: 'Send 4 requests', foot: null, dead: false })
    expect(batchWords({ verb: 'Send', ready: 1, held: 0, noun: 'request' }).button).toBe('Send 1 request')
  })
  it('some held: the button counts both with the reason and a door, the foot says what stays and what goes', () => {
    expect(batchWords({ verb: 'Send', ready: 3, held: 1, heldWhy: 'has no email' })).toEqual({
      button: 'Send 3 · 1 has no email ▸',
      foot: '1 is held. It stays here with the reason. The 3 ready ones send now.',
      dead: false,
    })
    expect(batchWords({ verb: 'Send', ready: 3, held: 2, heldWhy: 'have no email' })).toEqual({
      button: 'Send 3 · 2 have no email ▸',
      foot: '2 are held. They stay here with the reason. The 3 ready ones send now.',
      dead: false,
    })
    // one ready: the verb agrees
    expect(batchWords({ verb: 'Send', ready: 1, held: 2 }).foot).toBe('2 are held. They stay here with the reason. The 1 ready one sends now.')
    expect(batchWords({ verb: 'Apply', ready: 1, held: 1 }).foot).toBe('1 is held. It stays here with the reason. The 1 ready one applies now.')
    expect(batchWords({ verb: 'Push', ready: 1, held: 1 }).foot).toContain('one pushes now')
    // the reason by count
    const why = { one: 'typed waits', many: 'typed wait' }
    expect(batchWords({ verb: 'Approve', ready: 4, held: 1, heldWhy: why, noun: 'punch' }).button).toBe('Approve 4 punches · 1 typed waits ▸')
    expect(batchWords({ verb: 'Approve', ready: 4, held: 2, heldWhy: why, noun: 'punch' }).button).toBe('Approve 4 punches · 2 typed wait ▸')
    // no reason given: held
    expect(batchWords({ verb: 'Send', ready: 2, held: 3 }).button).toBe('Send 2 · 3 held ▸')
  })
  it('nothing ready: the bare verb with the door, dead, the foot says where to look', () => {
    expect(batchWords({ verb: 'Send', ready: 0, held: 2 })).toEqual({
      button: 'Send ▸',
      foot: 'Nothing is ready to send. Fix what is marked in red, then send.',
      dead: true,
    })
    expect(batchWords({ verb: 'Send', ready: 0, held: 2, noun: 'request' }).button).toBe('Send ▸')
  })
  it('a verb with a preposition keeps it on the button and drops it in the foot', () => {
    expect(batchWords({ verb: 'Send to', ready: 3, held: 1, heldWhy: 'has no email' })).toEqual({
      button: 'Send to 3 · 1 has no email ▸',
      foot: '1 is held. It stays here with the reason. The 3 ready ones send now.',
      dead: false,
    })
    expect(batchWords({ verb: 'Send to', ready: 0, held: 2 }).foot).toBe('Nothing is ready to send. Fix what is marked in red, then send.')
    expect(batchWords({ verb: 'Send to', ready: 1, held: 1 }).foot).toContain('The 1 ready one sends now.')
    expect(batchWords({ verb: 'Add', ready: 2, held: 1, noun: ['to schedule', 'to schedule'], heldWhy: 'held: overlaps' }).button).toBe('Add 2 to schedule · 1 held: overlaps ▸')
  })
  it('nothing at all: the bare verb, dead, no foot', () => {
    expect(batchWords({ verb: 'Send', ready: 0, held: 0 })).toEqual({ button: 'Send', foot: null, dead: true })
  })
  it('every foot keeps to plain words', () => {
    const feet = [
      batchWords({ verb: 'Send', ready: 3, held: 1, heldWhy: 'has no email' }).foot,
      batchWords({ verb: 'Send', ready: 1, held: 2 }).foot,
      batchWords({ verb: 'Approve', ready: 0, held: 2 }).foot,
    ]
    for (const foot of feet) expect(plainWordsFailures(foot ?? '')).toEqual([])
  })
})

describe('batchOutcomeWords — after the press, what took and what did not (sweep A, PR 2)', () => {
  it('every row took: the count done, no head, success', () => {
    expect(batchOutcomeWords({ verb: 'generate', past: 'generated', done: 6, failed: 0, noun: 'report' })).toEqual({ line: 'Generated 6 reports.', head: null, tone: 'success' })
    expect(batchOutcomeWords({ verb: 'update', past: 'updated', done: 1, failed: 0, noun: 'transaction' }).line).toBe('Updated 1 transaction.')
    expect(batchOutcomeWords({ verb: 'apply', past: 'applied', done: 12, failed: 0 }).line).toBe('Applied 12.')
  })
  it('some did not take: the toast says both, the head says they stay with the reason', () => {
    expect(batchOutcomeWords({ verb: 'generate', past: 'generated', done: 4, failed: 2, noun: 'report' })).toEqual({
      line: 'Generated 4 reports. 2 did not generate.',
      head: '2 reports did not generate. They stay here with the reason.',
      tone: 'warning',
    })
    expect(batchOutcomeWords({ verb: 'adopt', past: 'adopted', done: 2, failed: 1, noun: 'bid' }).head).toBe('1 bid did not adopt. It stays here with the reason.')
    expect(batchOutcomeWords({ verb: 'Send to', past: 'sent', done: 2, failed: 1 }).line).toBe('Sent 2. 1 did not send.')
  })
  it('nothing took: the toast says so, error', () => {
    expect(batchOutcomeWords({ verb: 'import', past: 'imported', done: 0, failed: 3, noun: 'RFI' })).toEqual({
      line: 'Nothing imported. 3 did not import.',
      head: '3 RFIs did not import. They stay here with the reason.',
      tone: 'error',
    })
  })
  it('every line keeps to plain words', () => {
    const outs = [
      batchOutcomeWords({ verb: 'generate', past: 'generated', done: 4, failed: 2, noun: 'report' }),
      batchOutcomeWords({ verb: 'update', past: 'updated', done: 0, failed: 1, noun: 'transaction' }),
      batchOutcomeWords({ verb: 'apply', past: 'applied', done: 9, failed: 3 }),
    ]
    for (const o of outs) {
      expect(plainWordsFailures(o.line)).toEqual([])
      expect(plainWordsFailures(o.head ?? '')).toEqual([])
    }
  })
})

describe('countedLabel — a button with no holds', () => {
  it('counts, with the noun in the right number', () => {
    expect(countedLabel('Mark', 5, ['opened', 'opened'])).toBe('Mark 5 opened')
    expect(countedLabel('Mark', 1, ['opened', 'opened'])).toBe('Mark 1 opened')
    expect(countedLabel('Mark', 3, ['read', 'read'])).toBe('Mark 3 read')
    expect(countedLabel('Rerun Google on', 7, 'address')).toBe('Rerun Google on 7 addresses')
    expect(countedLabel('Pin for', 4, 'user')).toBe('Pin for 4 users')
    expect(countedLabel('Pin for', 1, 'user')).toBe('Pin for 1 user')
    expect(countedLabel('Clear', 6, 'page pin')).toBe('Clear 6 page pins')
    expect(countedLabel('Apply to', 4, 'invoice')).toBe('Apply to 4 invoices')
    expect(countedLabel('Move', 5, 'session')).toBe('Move 5 sessions')
    expect(countedLabel('Move', 1, 'session')).toBe('Move 1 session')
    expect(countedLabel('Delete', 42, 'count row')).toBe('Delete 42 count rows')
    expect(countedLabel('Reject all', 14)).toBe('Reject all 14')
    expect(countedLabel('Unpin all', 4)).toBe('Unpin all 4')
  })
  it('at zero: the bare verb and its noun, for a dead button', () => {
    expect(countedLabel('Clear', 0, 'page pin')).toBe('Clear page pins')
    expect(countedLabel('Pin for', 0, 'user')).toBe('Pin for users')
    expect(countedLabel('Reject all', 0)).toBe('Reject all')
  })
})

describe('pluralNoun', () => {
  it('adds s, es after a hiss, or takes the tuple', () => {
    expect(pluralNoun('user', 2)).toBe('users')
    expect(pluralNoun('user', 1)).toBe('user')
    expect(pluralNoun('punch', 2)).toBe('punches')
    expect(pluralNoun('box', 3)).toBe('boxes')
    expect(pluralNoun(['person', 'people'], 2)).toBe('people')
    expect(pluralNoun(['person', 'people'], 1)).toBe('person')
  })
})
