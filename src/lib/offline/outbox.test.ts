import { describe, expect, it } from 'vitest'
import { appTzWallTimeMs, formatDenverTimeOnly } from '../../utils/dateUtils'
import { plainWordsFailures } from '../plainWords'
import { COULD_NOT_BE_SENT_WORDS, DEPENDENCY_REFUSED_MESSAGE, GOT_IT_LABEL, NEVER_QUEUES, NEXT_MORNING_HOUR, OUTBOX_KINDS, OUTBOX_SCHEMA, RETRY_DELAYS_MS, SENT_MARK, TRY_NOW_LABEL, WAITED_TOO_LONG_HELP, WAITED_TOO_LONG_WORDS, WAITING_WORDS, dropPress, failureQueues, inOrder, isOutboxKind, markDueNow, markRefused, markSeen, markSending, markSent, markTryFailed, needsAPerson, newPress, nextDueAt, nextSeq, nextToSend, nextTryAt, oldestWaiting, outboxBarWords, outboxDoorSections, outboxHoldsEverything, parseOutboxPress, pressLead, prune, retryDelayMs, settleDependents, waitLimitAt, waitedTooLong, waitingCountWords, type OutboxPress, keptPhotoCount, photosWaitingLine } from './outbox'

/** Dale's morning: 7:58 AM on a Thursday in the company's calendar. */
const DAY = '2026-10-29'
const at = (h: number, m: number) => appTzWallTimeMs(DAY, h, m)
const T_PRESS = at(7, 58)

function clockIn(over: Partial<OutboxPress<'clock-in'>> = {}): OutboxPress<'clock-in'> {
  return {
    ...newPress({
      id: 'p-in',
      seq: 1,
      kind: 'clock-in',
      userId: 'u1',
      pressedAt: T_PRESS,
      payload: { jobLedgerId: 'j1', bidId: null, notes: 'Rough in', travel: 'on-site' },
      about: 'Ridgeway Builders',
      door: '/dashboard',
    }),
    ...over,
  }
}

function note(over: Partial<OutboxPress<'job-note'>> = {}): OutboxPress<'job-note'> {
  return {
    ...newPress({ id: 'p-note', seq: 2, kind: 'job-note', userId: 'u1', pressedAt: at(8, 12), payload: { jobId: 'j1', body: 'Slab is poured.' }, about: 'Ridgeway Builders', door: '/jobs' }),
    ...over,
  }
}

function clockOut(over: Partial<OutboxPress<'clock-out'>> = {}): OutboxPress<'clock-out'> {
  return {
    ...newPress({
      id: 'p-out',
      seq: 3,
      kind: 'clock-out',
      userId: 'u1',
      pressedAt: at(9, 0),
      payload: { sessionId: null, sessionPressId: 'p-in', jobLedgerId: 'j1', bidId: null, notes: 'Rough in' },
      about: 'Ridgeway Builders',
      door: '/dashboard',
      dependsOn: 'p-in',
    }),
    ...over,
  }
}

describe('outbox · what may queue', () => {
  it('four presses may queue, in this order of names, and nothing else', () => {
    expect(OUTBOX_KINDS).toEqual(['clock-in', 'clock-out', 'job-note', 'field-report'])
    expect(isOutboxKind('clock-in')).toBe(true)
    expect(isOutboxKind('payment')).toBe(false)
    expect(isOutboxKind(null)).toBe(false)
  })

  it('names what never queues: money, a send to a customer, a signature', () => {
    expect(NEVER_QUEUES).toContain('a payment')
    expect(NEVER_QUEUES).toContain('a bill')
    expect(NEVER_QUEUES).toContain('a card split')
    expect(NEVER_QUEUES).toContain('a text or an email to a customer')
    expect(NEVER_QUEUES).toContain('a signature')
  })

  it('a fetch-layer failure or a timeout queues; a refusal does not; offline is not even tried', () => {
    expect(failureQueues({ kind: 'network', online: true })).toBe(true)
    expect(failureQueues({ kind: 'unknown', timedOut: true, online: true })).toBe(true)
    expect(failureQueues({ kind: 'server', online: true })).toBe(false)
    expect(failureQueues({ kind: 'unknown', online: true })).toBe(false)
    expect(failureQueues({ kind: 'server', online: false })).toBe(true)
  })
})

