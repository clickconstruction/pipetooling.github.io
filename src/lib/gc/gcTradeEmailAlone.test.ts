/**
 * Punch list #205: one email a person when the mail service refuses the one message. The kernel `gc-trade-email` sends
 * through, on a sender that says yes or no by address: the one message first, each person alone after a refusal, who is
 * held and why, who is owed on a second press, and the function's own steps read from its source.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  readEachAlone,
  sendTradeEmailToReach,
  TRADE_HELD_NO_REASON,
  TRADE_HELD_REASON_MAX,
  tradeEmailOwed,
  tradeHeldName,
  tradeHeldReason,
  tradeMailsReached,
  tradeNamesWith,
  type TradeReachPerson,
  type TradeSendAnswer,
} from '../../../supabase/functions/_shared/gcTradeEmailAlone'

const dana: TradeReachPerson = { name: 'Dana Ortiz', email: 'dana@summit.example' }
const marcus: TradeReachPerson = { name: 'Marcus Hale', email: 'marcus@summit.invalid' }
const ana: TradeReachPerson = { name: 'Ana Reyes', email: 'ana@summit.example' }

const REFUSED = 'Invalid `to` field. Please use our testing email address instead of domains like `example.com`.'

/** A mail service that refuses any message with a `.invalid` address on it, and counts every message it is handed. */
function service(refuses: (address: string) => boolean = (a) => a.endsWith('.invalid')) {
  let n = 0
  const send = vi.fn((to: TradeReachPerson, cc: TradeReachPerson[]): Promise<TradeSendAnswer> => {
    const bad = [to, ...cc].some((p) => refuses(p.email))
    return Promise.resolve(bad ? { success: false, error: REFUSED } : { success: true, resendEmailId: `re-${++n}` })
  })
  return send
}

describe('readEachAlone: the request asks for one email a person, or does not', () => {
  it('is false unless the body says true, and null for anything that is not a yes or a no', () => {
    expect(readEachAlone({ companyId: 'c' })).toBe(false)
    expect(readEachAlone({ eachAlone: false })).toBe(false)
    expect(readEachAlone({ eachAlone: true })).toBe(true)
    expect(readEachAlone({ eachAlone: 'true' })).toBeNull()
    expect(readEachAlone({ eachAlone: 1 })).toBeNull()
    expect(readEachAlone({ eachAlone: null })).toBeNull()
    expect(readEachAlone(null)).toBe(false)
    expect(readEachAlone(['eachAlone'])).toBe(false)
  })
})

