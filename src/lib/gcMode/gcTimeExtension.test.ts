import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { addDays } from './gcBuilding'
import { daysBetween, scheduleMeasures, substantialCompletionOn } from './gcBuildingSchedule'
import { CAUSE_OF } from './gcDaysLost'
import { lateFinish } from './gcLateFinish'
import { changeOrderMove, changeOrdersOnChart, changeOrderTails, customerContractDays } from './gcChangeOrderDays'
import { customerAsks } from './gcCustomerSchedule'
import { ownerPayApp } from './gcOwnerBilling'
import type { GcState, ScheduleMoveReason } from './gcTypes'
import { isTimeExtension, openAskMoves, timeExtensionLines, timeExtensionRule } from './gcTimeExtension'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const late = (s: GcState) => lateFinish(s, job(s))
const order = (s: GcState, n: number) => job(s).changeOrders!.find((c) => c.number === n)!

function moveBy(s: GcState, label: string, days: number, reason: ScheduleMoveReason, note: string): GcState {
  const a = scheduleMeasures(s, job(s)).items.find((i) => i.label === label)!.activity
  return gcReducer(s, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: { reason, note, by: 'Robert' } })
}

/** G-98's late job: Trim waits a week on the customer's tile decision, rain holds Test and balance nine days. Tue Dec 15, 4 days past Fri Dec 11. */
function lateJob(fee: number | null = 500): GcState {
  const s = fee ? gcReducer(initialGcState(), { type: 'setOwnerLateFinish', projectId: ID, perDay: fee }) : initialGcState()
  return moveBy(moveBy(s, 'Trim', 7, 'customer', 'Waiting on the restroom tile decision.'), 'Test and balance', 9, 'weather', 'Rain kept the roof open a week.')
}

const press = (s: GcState) => gcReducer(s, { type: 'draftTimeExtension', projectId: ID })
const send = (s: GcState, n = 1) => gcReducer(s, { type: 'sendChangeOrder', projectId: ID, changeOrderId: `co-${n}` })
const sign = (s: GcState, n = 1) => gcReducer(s, { type: 'ownerSignChangeOrder', projectId: ID, changeOrderId: `co-${n}` })
const decline = (s: GcState, n = 1) => gcReducer(s, { type: 'ownerDeclineChangeOrder', projectId: ID, changeOrderId: `co-${n}` })
const trimMove = (s: GcState) => job(s).schedule!.moves!.find((m) => m.note === 'Waiting on the restroom tile decision.')!

describe('Ask for the days (G-141): what the press would ask for', () => {
  it('has nothing to ask on the fixture, where nothing is late', () => {
    const s = initialGcState()
    expect(late(s).ask).toBeNull()
  })

  it('asks for every day the customer’s moves put on the finish: 5, while the whose-days line’s late count stays 4', () => {
    const s = lateJob()
    // The pin: the ask is the sum of the standing moves at the customer's door, by their days on the finish.
    const theirs = job(s).schedule!.moves!.filter((m) => !m.undoneOn && !m.changeOrderId && CAUSE_OF[m.reason] === 'customer')
    const sum = theirs.reduce((n, m) => n + daysBetween(m.finishFrom, m.finishTo), 0)
    expect(sum).toBe(5)
    const l = late(s)
    expect(l.ask?.days).toBe(sum)
    expect(l.late).toBe(4)
    expect(l.customers).toBe(4)
    expect(l.split).toBe("All 4 are the customer's: a change order for them would save $2,000.")
    expect(l.ask).toMatchObject({
      reason: 'owner',
      description: 'A time extension for the restroom tile decision we asked you for on Sep 28',
      rule: '5 days, the days your decision moved the finish.',
      contract: { from: '2026-12-11', to: '2026-12-16' },
      saves: 2000,
      spare: 1,
    })
    expect(l.ask?.moves.map((m) => [m.label, m.days, m.reason])).toEqual([['Trim', 5, 'customer']])
  })

  it('without a fee, it saves nothing in money and the line says it would move the contract', () => {
    const l = late(lateJob(null))
    expect(l.split).toBe("All 4 are the customer's: a change order for them would move the contract.")
    expect(l.ask).toMatchObject({ days: 5, saves: null, spare: 1 })
  })
})