describe('outbox · the press', () => {
  it('a new press is waiting, stamped with the moment it was pressed, under the schema of today', () => {
    const p = clockIn()
    expect(p.state).toBe('waiting')
    expect(p.pressedAt).toBe(T_PRESS)
    expect(p.schema).toBe(OUTBOX_SCHEMA)
    expect(p.attempts).toBe(0)
    expect(p.seen).toBe(false)
    expect(p.dependsOn).toBeNull()
  })

  it('the next number is one past the highest kept, so the order survives a prune', () => {
    expect(nextSeq([])).toBe(1)
    expect(nextSeq([clockIn({ seq: 4 }), note({ seq: 9 })])).toBe(10)
  })

  it('a stored press comes back whole; one off the shape or under an older schema is dropped', () => {
    const p = clockIn({ attempts: 2, lastTriedAt: at(8, 0) })
    expect(parseOutboxPress(JSON.parse(JSON.stringify(p)))).toEqual(p)
    expect(parseOutboxPress({ ...p, schema: OUTBOX_SCHEMA + 1 })).toBeNull()
    expect(parseOutboxPress({ ...p, kind: 'payment' })).toBeNull()
    expect(parseOutboxPress({ ...p, pressedAt: 'yesterday' })).toBeNull()
    expect(parseOutboxPress({ ...p, payload: null })).toBeNull()
    expect(parseOutboxPress(null)).toBeNull()
  })

  it('a press that was in flight when the page closed waits again: the id makes the resend safe', () => {
    const p = parseOutboxPress({ ...clockIn(), state: 'sending', attempts: 1, lastTriedAt: at(8, 0) })
    expect(p?.state).toBe('waiting')
    expect(p?.attempts).toBe(1)
  })

  it('a refusal survives the store with its reason and code', () => {
    const p = parseOutboxPress(markRefused(clockIn(), { message: 'The office closed that session.', code: 'P0001' }))
    expect(p?.state).toBe('refused')
    expect(p?.refusal).toEqual({ message: 'The office closed that session.', code: 'P0001' })
  })
})

describe('outbox · the retry rule', () => {
  it('tries at once, then after 5, 10, 20 and 30 s, then every 30 s', () => {
    expect(RETRY_DELAYS_MS).toEqual([5_000, 10_000, 20_000, 30_000])
    expect(retryDelayMs(0)).toBe(0)
    expect(retryDelayMs(1)).toBe(5_000)
    expect(retryDelayMs(2)).toBe(10_000)
    expect(retryDelayMs(3)).toBe(20_000)
    expect(retryDelayMs(4)).toBe(30_000)
    expect(retryDelayMs(9)).toBe(30_000)
  })

  it('a press is due at once before its first try and by the rule after a failed one', () => {
    const p = clockIn()
    expect(nextTryAt(p)).toBe(T_PRESS)
    const tried = markTryFailed(markSending(p, at(8, 0)), at(8, 0))
    expect(tried.state).toBe('waiting')
    expect(tried.attempts).toBe(1)
    expect(nextTryAt(tried)).toBe(at(8, 0) + 5_000)
    const twice = markTryFailed(markSending(tried, at(8, 1)), at(8, 1))
    expect(nextTryAt(twice)).toBe(at(8, 1) + 10_000)
  })

  it('Try now makes the next try due at once', () => {
    const tried = markTryFailed(markSending(clockIn(), at(8, 0)), at(8, 0))
    expect(nextToSend([tried], at(8, 0) + 1_000)).toBeNull()
    expect(nextToSend([markDueNow(tried)], at(8, 0) + 1_000)?.id).toBe('p-in')
  })
})

