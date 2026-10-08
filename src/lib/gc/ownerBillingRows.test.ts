/**
 * Our bills to the customer read back from their rows (./ownerBillingRows.ts), round trip: Fair Oaks D's
 * made-up bills (the test state) are written out as rows the way O4a's send will insert them, read back,
 * and the kernels read the same off them. Payments and paid days are O5c's, so they are left out of the
 * comparison: every bill reads unpaid until the Pipeline's own payments are read.
 */
import { describe, expect, it } from 'vitest'
import { ownerAccount, ownerPayApp, ownerPayAppForm, ownerPayAppsSent, sentPayAppLines } from './ownerBilling'
import { ownerBillingFromRows, payAppLineKey, type OwnerBillingRows, type OwnerPayAppLineRow } from './ownerBillingRows'
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
        email_send_log_id: null,
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
  reminders: app.reminders,
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
    expect(app.reminders).toEqual([{ on: '2026-10-02', by: '2026-10-07', note: 'Thank you.', subject: 'Reminder', lines: ['Hello'] }])
    expect([waiting.interestBills, waiting.acceptedOn]).toEqual([[{ number: 1, sentOn: '2026-10-02', amount: 412.5, paidOn: null }], '2026-10-01'])
  })

  it('reads nothing on a project with no bills yet', () => {
    expect(ownerBillingFromRows({ payApps: [], lines: [], reminders: [], interestBills: [], acceptance: null })).toBeNull()
  })
})
