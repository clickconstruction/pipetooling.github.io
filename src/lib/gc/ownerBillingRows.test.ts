/**
 * Our bills to the customer read back from their rows (./ownerBillingRows.ts), round trip: Fair Oaks D's
 * made-up bills (the test state) are written out as rows the way O4a's send will insert them, read back,
 * and the kernels read the same off them. Payments and paid days are O5c's, so they are left out of the
 * comparison: every bill reads unpaid until the Pipeline's own payments are read. Then money in on the billing
 * job (O5c): each bill's payments, the day it was paid, and the promises that cover it.
 */
import { describe, expect, it } from 'vitest'
import { ownerAccount, ownerPayApp, ownerPayAppForm, ownerPayAppsSent, sentPayAppLines } from './ownerBilling'
import { appOpen, appPaid } from './ownerBilling'
import {
  billMoney,
  ownerBillingFromRows,
  payAppFromRows,
  payAppLineKey,
  promisesOnBill,
  unbilledPayments,
  type OwnerBillingMoney,
  type OwnerBillingRows,
  type OwnerPayAppLineRow,
  type OwnerPayAppRow,
} from './ownerBillingRows'
import { initialGcState } from './schedule/testState'
import type { GcProject, GcState, OwnerPayAppSent } from './types'

const PROJECT = 'fairoaksd'

function lineKind(project: GcProject, key: string): OwnerPayAppLineRow['line'] {
  if (key === 'gc' || key === 'contingency' || key === 'fee') return key
  if (key.startsWith('co-')) return 'change_order'
  return project.packages.find((p) => p.id === key)?.selfPerform ? 'self' : 'trade'
}

/** A project's sent bills written out as rows. A made-up bill (no certificate kept) went certified as asked. */
function rowsOf(state: GcState, project: GcProject): OwnerBillingRows {
  const today = new Map(ownerPayApp(state, project).lines.map((l) => [l.id, l]))
  const sent = ownerPayAppsSent(project)
  return {
    payApps: sent.map((app) => {
      const certified = app.certified === undefined ? app.due : app.certified
      return {
        id: `app-${app.number}`,
        project_id: project.id,
        number: app.number,
        final: app.final === true,
        period_to: app.periodTo,
        sent_on: app.sentOn,
        sent_by: null,
        retainage_pct: app.retainagePct,
        retainage_step_at_pct: app.retainageStep?.atPct ?? null,
        retainage_step_to_pct: app.retainageStep?.toPct ?? null,
        retainage_step_way: app.retainageStep?.way ?? null,
        retainage: app.retainage,
        work_to_date: app.workToDate,
        due: app.due,
        certified,
        certified_on: certified === null ? null : (app.certifiedOn ?? app.sentOn),
        certified_note: app.certifiedNote ?? '',
        certified_by: null,
        conditional_waiver_id: null,
        invoice_id: null,
        created_at: `${app.sentOn}T15:00:00Z`,
      }
    }),
    lines: sent.flatMap((app) =>
      Object.entries(app.doneToDate).map(([key, done], position) => {
        const kind = lineKind(project, key)
        return {
          id: `app-${app.number}-${key}`,
          pay_app_id: `app-${app.number}`,
          position,
          line: kind,
          package_id: kind === 'trade' || kind === 'self' ? key : null,
          change_order_id: kind === 'change_order' ? key : null,
          label: today.get(key)?.label ?? key,
          worth: app.worthByLine?.[key] ?? today.get(key)?.worth ?? 0,
          done_to_date: done,
          stored: app.storedByLine?.[key] ?? 0,
        }
      }),
    ),
    reminders: sent.flatMap((app) =>
      (app.reminders ?? []).map((r, i) => ({
        id: `app-${app.number}-reminder-${i}`,
        pay_app_id: `app-${app.number}`,
        sent_on: r.on,
        sent_by: null,
        pay_by: r.by,
        note: r.note,
        subject: r.subject ?? '',
        lines: r.lines ?? [],
        // A made-up reminder went (its email with it) unless it says otherwise.
        email_send_log_id: r.emailed === false ? null : `log-${app.number}-${i}`,
        created_at: `${r.on}T15:00:0${i}Z`,
      })),
    ),
    interestBills: [],
    acceptance: null,
  }
}

