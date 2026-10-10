/**
 * The tests of `gcCounts.test.ts` on branch spike/gc-mode that read only B2b-i's kernels and the made-up data, moved word for word
 * (the Board's B2b-i), beside the ones earlier lifts moved. The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { gcNeedsYou, phraseFor } from '../needsYou'
import { allPeople, projectPeople } from '../projectPeople'
import { callList, callRows } from './callList'
import { chartHolds } from './chartHolds'
import { REASON_GROUPS, barReasons, boardFollowPeople, gcScheduleMovesNeedsYou, ourScheduleMoves, pastContract, reasonGroup, scheduleReasons, uninsuredReasons } from './counts'
import { initialGcState } from './testState'
import type { GcState } from '../types'

const ID = 'fairoaksd'

const job = (s: GcState, id = ID) => s.projects.find((p) => p.id === id)!

const reasons = (s: GcState) => scheduleReasons(s, job(s)).map((r) => [r.partner.company, r.reason.code, r.reason.tone, r.reason.text])

const moves = (s: GcState) => ourScheduleMoves(s, job(s)).map((m) => [m.kind, m.tone, m.words])

const s0 = initialGcState()

/** Fair Oaks D's packages changed in place of the reducer, the way the walk's own steps would leave them. */
function withPackage(state: GcState, packageId: string, change: (pkg: GcState['projects'][number]['packages'][number]) => GcState['projects'][number]['packages'][number]): GcState {
  return { ...state, projects: state.projects.map((p) => (p.id !== ID ? p : { ...p, packages: p.packages.map((k) => (k.id === packageId ? change(k) : k)) })) }
}

describe('on the made-up data', () => {
  it("names one company, Pecan Valley Electric: its insurance at work and its bars that wait, counted once", () => {
    expect(reasons(s0)).toEqual([['Pecan Valley Electric', 'notReady', 'amber', 'Site lighting and Fire alarm wait on current insurance. Site lighting starts Mon Oct 19.']])
    expect([...uninsuredReasons(s0, job(s0))]).toEqual([
      ['pecanvalley', { text: 'Their insurance ran out Tue Sep 15. Nothing they do for us is covered. They are at work on Panels and feeders, and Lighting.', tone: 'red', code: 'insurance', atWork: true }],
    ])
    // Two bars waiting and two at work: one company. The call list's bar reasons (G-146) put four more on the row.
    const fair = projectPeople(s0, job(s0))
    expect([fair.count, fair.late]).toEqual([6, 3])
    expect(fair.people.find((p) => p.company === 'Pecan Valley Electric')?.reasons.map((r) => r.code)).toEqual(['insurance', 'failed', 'waiver', 'notReady', 'dueToday', 'behind'])
  })

  it('has no move of ours anywhere, so the ring cards, the board row and Needs you read as before', () => {
    for (const p of s0.projects) {
      expect(ourScheduleMoves(s0, p)).toEqual([])
      if (p.id !== ID) expect(scheduleReasons(s0, p)).toEqual([])
    }
    expect(pastContract(s0, job(s0))).toBeNull()
    expect(gcScheduleMovesNeedsYou(s0)).toBeNull()
  })
})

describe('not ready to start (G-77): theirs or ours, by the paper', () => {
  it('a statement of work sent and not signed is theirs; drafted, not sent, is ours', () => {
    const sent = withPackage(s0, 'froof', (k) => ({ ...k, sow: { ...k.sow!, status: 'sent', sentOn: '2026-09-30' } }))
    // Roof curbs starts Mon Oct 5, inside the 3 days: red.
    expect(reasons(sent).filter(([company]) => company === 'Summit Roofing')).toEqual([['Summit Roofing', 'notReady', 'red', 'Roof curbs, and Sheet metal and flashing wait on a signed statement of work. Roof curbs starts Mon Oct 5.']])
    const draft = withPackage(s0, 'froof', (k) => ({ ...k, sow: { ...k.sow!, status: 'draft' } }))
    expect(reasons(draft).some(([company]) => company === 'Summit Roofing')).toBe(false)
    expect(moves(draft)).toEqual([['papers', 'red', "Summit Roofing's statement of work is drafted, not sent. Roof curbs starts Mon Oct 5."]])
  })

  it('a trade with no company yet is ours, by trade', () => {
    const open = withPackage(s0, 'froof', (k) => ({ ...k, awardedInviteId: null }))
    expect(moves(open)).toEqual([['award', 'red', 'Roofing has no company yet. Roof curbs starts Mon Oct 5.']])
  })
})

describe('Needs you’s phrase for a company', () => {
  const person = (s: GcState, company: string) => projectPeople(s, job(s)).people.find((p) => p.company === company)!

  it('says the work, not the paper, for a company at work uncovered', () => {
    expect(phraseFor(s0, person(s0, 'Pecan Valley Electric'))).toBe('Pecan Valley Electric is working without insurance')
  })

  it('says each schedule reason in a phrase', () => {
    const one = (code: string, text = 'x') => ({ key: 'partner:summit', kind: 'trade' as const, name: 'Carla Nguyen', company: 'Summit Roofing', tag: 'Roofing', partnerId: 'summit', reasons: [{ text, tone: 'amber' as const, code, lineId: 'froof-3' }], tone: 'amber' as const, last: null, phone: '' })
    expect(phraseFor(s0, one('notReady'))).toBe('Summit Roofing cannot start Sheet metal and flashing yet')
    expect(phraseFor(s0, one('confirm'))).toBe('Summit Roofing has not confirmed its dates')
    expect(phraseFor(s0, one('pushedBack'))).toBe('Summit Roofing has not answered our push back')
    expect(phraseFor(s0, one('log'))).toBe('Summit Roofing was not on site')
    expect(phraseFor(s0, one('crew'))).toBe('Summit Roofing is short a crew')
    expect(phraseFor(s0, one('crowded'))).toBe('Summit Roofing has not said how many it will have')
  })
})

