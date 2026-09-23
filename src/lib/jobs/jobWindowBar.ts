/**
 * The job window's phone action bar (punch list #30, PR 2b): what the middle button says,
 * who sees Arrived / Leaving, and the three tiles under the customer. Pure.
 */
import type { JobNextChip } from './jobNextLine'
import type { EditJobBillingBar } from './editJobBillingBar'
import { formatCurrencyNoCents } from './jobFormatting'

export type JobWindowVerbTarget = 'pct' | 'bill' | 'status'
export type JobWindowVerb = { label: string; tone: 'red' | 'blue' | 'green'; target: JobWindowVerbTarget }

/**
 * The bar's verb, from the same chip the Pipeline row shows plus the bill ledger: the gap the
 * row flagged is the thing the bar offers to fix. `null` on a Paid job (nothing is next).
 */
export function jobWindowVerb(input: { status: string | null; chip: JobNextChip | null; bar: EditJobBillingBar }): JobWindowVerb | null {
  const { status, chip, bar } = input
  if (status === 'paid') return null
  if (chip?.action === 'pct') return { label: 'Set % done', tone: 'red', target: 'pct' }
  if (chip?.action === 'bill-stage') return { label: 'Bill it', tone: 'green', target: 'bill' }
  if (bar.draft > 0) return { label: 'Send bill…', tone: 'blue', target: 'bill' }
  switch (status) {
    case 'waiting':
      return { label: 'Move to Working', tone: 'blue', target: 'status' }
    case 'working':
      return { label: 'Ready to bill', tone: chip?.action === 'advance' ? 'green' : 'blue', target: 'status' }
    case 'ready_to_bill':
      return { label: 'Bill it', tone: 'blue', target: 'bill' }
    case 'billed':
      return { label: 'Mark paid', tone: 'blue', target: 'status' }
    default:
      return null
  }
}

/** On the crew = a team member of the job, or assigned to one of its schedule blocks. */
export function viewerOnCrew(viewerId: string | null | undefined, teamMemberIds: Iterable<string>, scheduleAssigneeIds: Iterable<string>): boolean {
  if (!viewerId) return false
  for (const id of teamMemberIds) if (id === viewerId) return true
  for (const id of scheduleAssigneeIds) if (id === viewerId) return true
  return false
}

/** Job total · Billed (paid + open) · Paid, "—" for nothing. */
export function jobWindowTiles(bar: EditJobBillingBar): { total: string; billed: string; paid: string } {
  const f = (n: number) => (n > 0 ? `$${formatCurrencyNoCents(n)}` : '—')
  return { total: f(bar.total), billed: f(bar.paid + bar.billedUnpaid), paid: f(bar.paid) }
}