describe('sendTradeEmailToReach: the one message first, each person alone after a refusal', () => {
  it('sends one message, the first person on To and the rest on CC, when the service takes it', async () => {
    const send = service()
    const out = await sendTradeEmailToReach({ reach: [dana, ana], eachAlone: true, send })
    expect(out).toEqual({ went: true, mails: [{ to: dana, cc: [ana], resendEmailId: 're-1' }], held: [] })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('refuses the whole send, as before, for a caller that did not ask for one email a person', async () => {
    const send = service()
    const out = await sendTradeEmailToReach({ reach: [dana, marcus, ana], eachAlone: false, send })
    expect(out).toEqual({ went: false, reason: REFUSED, held: [] })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('sends each person alone after a refusal, keeps going past the one refused, and names that one with the reason', async () => {
    const send = service()
    const pause = vi.fn(() => Promise.resolve())
    const out = await sendTradeEmailToReach({ reach: [dana, marcus, ana], eachAlone: true, send, pause })
    expect(out).toEqual({
      went: true,
      mails: [
        { to: dana, cc: [], resendEmailId: 're-1' },
        { to: ana, cc: [], resendEmailId: 're-2' },
      ],
      held: [{ name: 'Marcus Hale', reason: REFUSED }],
    })
    // The one message, then three alone, in the people's order, with a pause before each one alone.
    expect(send.mock.calls.map(([to, cc]) => [to.email, cc.length])).toEqual([
      ['dana@summit.example', 2],
      ['dana@summit.example', 0],
      ['marcus@summit.invalid', 0],
      ['ana@summit.example', 0],
    ])
    expect(pause).toHaveBeenCalledTimes(3)
    if (out.went) expect(tradeMailsReached(out.mails)).toEqual([dana, ana])
  })

  it('refuses with the reason of the one message when nobody goes alone either, and still names each one held', async () => {
    const send = service(() => true)
    const out = await sendTradeEmailToReach({ reach: [dana, marcus], eachAlone: true, send })
    expect(out).toEqual({
      went: false,
      reason: REFUSED,
      held: [
        { name: 'Dana Ortiz', reason: REFUSED },
        { name: 'Marcus Hale', reason: REFUSED },
      ],
    })
  })

  it('does not try one person twice: with nobody else at the company the refusal stands', async () => {
    const send = service()
    const out = await sendTradeEmailToReach({ reach: [marcus], eachAlone: true, send })
    expect(out).toEqual({ went: false, reason: REFUSED, held: [] })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('holds a person whose send throws and still sends to the next', async () => {
    const send = vi.fn((to: TradeReachPerson, cc: TradeReachPerson[]): Promise<TradeSendAnswer> => {
      if (cc.length > 0) return Promise.resolve({ success: false, error: REFUSED })
      if (to.email === dana.email) return Promise.reject(new Error('The connection dropped'))
      return Promise.resolve({ success: true })
    })
    const out = await sendTradeEmailToReach({ reach: [dana, ana], eachAlone: true, send })
    expect(out).toEqual({ went: true, mails: [{ to: ana, cc: [], resendEmailId: null }], held: [{ name: 'Dana Ortiz', reason: 'The connection dropped' }] })
  })

  it('a second press sends each person owed alone, with no message to all of them first', async () => {
    const send = service()
    const out = await sendTradeEmailToReach({ reach: [marcus, ana], eachAlone: true, aloneOnly: true, send })
    expect(out).toEqual({ went: true, mails: [{ to: ana, cc: [], resendEmailId: 're-1' }], held: [{ name: 'Marcus Hale', reason: REFUSED }] })
    expect(send.mock.calls.map(([to, cc]) => [to.email, cc.length])).toEqual([
      ['marcus@summit.invalid', 0],
      ['ana@summit.example', 0],
    ])
    // The one owed is refused again: nobody went, and the reason is that person's.
    expect(await sendTradeEmailToReach({ reach: [marcus], eachAlone: true, aloneOnly: true, send })).toEqual({ went: false, reason: REFUSED, held: [{ name: 'Marcus Hale', reason: REFUSED }] })
  })

  it('reaches nobody on an empty list, which the function refuses before it gets here', async () => {
    const send = service()
    expect(await sendTradeEmailToReach({ reach: [], eachAlone: true, send })).toEqual({ went: false, reason: TRADE_HELD_NO_REASON, held: [] })
    expect(send).not.toHaveBeenCalled()
  })
})

describe('who is held, and who is owed on a second press', () => {
  it('says the reason on one line, cut at 200 characters, and never empty', () => {
    expect(tradeHeldReason('  Invalid\n `to`   field. ')).toBe('Invalid `to` field.')
    expect(tradeHeldReason(undefined)).toBe(TRADE_HELD_NO_REASON)
    expect(tradeHeldReason('   ')).toBe(TRADE_HELD_NO_REASON)
    expect(tradeHeldReason(new Error('The connection dropped'))).toBe('The connection dropped')
    const long = tradeHeldReason('x'.repeat(500))
    expect(long).toHaveLength(TRADE_HELD_REASON_MAX)
    expect(long.endsWith('…')).toBe(true)
  })

  it('lists a held person by name, and by address when the record has no name', () => {
    expect(tradeHeldName(marcus)).toBe('Marcus Hale')
    expect(tradeHeldName({ name: '  ', email: 'office@summit.example' })).toBe('office@summit.example')
  })

  it('owes the email to each person who is not on the row, whatever the case of the name', () => {
    expect(tradeEmailOwed([dana, marcus, ana], ['Dana Ortiz', 'ana reyes '])).toEqual([marcus])
    expect(tradeEmailOwed([dana, ana], ['Dana Ortiz', 'Ana Reyes'])).toEqual([])
    expect(tradeEmailOwed([dana, marcus], [])).toEqual([dana, marcus])
    // Two people of one name count as one: the row keeps names, so neither is sent to twice.
    expect(tradeEmailOwed([dana, { name: 'Dana Ortiz', email: 'dana.two@summit.example' }], ['Dana Ortiz'])).toEqual([])
  })

  it('adds each new name to the row once, after the ones before', () => {
    expect(tradeNamesWith(['Dana Ortiz', 'Ana Reyes'], ['Marcus Hale'])).toEqual(['Dana Ortiz', 'Ana Reyes', 'Marcus Hale'])
    expect(tradeNamesWith(['Dana Ortiz'], ['dana ortiz', 'Marcus Hale', 'Marcus Hale'])).toEqual(['Dana Ortiz', 'Marcus Hale'])
    expect(tradeNamesWith([], [])).toEqual([])
  })
})

describe('gc-trade-email: its own steps, read from its source', () => {
  const src = readFileSync(resolve(__dirname, '../../../supabase/functions/gc-trade-email/index.ts'), 'utf8')

  it('reads the flag off the body it parsed, and a flag that is not a yes or a no is a bad request', () => {
    expect(src).toMatch(/const eachAlone = readEachAlone\(body\)\s+if \(eachAlone === null\) return refuse\('badRequest'\)/)
  })

  it('answers a key sent before with nothing sent, unless the caller asked and someone is owed', () => {
    expect(src).toMatch(/if \(before && !eachAlone\) return json\(alreadyAnswer\(before\)\)/)
    expect(src).toMatch(/const owed = tradeEmailOwed\(reach, before\.to_names \?\? \[\]\)\s+if \(owed\.length === 0\) return json\(alreadyAnswer\(before\)\)/)
  })

  it('refuses a send only when nobody was reached, and says so in its log', () => {
    const refusals = src.match(/return refuse\('sendFailed'[^\n]*/g) ?? []
    // The test copy's, and the real send's when nobody went.
    expect(refusals).toHaveLength(2)
    expect(src).toMatch(/if \(!outcome\.went\) \{\s+console\.warn\(/)
  })

  it('writes the row from the people the emails reached, and files one sent copy for each email that went', () => {
    expect(src).toMatch(/const names = tradeMailsReached\(outcome\.mails\)\.map\(\(r\) => r\.name\)/)
    expect(src).toMatch(/to_names: names,/)
    expect(src).toMatch(/for \(const mail of outcome\.mails\) await fileCopy\(/)
  })
})
