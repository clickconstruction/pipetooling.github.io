/**
 * Contracts & terms, last sent: what went out to a customer most recently, read from the copy
 * the app froze when it sent it, set against the wording as it stands today.
 *
 * The card shows the template; this says whether the customer got it. Six entries have a frozen
 * copy to read: the job agreement's standard terms (`job_contracts`), the bid terms and
 * exclusions (the newest published bid-room revision), the estimate's Terms box and agreement
 * sentence (the newest sent estimate), and the electronic-signature consent (`esign_consents`).
 * The rest keep no copy, and say so on the card already.
 *
 * Pure: the tab reads the rows (`fetchContractLastSent`), this decides what to say.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdFriendly, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { esignConsentText, type EsignAudience, type EsignLang } from '../esignConsent'
import type { ContractCatalogEntry, ResolvedContractText } from './customerContractCatalog'

export type JobContractSentRow = {
  id: string
  status: string
  body_html: string | null
  body_format: string
  template_document_id: string | null
  template_version_date: string | null
  last_sent_at: string | null
  sent_at: string | null
  signed_at: string | null
  voided_at: string | null
}

export type BidRevisionSentRow = { payload: unknown; published_at: string; rev_number: number }

export type EstimateSentRow = { terms_snapshot: string | null; customer_experience_sent: unknown; sent_at: string | null; estimate_number: number | null; title: string | null }

export type ConsentSentRow = { clause_text: string; consent_version: number; lang: string; audience: string; document_noun: string; consented_at: string }

export type ContractLastSentData = {
  jobContracts: readonly JobContractSentRow[]
  bidRevision: BidRevisionSentRow | null
  estimate: EstimateSentRow | null
  consent: ConsentSentRow | null
}

export const EMPTY_LAST_SENT: ContractLastSentData = { jobContracts: [], bidRevision: null, estimate: null, consent: null }

/** The entries that have a frozen copy to read, and which one. */
export type LastSentReader = 'job_contract' | 'bid_terms' | 'bid_exclusions' | 'estimate_terms_box' | 'estimate_agree_sentence' | 'esign_consent'

export const LAST_SENT_READERS: Readonly<Record<string, LastSentReader>> = {
  'job-standard-terms': 'job_contract',
  'bid-terms': 'bid_terms',
  'bid-exclusions': 'bid_exclusions',
  'estimate-terms-box': 'estimate_terms_box',
  'estimate-agree-sentence': 'estimate_agree_sentence',
  'esign-consent': 'esign_consent',
}

/**
 * same — what went out is the wording on the card. differs — it is not. only — there is no one
 * wording to set it against (a box typed each time). never — nothing has gone out.
 */
export type LastSentStatus = 'same' | 'differs' | 'only' | 'never'

export type ContractLastSent = {
  status: LastSentStatus
  /** One sentence for the card. */
  line: string
  /** What went out, to read or to put in a column; null when nothing did or it was blank. */
  sentText: string | null
  sentFormat: 'plain' | 'html' | 'markdown'
  /** A short name for the column: "Sent Sep 25". */
  sentLabel: string | null
  /** Unsent drafts written from this document that still carry older wording. */
  staleDrafts: number
  /** Agreements out for signature that carry older wording. They are locked; this is only a count. */
  staleOut: number
}

/** Two wordings are the same when they differ only in spacing and line ends. */
export function normalizeWording(s: string | null | undefined): string {
  return (s ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{2,}/g, '\n').trim()
}

export function sameWording(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeWording(a) === normalizeWording(b)
}

function day(iso: string | null | undefined): string {
  const ymd = iso ? calendarYmdInAppTzFromIso(iso) : ''
  return ymd ? formatWorkDateYmdFriendly(ymd) : 'an unknown day'
}

function shortDay(iso: string | null | undefined): string {
  const ymd = iso ? calendarYmdInAppTzFromIso(iso) : ''
  return ymd ? formatWorkDateYmdMonthDayShort(ymd) : ''
}

