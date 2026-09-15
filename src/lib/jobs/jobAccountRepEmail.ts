/**
 * Job accounts from the bid (v2.3451): the estimator's email to the house's
 * job-accounts rep, composed from what the bid knows — the property, our
 * company, the GC's contact — and the ordering of houses on the Job accounts
 * question when the job came from a bid (the houses that quoted it first,
 * preselected). Pure.
 */

import type { JobAccountStripEntry } from './jobAccountStrip'

export interface BidPacketFacts {
  bidLabel: string
  propertyName: string | null | undefined
  address: string | null | undefined
  startDate: string | null | undefined
  gc: { company: string | null | undefined; contactName: string | null | undefined; phone: string | null | undefined; email: string | null | undefined } | null
  /** The owner of record when the office has it (job_property_owners); null = not on file. */
  owner: { name: string; mailingAddress: string } | null
}

export interface RepEmailOrg {
  companyName: string | null | undefined
  officePhone: string | null | undefined
}

const t = (s: string | null | undefined): string => (s ?? '').trim()

function fmtDate(iso: string | null | undefined): string {
  const v = t(iso)
  if (!v) return ''
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Subject + plain-text body for the rep. Short, in the estimator's voice, the facts the counter needs. */
export function composeRepEmail(args: {
  repFirstName: string
  houseName: string
  facts: BidPacketFacts
  org: RepEmailOrg
  senderName: string
}): { subject: string; text: string } {
  const company = t(args.org.companyName) || 'our company'
  const phone = t(args.org.officePhone)
  const address = t(args.facts.address) || t(args.facts.propertyName) || 'the property below'
  const subject = `Job account — ${address} (${company})`
  const start = fmtDate(args.facts.startDate)
  const lines: string[] = []
  lines.push(`${args.repFirstName || 'Hi'} — we won this one. Please open a job account for ${company} at the property below${start ? `; first parts run is around ${start}` : ''}.`)
  lines.push('')
  lines.push(`Property: ${address}`)
  if (t(args.facts.propertyName) && t(args.facts.propertyName) !== address) lines.push(`Project: ${t(args.facts.propertyName)}`)
  if (args.facts.gc && (t(args.facts.gc.company) || t(args.facts.gc.contactName))) {
    const who = [t(args.facts.gc.company), t(args.facts.gc.contactName)].filter(Boolean).join(' — ')
    const reach = [t(args.facts.gc.phone), t(args.facts.gc.email)].filter(Boolean).join(', ')
    lines.push(`General contractor: ${who}${reach ? `, ${reach}` : ''}`)
  }
  lines.push(args.facts.owner ? `Owner of record: ${args.facts.owner.name}, ${args.facts.owner.mailingAddress}` : 'Owner of record: to follow from our office.')
  lines.push('')
  lines.push(`Reply here${phone ? ` or call the office at ${phone}` : ''}. — ${t(args.senderName) || company}`)
  return { subject, text: lines.join('\n') }
}

export function repFirstName(name: string | null | undefined): string {
  return t(name).split(/\s+/)[0] ?? ''
}

/**
 * The Job accounts question's house order when the job came from a bid:
 * houses that quoted the bid first (preselected), then the rest in their
 * existing order. Only houses the question can still ask (state none).
 */
export function orderHousesForBid(entries: JobAccountStripEntry[], quotedHouseIds: ReadonlySet<string>): { entries: JobAccountStripEntry[]; preselected: Set<string> } {
  const quoted = entries.filter((e) => quotedHouseIds.has(e.houseId))
  const rest = entries.filter((e) => !quotedHouseIds.has(e.houseId))
  const preselected = new Set(quoted.filter((e) => e.state === 'none').map((e) => e.houseId))
  return { entries: [...quoted, ...rest], preselected }
}