describe('outbox · the order and what goes next', () => {
  it('goes out in the order pressed, one at a time, and nothing while one is in flight', () => {
    const presses = [note(), clockIn()]
    expect(inOrder(presses).map((p) => p.id)).toEqual(['p-in', 'p-note'])
    expect(nextToSend(presses, at(9, 42))?.id).toBe('p-in')
    const inFlight = presses.map((p) => (p.id === 'p-in' ? markSending(p, at(9, 42)) : p))
    expect(nextToSend(inFlight, at(9, 42))).toBeNull()
    expect(oldestWaiting(inFlight)).toBeNull()
  })

  it('a press behind one that is not due yet waits with it: one lost signal costs one request', () => {
    const first = markTryFailed(markSending(clockIn(), at(8, 0)), at(8, 0))
    const presses = [first, note()]
    expect(nextToSend(presses, at(8, 0) + 2_000)).toBeNull()
    expect(nextDueAt(presses, at(8, 0) + 2_000)).toBe(at(8, 0) + 5_000)
    expect(nextToSend(presses, at(8, 0) + 5_000)?.id).toBe('p-in')
  })

  it('a refused press holds nothing behind it: the rest still go', () => {
    const refused = markRefused(clockIn(), { message: 'The office closed that session.', code: 'P0001' })
    expect(nextToSend([refused, note()], at(9, 42))?.id).toBe('p-note')
  })

  it('a clock-out never goes before its clock-in, and is refused with it', () => {
    const presses = [clockIn(), clockOut()]
    expect(nextToSend(presses, at(9, 42))?.id).toBe('p-in')
    const sent = presses.map((p) => (p.id === 'p-in' ? markSent(p, { session_id: 's1' }, at(9, 42)) : p))
    expect(nextToSend(sent, at(9, 42))?.id).toBe('p-out')

    const refused = presses.map((p) => (p.id === 'p-in' ? markRefused(p, { message: 'You are already clocked in.', code: 'P0001' }) : p))
    const settled = settleDependents(refused)
    expect(settled.find((p) => p.id === 'p-out')?.state).toBe('refused')
    expect(settled.find((p) => p.id === 'p-out')?.refusal?.message).toBe(DEPENDENCY_REFUSED_MESSAGE)
    expect(nextToSend(settled, at(9, 42))).toBeNull()
  })

  it('a clock-out whose clock-in landed in an earlier session of the app goes on its own', () => {
    // The clock-in was pruned (sent two days ago): nothing in the list holds the clock-out back.
    expect(nextToSend([clockOut()], at(9, 42))?.id).toBe('p-out')
  })

  it('nothing is due when nothing waits', () => {
    expect(nextToSend([], at(9, 0))).toBeNull()
    expect(nextDueAt([markSent(clockIn(), {}, at(8, 0))], at(9, 0))).toBeNull()
  })
})

