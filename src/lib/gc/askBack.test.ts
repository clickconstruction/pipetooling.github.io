import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ASK_BACK_CONFIRM, ASK_BACK_HEARD_TITLE, ASK_BACK_PRESS, ASK_BACK_PRESS_TITLE, askBackConfirmWords, askBackHold, askBackPressTitle, askHeard, canTakeAskBack } from './askBack'
import type { Invite } from './types'

/** An ask just made, with no email sent: nothing has reached the company. */
function fresh(over: Partial<Invite> = {}): Invite {
  return { id: 'i9', partnerId: 'zz', status: 'invited', invitedOn: '2026-11-20', seenRev: null, bid: null, ...over }
}
const pkg = { awardedInviteId: null }
const emailed = { on: '2026-11-21', by: 'Rosa', how: 'email' as const, note: 'Invitation emailed.' }

describe('askBackHold · v2.8440, v2.8490', () => {
  it('an ask still open may be taken back, heard about or not', () => {
    for (const ask of [fresh(), fresh({ status: 'opened' }), fresh({ seenRev: 0 }), fresh({ contacts: [emailed] })]) {
      expect(askBackHold(ask, pkg)).toBeNull()
      expect(canTakeAskBack(ask, pkg)).toBe(true)
    }
  })

  it('what stands on it, or its own close, holds it with its words, the heaviest first', () => {
    const quote = { amount: 58000, basedOnRev: 0, submittedOn: '2026-11-21', includes: {}, plugs: {}, note: '' }
    expect(askBackHold(fresh({ bid: quote, status: 'bid' }), { awardedInviteId: 'i9' })).toBe('The trade is awarded to them.')
    expect(askBackHold(fresh({ bid: quote, status: 'bid' }), pkg)).toBe('They sent a quote.')
    expect(askBackHold(fresh({ status: 'declined' }), pkg)).toBe('They already passed on it.')
    expect(askBackHold(fresh({ status: 'declined', declinedWhy: 'cant' }), pkg)).toBe('They already passed on it.')
    expect(askBackHold(fresh({ status: 'declined', declinedWhy: 'withdrawn' }), pkg)).toBe('We already took it back.')
    expect(canTakeAskBack(fresh({ status: 'declined', declinedWhy: 'withdrawn' }), pkg)).toBe(false)
  })

  it('another ask awarded on the trade does not hold this one', () => {
    expect(askBackHold(fresh(), { awardedInviteId: 'i1' })).toBeNull()
  })
})

describe('askHeard · v2.8490', () => {
  it('says what the company heard, the portal first, and nothing for an ask that reached nobody', () => {
    expect(askHeard(fresh())).toBeNull()
    expect(askHeard(fresh({ status: 'opened' }))).toBe('opened this ask in their portal')
    expect(askHeard(fresh({ seenRev: 0 }))).toBe('opened this ask in their portal')
    expect(askHeard(fresh({ contacts: [emailed] }))).toBe('heard from us about this ask')
    expect(askHeard(fresh({ status: 'opened', contacts: [emailed] }))).toBe('opened this ask in their portal')
  })

  it('the press says on its hover which of the two it does', () => {
    expect(askBackPressTitle(fresh())).toBe(ASK_BACK_PRESS_TITLE)
    expect(askBackPressTitle(fresh({ status: 'opened' }))).toBe(ASK_BACK_HEARD_TITLE)
  })
})

