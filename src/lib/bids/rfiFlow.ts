/**
 * RFI flow kernel — RFI loop Phase R1 (docs/RFI_LOOP_PLAN.md).
 *
 * Pure logic for the bids_rfis queue: allowed status transitions, the CT "RFI flags"
 * clipboard parser (the counts-seam pattern — CountTooling's Copy RFI Flags produces
 * `RFI flags⇥<project>` then `p<N> <page>[ · <canvas>]⇥<question>` lines), audit-note
 * text for the bid ledger (method-less notes: v2.2413 — they never move the chase
 * clock), and `openRfisAtSend` for the Phase-R5 letter chip.
 *
 * RFIs are NON-BLOCKING (locked owner decision): an open RFI never stops the takeoff;
 * it must instead surface as an explicit assumption or exclusion at the letter.
 */

export type RfiStatus = 'draft' | 'approved' | 'sent' | 'answered' | 'withdrawn'
export type RfiSource = 'manual' | 'ct_note' | 'substrate'
export type RfiSentVia = 'email' | 'planhub' | 'phone' | 'other'

export type RfiRecipient = { gc_customer_id: string | null; name: string }

export type RfiRow = {
  id: string
  bid_id: string
  rfi_number: number
  question: string
  sheet_ref: string | null
  source: RfiSource
  status: RfiStatus
  sent_at: string | null
  sent_via: RfiSentVia | null
  sent_to: RfiRecipient[]
  answer: string | null
  answered_at: string | null
  answer_ref: string | null
}

/** Which statuses each status may move to. Withdrawn is terminal; answered accepts
 * nothing further (a follow-up question is a NEW RFI, keeping the ledger honest). */
const TRANSITIONS: Record<RfiStatus, RfiStatus[]> = {
  draft: ['approved', 'withdrawn'],
  approved: ['sent', 'draft', 'withdrawn'],
  sent: ['answered', 'withdrawn'],
  answered: [],
  withdrawn: [],
}

export function canTransition(from: RfiStatus, to: RfiStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to)
}

export function allowedTransitions(from: RfiStatus): RfiStatus[] {
  return TRANSITIONS[from] ?? []
}

/** Parse CountTooling's Copy-RFI-Flags clipboard text into draft candidates.
 * Tolerates a missing header (plain `sheet⇥question` lines still import); skips
 * blank lines and rows without a tab. Never throws on garbage — returns []. */
export function parseCtRfiFlags(text: string): Array<{ sheet_ref: string; question: string }> {
  const out: Array<{ sheet_ref: string; question: string }> = []
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trimEnd()
    if (!line || !line.includes('\t')) continue
    const [left = '', ...rest] = line.split('\t')
    const right = rest.join('\t').trim()
    if (!right) continue
    if (left.trim() === 'RFI flags') continue // header row: `RFI flags⇥<project>`
    out.push({ sheet_ref: left.trim(), question: right })
  }
  return out
}

/** The audit stamp for the bid's note ledger (method-less → never moves the chase clock). */
export function rfiAuditNote(
  event: 'created' | 'approved' | 'sent' | 'answered' | 'withdrawn',
  rfi: Pick<RfiRow, 'rfi_number' | 'question' | 'sheet_ref' | 'sent_via' | 'sent_to' | 'answer_ref'>
): string {
  const head = `[RFI-${rfi.rfi_number}]`
  const q = rfi.question.length > 140 ? rfi.question.slice(0, 137) + '…' : rfi.question
  const where = rfi.sheet_ref ? ` (${rfi.sheet_ref})` : ''
  switch (event) {
    case 'created':
      return `${head} drafted${where}: ${q}`
    case 'approved':
      return `${head} approved for sending${where}`
    case 'sent': {
      const to = (rfi.sent_to ?? []).map((r) => r.name).filter(Boolean).join(', ')
      return `${head} sent${rfi.sent_via ? ` via ${rfi.sent_via}` : ''}${to ? ` to ${to}` : ''}${where}: ${q}`
    }
    case 'answered':
      return `${head} answered${rfi.answer_ref ? ` — ${rfi.answer_ref}` : ''}`
    case 'withdrawn':
      return `${head} withdrawn`
  }
}

/** Open = will need an assumption/exclusion line if the letter goes out now (Phase R5). */
export function openRfisAtSend(rfis: Array<Pick<RfiRow, 'status'>>): number {
  return rfis.filter((r) => r.status === 'draft' || r.status === 'approved' || r.status === 'sent').length
}