describe('outbox · landing, refusing, seeing, dropping', () => {
  it('a landing keeps its first sent time when the server answers it again, so a send that lands twice counts once', () => {
    const first = markSent(markSending(clockIn(), at(9, 42)), { session_id: 's1' }, at(9, 42))
    const again = markSent(first, { session_id: 's1', repeat: true }, at(9, 50))
    expect(again.sentAt).toBe(at(9, 42))
    expect(again.state).toBe('sent')
    expect(again.id).toBe(first.id)
  })

  it('Got it marks the presses seen; the list still has them', () => {
    const sent = markSent(clockIn(), {}, at(9, 42))
    const seen = markSeen([sent, note()], ['p-in'])
    expect(seen[0]?.seen).toBe(true)
    expect(seen[1]?.seen).toBe(false)
    expect(seen).toHaveLength(2)
  })

  it('a dropped press is gone; a sent or an in-flight one is never dropped by hand', () => {
    const refused = markRefused(clockIn(), { message: 'No.', code: null })
    expect(dropPress([refused, note()], 'p-in').map((p) => p.id)).toEqual(['p-note'])
    const sent = markSent(clockIn(), {}, at(9, 42))
    expect(dropPress([sent], 'p-in')).toHaveLength(1)
    expect(dropPress([markSending(clockIn(), at(9, 0))], 'p-in')).toHaveLength(1)
  })

  it('prune keeps what waits and what was refused, a sent press for its day, and a day more until Got it', () => {
    const sentToday = markSent(clockIn(), {}, at(9, 42))
    const sentYesterdayUnseen = markSent(clockIn({ id: 'y1', pressedAt: appTzWallTimeMs('2026-10-28', 15, 0) }), {}, appTzWallTimeMs('2026-10-28', 15, 5))
    const sentYesterdaySeen = { ...sentYesterdayUnseen, id: 'y2', seen: true }
    const sentLastWeek = markSent(clockIn({ id: 'w1', pressedAt: appTzWallTimeMs('2026-10-22', 15, 0) }), {}, appTzWallTimeMs('2026-10-22', 15, 5))
    const refused = markRefused(clockIn({ id: 'r1', pressedAt: appTzWallTimeMs('2026-10-20', 15, 0) }), { message: 'No.', code: null })
    const someoneElses = clockIn({ id: 'o1', userId: 'u2' })
    const kept = prune([sentToday, sentYesterdayUnseen, sentYesterdaySeen, sentLastWeek, refused, note(), someoneElses], at(10, 0), 'u1')
    expect(kept.map((p) => p.id).sort()).toEqual(['p-in', 'p-note', 'r1', 'y1'])
  })
})

describe('outbox · the wait limit (one workday)', () => {
  it('a press pressed today has waited too long the next morning at six, in the company calendar', () => {
    expect(NEXT_MORNING_HOUR).toBe(6)
    expect(waitLimitAt(T_PRESS)).toBe(appTzWallTimeMs('2026-10-30', 6, 0))
    const p = clockIn()
    expect(waitedTooLong(p, at(23, 59))).toBe(false)
    expect(waitedTooLong(p, appTzWallTimeMs('2026-10-30', 5, 59))).toBe(false)
    expect(waitedTooLong(p, appTzWallTimeMs('2026-10-30', 6, 0))).toBe(true)
    expect(needsAPerson(p, appTzWallTimeMs('2026-10-30', 6, 0))).toBe(true)
    expect(needsAPerson(p, at(9, 0))).toBe(false)
  })

  it('a sent press never needs a person, however old', () => {
    expect(needsAPerson(markSent(clockIn(), {}, at(9, 42)), appTzWallTimeMs('2026-11-02', 9, 0))).toBe(false)
  })

  it('a refused press needs a person at once', () => {
    expect(needsAPerson(markRefused(clockIn(), { message: 'No.', code: null }), at(8, 0))).toBe(true)
  })
})

