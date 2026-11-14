/**
 * Pay terms an estimator read on a won bid (punch list #323, the owner's call of 2026-11-13).
 *
 * An estimator reads the GC's contract and may not set a Pay calendar: the calendar's two gates
 * are the money team's, and the estimator sees no bill and no payment. So the terms ride the job
 * draft the estimator already sends to Dispatch (`JobDraft.payTerms`), and the office makes them
 * the calendar: in New Job, where they set with the job, or later on the job's Pay calendar row.
 * The estimator says whose the terms are, since a contract's terms are sometimes one job's and
 * sometimes the GC's on every job.
 *
 * Pure: no React, no supabase. The calendar itself is `payCalendar.ts`'s.
 */
import { normalizePayCalendar, payCalendarShort, type PayCalendar, type PayCalendarSource } from './payCalendar'

/** Whose terms they are: this job's alone, or the payer's on every job. */
export type DraftPayTermsScope = 'job' | 'payer'

export type DraftPayTerms = {
  scope: DraftPayTermsScope
  calendar: PayCalendar
}

/** What the part opens on: this job, the smaller reach. */
export const DRAFT_PAY_TERMS_SCOPE_DEFAULT: DraftPayTermsScope = 'job'

/** Defensive read of what a draft carries; null for anything that is not a calendar with a pay day. */
export function parseDraftPayTerms(raw: unknown): DraftPayTerms | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const calendar = normalizePayCalendar(r.calendar as Partial<Record<keyof PayCalendar, unknown>> | null | undefined)
  if (!calendar) return null
  return { scope: r.scope === 'payer' ? 'payer' : 'job', calendar }
}

/** The terms a Dispatch request carries on their own (`pending_payload.pay_terms`), or null. */
export function draftPayTermsFromPayload(payload: unknown): DraftPayTerms | null {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return null
  return parseDraftPayTerms((payload as Record<string, unknown>).pay_terms)
}

/** Whose they are, in the few words a line has room for. */
export function draftPayTermsScopeWords(scope: DraftPayTermsScope): string {
  return scope === 'payer' ? 'every job they pay' : 'only this job'
}

/** The line under the choice, in the estimator's part. */
export function draftPayTermsScopeHint(scope: DraftPayTermsScope): string {
  return scope === 'payer' ? 'Their standard subcontract says it, whatever the job.' : 'This job’s contract says it.'
}

/** The terms as one line: "In by the 25th, paid the 10th · only this job". */
export function draftPayTermsLine(terms: DraftPayTerms): string {
  return `${payCalendarShort(terms.calendar)} · ${draftPayTermsScopeWords(terms.scope)}`
}

/** The terms as the tail of a draft's words on the Dispatch row: "pay terms: in by the 25th, paid the 10th, only this job". */
export function draftPayTermsDraftWords(terms: DraftPayTerms): string {
  const short = payCalendarShort(terms.calendar)
  return `pay terms: ${short.charAt(0).toLowerCase()}${short.slice(1)}, ${draftPayTermsScopeWords(terms.scope)}`
}

/** "Dana Whitfield’s draft", or "The draft" when the sender has no name to show. */
export function draftPayTermsFromWords(senderName: string | null | undefined): string {
  const who = (senderName ?? '').trim()
  return who ? `${who}’s draft` : 'The draft'
}

/**
 * Whether a job still offers the terms its draft carried. Terms for the job are offered until
 * the job carries a row of its own, a calendar or its off switch. Terms for the payer are
 * offered only while the bill reads no calendar at all: once the payer has one, or the job its
 * own, the office has answered.
 */
export function draftPayTermsOffered(terms: DraftPayTerms | null | undefined, from: PayCalendarSource): boolean {
  if (!terms) return false
  if (terms.scope === 'job') return from === 'none' || from === 'payer'
  return from === 'none'
}

/** What New Job holds once the office has agreed to the terms: saved already for the payer, or waiting to set with the job. */
export type NewJobPayTermsState =
  | { kind: 'offered' }
  | { kind: 'payer-saved' }
  | { kind: 'with-job'; calendar: PayCalendar | { off: true } }

/** The small words after the terms on New Job's line. */
export function newJobPayTermsTail(state: NewJobPayTermsState, payerName: string | null | undefined): string | null {
  if (state.kind === 'with-job') return 'sets with the job'
  if (state.kind === 'payer-saved') return `set for every job ${(payerName ?? '').trim() || 'they'} pays`
  return null
}

/** The Dispatch row's title for terms sent on their own: "Pay terms for B412 Larkfield Medical Office: in by the 25th, paid the 10th, only this job". */
export function payTermsRequestTitle(terms: DraftPayTerms, bidLabel: string): string {
  const short = payCalendarShort(terms.calendar)
  const clause = terms.calendar.clause ? ` (${terms.calendar.clause})` : ''
  return `Pay terms for ${bidLabel.trim() || 'a won bid'}: ${short.charAt(0).toLowerCase()}${short.slice(1)}, ${draftPayTermsScopeWords(terms.scope)}${clause}`
}

/** What closes the Dispatch row, in the words the estimator reads back. */
export const PAY_TERMS_SET_NOTE = 'The pay calendar is set.'
export const PAY_TERMS_NOT_A_CALENDAR_NOTE = 'Not a calendar payer. No pay calendar was set.'
