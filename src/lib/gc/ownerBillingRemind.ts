/**
 * GC mode, the real build, Owner Billing's O2a: reminding a customer to pay a late bill, moved word for word from the GC mode
 * prototype (branch spike/gc-mode, `gcOwnerBillingRemind.ts`).
 */
import { addDays } from './building'
import { appCertified, appOpen, ownerPayAppsSent, ownerPayDue } from './ownerBilling'
import { ownerInterestOnBill } from './ownerBillingInterest'
import type { GcCustomer, GcProject, GcState, OwnerPayAppSent } from './types'
import { daysUntil, money, shortDate, weekdayDate } from './words'

/** The pay-by day the office starts from: this many days from today. */
export const PAY_REMINDER_DAYS = 5

export interface PayReminderStep {
  docKey: string
  projectId: string
  number: number
  title: string
  history: string
  sendLabel: string
  dayWord: string
  /** The line under the day in the send view. */
  dayNote: string
  /** The pay-by day the office starts from. */
  by: string
}

function ago(iso: string, today: string): string {
  const days = -daysUntil(iso, today)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

function billOf(project: GcProject, number: number): OwnerPayAppSent | undefined {
  return ownerPayAppsSent(project).find((a) => a.number === number)
}

function billName(app: OwnerPayAppSent): string {
  return app.final ? 'the final pay application' : `pay application ${app.number}`
}

/**
 * Whether a bill can be reminded: certified, not paid, a dollar or more open, past the day it was
 * due. Null when it cannot, with nothing to say.
 */
export function payReminderStep(state: GcState, project: GcProject, number: number): PayReminderStep | null {
  const app = billOf(project, number)
  if (!app || app.paidOn !== null || appCertified(app) === null || appOpen(app) < 1) return null
  const due = ownerPayDue(state, project, app)
  if (due.daysLate <= 0 || due.on === null) return null
  const sent = (app.reminders ?? []).length
  const last = app.reminders?.[sent - 1]
  const late = `Due ${shortDate(due.on)}, ${due.daysLate === 1 ? '1 day' : `${due.daysLate} days`} late.`
  return {
    docKey: `payapp-${project.id}-${app.number}`,
    projectId: project.id,
    number: app.number,
    title: `Remind them to pay ${billName(app)}`,
    history: last ? `${late} Reminded ${sent === 1 ? 'once' : `${sent} times`}, last ${shortDate(last.on)}.` : `${late} This is the first reminder.`,
    sendLabel: 'Send the reminder',
    dayWord: 'Pay by',
    dayNote: 'This is our ask, not their promise. The day the bill was due stays.',
    by: addDays(state.today, PAY_REMINDER_DAYS),
  }
}

/** How the email greets them: the contact's first name, or a title with the last name ("Dr. Raman"). */
export function customerGreeting(customer: GcCustomer | undefined, fallback: string): string {
  // "Dr. Priya Raman" is greeted "Dr. Raman": a title keeps the last name (the Board's rule).
  const words = (customer?.contact || customer?.name || fallback).split(/\s+/)
  const titled = /^(Dr|Mr|Mrs|Ms)\.?$/i.test(words[0] ?? '')
  return titled ? `${words[0]} ${words[words.length - 1]}` : (words[0] ?? fallback)
}

/** The reminder as the customer will read it. */
export function payReminderEmail(
  state: GcState,
  customer: GcCustomer | undefined,
  project: GcProject,
  number: number,
  by: string,
  note: string,
): { subject: string; lines: string[] } {
  const app = billOf(project, number)
  if (!app) return { subject: '', lines: [] }
  const due = ownerPayDue(state, project, app)
  const open = appOpen(app)
  const name = billName(app)
  const Name = name.charAt(0).toUpperCase() + name.slice(1)
  const paidPart = (app.payments ?? []).filter((p) => p.amount > 0)
  const lastPaid = paidPart[paidPart.length - 1]
  const pct = project.ownerLateInterest?.pctPerMonth
  const interest = pct ? ownerInterestOnBill(state, project, app, pct) : null
  return {
    subject: `Reminder: ${name} for ${project.name}, ${money(open)}`,
    lines: [
      `Hello ${customerGreeting(customer, project.owner)},`,
      `${Name} for ${project.name} has ${money(open)} still open. It was due ${weekdayDate(due.on)}, ${due.promised ? 'the day you gave' : 'the day we expected it'}.`,
      ...(lastPaid ? [`Thank you for the ${money(lastPaid.amount)} you paid ${shortDate(lastPaid.on)}.`] : []),
      ...(interest && pct ? [`Interest of ${pct}% a month runs on it from ${shortDate(interest.from)}. ${money(interest.amount)} has built up so far.`] : []),
      `Please pay it by ${weekdayDate(by)}.`,
      ...(note.trim() ? [note.trim()] : []),
      customer?.portalOn ? 'Pay it in your portal, by card or bank transfer.' : 'Reply with the day you will pay.',
      'Our unconditional lien waiver for it comes to you the day it is paid.',
    ],
  }
}

export interface LatePayApp {
  number: number
  /** The day it was due: their newest promise or the day we expected it. */
  due: string
  daysLate: number
  open: number
}

/** The bills on a job that can be reminded: certified, not paid, open, past their due day. Latest first. */
export function latePayApps(state: GcState, project: GcProject): LatePayApp[] {
  return ownerPayAppsSent(project)
    .filter((app) => app.paidOn === null && appCertified(app) !== null && appOpen(app) >= 1)
    .flatMap((app) => {
      const due = ownerPayDue(state, project, app)
      return due.daysLate > 0 && due.on !== null ? [{ number: app.number, due: due.on, daysLate: due.daysLate, open: appOpen(app) }] : []
    })
    .sort((a, b) => b.daysLate - a.daysLate)
}

/** The bill's line once a reminder went: "Reminded today · pay by Wed Oct 7." Null: none sent. */
export function payReminderSentWords(state: GcState, project: GcProject, number: number): string | null {
  const last = billOf(project, number)?.reminders?.slice(-1)[0]
  return last ? `Reminded ${ago(last.on, state.today)} · pay by ${weekdayDate(last.by)}.` : null
}