describe('G-146: the call list’s bar reasons on the board row and the badge', () => {
  const people = (s: GcState) => projectPeople(s, job(s)).people

  it("pins Fair Oaks D's pill at 6 to call and 3 late, the badge at 11 and 6 late, and Needs you's title", () => {
    const fair = projectPeople(s0, job(s0))
    expect([fair.count, fair.late]).toEqual([6, 3])
    expect(fair.people.map((p) => [p.company, p.tone])).toEqual([
      ['Pecan Valley Electric', 'red'],
      ['Cool Breeze Mechanical', 'red'],
      ['Cibolo Creek Partners', 'red'],
      ['Iron Horse Fabrication', 'amber'],
      ['Summit Roofing', 'amber'],
      ['Marsh & Vale Architects', 'grey'],
    ])
    expect([allPeople(s0).count, allPeople(s0).late]).toEqual([11, 6])
    expect(gcNeedsYou(s0)?.title).toBe('11 to follow up on in GC mode')
    expect(gcNeedsYou(s0)?.detail).toBe("Hillside Excavation is late on their word · Bexar Steel Erectors never opened the ask · Voltage Brothers' insurance ran out · and 8 more.")
  })

  it("pins the architect's row to the holds that are theirs, RFI-003 and the submittal, never a bar", () => {
    const architect = people(s0).find((p) => p.kind === 'architect')!
    expect(architect.reasons.map((r) => [r.code, r.tone, r.text])).toEqual([
      ['held', 'grey', 'RFI-003 holds Rooftop units, which starts Mon Oct 12. The answer is needed by Fri Oct 9.'],
      ['held', 'grey', 'Submittal 28 31 11-01 holds Fire alarm, which starts Mon Nov 2. It is needed back by Mon Oct 19.'],
    ])
    // The bars themselves go to the trades doing them.
    expect(people(s0).find((p) => p.company === 'Cool Breeze Mechanical')?.reasons.map((r) => r.text)).toEqual([
      'Rooftop units waits on its delivery, expected Tue Oct 20 from their supplier. That is 8 days after it starts.',
      'Controls waits on their submittal 23 09 23-01, needed by Fri Oct 23.',
    ])
  })

  it('folds each bar reason under whoever already has a row, once per person', () => {
    const pecan = people(s0).find((p) => p.company === 'Pecan Valley Electric')!
    expect(pecan.reasons.map((r) => [r.code, r.tone])).toEqual([
      ['insurance', 'red'],
      ['failed', 'red'],
      ['waiver', 'amber'],
      ['notReady', 'amber'],
      ['dueToday', 'amber'],
      ['behind', 'amber'],
    ])
    expect(people(s0).filter((p) => p.company === 'Pecan Valley Electric')).toHaveLength(1)
  })

  it("leaves out an aside and G-77's paperwork, which the count says once already", () => {
    const own = callRows(s0, job(s0), chartHolds(s0, job(s0)))
    const asides = own.flatMap((p) => p.reasons.filter((r) => r.aside).map((r) => r.text))
    expect(asides.length).toBeGreaterThan(0)
    const counted = barReasons(s0, job(s0)).map((b) => b.reason.text)
    expect(counted.some((t) => asides.includes(t))).toBe(false)
    expect(counted.some((t) => t === 'Fire alarm waits on current insurance.' || t === 'Site lighting waits on current insurance.')).toBe(false)
  })

  it('By company says each bar reason once, its own line, not Follow up’s copy', () => {
    const list = callList(s0, job(s0), chartHolds(s0, job(s0)))
    for (const p of list.people) {
      const texts = p.reasons.map((r) => r.text)
      expect(new Set(texts).size).toBe(texts.length)
    }
    expect(list.count).toBe(5)
  })

  it('two groups, from one rule: on the schedule, or owed to us', () => {
    expect(REASON_GROUPS.map((g) => g.words)).toEqual(['On the schedule', 'Owed to us'])
    for (const code of ['failed', 'overdue', 'dueToday', 'behind', 'held', 'notReady', 'confirm', 'pushedBack', 'log', 'crew', 'crowded', 'late', 'dates', 'schedule']) expect(reasonGroup(code)).toBe('schedule')
    for (const code of ['ask', 'plans', 'sow', 'contract', 'co:co-1', 'pay:3', 'waiver', 'insurance', 'w9', 'promise', 'questions', 'bid', 'sentBack', undefined]) expect(reasonGroup(code)).toBe('owed')
  })

  it("the board row's sheet carries what the row counts: Summit's item in the call list's words, and Cibolo still there", () => {
    const sheet = boardFollowPeople(s0, job(s0))
    expect(sheet.map((p) => p.partner.company)).toEqual(['Pecan Valley Electric', 'Cool Breeze Mechanical', 'Cibolo Creek Partners', 'Iron Horse Fabrication', 'Summit Roofing', 'Marsh & Vale Architects'])
    const summit = sheet.find((p) => p.partner.id === 'summit')!
    expect(summit.items.map((i) => [i.kind, i.why, i.words?.en.about, i.words?.en.ask])).toEqual([
      ['schedule', 'TPO membrane is behind: 50% done against 100% in the plan. It is due Fri Oct 9.', 'your roofing TPO membrane on Fair Oaks Shops, Building D', 'When will it be done?'],
    ])
    // G-77's paperwork holds are asked once, by the paper's own item.
    const pecan = sheet.find((p) => p.partner.id === 'pecanvalley')!
    expect(pecan.items.filter((i) => i.kind === 'schedule' && i.schedule?.hold === 'paperwork')).toEqual([])
  })
})
