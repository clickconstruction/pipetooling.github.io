/**
 * A sub's company's own papers on People → Contracts (punch list #403, step 6, PR 2). A business's subcontractor
 * agreement and W-9 are the company's (`person_contract_documents` rows keyed by `company_id`, named
 * `gc-company:<id>`), so they show once, under the company's row, with **Send for signature** and **Enter from paper**.
 * Each worker's own papers stay on their row. These are the pure parts: which paper is the company's line, what the line
 * says, which papers can be sent or entered, the checks, and the email's words. The calls are `subCompanyPapersIo.ts`.
 */

import { val } from '../valuesInPlace'
import { signerEmailRefusal } from '../contracts/personPaperSend'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { CompanyWorker } from './subCompanies'

/** A company's paper as People reads it. */
export type CompanyPaperRow = {
  id: string
  company_id: string | null
  document_name: string
  status: string
  signed_at: string | null
  sent_at: string | null
  signer_last_viewed_at: string | null
  lineage_version: number | null
  form_template_id: string | null
  signer_name: string | null
  signer_title: string | null
}

/** A Contract Book entry as the two windows offer it. */
export type BookEntryChoice = { id: string; document_name: string; audience: string | null; form_template_id: string | null }

/** The words the company's papers say. */
export const COMPANY_PAPER_WORDS = {
  send: 'Send for signature',
  enter: 'Enter from paper',
  foot: 'The same papers are on Documents → Agreements.',
  none: 'Nothing sent to this company yet. Send for signature sends it the subcontractor agreement or the W-9.',
  signingFor: (company: string) => `signing for ${company}`,
  pickPaper: 'Pick a paper.',
  pickSigner: 'Pick who signs.',
  signerName: 'Type the name of who signed.',
  pickDay: 'Pick the day it was signed.',
  futureDay: 'The day it was signed cannot be after today.',
  signedAlready: 'That paper is signed already.',
  sentWords: (to: readonly string[]) => (to.length > 0 ? `Sent to ${to.join(', ')}.` : 'Sent.'),
  entered: 'Entered as signed on paper.',
  notEmailed: 'The signing link is made, but the email did not go. Try again in a minute.',
  officeOnly: 'Only the office sends a company its papers.',
} as const

/** The state chip's words for a company's paper. */
export function companyPaperStateWords(status: string): string {
  if (status === 'signed') return 'Signed'
  if (status === 'sent') return 'Sent'
  return 'Not sent'
}

/** The company's papers as its row lists them: the newest copy of each paper, by name. */
export function companyPaperLines(rows: readonly CompanyPaperRow[], companyId: string): CompanyPaperRow[] {
  const rank = (s: string) => (s === 'signed' ? 2 : s === 'sent' ? 1 : 0)
  const best = new Map<string, CompanyPaperRow>()
  for (const r of rows) {
    if (r.company_id !== companyId) continue
    const key = r.document_name.trim()
    const have = best.get(key)
    if (!have) {
      best.set(key, r)
      continue
    }
    const newer = (r.lineage_version ?? 1) - (have.lineage_version ?? 1) || rank(r.status) - rank(have.status)
    if (newer > 0) best.set(key, r)
  }
  return [...best.values()].sort((a, b) => a.document_name.localeCompare(b.document_name))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** *Nov 14* from a day or a moment; '' when it cannot be read. A moment is read in the app's own day. */
export function shortDay(at: string | null | undefined): string {
  const raw = (at ?? '').trim()
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.length > 10 ? calendarYmdInAppTzFromIso(raw) : raw)
  return ymd ? `${MONTHS[Number(ymd[2]) - 1] ?? ''} ${Number(ymd[3])}` : ''
}

/** Who signed, as the line names them: *Pat Sample, Owner*. '' when the paper keeps no name. */
function signerWords(p: Pick<CompanyPaperRow, 'signer_name' | 'signer_title'>): string {
  const name = (p.signer_name ?? '').trim()
  if (!name) return ''
  const title = (p.signer_title ?? '').trim()
  return title ? `${val('name', name)}, ${title}` : val('name', name)
}

/**
 * The line under a company's paper's name, its values marked: *Version 2 · signed Nov 14 by Pat Sample, Owner*,
 * *Form · sent Nov 18 · not opened*, *not sent*.
 */