describe('askBackConfirmWords', () => {
  it('for an ask nobody heard about: why it may go and what goes, and the button names the act', () => {
    const words = askBackConfirmWords('ZZ Test trade no page, delete me', 'Electrical')
    expect(words.title).toBe('Take the Electrical ask back from ZZ Test trade no page, delete me?')
    expect(words.message).toBe(
      'ZZ Test trade no page, delete me has not opened this ask, sent a quote or heard from us about it. The ask is deleted, and they read as never asked on Electrical. You can ask them again.',
    )
    expect(words.confirmLabel).toBe(ASK_BACK_CONFIRM)
    expect(ASK_BACK_CONFIRM).toBe('Take the ask back')
    expect(ASK_BACK_PRESS).toBe('Take the ask back…')
  })

  it('for an ask they heard about: what they heard, that it is kept and closes as ours, and that it stays closed', () => {
    const words = askBackConfirmWords('Hillside Excavation', 'Sitework', askHeard(fresh({ status: 'opened' })))
    expect(words.title).toBe('Take the Sitework ask back from Hillside Excavation?')
    expect(words.message).toBe(
      'Hillside Excavation opened this ask in their portal. So the ask is kept, and it closes as we took it back. Their portal says we took it back, and no email goes to them. A closed ask does not open again.',
    )
    expect(words.confirmLabel).toBe('Take the ask back')
    expect(askBackConfirmWords('Tejas Power', 'Electrical', askHeard(fresh({ contacts: [emailed] }))).message).toMatch(/^Tejas Power heard from us about this ask\. So the ask is kept/)
  })
})

describe('the server holds the same rule, and more · gc_take_ask_back', () => {
  const first = readFileSync('supabase/migrations/20261124050000_gc_take_ask_back.sql', 'utf8')
  const sql = readFileSync('supabase/migrations/20261124100000_gc_ask_taken_back_answer.sql', 'utf8')
  const bed = readFileSync('supabase/tests/gc_take_ask_back/20_scenario.sql', 'utf8')
  const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.gc_take_ask_back'), sql.indexOf('COMMENT ON FUNCTION public.gc_take_ask_back'))

  it('every refusal and every way of having heard that the function words is played in the bed', () => {
    const said = [...fn.matchAll(/THEN\s+'([^']+(?:''[^']*)*)'/g)].map((m) => m[1]!.replace(/''/g, "'").trim()).filter((words) => words !== 'by')
    // Four refusals, three ways of having heard. (The trace's "by" joins a name and is no sentence.)
    expect(said.length).toBe(7)
    for (const words of said) expect(bed.replace(/''/g, "'"), words).toContain(words)
    expect(bed).toContain('is already taken back.')
  })

  it('deletes only an ask nobody heard about, with its trace written first, and closes the rest as ours', () => {
    const heard = fn.indexOf('IF v_heard IS NULL THEN')
    const ledger = fn.indexOf('INSERT INTO public.gc_asks_taken_back')
    const gone = fn.indexOf('DELETE FROM public.gc_invites')
    const left = fn.indexOf('RETURN;')
    const closed = fn.indexOf("SET status = 'declined', declined_why = 'withdrawn'")
    expect(heard).toBeGreaterThan(0)
    expect(ledger).toBeGreaterThan(heard)
    expect(gone).toBeGreaterThan(ledger)
    expect(left).toBeGreaterThan(gone)
    expect(closed).toBeGreaterThan(left)
    expect(fn.match(/DELETE FROM/g)?.length).toBe(1)
  })

  it('takes the answer on the ask, tells the trade in its own key, and leaves the bench rule alone', () => {
    expect(sql).toContain("CHECK (declined_why IS NULL OR declined_why IN ('wont', 'cant', 'withdrawn'))")
    expect(sql.indexOf("RAISE EXCEPTION 'tookBack'")).toBeLessThan(sql.indexOf("RAISE EXCEPTION 'youPassed'"))
    expect(sql).not.toContain('FUNCTION public.gc_remove_bench_company')
    expect(sql).not.toContain('CREATE TABLE')
  })

  it('the first migration closes with the four fence calls, since it makes the table', () => {
    for (const fence of ['apply_read_only_write_blocks', 'apply_read_only_stmt_blocks', 'apply_digital_twin_write_blocks', 'apply_archived_read_blocks']) expect(first).toContain(`SELECT public.${fence}();`)
  })
})
