/**
 * Their paper (punch list #173, v2.6698): a contract on the other side's own form — a GC's
 * subcontract — that we signed and they never countersigned. Until now the app could file an
 * existing contract only as signed by the customer, which on such a paper is false, so the PDF
 * went onto Evidence and the Legal desk kept reading *No signed agreement*. This kernel is the
 * record as it is: who signed for us and when, whether they countersigned, whether they rely on
 * it (the owner's call of 2026-11-08: a paper signed by us only counts as signed for *Can we
 * sue?* once the other side relied on it — their notice, their pay application — carried as a
 * flag the office sets with the date and what the reliance was), the file, and the key terms
 * the office types with their clause references (a read from the PDF proposing them is a later
 * follow-up). Pure: no React, no supabase. The row lives in `job_contracts` with `kind =
 * 'their_paper'` and `status = 'signed'`; `jobContractCoverage.ts` turns it into the
 * `their_paper` coverage every chip, strip and desk reads.
 */

export const THEIR_PAPER_KIND = 'their_paper'

/** The key terms the record keeps, in the order the Burd matter needed them. */
export const THEIR_PAPER_TERM_KEYS = ['termination', 'notice_to_proceed', 'default_cure', 'retainage_release', 'payment_contingency', 'pay_calendar', 'change_orders', 'venue', 'fees_arbitration'] as const
export type TheirPaperTermKey = (typeof THEIR_PAPER_TERM_KEYS)[number]

export const THEIR_PAPER_TERM_WORDS: Record<TheirPaperTermKey, { label: string; hint: string }> = {
  termination: { label: 'Termination', hint: 'for convenience, 48-hour notice' },
  notice_to_proceed: { label: 'Notice to proceed', hint: 'written NTP before mobilizing' },
  default_cure: { label: 'Default and cure', hint: '5 days to cure after written notice' },
  retainage_release: { label: 'Retainage release', hint: '10%, 30 days after their final acceptance' },
  payment_contingency: { label: 'Payment contingency', hint: 'pay-when-paid by the owner' },
  // Punch list #323, PR 7: the cutoff and the pay day, where the paper names them. The Pay calendar itself is set on the payer or the job.
  pay_calendar: { label: 'Pay calendar', hint: 'in by the 25th, paid the 30th of the next month' },
  change_orders: { label: 'Change orders', hint: 'written and signed before the work' },
  venue: { label: 'Venue', hint: 'the county and state' },
  fees_arbitration: { label: 'Fees and arbitration', hint: 'prevailing party; arbitration' },
}

export type TheirPaperTerm = {
  key: TheirPaperTermKey
  /** The clause reference as the paper numbers it: `§14.2`, `Art. 11`. '' when the office has none. */
  clause: string
  /** The term in a few words. */
  words: string
}

/** The columns the record adds to `job_contracts` (migration 20261108120000). Every one optional: a read from before the push has none. */
export type TheirPaperColumns = {
  paper_title?: string | null
  our_signer_name?: string | null
  our_signed_on?: string | null
  our_signed_how?: string | null
  their_signed_on?: string | null
  relied_on_on?: string | null
  relied_on_what?: string | null
  key_terms?: unknown
}

export type TheirPaperRowLike = TheirPaperColumns & {
  id: string
  job_id: string
  status: string
  kind?: string | null
  voided_at?: string | null
  signed_document_url?: string | null
  paper_upload_path?: string | null
  created_at?: string | null
}

/** The record, read for a screen. */
export type TheirPaperRecord = {
  contractId: string
  /** What the paper is, as the office named it: `Sable Ridge Builders subcontract, their form`. */
  title: string
  ourSigner: string
  /** YYYY-MM-DD. */
  ourSignedOn: string | null
  ourSignedHow: string
  /** YYYY-MM-DD when they countersigned; null = not countersigned. */
  theirSignedOn: string | null
  /** The office's flag: the day they relied on the paper and what the reliance was. */
  reliedOn: { on: string; what: string } | null
  documentUrl: string | null
  hasUpload: boolean
  terms: TheirPaperTerm[]
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const ymd = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)

export function isTheirPaperTermKey(raw: unknown): raw is TheirPaperTermKey {
  return typeof raw === 'string' && (THEIR_PAPER_TERM_KEYS as ReadonlyArray<string>).includes(raw)
}

/** The stored list, read defensively: an unknown key, or a term with neither clause nor words, is dropped. */
export function parseTheirPaperTerms(raw: unknown): TheirPaperTerm[] {
  if (!Array.isArray(raw)) return []
  const out: TheirPaperTerm[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    if (!isTheirPaperTermKey(r.key) || out.some((t) => t.key === r.key)) continue
    const clause = str(r.clause)
    const words = str(r.words)
    if (!clause && !words) continue
    out.push({ key: r.key, clause, words })
  }
  return out.sort((a, b) => THEIR_PAPER_TERM_KEYS.indexOf(a.key) - THEIR_PAPER_TERM_KEYS.indexOf(b.key))
}

