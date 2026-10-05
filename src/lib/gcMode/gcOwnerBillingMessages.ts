/**
 * GC mode — design spike: every email a customer gets on one job, written out (owner's go-ahead
 * 2026-10-04), the way the trade's **Their messages** shows its own. Nothing is sent (email only,
 * question 29, in the real build). Ours: a pay application sent, certified, paid, reminded; a
 * change order to sign; an interest bill; the work billed in full and accepted. The Board lane's:
 * our contract to sign and its change-order reminders, through its own builders. The Building
 * lane's weekly reports, as each went (`project.weeklyReports`).
 *
 * Import from `./gcModel`.
 */
import type { GcCustomer, GcProject, GcState, OwnerPayAppSent } from './gcTypes'
import { GC_COMPANY } from './gcFixture'
import { money, shortDate, weekdayDate } from './gcWords'
import {
  appCertified,
  appClaimed,
  changeOrderDays,
  daysWords,
  ownerAllBilled,
  ownerExpectPaidOn,
  ownerPayAppsSent,
  projectChangeOrders,
} from './gcOwnerBilling'
import { contractEmail, customerReminderEmail, customerSendsFor } from './gcCustomerSend'
import { customerGreeting, payReminderEmail } from './gcOwnerBillingRemind'

export type CustomerMessageKind =
  | 'contract'
  | 'payApp'
  | 'certified'
  | 'reminder'
  | 'paid'
  | 'changeOrder'
  | 'changeReminder'
  | 'interest'
  | 'interestPaid'
  | 'acceptAsk'
  | 'accepted'
  | 'weekly'

export interface CustomerMessage {
  key: string
  on: string
  kind: CustomerMessageKind
  subject: string
  /** The email, one paragraph a line. */
  lines: string[]
}

/** On one day, what came after what: a payment after the bill, a thank-you after the ask. */
const KIND_ORDER: Record<CustomerMessageKind, number> = {
  accepted: 0,
  interestPaid: 1,
  paid: 2,
  interest: 3,
  reminder: 4,
  certified: 5,
  acceptAsk: 6,
  payApp: 7,
  changeReminder: 8,
  changeOrder: 9,
  contract: 10,
  weekly: 11,
}

function billWords(app: OwnerPayAppSent): { name: string; Name: string } {
  const name = app.final ? 'our final pay application' : `pay application ${app.number}`
  return { name, Name: name.charAt(0).toUpperCase() + name.slice(1) }
}

