import {
  ACCOUNT_MAN_RELATIONSHIP_LABELS,
  parseAccountManRelationship,
} from './accountMan'
import { customerListImpliesLinkedRow } from './jobFormCustomerDisplay'
import { formatTimeSince } from './jobFormatting'
import type { Database } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

/**
 * Value formatting for the Edit-tab fact rows (v2.1681): each function turns
 * form state into the one-line summary its row shows while collapsed. Null
 * means "nothing set" — the row renders a muted em dash.
 */

type NamedUser = { id: string; name: string }

/** "Malachi · Primary" (relationship label always shown so Only pops). */
export function accountManRowValue(
  users: NamedUser[],
  accountManagerUserId: string | null,
  accountManagerRelationship: string | null,
): string | null {
  if (!accountManagerUserId) return null
  const name = users.find((u) => u.id === accountManagerUserId)?.name?.trim()
  if (!name) return null
  const relationship = parseAccountManRelationship(accountManagerRelationship) ?? 'primary'
  return `${name} · ${ACCOUNT_MAN_RELATIONSHIP_LABELS[relationship]}`
}

/** Team names joined in assignment order; unknown ids fall back to the id. */
export function teamRowValue(users: NamedUser[], teamMemberIds: string[]): string | null {
  if (teamMemberIds.length === 0) return null
  return teamMemberIds.map((id) => users.find((u) => u.id === id)?.name?.trim() || id).join(', ')
}

export type CustomerRowSummary = {
  name: string
  linked: boolean
  /** Linked customer's address, for the muted tail. */
  address: string | null
  /** Show the amber "Not in Customers" chip (same heuristic as the classic header). */
  notInCustomers: boolean
}

export function customerRowSummary(args: {
  customers: CustomerRow[]
  customerId: string | null
  customerName: string
  customerEmail: string
  customerPhone: string
  masterUserId: string
}): CustomerRowSummary | null {
  const { customers, customerId, customerName, customerEmail, customerPhone, masterUserId } = args
  const hasFormCustomer = !!(customerName.trim() || customerEmail.trim() || customerPhone.trim())
  if (!customerId && !hasFormCustomer) return null
  const linkedRow = customerId ? customers.find((c) => c.id === customerId) ?? null : null
  const name = customerName.trim() || linkedRow?.name?.trim() || '—'
  return {
    name,
    linked: !!customerId,
    address: linkedRow?.address?.trim() || null,
    notInCustomers:
      hasFormCustomer &&
      !customerId &&
      !customerListImpliesLinkedRow(customers, masterUserId, customerName),
  }
}

export type FolderRowLinks = { files: string | null; pictures: string | null }

/** Trimmed URLs or null — the row shows inline "Files · Pictures" links for the set ones. */
export function folderRowLinks(googleDriveLink: string, jobPicturesLink: string): FolderRowLinks {
  return {
    files: googleDriveLink.trim() || null,
    pictures: jobPicturesLink.trim() || null,
  }
}

/** "08/15/26" from the form's YYYY-MM-DD; string math so no timezone shift. */
export function dateMetRowValue(dateMet: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateMet.trim())
  if (!m) return null
  const [, y, mo, d] = m
  return `${mo}/${d}/${(y ?? '').slice(2)}`
}

/**
 * "(2 months ago)"-style age for the Date met row (v2.1700) — the same
 * day/week/month/year buckets as the Pipeline's "Open N" (formatTimeSince).
 * Sub-day ages collapse to "today": Date met is a calendar date, so "5 hours
 * ago" would just be noise.
 */
export function dateMetRowAgo(dateMet: string, now = new Date()): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateMet.trim())
  if (!m) return null
  const since = formatTimeSince(`${m[1]}-${m[2]}-${m[3]}T00:00:00`, now)
  if (since === '—' || since === 'just now' || /minute|hour/.test(since)) return 'today'
  return `${since} ago`
}