/** A live their-paper row: the kind, status signed (the paper is as executed as it will be), not voided. */
export function isTheirPaperRow(row: Pick<TheirPaperRowLike, 'kind' | 'status' | 'voided_at'>): boolean {
  return row.kind === THEIR_PAPER_KIND && row.status === 'signed' && row.voided_at == null
}

export function theirPaperFromRow(row: TheirPaperRowLike): TheirPaperRecord {
  const on = ymd(row.relied_on_on)
  const what = str(row.relied_on_what)
  return {
    contractId: row.id,
    title: str(row.paper_title),
    ourSigner: str(row.our_signer_name),
    ourSignedOn: ymd(row.our_signed_on),
    ourSignedHow: str(row.our_signed_how),
    theirSignedOn: ymd(row.their_signed_on),
    reliedOn: on || what ? { on: on ?? '', what } : null,
    documentUrl: str(row.signed_document_url) || null,
    hasUpload: Boolean(str(row.paper_upload_path)),
    terms: parseTheirPaperTerms(row.key_terms),
  }
}

/**
 * The rule for *Can we sue?* (the owner, 2026-11-08): their paper counts as a signed agreement
 * once they countersigned it, or once they relied on it. Signed by us alone, it is a flagged basis
 * beside the sworn account, never the theory.
 */
export function theirPaperCountsAsSigned(rec: Pick<TheirPaperRecord, 'theirSignedOn' | 'reliedOn'>): boolean {
  return rec.theirSignedOn != null || rec.reliedOn != null
}

/** `Their paper · signed by us only · they rely on it` — the line every surface draws. */
export function theirPaperLine(rec: Pick<TheirPaperRecord, 'theirSignedOn' | 'reliedOn' | 'ourSigner'>): string {
  if (rec.theirSignedOn) return 'Their paper · signed by both'
  const parts = ['Their paper', 'signed by us only']
  parts.push(rec.reliedOn ? 'they rely on it' : 'not relied on yet')
  return parts.join(' · ')
}

function monthDay(ymdStr: string | null | undefined): string {
  if (!ymdStr) return ''
  const [y, m, d] = ymdStr.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d, 12)))
}

/** The record in one sentence, for a hover or a print. */
export function theirPaperWords(rec: TheirPaperRecord): string {
  return `${rec.title || 'Their paper'}, ${theirPaperSignedWords(rec)}`
}

/** The sentence after the paper's name: who signed for us, whether they countersigned, whether they rely on it. */
export function theirPaperSignedWords(rec: TheirPaperRecord): string {
  const signed = rec.ourSigner ? `signed for us by ${rec.ourSigner}${rec.ourSignedOn ? ` on ${monthDay(rec.ourSignedOn)}` : ''}${rec.ourSignedHow ? ` (${rec.ourSignedHow})` : ''}` : 'not yet signed for us'
  const theirs = rec.theirSignedOn ? `countersigned ${monthDay(rec.theirSignedOn)}` : 'not countersigned'
  const relied = rec.reliedOn ? ` They rely on it: ${rec.reliedOn.what || 'as the office recorded'}${rec.reliedOn.on ? ` (${monthDay(rec.reliedOn.on)})` : ''}.` : ' Nothing recorded yet of them relying on it.'
  return `${signed}, ${theirs}.${relied}`
}

/** `Termination §14.2 — for convenience, 48-hour notice`, one per term. */
export function theirPaperTermLine(t: TheirPaperTerm): string {
  const label = THEIR_PAPER_TERM_WORDS[t.key].label
  return `${label}${t.clause ? ` ${t.clause}` : ''}${t.words ? ` — ${t.words}` : ''}`
}

/** The form the sheet edits: every field a string, so a half-typed date can sit in the box. */
export type TheirPaperDraft = {
  title: string
  ourSigner: string
  ourSignedOn: string
  ourSignedHow: string
  theirSignedOn: string
  reliedOn: boolean
  reliedOnOn: string
  reliedOnWhat: string
  link: string
  terms: Record<TheirPaperTermKey, { clause: string; words: string }>
}

export function emptyTheirPaperDraft(): TheirPaperDraft {
  const terms = {} as TheirPaperDraft['terms']
  for (const k of THEIR_PAPER_TERM_KEYS) terms[k] = { clause: '', words: '' }
  return { title: '', ourSigner: '', ourSignedOn: '', ourSignedHow: '', theirSignedOn: '', reliedOn: false, reliedOnOn: '', reliedOnWhat: '', link: '', terms }
}