describe('outbox · the bar', () => {
  const fmt = formatDenverTimeOnly

  it('is gone when nothing waits and nothing landed unseen', () => {
    expect(outboxBarWords([], at(9, 0))).toBeNull()
    expect(outboxBarWords([{ ...markSent(clockIn(), {}, at(9, 42)), seen: true }], at(9, 50))).toBeNull()
  })

  it('one press waiting: its lead, waiting to send, the countdown and Try now, in amber', () => {
    const tried = markTryFailed(markSending(clockIn(), at(8, 0)), at(8, 0))
    const words = outboxBarWords([tried], at(8, 0) + 2_000)
    expect(words?.tone).toBe('amber')
    expect(words?.lead).toBe(`Clock in from ${fmt(T_PRESS)}`)
    expect(words?.lines).toEqual([WAITING_WORDS, `last tried ${fmt(at(8, 0))}`])
    expect(words?.countdown).toBe('trying again in 3 s')
    expect(words?.button?.kind).toBe('try-now')
    expect(words?.button?.label).toBe(TRY_NOW_LABEL)
    expect(words?.opensList).toBe(true)
    expect(words?.pulsing).toBe(false)
  })

  it('several waiting: the count and the last try, the countdown from the oldest', () => {
    const tried = markTryFailed(markSending(clockIn(), at(8, 12)), at(8, 12))
    const words = outboxBarWords([tried, note()], at(8, 12) + 1_000)
    expect(words?.lead).toBe('2 waiting to send')
    expect(words?.lines).toEqual([`last tried ${fmt(at(8, 12))}`])
    expect(words?.countdown).toBe('trying again in 4 s')
    expect(words?.button?.pressIds).toEqual(['p-in', 'p-note'])
  })

  it('offline, the countdown is not shown: the resend fires on the online event', () => {
    const tried = markTryFailed(markSending(clockIn(), at(8, 12)), at(8, 12))
    const words = outboxBarWords([tried, note()], at(8, 12) + 1_000, { offline: true })
    expect(words?.countdown).toBeNull()
    expect(words?.lead).toBe('2 waiting to send')
  })

  it('a send in flight reads Sending … in amber, pulsing, with no button', () => {
    const words = outboxBarWords([markSending(clockIn(), at(9, 42)), note()], at(9, 42))
    expect(words?.lead).toBe(`Sending clock in from ${fmt(T_PRESS)}…`)
    expect(words?.pulsing).toBe(true)
    expect(words?.button).toBeNull()
    expect(words?.countdown).toBeNull()
  })

  it('one landed: green, its lead with the mark, Got it', () => {
    const words = outboxBarWords([markSent(clockIn(), {}, at(9, 42))], at(9, 43))
    expect(words?.tone).toBe('green')
    expect(words?.lead).toBe(`Clock in from ${fmt(T_PRESS)} ${SENT_MARK}`)
    expect(words?.lines).toEqual([])
    expect(words?.button?.kind).toBe('got-it')
    expect(words?.button?.label).toBe(GOT_IT_LABEL)
    expect(words?.button?.pressIds).toEqual(['p-in'])
  })

  it('several landed at once: 3 sent ✓, see them, one Got it for all', () => {
    const presses = [markSent(clockIn(), {}, at(9, 42)), markSent(note(), {}, at(9, 42)), markSent(clockOut(), {}, at(9, 42))]
    const words = outboxBarWords(presses, at(9, 43))
    expect(words?.tone).toBe('green')
    expect(words?.lead).toBe(`3 ${SENT_MARK}`)
    expect(words?.lines).toEqual(['see them'])
    expect(words?.button?.pressIds).toEqual(['p-in', 'p-note', 'p-out'])
  })

  it('a refusal turns the bar red for that press, with the reason and Fix, while the rest read as sent', () => {
    const presses = [markRefused(clockIn(), { message: 'The office closed that session.', code: 'P0001' }), markSent(note(), {}, at(9, 42))]
    const words = outboxBarWords(presses, at(9, 43))
    expect(words?.tone).toBe('red')
    expect(words?.lead).toBe(`Clock in from ${fmt(T_PRESS)} ${COULD_NOT_BE_SENT_WORDS}`)
    expect(words?.lines).toEqual(['The office closed that session.', `1 ${SENT_MARK}`])
    expect(words?.button).toEqual({ kind: 'fix', label: 'Fix', door: '/dashboard', pressIds: ['p-in'] })
    expect(words?.countdown).toBeNull()
  })

  it('red stays until the door is opened, never cleared by time; then the sent one is green', () => {
    const refused = markRefused(clockIn(), { message: 'The office closed that session.', code: 'P0001' })
    const sent = markSent(note(), {}, at(9, 42))
    expect(outboxBarWords([refused, sent], appTzWallTimeMs('2026-11-02', 9, 0))?.tone).toBe('red')
    const words = outboxBarWords(markSeen([refused, sent], ['p-in']), at(9, 50))
    expect(words?.tone).toBe('green')
    expect(words?.lead).toBe(`Job note from ${fmt(at(8, 12))} ${SENT_MARK}`)
  })

  it('a press that waited past the next morning turns red with its reason and the list as its door', () => {
    const morning = appTzWallTimeMs('2026-10-30', 6, 30)
    const words = outboxBarWords([clockIn()], morning)
    expect(words?.tone).toBe('red')
    expect(words?.lead).toBe(`Clock in from ${fmt(T_PRESS)} ${WAITED_TOO_LONG_WORDS}`)
    expect(words?.lines).toEqual([WAITED_TOO_LONG_HELP])
    expect(words?.button?.kind).toBe('fix')
  })

  it('two presses needing a person read as a count', () => {
    const presses = [markRefused(clockIn(), { message: 'No.', code: null }), markRefused(note(), { message: 'No.', code: null })]
    expect(outboxBarWords(presses, at(9, 0))?.lead).toBe('2 presses need you')
  })

  it('waiting beside a landed one: amber with Try now, the sent count on a line, Got it in the list', () => {
    const words = outboxBarWords([markSent(clockIn(), {}, at(9, 42)), note()], at(9, 42))
    expect(words?.tone).toBe('amber')
    expect(words?.lead).toBe(`Job note from ${fmt(at(8, 12))}`)
    expect(words?.lines).toEqual([WAITING_WORDS, `1 ${SENT_MARK}`])
    expect(words?.button?.kind).toBe('try-now')
  })

  it('every sentence the bar reads follows the plain-words rules', () => {
    const presses = [
      markRefused(clockIn(), { message: 'The office closed that session.', code: 'P0001' }),
      markTryFailed(markSending(note(), at(8, 12)), at(8, 12)),
      markSent(clockOut(), {}, at(9, 42)),
    ]
    for (const now of [at(8, 13), at(9, 43), appTzWallTimeMs('2026-10-30', 6, 30)]) {
      for (const set of [presses, presses.slice(1), presses.slice(2), [markSending(note(), now)]]) {
        const words = outboxBarWords(set, now)
        if (!words) continue
        for (const text of [words.lead, ...words.lines, words.countdown ?? '']) {
          expect(plainWordsFailures(text.replace(/…/g, '.'))).toEqual([])
        }
      }
    }
    expect(plainWordsFailures(WAITED_TOO_LONG_HELP)).toEqual([])
  })

  it('names the waiting count for the slow line and says nothing is lost only while no press needs a person', () => {
    const waiting = [clockIn(), note()]
    expect(waitingCountWords(waiting)).toBe('2 waiting to send')
    expect(waitingCountWords([])).toBeNull()
    expect(outboxHoldsEverything(waiting, at(9, 0))).toBe(true)
    expect(outboxHoldsEverything([markRefused(clockIn(), { message: 'No.', code: null }), note()], at(9, 0))).toBe(false)
    expect(outboxHoldsEverything([markSent(clockIn(), {}, at(9, 42))], at(9, 43))).toBe(false)
    expect(outboxHoldsEverything(waiting, appTzWallTimeMs('2026-10-30', 6, 30))).toBe(false)
  })

  it('the lead names the press and the moment it was pressed', () => {
    expect(pressLead(note())).toBe(`Job note from ${fmt(at(8, 12))}`)
    expect(pressLead(clockIn(), () => '7:58')).toBe('Clock in from 7:58')
  })
})

