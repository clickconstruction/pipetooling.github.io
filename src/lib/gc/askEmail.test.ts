import { describe, expect, it, vi } from 'vitest'
import { ASK_EMAILED_NOTE, ASK_NOT_SENT_NOTE, inviteAsks, inviteEmailRequest, type NewAsk } from './askEmail'
import { boardStateFromRows } from './boardRows'
import { clinicBoardRows } from './boardTestRows'
import { GC_TRADE_EMAIL_REFUSALS, type TradeEmailAnswer } from './tradeEmail'

const ask = (inviteId: string, companyId: string): NewAsk => ({ inviteId, companyId })
const sent = (already = false): TradeEmailAnswer => ({ ok: true, companyId: 'x', messageId: 'm', emailSendLogId: null, to: ['Ray Ortiz'], already })

describe('the Ask window’s emails (B4-a on P3)', () => {
  it('draws a new ask’s invitation as the window draws it, keyed so a repeat sends nothing', () => {
    const state = boardStateFromRows(clinicBoardRows())
    const req = inviteEmailRequest(state, 'p1', 'k2', ask('n9', 'lonestar'), 'en')!
    expect(req).toMatchObject({ companyId: 'lonestar', kind: 'invite', key: 'n9:invite', projectId: 'p1', lang: 'en' })
    expect(req.subject).toMatch(/Hill Country Clinic/)
    // The lines the quote should cover ride as a list, after the words.
    expect(req.lines).toContainEqual({ items: ['Foundations'] })
    expect(req.lines.every((l) => typeof l === 'string' || 'items' in l)).toBe(true)
    expect(inviteEmailRequest(state, 'p1', 'gone', ask('n9', 'lonestar'), 'en')).toBeNull()
    expect(inviteEmailRequest(state, 'p1', 'k2', ask('n9', 'nobody'), 'en')).toBeNull()
  })

  it('a dev’s press: emailed reads Invitation emailed, a repeat leaves no second line, a refusal leaves its words', async () => {
    const send = vi.fn((a: NewAsk): Promise<TradeEmailAnswer> =>
      Promise.resolve(a.companyId === 'a' ? sent() : a.companyId === 'b' ? sent(true) : { ok: false, key: 'noEmail', detail: null }),
    )
    const { outcomes, lines } = await inviteAsks([ask('1', 'a'), ask('2', 'b'), ask('3', 'c')], send)
    expect(send).toHaveBeenCalledTimes(3)
    expect(outcomes.map((o) => [o.companyId, o.sent, o.words])).toEqual([
      ['a', true, null],
      ['b', true, null],
      ['c', false, GC_TRADE_EMAIL_REFUSALS.noEmail],
    ])
    expect(lines).toEqual([
      { inviteId: '1', companyId: 'a', how: 'email', note: ASK_EMAILED_NOTE },
      { inviteId: '3', companyId: 'c', how: 'note', note: GC_TRADE_EMAIL_REFUSALS.noEmail },
    ])
  })

  it('anyone who cannot send yet saves the asks, each with the note that a dev sends it', async () => {
    const { outcomes, lines } = await inviteAsks([ask('1', 'a')], null)
    expect(outcomes).toEqual([{ inviteId: '1', companyId: 'a', sent: false, words: null }])
    expect(lines).toEqual([{ inviteId: '1', companyId: 'a', how: 'note', note: ASK_NOT_SENT_NOTE }])
  })
})