/** Every email the customer gets on this job, newest first. */
export function customerMessages(state: GcState, project: GcProject): CustomerMessage[] {
  const customer: GcCustomer | undefined = state.customers.find((c) => c.id === project.customerId)
  const hello = `Hello ${customerGreeting(customer, project.owner)},`
  const portal = customer?.portalOn === true
  const job = project.name
  const out: CustomerMessage[] = []

  // The Board lane's: our contract to sign, and the change orders' reminders.
  if (customer) {
    for (const send of customerSendsFor(state, customer.id, 'contract', project.id)) {
      const mail = contractEmail(customer, project, send.first === true, send.by, send.note)
      out.push({ key: `contract-${send.id}`, on: send.on, kind: 'contract', ...mail })
    }
  }

  const sent = ownerPayAppsSent(project)
  for (const app of sent) {
    const { name, Name } = billWords(app)
    out.push({
      key: `payapp-${app.number}`,
      on: app.sentOn,
      kind: 'payApp',
      subject: `${Name} for ${job}, ${money(app.due)}`,
      lines: [
        hello,
        app.final
          ? `${Name} for ${job} asks for the ${money(app.due)} you held. Every line is done.`
          : `${Name} for ${job} asks for ${money(app.due)}. It bills the work done through ${shortDate(app.periodTo)}, less the ${app.retainagePct}% you hold and the bills before it.`,
        `${project.architect} certifies it first. We will tell you when they do.`,
        `Our conditional lien waiver for ${money(app.due)} is attached.`,
        portal ? 'Open your portal to see every line and the form.' : 'The pay application is attached.',
      ],
    })

    const certified = appCertified(app)
    if (certified !== null && app.certifiedOn) {
      const less = app.due - certified
      const expect = ownerExpectPaidOn(state, project, app)
      out.push({
        key: `certified-${app.number}`,
        on: app.certifiedOn,
        kind: 'certified',
        subject: `${project.architect} certified ${name}, ${money(certified)}`,
        lines: [
          hello,
          `${project.architect} certified ${name} for ${job} at ${money(certified)}.`,
          ...(less > 0.5 ? [`That is ${money(less)} less than we asked. It comes back on the next bill once the work is done.`] : []),
          ...(expect ? [`We expect it by ${weekdayDate(expect)}.`] : []),
          portal ? 'Pay it in your portal, by card or bank transfer.' : 'Reply with the day you will pay.',
        ],
      })
    }

    for (const [i, r] of (app.reminders ?? []).entries()) {
      const mail = r.subject && r.lines ? { subject: r.subject, lines: r.lines } : payReminderEmail(state, customer, project, app.number, r.by, r.note)
      out.push({ key: `reminder-${app.number}-${i}`, on: r.on, kind: 'reminder', ...mail })
    }

    // Each payment: a thank-you with our unconditional waiver for what it paid.
    const payments = app.payments ?? (app.paidOn ? [{ on: app.paidOn, amount: app.paidAmount ?? appClaimed(app) }] : [])
    let paidSoFar = 0
    for (const [i, p] of payments.entries()) {
      paidSoFar += p.amount
      const left = appClaimed(app) - paidSoFar
      out.push({
        key: `paid-${app.number}-${i}`,
        on: p.on,
        kind: 'paid',
        subject: `Thank you: ${money(p.amount)} for ${name}`,
        lines: [
          hello,
          `We received ${money(p.amount)} for ${name} on ${job}.`,
          left > 0.5 ? `${money(left)} is still open on it.` : 'It is paid in full.',
          `Our unconditional lien waiver for ${money(p.amount)} is attached.`,
        ],
      })
    }
  }

  // Every line billed: the ask to walk the space and accept the work, then the thank-you.
  const progress = sent.filter((a) => !a.final)
  const lastProgress = progress[progress.length - 1]
  const acceptedOn = project.ownerBilling?.acceptedOn ?? null
  if (lastProgress && ownerAllBilled(state, project)) {
    out.push({
      key: 'accept-ask',
      on: lastProgress.sentOn,
      kind: 'acceptAsk',
      subject: `${job}: every line is billed`,
      lines: [
        hello,
        `Every line of ${job} is billed.`,
        'Walk the space with us. When the punch list is done, accept the work in your portal.',
        `Then our last bill asks for the ${money(lastProgress.retainage)} you hold.`,
      ],
    })
  }
  if (acceptedOn) {
    out.push({
      key: 'accepted',
      on: acceptedOn,
      kind: 'accepted',
      subject: `Thank you for accepting ${job}`,
      lines: [hello, `You accepted the work on ${job}.`, 'Our final pay application comes next. It asks for what you hold.'],
    })
  }

  // Change orders: the one to sign, and the Board's reminders for it.
  for (const co of projectChangeOrders(project)) {
    if (co.status === 'draft' || !co.sentOn) continue
    const days = changeOrderDays(co)
    out.push({
      key: `co-${co.id}`,
      on: co.sentOn,
      kind: 'changeOrder',
      subject: `Change order ${co.number} for ${job}, ${co.price < 0 ? '−' : '+'}${money(Math.abs(co.price))}`,
      lines: [
        hello,
        `Change order ${co.number} for ${job} is ready for your signature: ${co.description.trim().replace(/[.\s]+$/, '')}.`,
        `It ${co.price < 0 ? 'takes' : 'adds'} ${money(Math.abs(co.price))} ${co.price < 0 ? 'off' : 'to'} your price.${days > 0 ? ` It adds ${daysWords(days)} to the job.` : ''}`,
        portal ? 'Sign it or decline it in your portal.' : 'Reply to sign it, or with any questions.',
      ],
    })
    if (customer) {
      for (const send of customerSendsFor(state, customer.id, 'changeOrder', project.id, co.id)) {
        const mail = customerReminderEmail(customer, project, co, send.by, send.note)
        out.push({ key: `co-reminder-${send.id}`, on: send.on, kind: 'changeReminder', ...mail })
      }
    }
  }

  // Interest on late bills: a bill of its own, then the thank-you.
  const pct = project.ownerLateInterest?.pctPerMonth
  for (const bill of project.ownerBilling?.interestBills ?? []) {
    out.push({
      key: `interest-${bill.number}`,
      on: bill.sentOn,
      kind: 'interest',
      subject: `Interest on late bills for ${job}, ${money(bill.amount)}`,
      lines: [
        hello,
        `Some of your bills on ${job} were paid after the day they were due.`,
        `The interest on them comes to ${money(bill.amount)}${pct ? `, at ${pct}% a month` : ''}.`,
        portal ? 'Pay it in your portal.' : 'Reply with the day you will pay.',
      ],
    })
    if (bill.paidOn) {
      out.push({
        key: `interest-paid-${bill.number}`,
        on: bill.paidOn,
        kind: 'interestPaid',
        subject: `Thank you: ${money(bill.amount)} of interest`,
        lines: [hello, `We received ${money(bill.amount)} for the interest on ${job}.`],
      })
    }
  }

  // The Building lane's weekly reports, as each went.
  for (const report of project.weeklyReports ?? []) {
    out.push({
      key: `weekly-${report.weekOf}-${report.sentOn}`,
      on: report.sentOn,
      kind: 'weekly',
      subject: report.subject,
      lines: report.body.split('\n').map((l) => l.trim()).filter((l) => l !== ''),
    })
  }

  return out.sort((a, b) => b.on.localeCompare(a.on) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
}

/** Who the emails go to and from, for the message's header. */
export function customerMessageParties(state: GcState, project: GcProject): { from: string; to: string } {
  const customer = state.customers.find((c) => c.id === project.customerId)
  return { from: GC_COMPANY.name, to: customer ? `${customer.contact}, ${customer.name}` : project.owner }
}