export function companyPaperDetail(p: CompanyPaperRow): string {
  const bits: string[] = []
  if ((p.lineage_version ?? 1) > 1) bits.push(`Version ${val('count', String(p.lineage_version))}`)
  else if (p.form_template_id) bits.push('Form')
  if (p.status === 'signed') {
    const day = shortDay(p.signed_at)
    const who = signerWords(p)
    bits.push(['signed', day ? val('day', day) : '', who ? `by ${who}` : ''].filter(Boolean).join(' '))
  } else if (p.status === 'sent') {
    const day = shortDay(p.sent_at)
    bits.push(day ? `sent ${val('day', day)}` : 'sent')
    bits.push(p.signer_last_viewed_at ? 'opened' : 'not opened')
    const who = signerWords(p)
    if (who) bits.push(`with ${who}`)
  } else bits.push('not sent')
  return bits.join(' · ')
}

/** A paper either window offers, and why it is held when it is. */
export type CompanyPaperChoice = { id: string; name: string; held: string | null }

/**
 * The Contract Book papers a company is offered: the subs' papers (the subcontractor agreement, the W-9). One the
 * company has signed is listed and held, so the office sees why it is not offered.
 */
export function companyPaperChoices(entries: readonly BookEntryChoice[], papers: readonly CompanyPaperRow[]): CompanyPaperChoice[] {
  const signed = new Set(papers.filter((p) => p.status === 'signed').map((p) => p.document_name.trim()))
  const seen = new Set<string>()
  const out: CompanyPaperChoice[] = []
  for (const e of entries) {
    if ((e.audience ?? '') !== 'sub') continue
    const name = e.document_name.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push({ id: e.id, name, held: signed.has(name) ? COMPANY_PAPER_WORDS.signedAlready : null })
  }
  return out
}

/** The worker the windows open on: the one with a title (the owner), else the first. Null with no worker. */
export function defaultSigner(workers: readonly CompanyWorker[]): CompanyWorker | null {
  return workers.find((w) => w.title.trim() !== '') ?? workers[0] ?? null
}

/** Why the send cannot go yet, or null. */
export function companySendRefusal(input: { choice: CompanyPaperChoice | null; signer: string; email: string }): string | null {
  if (!input.choice) return COMPANY_PAPER_WORDS.pickPaper
  if (input.choice.held) return input.choice.held
  if (!input.signer.trim()) return COMPANY_PAPER_WORDS.pickSigner
  return signerEmailRefusal(input.email)
}

/** Why the paper cannot be entered yet, or null. `today` is the office's day, 'YYYY-MM-DD'. */
export function companyEntryRefusal(input: { choice: CompanyPaperChoice | null; signer: string; signedOn: string; today: string }): string | null {
  if (!input.choice) return COMPANY_PAPER_WORDS.pickPaper
  if (input.choice.held) return input.choice.held
  if (!input.signer.trim()) return COMPANY_PAPER_WORDS.signerName
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.signedOn)) return COMPANY_PAPER_WORDS.pickDay
  if (input.signedOn > input.today) return COMPANY_PAPER_WORDS.futureDay
  return null
}

/** The email a company's paper goes out with, from the office under the name the sub knows. */
export function companyPaperEmail(input: { paper: string; company: string; signer: string }): { subject: string; lines: string[]; actionLabel: string } {
  const paper = input.paper.trim()
  return {
    subject: `Please sign: ${paper}`,
    lines: [`${input.signer.trim()}, please sign the ${paper} for ${input.company.trim()}.`, 'Press the button to read it and sign. The link works for 14 days.'],
    actionLabel: 'Read and sign',
  }
}

/** The send's key: one press, one email. A second press after a failure is a new key. */
export function companyPaperSendKey(documentId: string, at: number): string {
  return `people-company-paper:${documentId}:${at}`
}

/** The roster address of a worker, by name; '' when the roster has none. */
export function workerEmail(name: string, people: ReadonlyArray<{ name: string | null; email: string | null }>): string {
  const want = name.trim()
  return (people.find((p) => (p.name ?? '').trim() === want)?.email ?? '').trim()
}