export function theirPaperDraftFromRecord(rec: TheirPaperRecord): TheirPaperDraft {
  const d = emptyTheirPaperDraft()
  d.title = rec.title
  d.ourSigner = rec.ourSigner
  d.ourSignedOn = rec.ourSignedOn ?? ''
  d.ourSignedHow = rec.ourSignedHow
  d.theirSignedOn = rec.theirSignedOn ?? ''
  d.reliedOn = rec.reliedOn != null
  d.reliedOnOn = rec.reliedOn?.on ?? ''
  d.reliedOnWhat = rec.reliedOn?.what ?? ''
  d.link = rec.documentUrl ?? ''
  for (const t of rec.terms) d.terms[t.key] = { clause: t.clause, words: t.words }
  return d
}

const isHttp = (s: string) => /^https?:\/\/\S+$/i.test(s.trim())

/** Why the draft cannot be recorded yet, or null. The owner's call: a relied-on flag carries its date and what the reliance was. */
export function theirPaperDraftProblem(d: TheirPaperDraft): string | null {
  if (!d.ourSigner.trim()) return 'Name who signed it for us.'
  if (d.reliedOn && !d.reliedOnWhat.trim()) return 'Say what they relied on it for: their notice, their pay application.'
  if (d.reliedOn && !d.reliedOnOn.trim()) return 'Give the day they relied on it.'
  if (d.link.trim() && !isHttp(d.link)) return 'That is not a link yet. In Drive, use Share and then Copy link.'
  return null
}

/** The terms the draft fills, in the record's order. */
export function theirPaperDraftTerms(d: TheirPaperDraft): TheirPaperTerm[] {
  return THEIR_PAPER_TERM_KEYS.map((key) => ({ key, clause: d.terms[key].clause.trim(), words: d.terms[key].words.trim() })).filter((t) => t.clause || t.words)
}

/** The columns a save writes (`job_contracts`), from the draft. */
export function theirPaperColumnsFromDraft(d: TheirPaperDraft): Required<Omit<TheirPaperColumns, 'key_terms'>> & { key_terms: TheirPaperTerm[]; signed_document_url: string | null; kind: typeof THEIR_PAPER_KIND; status: 'signed' } {
  const relied = d.reliedOn
  return {
    kind: THEIR_PAPER_KIND,
    status: 'signed',
    paper_title: d.title.trim() || null,
    our_signer_name: d.ourSigner.trim(),
    our_signed_on: d.ourSignedOn.trim() || null,
    our_signed_how: d.ourSignedHow.trim() || null,
    their_signed_on: d.theirSignedOn.trim() || null,
    relied_on_on: relied ? d.reliedOnOn.trim() || null : null,
    relied_on_what: relied ? d.reliedOnWhat.trim() || null : null,
    key_terms: theirPaperDraftTerms(d),
    signed_document_url: isHttp(d.link) ? d.link.trim() : null,
  }
}

/**
 * The narrative's contract section (the editor's *Insert the contract's terms*): the paper in one
 * line, then one list item per term. '' when nothing is recorded.
 */
export function theirPaperNarrativeMarkdown(recs: ReadonlyArray<{ jobLabel: string; record: TheirPaperRecord }>): string {
  const blocks: string[] = []
  for (const { jobLabel, record } of recs) {
    const lines = [`**${record.title || 'Their paper'}** on ${jobLabel}: ${theirPaperSignedWords(record)}`]
    for (const t of record.terms) lines.push(`- ${theirPaperTermLine(t)}`)
    blocks.push(lines.join('\n'))
  }
  return blocks.join('\n\n')
}

const NARRATIVE_CONTRACT_HEADING = /^#{1,6}\s+The contract\s*$/i

/**
 * Paste the contract's terms into the narrative under *The contract*: after the heading and any
 * lines already there, else at the end under its own heading. A line already present word for word
 * is not added twice — the same manners as `insertEventsIntoNarrative`.
 */
export function insertContractTermsIntoNarrative(markdown: string, termsMarkdown: string): string {
  if (!termsMarkdown.trim()) return markdown
  const have = new Set(markdown.split('\n').map((l) => l.trim()))
  const fresh = termsMarkdown.split('\n').filter((l) => !have.has(l.trim()))
  if (fresh.length === 0) return markdown
  const block = fresh.join('\n')
  const lines = markdown.split('\n')
  const at = lines.findIndex((l) => NARRATIVE_CONTRACT_HEADING.test(l))
  if (at === -1) return `${markdown.trimEnd()}${markdown.trim() ? '\n\n' : ''}## The contract\n\n${block}\n`
  let end = at + 1
  while (end < lines.length && !/^#{1,6}\s/.test(lines[end]!)) end++
  while (end > at + 1 && lines[end - 1]!.trim() === '') end--
  const before = lines.slice(0, end)
  const after = lines.slice(end)
  return [...before, '', block, '', ...after].join('\n').replace(/\n{3,}/g, '\n\n')
}
