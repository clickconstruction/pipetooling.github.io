/**
 * Texts paused for the phone balance: Quo's refusals as its API reference documents them (version 2026-03-30, `POST
 * /v1/messages`), the row both ways, and the time rule that keeps a slow answer for an older text from undoing a newer
 * one. Times are Chicago's: Monday, October 12, 2026 is today.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  QUO_PAUSED_KEY,
  TEXTS_DAILY_CAP,
  TEXTS_NOT_REGISTERED,
  TEXTS_PAUSED,
  nextPause,
  notePause,
  pauseText,
  pausedLine,
  pausedSince,
  readPause,
  readQuoRefusal,
  type PauseStore,
  type QuoPause,
} from './paused'

const T1 = '2026-10-12T14:00:00.000Z'
const T2 = '2026-10-12T14:05:00.000Z'
const T3 = '2026-10-12T14:10:00.000Z'
const T4 = '2026-10-12T14:15:00.000Z'

const paused = (since: string, at = since): QuoPause => ({ since, reason: 'balance', at })
const going = (at: string): QuoPause => ({ since: null, reason: null, at })

describe('Quo turning a text away', () => {
  it('reads the documented refusals by their codes', () => {
    expect(readQuoRefusal(402, { message: 'Your subscription has expired', code: '0201402', status: 402, title: 'Subscription Expired' })).toEqual({
      refused: 'paused',
      words: TEXTS_PAUSED,
      status: 402,
      why: '402 0201402 Subscription Expired',
    })
    expect(readQuoRefusal(400, { message: 'A2P registration is not approved', code: '0206400', status: 400, title: 'A2P Registration Not Approved' })).toEqual({
      refused: 'not-registered',
      words: TEXTS_NOT_REGISTERED,
      status: 503,
      why: '400 0206400 A2P Registration Not Approved',
    })
    expect(
      readQuoRefusal(403, {
        message: 'A2P 10DLC Daily limit reached. For help increasing this limit, visit https://support.quo.com/help/submit-a-request',
        code: '0204403',
        status: 403,
        title: 'A2P 10DLC Daily Message Cap Reached',
      }),
    ).toEqual({ refused: 'daily-cap', words: TEXTS_DAILY_CAP, status: 429, why: '403 0204403 A2P 10DLC Daily Message Cap Reached' })
  })

  it('reads any 402, and a refusal whose words name money, as paused', () => {
    expect(readQuoRefusal(402, null).refused).toBe('paused')
    expect(readQuoRefusal(403, { title: 'Insufficient Funds', message: 'Add funds to keep sending.' }).refused).toBe('paused')
    expect(readQuoRefusal(400, { title: 'Bad Request', errors: [{ path: '/content', message: 'Your balance is too low to send this message' }] }).refused).toBe('paused')
    expect(readQuoRefusal(403, { error: { title: 'Out of credits' } }).refused).toBe('paused')
  })

  it('never reads a permission or a key as paused, so nobody tops up a funded balance', () => {
    expect(readQuoRefusal(403, { title: 'Forbidden', message: 'Insufficient permissions or an account setting is not enabled' })).toEqual({
      refused: 'quo',
      words: 'Quo did not take the text. It answered 403.',
      status: 502,
      why: '403 Forbidden',
    })
    expect(readQuoRefusal(401, { message: 'Unauthorized', code: '0200401', status: 401, title: 'Unauthorized' }).refused).toBe('quo')
    expect(readQuoRefusal(500, { message: 'Unknown', code: '0201500', status: 500, title: 'Unknown' }).refused).toBe('quo')
    expect(readQuoRefusal(500, 'not json')).toEqual({ refused: 'quo', words: 'Quo did not take the text. It answered 500.', status: 502, why: '500' })
  })
})

describe('the pause row', () => {
  it('reads its own words back, and nothing from words that are not a row', () => {
    expect(QUO_PAUSED_KEY).toBe('messages_quo_paused_v1')
    expect(readPause(pauseText(paused(T1, T2)))).toEqual(paused(T1, T2))
    expect(readPause(pauseText(going(T3)))).toEqual(going(T3))
    expect(readPause(null)).toBeNull()
    expect(readPause(undefined)).toBeNull()
    expect(readPause('')).toBeNull()
    expect(readPause('not json')).toBeNull()
    expect(readPause('["x"]')).toBeNull()
    expect(readPause('{"since": "soon"}')).toBeNull()
  })

  it('reads a row written by hand with no time of its own as decided when it paused', () => {
    expect(readPause(`{"since": "${T1}"}`)).toEqual(paused(T1))
    expect(pausedSince(readPause(`{"since": "${T1}"}`))).toBe(T1)
    expect(pausedSince(readPause(pauseText(going(T3))))).toBeNull()
    expect(pausedSince(null)).toBeNull()
  })
})

describe('a text’s word on the pause', () => {
  it('pauses on a refusal, and keeps the first refusal’s day through the later ones', () => {
    expect(nextPause(null, { kind: 'pause', at: T1 })).toEqual(paused(T1))
    expect(nextPause(going(T1), { kind: 'pause', at: T2 })).toEqual(paused(T2))
    expect(nextPause(paused(T1), { kind: 'pause', at: T2 })).toEqual(paused(T1, T2))
  })

  it('ends the pause on the next text Quo takes, and writes nothing while nothing is paused', () => {
    expect(nextPause(paused(T1, T2), { kind: 'go', at: T3 })).toEqual(going(T3))
    expect(nextPause(null, { kind: 'go', at: T3 })).toBeNull()
    expect(nextPause(going(T1), { kind: 'go', at: T3 })).toBeNull()
  })

  it('lets no word about an older text undo a newer one, either way', () => {
    // A text sent before the newest refusal, taken late, leaves texts paused.
    expect(nextPause(paused(T1, T3), { kind: 'go', at: T2 })).toBeNull()
    // A refusal for a text sent before the take that ended the pause does not pause them again.
    expect(nextPause(going(T3), { kind: 'pause', at: T2 })).toBeNull()
    // The same text twice changes nothing, and neither does a word with no time.
    expect(nextPause(paused(T1, T2), { kind: 'pause', at: T2 })).toBeNull()
    expect(nextPause(paused(T1), { kind: 'go', at: 'later' })).toBeNull()
  })
})

/** A row in memory. `meddle` writes as another function would, between our read and our write. */
function memoryStore(row: string | null | undefined, meddle: (() => string)[] = []) {
  const writes: string[] = []
  const store: PauseStore = {
    read: async () => row,
    write: async (prev, next) => {
      const other = meddle.shift()
      if (other !== undefined) row = other()
      if (row !== prev) return false
      row = next
      writes.push(next)
      return true
    },
  }
  return { store, writes, row: () => row }
}