describe('outbox · the list behind the bar', () => {
  it('sorts each press into Needs you, Waiting or Sent today with its words', () => {
    const presses = [
      markRefused(clockIn(), { message: 'The office closed that session.', code: 'P0001' }),
      markTryFailed(markSending(note(), at(8, 12)), at(8, 12)),
      markSending(clockOut({ seq: 4 }), at(9, 42)),
      markSent(note({ id: 'n2', seq: 3, pressedAt: at(8, 30) }), {}, at(9, 41)),
    ]
    const fmt = formatDenverTimeOnly
    const sections = outboxDoorSections(presses, at(9, 42))
    expect(sections.needsYou).toEqual([
      { id: 'p-in', state: 'needs-you', kind: 'Clock in', about: 'Ridgeway Builders', pressed: `pressed ${fmt(T_PRESS)}`, status: 'could not be sent', reason: 'The office closed that session.', door: '/dashboard', canSendNow: false, canDrop: true },
    ])
    expect(sections.waiting.map((r) => [r.id, r.state, r.status, r.canSendNow, r.canDrop])).toEqual([
      ['p-note', 'waiting', `waiting to send, last tried ${fmt(at(8, 12))}`, true, true],
      ['p-out', 'sending', 'sending…', false, false],
    ])
    expect(sections.sentToday.map((r) => [r.id, r.status])).toEqual([['n2', `sent ${fmt(at(9, 41))}`]])
  })

  it('a press that waited past the morning is under Needs you with Send now and Drop it', () => {
    const sections = outboxDoorSections([clockIn()], appTzWallTimeMs('2026-10-30', 6, 30))
    expect(sections.needsYou[0]?.status).toBe('waiting since yesterday')
    expect(sections.needsYou[0]?.canSendNow).toBe(true)
    expect(sections.needsYou[0]?.canDrop).toBe(true)
    expect(sections.waiting).toEqual([])
  })

  it('Sent today reads newest first', () => {
    const sections = outboxDoorSections([markSent(clockIn(), {}, at(9, 42)), markSent(note(), {}, at(9, 43))], at(9, 50))
    expect(sections.sentToday.map((r) => r.id)).toEqual(['p-note', 'p-in'])
  })
})

