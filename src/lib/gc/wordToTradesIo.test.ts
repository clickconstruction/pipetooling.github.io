/**
 * Punch list #205 (./wordToTradesIo.ts): the press behind Word to every trade. One call per company through
 * `gc-trade-email`, each asking for one email a person; a company refused is named and the rest still go; a person the
 * mail service refused is named under a company the word reached; a second press reaches only who was owed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initialGcState } from './schedule/testState'
import { GC_TRADE_EMAIL_REFUSALS } from './tradeEmail'
import { sendGcTradeEmail } from './tradeEmailIo'
import { wordEmailKey, wordRecipients } from './wordToTrades'
import { sendWordToTrades } from './wordToTradesIo'

vi.mock('./tradeEmailIo', () => ({ sendGcTradeEmail: vi.fn() }))

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const three = wordRecipients(s, fairOaks).slice(0, 3)
const SUBJECT = 'A word from Click on Fair Oaks Shops, Building D'
const TEXT = 'The site is closed Friday for the pour.'
const went = (companyId: string, more: { already?: boolean; emails?: number; held?: { name: string; reason: string }[] } = {}) => ({ ok: true as const, companyId, messageId: `m-${companyId}`, emailSendLogId: null, to: ['Dana Ortiz'], already: false, ...more })

beforeEach(() => {
  vi.mocked(sendGcTradeEmail).mockReset()
})

describe('sendWordToTrades: one email a person, and every company its own outcome', () => {
  it('asks each company once for one email a person, under one key for the words', async () => {
    vi.mocked(sendGcTradeEmail).mockImplementation((req) => Promise.resolve(went(req.companyId, { emails: 1, held: [] })))
    const out = await sendWordToTrades(fairOaks, three, `  ${SUBJECT} `, TEXT)
    const key = await wordEmailKey(fairOaks.id, `  ${SUBJECT} `, TEXT)
    expect(vi.mocked(sendGcTradeEmail).mock.calls.map(([req]) => req)).toEqual(
      three.map((r) => ({ companyId: r.partner.id, kind: 'nudge', groups: ['job'], key, projectId: fairOaks.id, lang: 'en', subject: SUBJECT, lines: [TEXT], eachAlone: true })),
    )
    expect(out).toEqual({ sent: three.map((r) => ({ companyId: r.partner.id, company: r.partner.company })), already: [], refused: [], held: [], emails: 3 })
  })

  it('keeps going past a company that is refused, and names a person the mail service refused under a company it reached', async () => {
    const [a, b, c] = three
    vi.mocked(sendGcTradeEmail)
      // The one message was refused: two went alone and one person was held.
      .mockResolvedValueOnce(went(a!.partner.id, { emails: 2, held: [{ name: 'Marcus Hale', reason: 'Invalid `to` field.' }] }))
      .mockResolvedValueOnce({ ok: false, key: 'noEmail', detail: null })
      .mockResolvedValueOnce(went(c!.partner.id, { emails: 1, held: [] }))
    const out = await sendWordToTrades(fairOaks, three, SUBJECT, TEXT)
    expect(out.sent.map((x) => x.companyId)).toEqual([a!.partner.id, c!.partner.id])
    expect(out.refused).toEqual([{ companyId: b!.partner.id, company: b!.partner.company, words: GC_TRADE_EMAIL_REFUSALS.noEmail }])
    expect(out.held).toEqual([{ companyId: a!.partner.id, company: a!.partner.company, name: 'Marcus Hale', words: 'The email did not go out. The mail service said: Invalid `to` field.' }])
    expect(out.emails).toBe(3)
  })

  it('on a second press counts a company as sent to only when someone owed was reached, and names one still held', async () => {
    const [a, b, c] = three
    vi.mocked(sendGcTradeEmail)
      // The address was mended: the one who was held gets it alone.
      .mockResolvedValueOnce(went(a!.partner.id, { already: true, emails: 1, held: [] }))
      // Everyone had it.
      .mockResolvedValueOnce(went(b!.partner.id, { already: true, emails: 0, held: [] }))
      // The one owed was refused again.
      .mockResolvedValueOnce(went(c!.partner.id, { already: true, emails: 0, held: [{ name: 'Ana Reyes', reason: 'Invalid `to` field.' }] }))
    const out = await sendWordToTrades(fairOaks, three, SUBJECT, TEXT)
    expect(out.sent.map((x) => x.companyId)).toEqual([a!.partner.id])
    expect(out.already.map((x) => x.companyId)).toEqual([b!.partner.id, c!.partner.id])
    expect(out.held.map((h) => [h.companyId, h.name])).toEqual([[c!.partner.id, 'Ana Reyes']])
    expect(out.emails).toBe(1)
  })

  it('reads an answer of the function as it was before: one email for a send, none for a key sent before', async () => {
    const [a, b] = three
    vi.mocked(sendGcTradeEmail).mockResolvedValueOnce(went(a!.partner.id)).mockResolvedValueOnce(went(b!.partner.id, { already: true }))
    const out = await sendWordToTrades(fairOaks, three.slice(0, 2), SUBJECT, TEXT)
    expect(out).toMatchObject({ sent: [{ companyId: a!.partner.id }], already: [{ companyId: b!.partner.id }], held: [], emails: 1 })
  })
})
