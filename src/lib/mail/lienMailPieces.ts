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

/** The footer's lines, one per piece: the recipient, the state, the USPS number. */
export function filingMailLines(pieces: ReadonlyArray<LienMailPieceRow>, fmt: (ymd: string) => string = (d) => d): Array<{ id: string; who: string; words: string; tracking: string; tone: 'green' | 'red' | 'amber' | 'muted' }> {
  return pieces.map((p) => ({
    id: p.id,
    who: RECIPIENT_WORDS[p.recipient] ?? p.recipient,
    words: mailPieceWords(p, fmt),
    tracking: (p.usps_tracking ?? '').trim(),
    tone: p.status === 'delivered' ? 'green' : p.status === 'returned' || p.status === 'failed' ? 'red' : p.status === 'notice_left' || p.status === 'unknown' ? 'amber' : 'muted',
  }))
}

/** The pieces that want a person: returned, unclaimed, refused, or a status the fold had not seen. */
export function mailPiecesNeedingYou(pieces: ReadonlyArray<LienMailPieceRow>): LienMailPieceRow[] {
  return pieces.filter((p) => p.status === 'returned' || p.status === 'notice_left' || p.status === 'failed' || p.status === 'unknown')
}