/** The fields a bill keeps as it went, which the rows carry; the money is O5c's. */
const kept = (app: OwnerPayAppSent) => ({
  number: app.number,
  periodTo: app.periodTo,
  sentOn: app.sentOn,
  doneToDate: app.doneToDate,
  workToDate: app.workToDate,
  retainagePct: app.retainagePct,
  retainage: app.retainage,
  due: app.due,
  final: app.final === true,
  storedByLine: app.storedByLine,
  retainageStep: app.retainageStep,
  reminders: app.reminders?.map((r) => ({ ...r, emailed: r.emailed ?? true })),
})

describe('our bills to the customer, read back from their rows', () => {
  const state = initialGcState()
  const project = state.projects.find((p) => p.id === PROJECT)!
  const mapped = ownerBillingFromRows(rowsOf(state, project))!
  const read: GcProject = { ...project, ownerBilling: mapped }

  it('keeps every bill as it went: its lines, its retainage, what it asked', () => {
    expect(mapped.payApps!.map(kept)).toEqual(ownerPayAppsSent(project).map(kept))
  })

  it('reads every bill unpaid until the payments are read, and billed and held off the last one', () => {
    expect(mapped.payApps!.every((app) => app.paidOn === null)).toBe(true)
    const progress = ownerPayAppsSent(project).filter((a) => !a.final)
    const last = progress[progress.length - 1]!
    expect([mapped.billed, mapped.retainageHeld, mapped.paid]).toEqual([last.workToDate, last.retainage, 0])
  })

  it('gives the kernels the same next bill, the same lines on each sent one, and the same G703', () => {
    expect(ownerPayApp(state, read)).toEqual(ownerPayApp(state, project))
    for (const app of ownerPayAppsSent(project)) {
      expect(sentPayAppLines(state, read, app.number)).toEqual(sentPayAppLines(state, project, app.number))
      expect(ownerPayAppForm(state, read, app.number)?.app).toEqual(ownerPayAppForm(state, project, app.number)?.app)
    }
    const account = ownerAccount(read)!
    const before = ownerAccount(project)!
    expect([account.billed, account.retainageHeld, account.asked]).toEqual([before.billed, before.retainageHeld, before.asked])
  })

  it('keys each line the kernels’ way', () => {
    expect([
      payAppLineKey({ line: 'trade', package_id: 'p1', change_order_id: null }),
      payAppLineKey({ line: 'self', package_id: 'p2', change_order_id: null }),
      payAppLineKey({ line: 'change_order', package_id: null, change_order_id: 'co-1' }),
      payAppLineKey({ line: 'fee', package_id: null, change_order_id: null }),
    ]).toEqual(['p1', 'p2', 'co-1', 'fee'])
  })

  it('reads a waiting certificate, a step, stored materials, a reminder, an interest bill and the acceptance', () => {
    const rows = rowsOf(state, project)
    const first = rows.payApps[0]!
    const waiting = ownerBillingFromRows({
      ...rows,
      payApps: [{ ...first, certified: null, certified_on: null, retainage_step_at_pct: 50, retainage_step_to_pct: 5, retainage_step_way: 'after' }],
      lines: rows.lines.filter((l) => l.pay_app_id === first.id).map((l, i) => (i === 0 ? { ...l, stored: 1200 } : l)),
      reminders: [{ id: 'r1', pay_app_id: first.id, sent_on: '2026-10-02', sent_by: null, pay_by: '2026-10-07', note: 'Thank you.', subject: 'Reminder', lines: ['Hello'], email_send_log_id: null, created_at: '2026-10-02T15:00:00Z' }],
      interestBills: [{ id: 'i1', project_id: project.id, number: 1, sent_on: '2026-10-02', amount: 412.5, invoice_id: null, created_by: null, created_at: '2026-10-02T15:00:00Z' }],
      acceptance: { project_id: project.id, accepted_on: '2026-10-01', accepted_by_name: 'Elena Marchetti', how: 'office', note: '', recorded_by: null, created_at: '2026-10-01T15:00:00Z' },
    })!
    const app = waiting.payApps![0]!
    expect([app.certified, app.certifiedOn, app.retainageStep]).toEqual([null, null, { atPct: 50, toPct: 5, way: 'after' }])
    expect(Object.values(app.storedByLine ?? {})).toEqual([1200])
    // No log on it: filed, but its email did not go (O5b).
    expect(app.reminders).toEqual([{ on: '2026-10-02', by: '2026-10-07', note: 'Thank you.', subject: 'Reminder', lines: ['Hello'], emailed: false }])
    expect([waiting.interestBills, waiting.acceptedOn]).toEqual([[{ number: 1, sentOn: '2026-10-02', amount: 412.5, paidOn: null }], '2026-10-01'])
  })

  it('reads nothing on a project with no bills yet', () => {
    expect(ownerBillingFromRows({ payApps: [], lines: [], reminders: [], interestBills: [], acceptance: null })).toBeNull()
  })
})

