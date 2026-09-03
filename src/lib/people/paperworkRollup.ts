/**
 * Person Desk paperwork rollup (PR 3): one line per document lineage for a
 * person, newest version wins, with the chip state the Contracts tab implies
 * (unsent / sent / signed, plus expiry when a date is set).
 */

export type PaperworkDocInput = {
  id: string
  document_name: string
  status: string
  signed_at: string | null
  sent_at: string | null
  expires_at?: string | null
  dashboard_prompt_after_clock_in: boolean | null
  contract_lineage_id: string | null
  lineage_version: number | null
  doc_type?: string | null
}

export type PaperworkState = 'unsent' | 'sent' | 'signed' | 'expiring' | 'expired'

export type PaperworkLine = {
  id: string
  name: string
  state: PaperworkState
  detail: string
  nag: boolean
}

export const PAPERWORK_EXPIRY_WARN_DAYS = 30

function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000)
}

export function buildPaperworkLines(docs: readonly PaperworkDocInput[], todayYmd: string): PaperworkLine[] {
  // Newest lineage version per lineage (fallback: per name when the lineage id is null).
  const latest = new Map<string, PaperworkDocInput>()
  for (const d of docs) {
    const key = d.contract_lineage_id ?? `name:${d.document_name}`
    const cur = latest.get(key)
    if (!cur || (d.lineage_version ?? 0) > (cur.lineage_version ?? 0)) latest.set(key, d)
  }
  const lines: PaperworkLine[] = []
  for (const d of latest.values()) {
    let state: PaperworkState = d.status === 'signed' ? 'signed' : d.status === 'sent' ? 'sent' : 'unsent'
    let detail = state === 'signed' ? `signed ${d.signed_at ? d.signed_at.slice(0, 10) : ''}`.trim() : state === 'sent' ? `sent ${d.sent_at ? d.sent_at.slice(0, 10) : ''}`.trim() : 'not sent'
    if (state === 'signed' && d.expires_at) {
      const days = daysBetween(todayYmd, d.expires_at)
      if (days < 0) {
        state = 'expired'
        detail = `expired ${d.expires_at}`
      } else if (days <= PAPERWORK_EXPIRY_WARN_DAYS) {
        state = 'expiring'
        detail = `expires in ${days} day${days === 1 ? '' : 's'}`
      }
    }
    lines.push({ id: d.id, name: d.document_name, state, detail, nag: Boolean(d.dashboard_prompt_after_clock_in) })
  }
  const order: Record<PaperworkState, number> = { expired: 0, unsent: 1, expiring: 2, sent: 3, signed: 4 }
  lines.sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name))
  return lines
}

export function summarizePaperwork(lines: readonly PaperworkLine[]): { unsent: number; sent: number; signed: number; expiring: number; expired: number } {
  const s = { unsent: 0, sent: 0, signed: 0, expiring: 0, expired: 0 }
  for (const l of lines) s[l.state] += 1
  return s
}
