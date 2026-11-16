import { describe, expect, it } from 'vitest'
import { gatherOutcomeWords, gatherPlan, overToCreditPlan, proposeSendingGroups, type GatherLine, type OverPayment } from './subSendingRepair'

// Made-up money.
const pay = (id: string, amount: number, day: string, o: Partial<OverPayment> = {}): OverPayment => ({ id, amount, dayWords: day, fromCredit: false, carriesCredit: false, at: `2026-10-${id}`, ...o })

describe('overToCreditPlan — a sheet paid past its total becomes a credit', () => {
  const sheet = { label: '2033 Alder Court Remodel', total: 300, paid: 350, over: 50 }
  const sub = { personId: 'harlan', name: 'Harlan Mechanical' }
  it('the newest payment carries it, and what left the bank does not change', () => {
    const p = overToCreditPlan(sheet, [pay('01', 100, 'Oct 1'), pay('03', 250, 'Oct 3')], sub)
    expect(p).toMatchObject({ ok: true, over: 50, paymentId: '03', before: 250, after: 200, confirmLabel: 'Keep $50.00 as their credit' })
    expect(p.ok && p.words).toEqual([
      '2033 Alder Court Remodel comes to $300.00 and $350.00 was paid on it: $50.00 over.',
      "The payment of Oct 3 reads $200.00 on this sheet and $50.00 kept as Harlan Mechanical's credit.",
      '$250.00 left the bank, as before. The sheet reads paid in full, and the next payment to Harlan Mechanical offers the credit first.',
    ])
    expect(p.ok && p.after + p.over).toBe(250)
  })
  it('skips a payment made from a credit, one that already carries a credit, and one too small to carry it', () => {
    const p = overToCreditPlan(sheet, [pay('01', 200, 'Oct 1'), pay('02', 100, 'Oct 2', { carriesCredit: true }), pay('03', 30, 'Oct 3'), pay('04', 80, 'Oct 4', { fromCredit: true })], sub)
    expect(p).toMatchObject({ ok: true, paymentId: '01', after: 150 })
  })
  it('refuses with the reason', () => {
    expect(overToCreditPlan({ ...sheet, over: 0 }, [], sub)).toMatchObject({ ok: false, reason: 'not_over' })
    expect(overToCreditPlan(sheet, [pay('01', 350, 'Oct 1')], { personId: null, name: 'Harlan Mechanical' })).toMatchObject({ ok: false, reason: 'no_person', error: 'A credit needs the sub on the roster as one person. Link the sheet to one sub first.' })
    expect(overToCreditPlan(sheet, [pay('01', 50, 'Oct 1')], sub)).toMatchObject({ ok: false, reason: 'no_payment' })
  })
})

const line = (id: string, sheetId: string, ymd: string, amount: number, o: Partial<GatherLine> = {}): GatherLine => ({ id, sheetId, paidToKey: 'id:harlan', paidTo: 'Harlan Mechanical', job: `Job ${sheetId}`, ymd, recorded: false, method: 'Check', methodRef: '1167', amount, hasSending: false, fromCredit: false, ...o })

describe('proposeSendingGroups — old payments gathered into the sendings they were', () => {
  const lines = [
    line('a', 's1', '2026-08-14', 500),
    line('b', 's2', '2026-08-14', 700),
    line('c', 's3', '2026-08-14', 900),
    // Another check the same day: its own group.
    line('d', 's4', '2026-08-14', 200, { methodRef: '1168' }),
    line('e', 's5', '2026-08-14', 300, { methodRef: '1168' }),
    // Typed in one sitting with no Date sent: held.
    line('f', 's6', '2026-07-02', 400, { recorded: true, method: '', methodRef: '' }),
    line('g', 's7', '2026-07-02', 600, { recorded: true, method: '', methodRef: '' }),
    // Left alone: already in a sending, a lone row, a back-charge, a payment from credit, a sheet with no one person.
    line('h', 's8', '2026-08-14', 100, { hasSending: true }),
    line('i', 's9', '2026-09-01', 100),
    line('j', 's1', '2026-08-14', -50),
    line('k', 's2', '2026-08-14', 75, { fromCredit: true }),
    line('l', 's3', '2026-08-14', 80, { paidToKey: 'harlan and marlow' }),
  ]
  const groups = proposeSendingGroups(lines)
  it('one person, one day, one way of paying is one sending', () => {
    expect(groups.map((g) => [g.ymd, g.how, g.lines.map((l) => l.id).join(''), g.amount, g.ready])).toEqual([
      ['2026-08-14', 'Check 1167', 'abc', 2100, true],
      ['2026-08-14', 'Check 1168', 'de', 500, true],
      ['2026-07-02', '', 'fg', 1000, false],
    ])
  })
  it('holds a group whose day is only the day it was typed, with the reason', () => {
    expect(groups[2]!.held).toBe('No Date sent on these: they are grouped by the day they were typed, which may hold several payments.')
  })
  it('holds two rows on one sheet: that reads as two payments', () => {
    const g = proposeSendingGroups([line('x', 's1', '2026-08-20', 100), line('y', 's1', '2026-08-20', 150)])
    expect(g[0]).toMatchObject({ ready: false, held: 'Two of these are on one sheet, so they may be two payments made the same day.' })
  })
  it('holds rows matched to different bank lines, and that reason comes first', () => {
    const g = proposeSendingGroups([line('x', 's1', '2026-08-20', 100, { bankLineId: 'bank-1' }), line('y', 's2', '2026-08-20', 150, { bankLineId: 'bank-2' })])
    expect(g[0]).toMatchObject({ ready: false, held: 'These are matched to different bank lines, so they were not one payment.' })
    // One line matched and one not, or both on the same line, is still one payment.
    expect(proposeSendingGroups([line('x', 's1', '2026-08-20', 100, { bankLineId: 'bank-1' }), line('y', 's2', '2026-08-20', 150)])[0]!.ready).toBe(true)
    expect(proposeSendingGroups([line('x', 's1', '2026-08-20', 100, { bankLineId: 'bank-1' }), line('y', 's2', '2026-08-20', 150, { bankLineId: 'bank-1' })])[0]!.ready).toBe(true)
  })
  it('the press says what it will do with its count, and what it leaves', () => {
    const ready = new Set(groups.filter((g) => g.ready).map((g) => g.key))
    const plan = gatherPlan(groups, ready)
    expect(plan).toMatchObject({ payments: 5, amount: 2600, sumWords: '5 payments become 2 sendings. No amount, date or sheet changes.', leftWords: '1 group is left as it is. Tick one to gather it too.' })
    expect(plan.words).toMatchObject({ button: 'Gather 2 sendings · 1 left as it is ▸', dead: false })
    // Everything ticked: no hold on the button.
    expect(gatherPlan(groups, new Set(groups.map((g) => g.key))).words).toMatchObject({ button: 'Gather 3 sendings', dead: false })
    // Nothing ticked: the press is dead.
    expect(gatherPlan(groups, new Set())).toMatchObject({ payments: 0, sumWords: '', words: { dead: true } })
  })
  it('after the press, says what took and what did not', () => {
    expect(gatherOutcomeWords(2, 0)).toMatchObject({ line: 'Gathered 2 sendings.', head: null, tone: 'success' })
    expect(gatherOutcomeWords(1, 1)).toMatchObject({ line: 'Gathered 1 sending. 1 did not gather.', head: '1 sending did not gather. It stays here with the reason.', tone: 'warning' })
  })
})