describe('money in on the billing job (O5c)', () => {
  const app = (over: Partial<OwnerPayAppRow> = {}): OwnerPayAppRow => ({
    id: 'a1',
    project_id: PROJECT,
    number: 1,
    final: false,
    period_to: '2026-09-25',
    sent_on: '2026-09-25',
    sent_by: null,
    retainage_pct: 10,
    retainage_step_at_pct: null,
    retainage_step_to_pct: null,
    retainage_step_way: null,
    retainage: 100,
    work_to_date: 1000,
    due: 900,
    certified: 900,
    certified_on: '2026-09-30',
    certified_note: '',
    certified_by: null,
    invoice_id: 'inv-1',
    conditional_waiver_id: null,
    created_at: '2026-09-25T15:00:00Z',
    ...over,
  })
  const money = (over: Partial<OwnerBillingMoney> = {}): OwnerBillingMoney => ({
    bills: [{ id: 'inv-1', amount: 900, status: 'billed' }],
    payments: [],
    promises: [],
    ...over,
  })

  it('reads a bill\'s payments oldest first, paid on the day the last of it came', () => {
    const m = money({
      bills: [{ id: 'inv-1', amount: 900, status: 'paid' }],
      payments: [
        { invoice_id: 'inv-1', amount: 600, paid_on: '2026-10-20' },
        { invoice_id: 'inv-1', amount: 300, paid_on: '2026-10-05' },
      ],
    })
    const read = payAppFromRows(app(), [], [], m)
    expect([read.payments, read.paidOn]).toEqual([[{ on: '2026-10-05', amount: 300 }, { on: '2026-10-20', amount: 600 }], '2026-10-20'])
    expect([appPaid(read), appOpen(read)]).toEqual([900, 0])
  })

  it('says the day the app reminded the architect, in the office’s day (O10), and only its own pay application’s', () => {
    const notices = [
      { pay_app_id: 'a1', kind: 'certify_reminder', created_at: '2026-10-06T02:30:00Z' },
      { pay_app_id: 'a2', kind: 'certify_reminder', created_at: '2026-10-09T15:00:00Z' },
    ]
    expect(payAppFromRows(app(), [], [], money(), notices).architectRemindedOn).toBe('2026-10-05')
    expect(payAppFromRows(app(), [], [], money(), []).architectRemindedOn).toBeUndefined()
    expect(payAppFromRows(app({ id: 'a3' }), [], [], money(), notices).architectRemindedOn).toBeUndefined()
  })

  it('leaves the rest of a part payment open, and closes a written-down bill on its last payment\'s day', () => {
    const part = payAppFromRows(app(), [], [], money({ payments: [{ invoice_id: 'inv-1', amount: 300, paid_on: '2026-10-05' }] }))
    expect([part.paidOn, appPaid(part), appOpen(part)]).toEqual([null, 300, 600])
    const writtenDown = billMoney(money({ bills: [{ id: 'inv-1', amount: 900, status: 'paid' }], payments: [{ invoice_id: 'inv-1', amount: 500, paid_on: '2026-10-08' }] }), 'inv-1')
    expect(writtenDown.paidOn).toBe('2026-10-08')
  })

  it('lays each promise on every bill open when it was made, in the app\'s day, the customer\'s own as theirs', () => {
    const m = money({
      promises: [
        { promisedYmd: '2026-11-05', createdAt: '2026-10-15T15:00:00Z', source: 'customer', note: ' Check is cut. ' },
        { promisedYmd: '2026-10-30', createdAt: '2026-10-10T03:00:00Z', source: 'office', note: null },
        { promisedYmd: '2026-10-01', createdAt: '2026-09-20T15:00:00Z', source: 'office', note: 'Before the bill' },
      ],
    })
    expect(payAppFromRows(app(), [], [], m).promises).toEqual([
      // 03:00 UTC on Oct 10 is the evening of Oct 9 in the app's day.
      { by: '2026-10-30', madeOn: '2026-10-09', note: '', who: 'office' },
      { by: '2026-11-05', madeOn: '2026-10-15', note: 'Check is cut.', who: 'owner' },
    ])
    // Paid on Oct 12: the promise made after it does not cover it.
    expect(promisesOnBill(m, '2026-09-30', '2026-10-12').map((p) => p.by)).toEqual(['2026-10-30'])
  })

  it('reads no money on a pay application with no bill, and lists a payment that names no bill as it is', () => {
    const m = money({ payments: [{ invoice_id: null, amount: 250, paid_on: '2026-10-03' }, { invoice_id: 'inv-1', amount: 100, paid_on: '2026-10-02' }] })
    const waiting = payAppFromRows(app({ invoice_id: null, certified: null, certified_on: null }), [], [], m)
    expect([waiting.payments, waiting.promises, waiting.paidOn]).toEqual([undefined, undefined, null])
    expect(unbilledPayments(m)).toEqual([{ on: '2026-10-03', amount: 250 }])
  })

  it('adds up what they paid, and reads an interest bill\'s paid day off its bill the same way', () => {
    const billing = ownerBillingFromRows({
      payApps: [app(), app({ id: 'a2', number: 2, period_to: '2026-10-25', sent_on: '2026-10-25', invoice_id: 'inv-2', certified_on: '2026-10-28' })],
      lines: [],
      reminders: [],
      interestBills: [{ id: 'i1', project_id: PROJECT, number: 1, sent_on: '2026-10-02', amount: 40, invoice_id: 'inv-9', created_by: null, created_at: '2026-10-02T15:00:00Z' }],
      acceptance: null,
      money: money({
        bills: [{ id: 'inv-1', amount: 900, status: 'paid' }, { id: 'inv-2', amount: 900, status: 'billed' }, { id: 'inv-9', amount: 40, status: 'paid' }],
        payments: [
          { invoice_id: 'inv-1', amount: 900, paid_on: '2026-10-10' },
          { invoice_id: 'inv-2', amount: 200, paid_on: '2026-10-30' },
          { invoice_id: 'inv-9', amount: 40, paid_on: '2026-10-11' },
        ],
      }),
    })!
    expect([billing.paid, billing.payApps!.map((a) => a.paidOn), billing.interestBills![0]!.paidOn]).toEqual([1100, ['2026-10-10', null], '2026-10-11'])
  })
})