describe('writing a word on the pause', () => {
  it('writes the first refusal where there is no row yet', async () => {
    const m = memoryStore(undefined)
    expect(await notePause(m.store, { kind: 'pause', at: T1 })).toBe('wrote')
    expect(readPause(m.row())).toEqual(paused(T1))
  })

  it('reads the row again when another text changed it meanwhile, and leaves a newer refusal standing', async () => {
    const m = memoryStore(pauseText(paused(T1)), [() => pauseText(paused(T1, T4))])
    expect(await notePause(m.store, { kind: 'go', at: T3 })).toBe('unchanged')
    expect(readPause(m.row())).toEqual(paused(T1, T4))
    expect(m.writes).toEqual([])
  })

  it('ends the pause over a refusal for an older text that landed meanwhile', async () => {
    const m = memoryStore(pauseText(paused(T1)), [() => pauseText(paused(T1, T2))])
    expect(await notePause(m.store, { kind: 'go', at: T3 })).toBe('wrote')
    expect(readPause(m.row())).toEqual(going(T3))
  })

  it('drops the word when the row keeps changing', async () => {
    let n = 0
    const m = memoryStore(pauseText(paused(T1)), [0, 1, 2].map(() => () => pauseText(paused(T1, `2026-10-12T14:0${n++}:30.000Z`))))
    expect(await notePause(m.store, { kind: 'go', at: T3 })).toBe('kept-changing')
  })
})

describe('the words', () => {
  it('say since when texts are paused, in Chicago’s days', () => {
    expect(pausedLine(T1, '2026-10-12T22:00:00.000Z')).toBe('Texts are paused since today. Top up the phone balance.')
    expect(pausedLine('2026-10-11T15:00:00.000Z', T1)).toBe('Texts are paused since yesterday. Top up the phone balance.')
    expect(pausedLine('2026-10-08T03:30:00.000Z', T1)).toBe('Texts are paused since Wed, Oct 7. Top up the phone balance.')
  })

  it('are plain words', () => {
    const all = [
      TEXTS_PAUSED,
      TEXTS_NOT_REGISTERED,
      TEXTS_DAILY_CAP,
      readQuoRefusal(500, null).words,
      pausedLine(T1, T1),
      pausedLine('2026-10-07T15:00:00.000Z', T1),
    ]
    expect(all.flatMap(plainWordsFailures)).toEqual([])
  })
})
