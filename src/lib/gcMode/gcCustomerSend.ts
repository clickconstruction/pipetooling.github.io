/**
 * GC mode — design spike: remind a customer from its window (the owner, 2026-10-04, after send a
 * paper): a change order waiting on their signature gets **Remind them**, with the day to sign by,
 * a line of your own and the email as they will get it. Payment reminders are Owner Billing's to
 * shape; our contract has no send yet (how the customer signs it is the owner's call).
 */
import type { ChangeOrder, CustomerSend, GcCustomer, GcProject, GcState } from './gcTypes'
import { daysUntil, money, shortDate, weekdayDate } from './gcWords'

export interface CustomerStep {
  docKey: string
  projectId: string
  changeOrderId: string
  title: string
  history: string
  sendLabel: string
  dayWord: string
}

function ago(iso: string, today: string): string {
  const days = -daysUntil(iso, today)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

/** Change orders sent to this customer and not answered, on the jobs they are the customer on. */
export function changeOrdersWaitingOn(state: GcState, customer: GcCustomer): { project: GcProject; co: ChangeOrder }[] {
  return state.projects
    .filter((p) => p.customerId === customer.id && !p.lostOn)
    .flatMap((project) => (project.changeOrders ?? []).filter((co) => co.status === 'sent').map((co) => ({ project, co })))
}

export function customerSendsFor(state: GcState, customerId: string, changeOrderId: string): CustomerSend[] {
  return (state.customerSends ?? []).filter((s) => s.customerId === customerId && s.changeOrderId === changeOrderId)
}

/** The next step on a customer's paper, by its Documents key (`co-<id>`). Null: nothing to send. */
export function customerStep(state: GcState, customer: GcCustomer, docKey: string): CustomerStep | null {
  if (!docKey.startsWith('co-')) return null
  const found = changeOrdersWaitingOn(state, customer).find(({ co }) => `co-${co.id}` === docKey)
  if (!found) return null
  const { project, co } = found
  const sends = customerSendsFor(state, customer.id, co.id)
  const last = sends[sends.length - 1]
  const sent = co.sentOn ? `Sent ${shortDate(co.sentOn)}, ${ago(co.sentOn, state.today)}.` : 'Sent.'
  return {
    docKey,
    projectId: project.id,
    changeOrderId: co.id,
    title: `Remind them to sign change order ${co.number}`,
    history: last ? `${sent} Reminded ${sends.length === 1 ? 'once' : `${sends.length} times`}, last ${shortDate(last.on)}.` : `${sent} This is the first reminder.`,
    sendLabel: 'Send the reminder',
    dayWord: 'Sign by',
  }
}

/** The reminder as the customer will read it. */
export function customerReminderEmail(customer: GcCustomer, project: GcProject, co: ChangeOrder, by: string, note: string): { subject: string; lines: string[] } {
  // "Dr. Priya Raman" is greeted "Dr. Raman", not "Dr.": a title keeps the last name.
  const words = (customer.contact || customer.name).split(/\s+/)
  const titled = /^(Dr|Mr|Mrs|Ms)\.?$/i.test(words[0] ?? '')
  const first = titled ? `${words[0]} ${words[words.length - 1]}` : (words[0] ?? customer.name)
  return {
    subject: `Reminder: change order ${co.number} for ${project.name}`,
    lines: [
      `Hello ${first},`,
      `Change order ${co.number} for ${project.name} is waiting on your signature: ${co.description}, ${money(co.price)}.`,
      `Please sign it by ${weekdayDate(by)}.`,
      ...(note.trim() ? [note.trim()] : []),
      customer.portalOn ? 'Open your portal to read it and sign it.' : 'Reply to this email with any questions, and we will walk you through it.',
    ],
  }
}

/** The Documents row's line once a reminder went: "Reminded today · sign by Fri Oct 9." */
export function customerSentWords(state: GcState, customerId: string, changeOrderId: string): string | null {
  const sends = customerSendsFor(state, customerId, changeOrderId)
  const last = sends[sends.length - 1]
  return last ? `Reminded ${ago(last.on, state.today)} · sign by ${weekdayDate(last.by)}.` : null
}

/** A reminder's day that passed with the change order still not signed: the customer reads late. */
export function customerReminderLate(state: GcState, customerId: string, changeOrderId: string): boolean {
  const sends = customerSendsFor(state, customerId, changeOrderId)
  const last = sends[sends.length - 1]
  return Boolean(last && daysUntil(last.by, state.today) < 0)
}
