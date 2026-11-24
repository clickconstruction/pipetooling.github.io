import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AWARD_BACK_CONFIRM, AWARD_BACK_PRESS, awardBackConfirmWords, awardBackHold, showsAwardBack } from './awardBack'
import type { Sow } from './types'

function sow(over: Partial<Sow> = {}): Sow {
  return { status: 'draft', price: 66500, retainagePct: 10, basedOnRev: 0, sov: [], signedOn: null, draws: [], ...over }
}

describe('awardBackHold · v2.8434', () => {
  it('a drafted statement of work is no hold, nor is an award with none', () => {
    expect(awardBackHold({ sow: sow() })).toBeNull()
    expect(awardBackHold({ sow: null })).toBeNull()
  })

  it('a sent one holds the press, saying nothing takes it back yet', () => {
    expect(awardBackHold({ sow: sow({ status: 'sent', sentOn: '2026-10-09' }) })).toBe('The statement of work went to them to sign. Nothing takes a sent one back yet.')
  })

  it('a signed one holds it, pointing at Change orders', () => {
    expect(awardBackHold({ sow: sow({ status: 'signed', signedOn: '2026-10-12' }) })).toBe('They signed the statement of work. A signed one changes through Change orders.')
  })
})

describe('showsAwardBack', () => {
  it('shows on an awarded trade for a reader who can award, and nowhere else', () => {
    expect(showsAwardBack({ awardedInviteId: 'i1' }, true)).toBe(true)
    expect(showsAwardBack({ awardedInviteId: 'i1' }, false)).toBe(false)
    expect(showsAwardBack({ awardedInviteId: null }, true)).toBe(false)
  })
})

describe('awardBackConfirmWords', () => {
  it('says what goes, what stays and what the company may have seen, and the button names the act', () => {
    const words = awardBackConfirmWords('Sitework', 'Lonestar Earthworks', { sow: sow() })
    expect(words.title).toBe('Take the Sitework award back from Lonestar Earthworks?')
    expect(words.message).toBe(
      'The award comes off, and the drafted statement of work for $66,500 is deleted. Their quote and the ask stay, and Sitework can be awarded again. If Lonestar Earthworks opened their portal since the award, it told them they got the job.',
    )
    expect(words.confirmLabel).toBe(AWARD_BACK_CONFIRM)
    expect(AWARD_BACK_CONFIRM).toBe('Take the award back')
    expect(AWARD_BACK_PRESS).toBe('Take the award back…')
  })

  it('an award with no statement of work names none', () => {
    expect(awardBackConfirmWords('Concrete', 'Capped Concrete', { sow: null }).message).toMatch(/^The award comes off\. Their quote/)
  })
})

describe('the server holds the same two steps, and more · gc_take_award_back', () => {
  const sql = readFileSync('supabase/migrations/20261124040000_gc_take_award_back.sql', 'utf8')
  const bed = readFileSync('supabase/tests/gc_take_award_back/20_scenario.sql', 'utf8')

  it('refuses a sent and a signed statement of work, as the press does', () => {
    expect(sql).toContain("WHEN v_sow.status = 'signed' THEN")
    expect(sql).toContain("WHEN v_sow.status = 'sent' THEN")
  })

  it('writes the award only under the flag the guard reads, and turns it off after', () => {
    const on = sql.indexOf("set_config('gc.award_write', 'on', true)")
    const write = sql.indexOf('SET awarded_invite_id = NULL, awarded_by = NULL, awarded_on = NULL')
    const off = sql.indexOf("set_config('gc.award_write', '', true)")
    expect(on).toBeGreaterThan(0)
    expect(write).toBeGreaterThan(on)
    expect(off).toBeGreaterThan(write)
  })

  it('every refusal the function words is played in the bed', () => {
    const holds = [...sql.matchAll(/THEN '([^']+(?:''[^']*)*)'/g)].map((m) => m[1]!.replace(/''/g, "'"))
    expect(holds.length).toBeGreaterThanOrEqual(11)
    for (const hold of holds) expect(bed.replace(/''/g, "'"), hold).toContain(hold)
  })
})
