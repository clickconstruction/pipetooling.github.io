/**
 * The desk reads the mail pieces behind a sent notice (the Docsmit train, 6b — `docs/DOCSMIT_LIEN_RUN_PLAN.md`,
 * "Delivery drives the desk"): one `mail_pieces` row per envelope the run mailed through a provider, keyed to the
 * filings inside it by `source_ids`. Pure: rows in, the words the Sent row and the notice footer show. A piece's
 * days are Central calendar days of the provider's instants.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { MailPieceStatus } from './mailPiece'

export type LienMailPieceRow = {
  id: string
  kind: string
  recipient: string
  status: MailPieceStatus | string
  usps_tracking: string | null
  mailed_at: string | null
  delivered_at: string | null
  signed_by: string | null
  delivery_status: string | null
  source_ids: string[]
  problem?: string | null
  /** What Docsmit charged, once the poll read it (6b, the cost line). */
  price?: number | null
  /** The doors (6b-3): the name on the envelope (the re-mail door's prefill), the provider's send type (a plain copy is First Class), the piece this one answers, when and how this one was answered. */
  name?: string | null
  organization?: string | null
  send_type?: string | null
  resend_of?: string | null
  resolved_at?: string | null
  resolved_note?: string | null
}

const RECIPIENT_WORDS: Record<string, string> = { owner: 'Owner of record', original_contractor: 'Original contractor' }

export function mailPiecesByFiling(rows: ReadonlyArray<LienMailPieceRow>): Record<string, LienMailPieceRow[]> {
  const out: Record<string, LienMailPieceRow[]> = {}
  for (const p of rows) for (const id of Array.isArray(p.source_ids) ? p.source_ids : []) (out[id] ??= []).push(p)
  return out
}

function day(iso: string | null, fmt: (ymd: string) => string): string {
  const ymd = iso ? calendarYmdInAppTzFromIso(iso) : ''
  return ymd ? fmt(ymd) : ''
}

/** One piece's state in a few words: *in transit* · *delivered Oct 16, signed R SMITH* · *returned* · *unclaimed* · *number coming*. */
export function mailPieceWords(p: LienMailPieceRow, fmt: (ymd: string) => string = (d) => d): string {
  const delivered = day(p.delivered_at, fmt)
  const mailed = day(p.mailed_at, fmt)
  switch (p.status) {
    case 'delivered':
      return `delivered${delivered ? ` ${delivered}` : ''}${p.signed_by ? `, signed ${p.signed_by.trim()}` : ''}`
    case 'returned':
      return 'returned to sender'
    case 'notice_left':
      return 'notice left, unclaimed so far'
    case 'in_transit':
      return `in transit${mailed ? `, mailed ${mailed}` : ''}`
    case 'mailed':
      return `mailed${mailed ? ` ${mailed}` : ''}`
    case 'sent':
      return 'with Docsmit, not yet accepted by USPS'
    case 'failed':
      return `Docsmit refused it${p.problem ? `: ${p.problem}` : ''}`
    case 'prepared':
      return 'prepared, not sent'
    default:
      return p.delivery_status ? `USPS says "${p.delivery_status}"` : 'status unknown'
  }
}

/** The tail of the Sent row for a filing with pieces: ` · mailed through Docsmit · delivered Oct 16` (one state when the pieces agree, else per recipient). Empty with no pieces. */
export function filingMailTail(pieces: ReadonlyArray<LienMailPieceRow>, fmt: (ymd: string) => string = (d) => d): string {
  if (pieces.length === 0) return ''
  const words = pieces.map((p) => ({ who: RECIPIENT_WORDS[p.recipient] ?? p.recipient, words: mailPieceWords(p, fmt) }))
  const distinct = [...new Set(words.map((w) => w.words))]
  return ` · mailed through Docsmit · ${distinct.length === 1 ? distinct[0] : words.map((w) => `${w.who.toLowerCase()} ${w.words}`).join('; ')}`
}

