/**
 * Builds the plain-text summary the Bid Preview "Copy for text" button puts on
 * the clipboard — project name, address, and bid due date, one per line, ready
 * to paste into a text message. Missing fields are skipped.
 */

export type BidCopyForTextFields = {
  project_name?: string | null
  address?: string | null
  bid_due_date?: string | null
}

/** 2026-08-27 → 8/27/2026 without going through Date (no timezone shift). */
function formatYmdForText(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${Number(m[2])}/${Number(m[3])}/${m[1]}`
}

export function buildBidCopyForText(bid: BidCopyForTextFields): string {
  const lines: string[] = []
  const name = bid.project_name?.trim()
  if (name) lines.push(name)
  const address = bid.address?.trim()
  if (address) lines.push(address)
  const due = bid.bid_due_date?.trim()
  if (due) lines.push(`Bid due: ${formatYmdForText(due)}`)
  return lines.join('\n')
}