// Punch list #229, PR 6: the photos riding with a kept report, on the bar.
describe('the photos on the bar', () => {
  const T0 = 1_780_000_000_000
  const photo = (id: string, sent = false) => ({ id, sent, fixtureId: null, stageName: null, caption: 'Photo', questionId: null, questionWords: null, takenAt: '2026-11-01T13:00:00Z', bytes: 1, originalBytes: 1, width: 1, height: 1, byName: '' })
  const withPhotos = (id: string, n: number, seq: number) =>
    newPress({ id, seq, kind: 'field-report', userId: 'u1', pressedAt: T0, payload: { templateId: 't', fieldValues: {}, jobLedgerId: 'j1', projectId: null, bidId: null, lat: null, lng: null, photos: Array.from({ length: n }, (_, i) => photo(`${id}-${i}`, i === 0)) } })
  const plain = newPress({ id: 'p-note', seq: 9, kind: 'job-note', userId: 'u1', pressedAt: T0, payload: { jobId: 'j1', body: 'x' } })

  it('counts every photo on a waiting or sending report, and none on a note or a landed one', () => {
    expect(keptPhotoCount([withPhotos('a', 2, 1), plain])).toBe(2)
    expect(keptPhotoCount([{ ...withPhotos('a', 2, 1), state: 'sent' }])).toBe(0)
    expect(keptPhotoCount([plain])).toBe(0)
  })

  it('reads one photo with it, several with them, and nothing with none', () => {
    expect(photosWaitingLine([withPhotos('a', 1, 1)])).toEqual(['1 photo with it'])
    expect(photosWaitingLine([withPhotos('a', 2, 1)])).toEqual(['2 photos with it'])
    expect(photosWaitingLine([withPhotos('a', 1, 1), withPhotos('b', 2, 2)])).toEqual(['3 photos with them'])
    expect(photosWaitingLine([plain])).toEqual([])
    const words = outboxBarWords([withPhotos('a', 2, 1)], T0 + 1_000)
    expect(words?.lines[0]).toBe(WAITING_WORDS)
    expect(words?.lines[1]).toBe('2 photos with it')
  })
})