describe('the press', () => {
  it('drafts change order 1 with the days, the moves and the customer’s words, and sends nothing', () => {
    const before = lateJob()
    const s = press(before)
    const co = order(s, 1)
    expect(co).toEqual({
      id: 'co-1',
      number: 1,
      description: 'A time extension for the restroom tile decision we asked you for on Sep 28',
      reason: 'owner',
      schedule: '+5 days',
      packageId: null,
      cost: 0,
      price: 0,
      status: 'draft',
      sentOn: null,
      answeredOn: null,
      pctDone: 0,
      days: 5,
      daysOnChart: [trimMove(before).id],
    })
    expect(isTimeExtension(co)).toBe(true)
    expect(s.log.some((e) => e.text === "Drafted change order 1 on Fair Oaks Shops, Building D: 5 days of time, the days the customer's moves put on the finish. Nothing is sent.")).toBe(true)
    // Nothing reaches the customer: no send, and nothing waits on their signature.
    expect(s.customerSends ?? []).toEqual(before.customerSends ?? [])
    expect(customerAsks(job(s))).toEqual(customerAsks(job(before)))
    // A second press drafts nothing: the move is asked for.
    expect(press(s)).toBe(s)
    expect(late(s).ask).toBeNull()
    expect(openAskMoves(job(s))).toEqual([])
  })

  it('does nothing on the fixture', () => {
    const s = initialGcState()
    expect(press(s)).toBe(s)
  })
})

describe('G-98’s whose-days line through the ask', () => {
  it('says where the ask stands: a draft, sent, signed', () => {
    const drafted = press(lateJob())
    expect(late(drafted).split).toBe("All 4 are the customer's: change order 1 asks for 5, the days their moves put on the finish. It is a draft on Bill the customer.")
    const sent = send(drafted)
    expect(late(sent).split).toBe("All 4 are the customer's: change order 1 asks for 5, the days their moves put on the finish.")
    expect(late(sent).orderLines).toEqual(['Change order 1 would move the contract 5 days once they sign it.'])
    // Signed: the contract's day moves 5 days, and the job has a day in hand.
    const signed = sign(sent)
    const l = late(signed)
    expect(substantialCompletionOn(job(signed))?.on).toBe('2026-12-16')
    expect(l.risk.schedule?.on).toBe('2026-12-15')
    expect(l).toMatchObject({ late: 0, spare: 1, customers: 0, split: null, ask: null, asked: [] })
    expect(l.words).toEqual(['Each day past Wed Dec 16 costs $500.', 'Change order 1 moved the contract 5 days, signed Fri Oct 2.'])
  })

  it('declined, the days are to ask for again: the press comes back, and drafts change order 2', () => {
    const declined = decline(send(press(lateJob())))
    expect(late(declined).split).toBe("All 4 are the customer's: a change order for them would save $2,000.")
    expect(late(declined).ask?.days).toBe(5)
    const again = press(declined)
    expect(order(again, 2)).toMatchObject({ status: 'draft', days: 5, daysOnChart: [trimMove(declined).id] })
  })

  it('a customer’s move after the ask: the line says so, and the press asks for that move alone', () => {
    const drafted = press(lateJob())
    const more = moveBy(drafted, 'Trim', 5, 'customer', 'The tile came in the wrong color.')
    const l = late(more)
    expect(l.ask?.moves.map((m) => [m.label, m.days])).toEqual([['Trim', 3]])
    expect(l.ask?.moves[0]?.id).not.toBe(trimMove(more).id)
    expect(l.split).toBe(
      "All 7 are the customer's: change order 1 asks for 5, the days their moves put on the finish. It is a draft on Bill the customer. Their moves since then add 3 days, not asked for yet.",
    )
    expect(order(press(more), 2)).toMatchObject({ days: 3, daysOnChart: [l.ask?.moves[0]?.id] })
  })

  it('a move undone after the ask: its row says so, and the customer’s count drops', () => {
    // Trim's move alone, so it is the last move and Undo takes it.
    const s = gcReducer(initialGcState(), { type: 'setOwnerLateFinish', projectId: ID, perDay: 500 })
    const drafted = press(moveBy(s, 'Trim', 7, 'customer', 'Waiting on the restroom tile decision.'))
    expect(late(drafted).customers).toBeGreaterThan(0)
    const undone = gcReducer(drafted, { type: 'undoScheduleMove', projectId: ID, moveId: trimMove(drafted).id, by: 'Robert' })
    expect(timeExtensionLines(undone, job(undone), order(undone, 1))).toContain("Trim's move of Fri Oct 2 was undone Fri Oct 2.")
    expect(late(undone).customers).toBe(0)
  })
})