/** The footer's lines, one per piece: the recipient, the state, the USPS number, the charge once read. */
export function filingMailLines(pieces: ReadonlyArray<LienMailPieceRow>, fmt: (ymd: string) => string = (d) => d): Array<{ id: string; who: string; words: string; tracking: string; cost: string; tone: 'green' | 'red' | 'amber' | 'muted' }> {
  return pieces.map((p) => ({
    id: p.id,
    who: `${RECIPIENT_WORDS[p.recipient] ?? p.recipient}${mailPieceIsPlainCopy(p) ? ' (plain copy)' : ''}`,
    words: p.resolved_at ? `${mailPieceWords(p, fmt)} · ${(p.resolved_note ?? '').trim() || 'handled'}` : mailPieceWords(p, fmt),
    tracking: (p.usps_tracking ?? '').trim(),
    cost: mailCostDollars(p.price),
    tone: p.resolved_at ? 'muted' : p.status === 'delivered' ? 'green' : p.status === 'returned' || p.status === 'failed' ? 'red' : p.status === 'notice_left' || p.status === 'unknown' ? 'amber' : 'muted',
  }))
}

/** The pieces that want a person: returned, unclaimed, refused, or a status the fold had not seen — and not yet answered through a door (6b-3). */
export function mailPiecesNeedingYou(pieces: ReadonlyArray<LienMailPieceRow>): LienMailPieceRow[] {
  return pieces.filter((p) => !p.resolved_at && (p.status === 'returned' || p.status === 'notice_left' || p.status === 'failed' || p.status === 'unknown'))
}

/** A plain First Class copy sent through a door, riding beside the certified envelope it answers. */
export function mailPieceIsPlainCopy(p: Pick<LienMailPieceRow, 'send_type' | 'resend_of'>): boolean {
  return !!p.resend_of && /^first class$/i.test((p.send_type ?? '').trim())
}

/** `$2.49`, or empty while the charge is not read. */
export function mailCostDollars(price: number | null | undefined): string {
  return typeof price === 'number' && Number.isFinite(price) ? `$${price.toFixed(2)}` : ''
}

/** The footer's cost line for a filing: *Docsmit cost $4.98* summing the pieces read so far, *· 1 not read yet* when one is not; empty with none read. */
export function filingMailCostWords(pieces: ReadonlyArray<LienMailPieceRow>): string {
  const read = pieces.filter((p) => typeof p.price === 'number' && Number.isFinite(p.price))
  if (read.length === 0) return ''
  const total = read.reduce((s, p) => s + (p.price as number), 0)
  const unread = pieces.length - read.length
  return `Docsmit cost ${mailCostDollars(Math.round(total * 100) / 100)}${unread > 0 ? ` · ${unread} not read yet` : ''}`
}

/**
 * The Do now rows for the envelopes that want a person (6b, the Deliveries filter): one per piece the fold put in
 * `mailPiecesNeedingYou`, keyed to its job through the filings it holds. `filingsByJob` is the desk's own read.
 */
export function mailNeedsYouRows(filingsByJob: Readonly<Record<string, ReadonlyArray<{ id: string }>>>, piecesByFiling: Readonly<Record<string, ReadonlyArray<LienMailPieceRow>>>, fmt: (ymd: string) => string = (d) => d): Array<{ jobId: string; pieceId: string; who: string; words: string }> {
  const out: Array<{ jobId: string; pieceId: string; who: string; words: string }> = []
  const seen = new Set<string>()
  for (const [jobId, filings] of Object.entries(filingsByJob)) {
    for (const f of filings) {
      for (const p of mailPiecesNeedingYou(piecesByFiling[f.id] ?? [])) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        out.push({ jobId, pieceId: p.id, who: RECIPIENT_WORDS[p.recipient] ?? p.recipient, words: mailPieceWords(p, fmt) })
      }
    }
  }
  return out
}

/** The sent notices mailed through the provider, for the Sent pile's Deliveries filter: the job ids with a piece behind the sent filing. */
export function jobsWithMailPieces(entries: ReadonlyArray<{ jobId: string; item: { sent_filing_id?: string | null } | null }>, piecesByFiling: Readonly<Record<string, ReadonlyArray<LienMailPieceRow>>>): Set<string> {
  const out = new Set<string>()
  for (const e of entries) {
    const id = e.item?.sent_filing_id
    if (id && (piecesByFiling[id]?.length ?? 0) > 0) out.add(e.jobId)
  }
  return out
}
