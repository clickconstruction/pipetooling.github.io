import { describe, expect, it } from 'vitest'

import { buildBackfillPlan, isPayLikeNote, renderBackfillPlan, type BackfillPayment, type BackfillSend, type MercurySend } from './backfillPlan'

const pay = (o: Partial<BackfillPayment> & Pick<BackfillPayment, 'id' | 'personName' | 'amount' | 'paidAt'>): BackfillPayment => ({
  payStubId: `stub-${o.id}`,
  memo: null,
  sourceKind: null,
  sourceId: null,
  ...o,
})
const send = (o: Partial<BackfillSend> & Pick<BackfillSend, 'id' | 'occurredDate' | 'amountSent'>): BackfillSend => ({
  note: 'Week',
  counterparty: 'Taunya Villarreal',
  lane: 'review',
  personName: 'Taunya',
  ...o,
})

describe('buildBackfillPlan (v2.3579)', () => {
  it('links exact matches, skips sends a payment already carries, and consumes each payment once', () => {
    const plan = buildBackfillPlan({
      sends: [send({ id: '#D-1', occurredDate: '2026-07-20', amountSent: 349.63 }), send({ id: '#D-DONE', occurredDate: '2026-07-01', amountSent: 100 })],
      payments: [pay({ id: 'p1', personName: 'Taunya', amount: 349.63, paidAt: '2026-07-20', memo: 'Cashapp' }), pay({ id: 'p0', personName: 'Taunya', amount: 100, paidAt: '2026-07-01', sourceKind: 'cashapp', sourceId: '#D-DONE' })],
    })
    expect(plan.alreadyLinked).toBe(1)
    expect(plan.actions).toEqual([expect.objectContaining({ kind: 'link', paymentId: 'p1', sourceId: '#D-1', rule: 'amount', amountAfter: 349.63 })])
  })

  it('corrects within $5; a bigger gap is left for a person with both figures, never recorded again', () => {
    const plan = buildBackfillPlan({
      sends: [send({ id: '#D-3', occurredDate: '2026-05-26', amountSent: 532.22, personName: 'Paige' }), send({ id: '#D-45', occurredDate: '2026-07-20', amountSent: 349.63, note: 'Last week' })],
      payments: [pay({ id: 'paige', personName: 'Paige', amount: 535.22, paidAt: '2026-05-26', memo: 'Cashapp' }), pay({ id: 't', personName: 'Taunya', amount: 394.63, paidAt: '2026-07-20', memo: 'Cashapp' })],
    })
    expect(plan.actions.find((a) => a.kind === 'link')).toEqual(expect.objectContaining({ paymentId: 'paige', rule: 'near', amountBefore: 535.22, amountAfter: 532.22 }))
    expect(plan.actions.find((a) => a.kind === 'review')).toEqual(expect.objectContaining({ txId: '#D-45', why: expect.stringContaining('$45.00 apart') }))
    expect(plan.counts).toEqual({ link: 1, split: 0, lane: 0, record: 0, review: 1, mercury_unmatched: 0 })
  })

  it('links one send to the several report rows it paid (rule c) and refuses two rows on one report', () => {
    const plan = buildBackfillPlan({
      sends: [send({ id: '#D-1200', occurredDate: '2026-08-03', amountSent: 1200, personName: 'Michael A', counterparty: 'michael Archambault' })],
      payments: [
        pay({ id: 'a', personName: 'Michael A', amount: 700, paidAt: '2026-08-03', memo: 'sent', payStubId: 's1' }),
        pay({ id: 'b', personName: 'Michael A', amount: 500, paidAt: '2026-08-03', memo: 'sent', payStubId: 's2' }),
      ],
    })
    expect(plan.actions.every((a) => a.kind === 'link' && a.sourceId === '#D-1200' && a.rule === 'split')).toBe(true)
    expect(plan.actions).toHaveLength(2)

    const same = buildBackfillPlan({
      sends: [send({ id: '#D-1200', occurredDate: '2026-08-03', amountSent: 1200, personName: 'Michael A' })],
      payments: [pay({ id: 'a', personName: 'Michael A', amount: 700, paidAt: '2026-08-03', payStubId: 's1' }), pay({ id: 'b', personName: 'Michael A', amount: 500, paidAt: '2026-08-03', payStubId: 's1' })],
    })
    expect(same.actions[0]).toEqual(expect.objectContaining({ kind: 'review', txId: '#D-1200', why: expect.stringContaining('same report') }))
  })

  it('memo-group: five rows memoed "1200 sent" all link to the one $1,200 send', () => {
    const rows = [355.5, 28.65, 250.01, 457.41, 108.43]
    const plan = buildBackfillPlan({
      sends: [send({ id: '#D-1200', occurredDate: '2026-08-03', amountSent: 1200, note: 'Everything we can', personName: 'Michael A' })],
      payments: rows.map((amount, i) => pay({ id: `r${i}`, personName: 'Michael A', amount, paidAt: '2026-08-03', memo: '1200 sent', payStubId: `s${i}` })),
    })
    expect(plan.actions).toHaveLength(5)
    expect(plan.actions.every((a) => a.kind === 'link' && a.rule === 'memo-group' && a.sourceId === '#D-1200')).toBe(true)
  })

  it('memo-fill: "500 advance" on $1,014.32 splits into the $500 advance and the $514.32 remainder send', () => {
    const plan = buildBackfillPlan({
      sends: [
        send({ id: '#D-A', occurredDate: '2026-05-15', amountSent: 500, note: 'Friday advance', personName: 'Paige' }),
        send({ id: '#D-B', occurredDate: '2026-05-17', amountSent: 514.32, note: 'Remainder of week', personName: 'Paige' }),
      ],
      payments: [pay({ id: 'merged', personName: 'Paige', amount: 1014.32, paidAt: '2026-05-15', memo: '500 advance' })],
    })
    expect(plan.actions).toHaveLength(1)
    const s = plan.actions[0]!
    expect(s.kind).toBe('split')
    if (s.kind === 'split') {
      expect(s.parts.map((p) => [p.amount, p.source_kind, p.source_id])).toEqual([
        [500, 'cashapp', '#D-A'],
        [514.32, 'cashapp', '#D-B'],
      ])
    }
  })

  it('memo-fill from Mercury: "Mercury 100 + 445.39" splits into the Cash App advance and the Mercury send', () => {
    const plan = buildBackfillPlan({
      sends: [send({ id: '#D-100', occurredDate: '2026-05-02', amountSent: 100, note: 'Advance' })],
      payments: [pay({ id: 'both', personName: 'Taunya', amount: 545.39, paidAt: '2026-05-04', memo: 'Mercury 100 + 445.39' })],
      mercury: [{ id: 'm-445', postedDate: '2026-05-05', amountSent: 445.39, counterparty: 'Taunya Villarreal', memo: 'From Click Plumbing', personName: 'Taunya' }],
    })
    // the memo rule sees both numbers: 100 (the Cash App send) and 445.39 (nothing on Cash App) — the gap is the Mercury send
    const s = plan.actions.find((a) => a.kind === 'split')
    expect(s).toBeTruthy()
    if (s && s.kind === 'split') expect(s.parts.map((p) => [p.amount, p.source_kind, p.source_id])).toEqual([[100, 'cashapp', '#D-100'], [445.39, 'mercury', 'm-445']])
    expect(plan.actions.filter((a) => a.kind === 'mercury_unmatched')).toHaveLength(0)
  })

  it('leaves memo sends that do not sum, and files expenses and pre-record sends', () => {
    const plan = buildBackfillPlan({
      sends: [
        send({ id: '#D-A', occurredDate: '2026-04-30', amountSent: 1000, note: 'week', personName: 'Zach W' }),
        send({ id: '#D-E', occurredDate: '2026-07-02', amountSent: 265, note: 'Reimbursements' }),
        send({ id: '#D-OLD', occurredDate: '2026-03-16', amountSent: 483, note: 'Tristen last week', personName: 'Tristen' }),
        send({ id: '#D-WHO', occurredDate: '2026-07-02', amountSent: 50, note: 'Week', personName: null, counterparty: 'Jjmoney' }),
        send({ id: '#D-GIFT', occurredDate: '2026-06-04', amountSent: 100, note: 'Happy Birthday' }),
        send({ id: '#D-ADV', occurredDate: '2026-09-03', amountSent: 500, note: 'Advance' }),
        send({ id: '#D-FIRSTWEEK', occurredDate: '2026-03-23', amountSent: 1232, note: 'last week' }),
      ],
      payments: [pay({ id: 'z', personName: 'Zach W', amount: 664.39, paidAt: '2026-04-30', memo: 'Cashapp 1000 - 335.61 owed back' })],
      firstReportStartByPerson: { Tristen: '2026-03-22', Taunya: '2026-03-22', 'Zach W': '2026-03-22' },
    })
    const kinds = Object.fromEntries(plan.actions.map((a) => ['txId' in a ? a.txId : '', a.kind + ('lane' in a ? ':' + a.lane : '')]))
    expect(kinds).toEqual({ '#D-A': 'review', '#D-E': 'lane:expense', '#D-OLD': 'lane:before_records', '#D-WHO': 'review', '#D-GIFT': 'review', '#D-ADV': 'record', '#D-FIRSTWEEK': 'review' })
    expect(plan.actions.find((a) => 'txId' in a && a.txId === '#D-FIRSTWEEK')).toEqual(expect.objectContaining({ why: expect.stringContaining('first week of records') }))
  })

  it('only pay-like notes become record candidates', () => {
    expect(isPayLikeNote('Week', 'pay')).toBe(true)
    expect(isPayLikeNote('Tristen last week', 'pay')).toBe(true)
    expect(isPayLikeNote('Advance', 'advance')).toBe(true)
    expect(isPayLikeNote('Everything we can', 'pay')).toBe(true)
    expect(isPayLikeNote('315', 'pay')).toBe(true)
    expect(isPayLikeNote('Tolls', 'pay')).toBe(false)
    expect(isPayLikeNote('Happy Birthday', 'pay')).toBe(false)
    expect(isPayLikeNote('Thank you', 'pay')).toBe(false)
    expect(isPayLikeNote('Gas', 'expense')).toBe(false)
  })

  it('links Mercury sends by amount for the alias-resolved person, preferring a Mercury memo, and counts pre-record ones', () => {
    const mercury: MercurySend[] = [
      { id: 'm-778', postedDate: '2026-05-28', amountSent: 778.4, counterparty: 'Taunya Villarreal', memo: 'From Click Plumbing for Tristen last week', personName: 'Tristen' },
      { id: 'm-500', postedDate: '2026-06-15', amountSent: 500, counterparty: 'Taunya Villarreal', memo: 'From Click Plumbing', personName: 'Taunya' },
      { id: 'm-near', postedDate: '2026-04-07', amountSent: 716.27, counterparty: 'Michael Archambault', memo: 'Week', personName: 'Michael A' },
      { id: 'm-none', postedDate: '2026-04-07', amountSent: 716.27, counterparty: 'Michael Archambault', memo: 'From Click Plumbing', personName: 'Michael A' },
      { id: 'm-old', postedDate: '2026-03-23', amountSent: 750, counterparty: 'Michael Archambault', memo: 'From Click Plumbing', personName: 'Michael A' },
      { id: 'm-zinna', postedDate: '2026-04-20', amountSent: 1500, counterparty: 'Michael Zinna', memo: '', personName: null },
    ]
    const plan = buildBackfillPlan({
      sends: [],
      payments: [
        pay({ id: 'tr', personName: 'Tristen', amount: 778.4, paidAt: '2026-05-27', memo: 'Tristen' }),
        pay({ id: 'ta-cash', personName: 'Taunya', amount: 500, paidAt: '2026-06-16', memo: '' }),
        pay({ id: 'mi', personName: 'Michael A', amount: 716.27, paidAt: '2026-04-06', memo: 'Mercury' }),
      ],
      mercury,
      firstReportStartByPerson: { 'Michael A': '2026-03-29' },
    })
    const links = plan.actions.filter((a) => a.kind === 'link')
    expect(links.map((a) => a.kind === 'link' && [a.paymentId, a.sourceId, a.rule])).toEqual([
      ['tr', 'm-778', 'mercury'],
      ['ta-cash', 'm-500', 'mercury'],
      ['mi', 'm-near', 'mercury'],
    ])
    expect(plan.mercuryBeforeRecords).toBe(1)
    const unmatched = plan.actions.filter((a) => a.kind === 'mercury_unmatched')
    expect(unmatched.map((a) => a.kind === 'mercury_unmatched' && a.mercuryId)).toEqual(['m-none', 'm-zinna'])
  })

  it('renders the plan as Markdown with one section per action kind', () => {
    const plan = buildBackfillPlan({
      sends: [send({ id: '#D-1', occurredDate: '2026-07-20', amountSent: 349.63 })],
      payments: [],
    })
    const md = renderBackfillPlan(plan, { title: 'Test plan' })
    expect(md).toContain('# Test plan')
    expect(md).toContain('## To record')
    expect(md).toContain('#D-1')
    expect(md).not.toContain('## Link')
  })
})