function format(v: string | null | undefined): 'plain' | 'html' | 'markdown' {
  return v === 'html' || v === 'markdown' ? v : 'plain'
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

const NEVER = (what: string): ContractLastSent => ({ status: 'never', line: `${what} — none has gone out yet.`, sentText: null, sentFormat: 'plain', sentLabel: null, staleDrafts: 0, staleOut: 0 })

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`
}

/** When a row went out: the last send, else the first, else the signature (a paper filing has only that). */
function wentOutAt(r: JobContractSentRow): string | null {
  return r.last_sent_at ?? r.sent_at ?? null
}

function jobContractLastSent(text: ResolvedContractText, rows: readonly JobContractSentRow[]): ContractLastSent {
  const docId = text.doc?.id ?? null
  const mine = rows.filter((r) => r.voided_at == null && (r.template_document_id ?? null) === docId)
  // Sent by us: a filed paper copy was never sent, and carries the customer's own paper.
  const sent = mine.filter((r) => (r.status === 'sent' || r.status === 'signed') && wentOutAt(r) != null).sort((a, b) => (wentOutAt(b) ?? '').localeCompare(wentOutAt(a) ?? ''))
  const staleDrafts = mine.filter((r) => r.status === 'draft' && !sameWording(r.body_html, text.text)).length
  const staleOut = mine.filter((r) => r.status === 'sent' && wentOutAt(r) != null && !sameWording(r.body_html, text.text)).length
  const newest = sent[0]
  const tail: string[] = []
  if (staleOut > 0) tail.push(`${plural(staleOut, 'agreement is', 'agreements are')} out for signature with older wording; ${staleOut === 1 ? 'it keeps' : 'they keep'} what ${staleOut === 1 ? 'it' : 'they'} went out with`)
  if (staleDrafts > 0) tail.push(`${plural(staleDrafts, 'unsent draft still carries', 'unsent drafts still carry')} older wording`)
  const suffix = tail.length > 0 ? ` ${tail.join('. ')}.` : ''
  if (!newest) {
    const base = NEVER('No agreement has been sent with these terms')
    return { ...base, line: `${base.line}${suffix}`, staleDrafts, staleOut }
  }
  const same = sameWording(newest.body_html, text.text)
  const version = newest.template_version_date ? ` (the wording of ${formatWorkDateYmdMonthDayShort(newest.template_version_date)})` : ''
  return {
    status: same ? 'same' : 'differs',
    line: same ? `The last agreement sent, ${day(wentOutAt(newest))}, carries this wording.${suffix}` : `The last agreement sent, ${day(wentOutAt(newest))}, carries older wording${version}.${suffix}`,
    sentText: (newest.body_html ?? '').trim() ? newest.body_html : null,
    sentFormat: format(newest.body_format),
    sentLabel: `Sent ${shortDay(wentOutAt(newest))}`,
    staleDrafts,
    staleOut,
  }
}

function bidLastSent(text: ResolvedContractText, rev: BidRevisionSentRow | null, field: 'terms' | 'exclusions', noun: string): ContractLastSent {
  if (!rev) return NEVER('No proposal has been published to a bid room')
  const sentText = str(record(rev.payload)[field])
  const when = `${day(rev.published_at)} (rev ${rev.rev_number})`
  if (!sentText.trim()) {
    return { status: 'differs', line: `The last proposal published, ${when}, went out with no ${noun} at all.`, sentText: null, sentFormat: 'plain', sentLabel: null, staleDrafts: 0, staleOut: 0 }
  }
  const same = sameWording(sentText, text.text)
  return {
    status: same ? 'same' : 'differs',
    line: same ? `The last proposal published, ${when}, carries this wording.` : `The last proposal published, ${when}, carries different wording. A bid can carry its own.`,
    sentText,
    sentFormat: 'plain',
    sentLabel: `Published ${shortDay(rev.published_at)}`,
    staleDrafts: 0,
    staleOut: 0,
  }
}

function estimateName(e: EstimateSentRow): string {
  return e.estimate_number != null ? `estimate ${e.estimate_number}` : 'estimate'
}

function estimateTermsBoxLastSent(e: EstimateSentRow | null): ContractLastSent {
  if (!e) return NEVER('No estimate has been sent')
  const sentText = str(e.terms_snapshot)
  if (!sentText.trim()) {
    return { status: 'only', line: `The last estimate sent, ${day(e.sent_at)} (${estimateName(e)}), went out with the Terms box empty.`, sentText: null, sentFormat: 'plain', sentLabel: null, staleDrafts: 0, staleOut: 0 }
  }
  return { status: 'only', line: `The last estimate sent, ${day(e.sent_at)} (${estimateName(e)}), carried terms of its own.`, sentText, sentFormat: 'plain', sentLabel: `Sent ${shortDay(e.sent_at)}`, staleDrafts: 0, staleOut: 0 }
}

function estimateAgreeLastSent(text: ResolvedContractText, e: EstimateSentRow | null): ContractLastSent {
  if (!e) return NEVER('No estimate has been sent')
  const frozen = record(e.customer_experience_sent)
  // `serializableSnapshot` keeps the resolved wording under camelCase names.
  const sentText = str(frozen.acceptCheckboxLabel)
  if (!sentText.trim()) {
    return { status: 'only', line: `The last estimate sent, ${day(e.sent_at)} (${estimateName(e)}), kept no copy of its wording.`, sentText: null, sentFormat: 'plain', sentLabel: null, staleDrafts: 0, staleOut: 0 }
  }
  const same = sameWording(sentText, text.text)
  return {
    status: same ? 'same' : 'differs',
    line: same ? `The last estimate sent, ${day(e.sent_at)} (${estimateName(e)}), carries this wording.` : `The last estimate sent, ${day(e.sent_at)} (${estimateName(e)}), carries different wording. An estimate can carry its own.`,
    sentText,
    sentFormat: 'plain',
    sentLabel: `Sent ${shortDay(e.sent_at)}`,
    staleDrafts: 0,
    staleOut: 0,
  }
}

function audience(v: string): EsignAudience {
  return v === 'gc' || v === 'sub' ? v : 'customer'
}

function consentLastSent(c: ConsentSentRow | null): ContractLastSent {
  if (!c) return NEVER('No signature has recorded its consent')
  const lang: EsignLang = c.lang === 'es' ? 'es' : 'en'
  const today = esignConsentText({ audience: audience(c.audience), documentNoun: c.document_noun, lang })
  const same = sameWording(c.clause_text, today.clauseText)
  const who = `version ${c.consent_version}, ${lang === 'es' ? 'Spanish' : 'English'}, on ${c.document_noun || 'a document'}`
  return {
    status: same ? 'same' : 'differs',
    line: same
      ? `The last signature, ${day(c.consented_at)}, agreed to today's wording (${who}).`
      : `The last signature, ${day(c.consented_at)}, agreed to wording that is not today's (${who}; today is version ${today.version}).`,
    sentText: c.clause_text.trim() ? c.clause_text : null,
    sentFormat: 'plain',
    sentLabel: `Signed ${shortDay(c.consented_at)}`,
    staleDrafts: 0,
    staleOut: 0,
  }
}

/** What last went out for this card, or null when the entry keeps no copy to read. */
export function contractLastSent(entry: ContractCatalogEntry, text: ResolvedContractText, data: ContractLastSentData): ContractLastSent | null {
  const reader = LAST_SENT_READERS[entry.id]
  if (!reader) return null
  if (reader === 'job_contract') return jobContractLastSent(text, data.jobContracts)
  if (reader === 'bid_terms') return bidLastSent(text, data.bidRevision, 'terms', 'Terms')
  if (reader === 'bid_exclusions') return bidLastSent(text, data.bidRevision, 'exclusions', 'Exclusions')
  if (reader === 'estimate_terms_box') return estimateTermsBoxLastSent(data.estimate)
  if (reader === 'estimate_agree_sentence') return estimateAgreeLastSent(text, data.estimate)
  return consentLastSent(data.consent)
}

/** The compare key of what went out for a card — a column of its own beside the card's. */
export function sentCompareKey(textKey: string): string {
  return `sent:${textKey}`
}

/** How many cards say what went out is not what the card says. */
export function lastSentDiffers(all: ReadonlyArray<ContractLastSent | null>): number {
  return all.filter((l) => l != null && (l.status === 'differs' || l.staleDrafts > 0)).length
}
