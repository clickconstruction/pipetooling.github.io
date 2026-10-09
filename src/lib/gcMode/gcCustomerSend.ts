/**
 * GC mode — design spike: send a customer a paper from its window (the owner, 2026-10-04, after
 * send a paper). Our contract goes to them to sign in their portal ("they sign it in their
 * portal"), then reminders; a change order waiting on their signature gets **Remind them**. Each
 * send has the day to sign by, a line of your own and the email as they will get it. Payment
 * reminders are Owner Billing's (gcOwnerBillingRemind.ts).
 */
import type { ChangeOrder, GcCustomer, GcProject, GcState } from './gcTypes'
import { daysUntil, money, shortDate, weekdayDate } from './gcWords'
import { priceToOwner } from './gcCustomers'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import { customerSendsFor } from '../gc/customerSend'
export { contractWaitingOn, customerReminderLate, customerSendsFor, customerSentWords } from '../gc/customerSend'

export interface CustomerStep {
  docKey: string
  paper: 'contract' | 'changeOrder'
  projectId: string
  changeOrderId?: string
  /** first: our contract has not gone to them yet. reminder: it went, or the change order did. */
  mode: 'first' | 'reminder'
  /** The row's button: "Send to sign" or "Remind them". */
  verb: string
  title: string
  history: string
  sendLabel: string
  dayWord: string
}

function ago(iso: string, today: string): string {
  const days = -daysUntil(iso, today)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

/** "Dr. Priya Raman" is greeted "Dr. Raman", not "Dr.": a title keeps the last name. */
function greetingName(customer: GcCustomer): string {
  const words = (customer.contact || customer.name).split(/\s+/)
  const titled = /^(Dr|Mr|Mrs|Ms)\.?$/i.test(words[0] ?? '')
  return titled ? `${words[0]} ${words[words.length - 1]}` : (words[0] ?? customer.name)
}

/** Change orders sent to this customer and not answered, on the jobs they are the customer on. */
export function changeOrdersWaitingOn(state: GcState, customer: GcCustomer): { project: GcProject; co: ChangeOrder }[] {
  return state.projects
    .filter((p) => p.customerId === customer.id && !p.lostOn)
    .flatMap((project) => (project.changeOrders ?? []).filter((co) => co.status === 'sent').map((co) => ({ project, co })))
}

/**
 * The next step on a customer's paper, by its Documents key: `contract-<project>` (send our contract
 * to sign, then remind) or `co-<change order>` (remind). Null: nothing to send.
 */
export function customerStep(state: GcState, customer: GcCustomer, docKey: string): CustomerStep | null {
  if (docKey.startsWith('contract-')) {
    const project = state.projects.find((p) => `contract-${p.id}` === docKey)
    if (!project || project.customerId !== customer.id || project.stage === 'pursuing' || project.lostOn || project.ownerContractSignedOn) return null
    const base = { docKey, paper: 'contract' as const, projectId: project.id, dayWord: 'Sign by' }
    if (!project.ownerContractSentOn) {
      return {
        ...base,
        mode: 'first',
        verb: 'Send to sign',
        title: 'Send our contract to sign in their portal',
        history: customer.portalOn ? 'Not sent yet. They read it and sign it in their portal.' : 'Not sent yet. Sending it turns their portal on: they sign it there.',
        sendLabel: 'Send to sign',
      }
    }
    const reminders = customerSendsFor(state, customer.id, 'contract', project.id).filter((s) => !s.first)
    const last = reminders[reminders.length - 1]
    const sent = `Sent ${shortDate(project.ownerContractSentOn)}, ${ago(project.ownerContractSentOn, state.today)}.`
    return {
      ...base,
      mode: 'reminder',
      verb: 'Remind them',
      title: 'Remind them to sign our contract',
      history: last ? `${sent} Reminded ${reminders.length === 1 ? 'once' : `${reminders.length} times`}, last ${shortDate(last.on)}.` : `${sent} This is the first reminder.`,
      sendLabel: 'Send the reminder',
    }
  }
  if (!docKey.startsWith('co-')) return null
  const found = changeOrdersWaitingOn(state, customer).find(({ co }) => `co-${co.id}` === docKey)
  if (!found) return null
  const { project, co } = found
  const sends = customerSendsFor(state, customer.id, 'changeOrder', project.id, co.id)
  const last = sends[sends.length - 1]
  const sent = co.sentOn ? `Sent ${shortDate(co.sentOn)}, ${ago(co.sentOn, state.today)}.` : 'Sent.'
  return {
    docKey,
    paper: 'changeOrder',
    projectId: project.id,
    changeOrderId: co.id,
    mode: 'reminder',
    verb: 'Remind them',
    title: `Remind them to sign change order ${co.number}`,
    history: last ? `${sent} Reminded ${sends.length === 1 ? 'once' : `${sends.length} times`}, last ${shortDate(last.on)}.` : `${sent} This is the first reminder.`,
    sendLabel: 'Send the reminder',
    dayWord: 'Sign by',
  }
}

/** A change order's reminder as the customer will read it. */
export function customerReminderEmail(customer: GcCustomer, project: GcProject, co: ChangeOrder, by: string, note: string): { subject: string; lines: string[] } {
  return {
    subject: `Reminder: change order ${co.number} for ${project.name}`,
    lines: [
      `Hello ${greetingName(customer)},`,
      `Change order ${co.number} for ${project.name} is waiting on your signature: ${co.description}, ${money(co.price)}.`,
      `Please sign it by ${weekdayDate(by)}.`,
      ...(note.trim() ? [note.trim()] : []),
      customer.portalOn ? 'Open your portal to read it and sign it.' : 'Reply to this email with any questions, and we will walk you through it.',
    ],
  }
}

/** Our contract's email, the first or a reminder. They always sign in their portal: the first send turns it on. */
export function contractEmail(customer: GcCustomer, project: GcProject, first: boolean, by: string, note: string): { subject: string; lines: string[] } {
  const price = money(priceToOwner(project).price)
  return {
    subject: first ? `Your contract for ${project.name}` : `Reminder: your contract for ${project.name}`,
    lines: [
      `Hello ${greetingName(customer)},`,
      first
        ? `Thank you for choosing us for ${project.name}. Here is our contract for it: ${price}.`
        : `Our contract for ${project.name} is still waiting on your signature: ${price}.`,
      `Please sign it by ${weekdayDate(by)}.`,
      ...(note.trim() ? [note.trim()] : []),
      'Open your portal to read it and sign it. Your bills, change orders and papers for the job will be there too.',
    ],
  }
}