describe('signed, the bars stay where they are', () => {
  it('moves no bar, and G-76 draws no tail and offers no push, even on a trade’s work', () => {
    const before = lateJob()
    const signed = sign(send(press(before)))
    expect(job(signed).schedule!.activities).toEqual(job(before).schedule!.activities)
    expect(changeOrdersOnChart(job(signed), signed.today)).toEqual([])
    expect(changeOrderTails(job(signed), signed.today).size).toBe(0)
    // The field is what keeps it off the bars: given a trade, G-76 still skips it.
    const onTrim: GcState = { ...signed, projects: signed.projects.map((p) => (p.id !== ID ? p : { ...p, changeOrders: (p.changeOrders ?? []).map((c) => ({ ...c, packageId: 'fplumb' })) })) }
    expect(changeOrdersOnChart(job(onTrim), onTrim.today)).toEqual([])
    expect(changeOrderTails(job(onTrim), onTrim.today).size).toBe(0)
    expect(changeOrderMove(job(signed), order(signed, 1), signed.today)).toBeNull()
  })

  it('reads on the customer’s schedule like any signed order, and is no line on the bill', () => {
    const signed = sign(send(press(lateJob())))
    expect(customerContractDays(job(signed))).toEqual(['Change order 1 added 5 days to your contract.', 'Substantial completion is now Wed Dec 16, 5 days past the Dec 11 you signed.'])
    expect(ownerPayApp(signed, job(signed)).lines.map((l) => l.id)).not.toContain('co-1')
  })
})

describe('its words', () => {
  it('has its row’s lines: the rule, the move with our note, what it saves, the contract', () => {
    const drafted = press(lateJob())
    expect(timeExtensionLines(drafted, job(drafted), order(drafted, 1))).toEqual([
      '5 days, the days your decision moved the finish.',
      'Trim moved Fri Oct 2 and put 5 days on the finish. Our note: “Waiting on the restroom tile decision.”',
      "At the contract's $500 a day, it saves $2,000 and leaves 1 day to spare.",
      'Substantial completion moves from Fri Dec 11 to Wed Dec 16.',
    ])
    const signed = sign(send(drafted))
    expect(timeExtensionLines(signed, job(signed), order(signed, 1)).slice(2)).toEqual([
      "At the contract's $500 a day, it saves $2,000 and leaves 1 day to spare.",
      'Substantial completion moved from Fri Dec 11 to Wed Dec 16.',
    ])
  })

  it('names the decision only when one decision holds the moved bar, and uses the customer’s words otherwise', () => {
    // No decision on record: G-96's words.
    const noWaits = (s: GcState): GcState => ({ ...s, projects: s.projects.map((p) => (p.id !== ID ? p : { ...p, waits: [] })) })
    const plain = noWaits(lateJob())
    expect(late(plain).ask).toMatchObject({ description: 'A time extension for a decision we were waiting on from you', rule: '5 days, the days your decision moved the finish.' })
    // A change to the plans: their words, and the order's reason is a plan revision.
    const s = gcReducer(initialGcState(), { type: 'setOwnerLateFinish', projectId: ID, perDay: 500 })
    const plans = moveBy(moveBy(s, 'Trim', 7, 'plans', 'The architect moved the restroom fixtures.'), 'Test and balance', 9, 'weather', 'Rain kept the roof open a week.')
    expect(late(plans).ask).toMatchObject({ reason: 'plans', description: 'A time extension for a change to the plans', rule: '5 days, the days the change to the plans moved the finish.' })
  })

  it('says every line in plain words, and what the customer reads never names a company or the fee', () => {
    const drafted = press(lateJob())
    const signed = sign(send(drafted))
    const ask = late(lateJob()).ask!
    const lines = [
      ask.description,
      ask.rule,
      late(drafted).split ?? '',
      late(send(drafted)).split ?? '',
      ...timeExtensionLines(drafted, job(drafted), order(drafted, 1)),
      ...timeExtensionLines(signed, job(signed), order(signed, 1)),
    ]
    for (const line of lines) expect(plainWordsFailures(line)).toEqual([])
    const customer = [order(drafted, 1).description, timeExtensionRule(job(drafted), order(drafted, 1))].join(' ')
    for (const p of drafted.partners) expect(customer).not.toContain(p.company)
    expect(customer).not.toContain('$')
    expect(customer).not.toContain('Waiting on')
  })
})
