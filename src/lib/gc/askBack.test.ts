import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ASK_BACK_CONFIRM, ASK_BACK_PRESS, askBackConfirmWords, askBackHold, canTakeAskBack } from './askBack'
import type { Invite } from './types'

/** An ask just made, with no email sent: nothing has reached the company. */
function fresh(over: Partial<Invite> = {}): Invite {
  return { id: 'i9', partnerId: 'zz', status: 'invited', invitedOn: '2026-11-20', seenRev: null, bid: null, ...over }
}
const pkg = { awardedInviteId: null }

describe('askBackHold · v2.8440', () => {
  it('an ask the company has not heard about may go', () => {
    expect(askBackHold(fresh(), pkg)).toBeNull()
    expect(canTakeAskBack(fresh(), pkg)).toBe(true)
  })

  it('each thing that stands on it, or that they heard, holds it with its words, the heaviest first', () => {
    const quote = { amount: 58000, basedOnRev: 0, submittedOn: '2026-11-21', includes: {}, plugs: {}, note: '' }
    expect(askBackHold(fresh({ bid: quote, status: 'bid' }), { awardedInviteId: 'i9' })).toBe('The trade is awarded to them.')
    expect(askBackHold(fresh({ bid: quote, status: 'bid' }), pkg)).toBe('They sent a quote.')
    expect(askBackHold(fresh({ status: 'declined' }), pkg)).toBe('They already passed on it.')
    expect(askBackHold(fresh({ status: 'opened' }), pkg)).toBe('They opened it in their portal.')
    expect(askBackHold(fresh({ seenRev: 0 }), pkg)).toBe('They opened it in their portal.')
    expect(askBackHold(fresh({ contacts: [{ on: '2026-11-21', by: 'Rosa', how: 'email', note: 'Invitation emailed.' }] }), pkg)).toBe('A contact with them is logged on it.')
    expect(canTakeAskBack(fresh({ status: 'opened' }), pkg)).toBe(false)
  })

  it('another ask awarded on the trade does not hold this one', () => {
    expect(askBackHold(fresh(), { awardedInviteId: 'i1' })).toBeNull()
  })
})

describe('askBackConfirmWords', () => {
  it('says why it may go and what goes, and the button names the act', () => {
    const words = askBackConfirmWords('ZZ Test trade no page, delete me', 'Electrical')
    expect(words.title).toBe('Take the Electrical ask back from ZZ Test trade no page, delete me?')
    expect(words.message).toBe(
      'ZZ Test trade no page, delete me has not opened this ask, sent a quote or heard from us about it. The ask is deleted, and they read as never asked on Electrical. You can ask them again.',
    )
    expect(words.confirmLabel).toBe(ASK_BACK_CONFIRM)
    expect(ASK_BACK_CONFIRM).toBe('Take the ask back')
    expect(ASK_BACK_PRESS).toBe('Take the ask back…')
  })
})

describe('the server holds the same rule, and more · gc_take_ask_back', () => {
  const sql = readFileSync('supabase/migrations/20261124050000_gc_take_ask_back.sql', 'utf8')
  const bed = readFileSync('supabase/tests/gc_take_ask_back/20_scenario.sql', 'utf8')

  it('every refusal the function words is played in the bed', () => {
    const holds = [...sql.matchAll(/THEN '([^']+(?:''[^']*)*)'/g)].map((m) => m[1]!.replace(/''/g, "'").trim())
    expect(holds.length).toBe(7)
    for (const hold of holds) expect(bed.replace(/''/g, "'"), hold).toContain(hold)
  })

  it('writes its trace before the ask goes, and leaves the bench rule alone', () => {
    expect(sql.indexOf('INSERT INTO public.gc_asks_taken_back')).toBeLessThan(sql.indexOf('DELETE FROM public.gc_invites'))
    expect(sql).not.toContain('FUNCTION public.gc_remove_bench_company')
  })

  it('closes with the four fence calls, since it makes a table', () => {
    for (const fence of ['apply_read_only_write_blocks', 'apply_read_only_stmt_blocks', 'apply_digital_twin_write_blocks', 'apply_archived_read_blocks']) expect(sql).toContain(`SELECT public.${fence}();`)
  })
})
