import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { addDays } from './gcBuilding'
import type { GcState } from './gcTypes'
import { portalHome, portalMessages } from './gcPortal'
import { companiesToTell, datesAsksForOffice, datesMessage, datesNotices, moveAnswerWords, untoldMoves } from './gcTellTrades'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const why = { reason: 'weather' as const, note: 'Rain stopped the roof for a week.', by: 'Robert' }

/** The roof moved a month: Summit's own line, and it pushes sheet metal (Summit) and the rooftop units (Cool Breeze). */
function roofMoved() {
  const state = initialGcState()
  const tpoId = job(state).packages.flatMap((k) => k.sow?.sov ?? []).find((l) => l.label === 'TPO membrane')!.id
  const a = job(state).schedule!.activities.find((x) => x.lineId === tpoId)!
  const moved = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: addDays(a.start, 30), finish: addDays(a.finish, 30), after: a.after, why })
  const summit = moved.partners.find((p) => p.company === 'Summit Roofing')!
  const breeze = moved.partners.find((p) => p.company === 'Cool Breeze Mechanical')!
  return { state, moved, summit, breeze, move: job(moved).schedule!.moves![0]! }
}

describe('who to tell, and what', () => {
  it('groups the lines a move changed by the company doing them', () => {
    const { moved, move, summit, breeze } = roofMoved()
    expect(untoldMoves(job(moved)).map((m) => m.id)).toEqual([move.id])
    const companies = companiesToTell(moved, job(moved), [move])
    expect(companies.map((c) => c.partner.company).sort()).toEqual([breeze.company, summit.company].sort())
    const s = companies.find((c) => c.partner.id === summit.id)!
    expect(s.lines.map((l) => l.work)).toEqual(['TPO membrane', 'Sheet metal and flashing'])
    expect(s.lines[0]?.to.start).toBe(addDays(s.lines[0]!.from.start, 30))
  })

  it('writes one message per company, in its language, with the old and new days and why', () => {
    const { moved, move, summit } = roofMoved()
    const company = companiesToTell(moved, job(moved), [move]).find((c) => c.partner.id === summit.id)!
    const en = datesMessage(job(moved), summit, company, 'en')
    expect(en.subject).toBe('Your dates moved on Fair Oaks Shops, Building D')
    expect(en.lines[0]).toBe('Hello Carla,')
    expect(en.lines).toContain('TPO membrane: Oct 21 to Nov 8, not Sep 21 to Oct 9.')
    expect(en.lines).toContain('Why: weather: Rain stopped the roof for a week.')
    expect(en.lines[en.lines.length - 1]).toBe('In your portal, tell us the dates work, or give us another day.')
    const es = datesMessage(job(moved), summit, company, 'es')
    expect(es.subject).toBe('Sus fechas cambiaron en Fair Oaks Shops, Building D')
    expect(es.lines).toContain('TPO membrane: Oct 21 to Nov 8, no Sep 21 to Oct 9.')
  })
})

describe('telling them, and their answer', () => {
  it('marks the move told to each company, and the message shows in their portal with a to-do', () => {
    const { moved, move, summit, breeze } = roofMoved()
    const told = gcReducer(moved, { type: 'tellTradesMoves', projectId: ID, moveIds: [move.id], by: 'Robert' })
    const m = job(told).schedule!.moves![0]!
    expect(m.toldOn).toBe(told.today)
    expect([...(m.toldTo ?? [])].sort()).toEqual([breeze.id, summit.id].sort())
    expect(told.log[0]?.text).toBe('Robert told 2 companies their dates moved on Fair Oaks Shops, Building D.')
    expect(untoldMoves(job(told))).toEqual([])
    const msg = portalMessages(told, summit.id).find((x) => x.kind === 'dates')!
    expect(msg.subject).toBe('Your dates moved on Fair Oaks Shops, Building D')
    expect(portalHome(told, summit.id).todos.some((t) => t.key === `dates:${move.id}`)).toBe(true)
    expect(datesNotices(told, summit.id).map((n) => n.move.id)).toEqual([move.id])
    expect(moveAnswerWords(told, m)).toContain('Summit Roofing: told Oct 2, no answer yet.')
    // Telling again changes nothing.
    expect(gcReducer(told, { type: 'tellTradesMoves', projectId: ID, moveIds: [move.id], by: 'Robert' })).toBe(told)
  })

  it('a company says the dates work, or asks for another day, and the office sees which', () => {
    const { moved, move, summit, breeze } = roofMoved()
    const told = gcReducer(moved, { type: 'tellTradesMoves', projectId: ID, moveIds: [move.id], by: 'Robert' })
    const ok = gcReducer(told, { type: 'tradeAnswerDates', projectId: ID, partnerId: summit.id, moveId: move.id, ok: true })
    expect(ok.log[0]?.text).toBe('Summit Roofing: the new dates on Fair Oaks Shops, Building D work.')
    expect(datesNotices(ok, summit.id)).toEqual([])
    expect(portalHome(ok, summit.id).todos.some((t) => t.key === `dates:${move.id}`)).toBe(false)
    const asked = gcReducer(ok, { type: 'tradeAnswerDates', projectId: ID, partnerId: breeze.id, moveId: move.id, ok: false, day: '2026-11-16', note: 'We are on another job until then.' })
    const m = job(asked).schedule!.moves![0]!
    expect(moveAnswerWords(asked, m)).toEqual(['Summit Roofing: the dates work.', 'Cool Breeze Mechanical asked for Mon Nov 16: “We are on another job until then.”'])
    const [ask] = datesAsksForOffice(asked, job(asked))
    expect(ask?.partner.company).toBe('Cool Breeze Mechanical')
    expect(ask?.day).toBe('2026-11-16')
    // A second answer from the same company, or one from a company not told, changes nothing.
    expect(gcReducer(asked, { type: 'tradeAnswerDates', projectId: ID, partnerId: summit.id, moveId: move.id, ok: false })).toBe(asked)
    const stranger = asked.partners.find((p) => p.company === 'Tri-County Site')!
    expect(gcReducer(asked, { type: 'tradeAnswerDates', projectId: ID, partnerId: stranger.id, moveId: move.id, ok: true })).toBe(asked)
  })
})
