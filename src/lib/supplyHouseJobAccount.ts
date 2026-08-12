/**
 * "Share with supply house" job-account packet (v2.1605, mockup-approved).
 *
 * Supply houses setting up a job account asked for: property name, address,
 * phone numbers, and the owner's info — the homeowner, or for a building
 * owner the company name too. These pure helpers prefill the packet from the
 * job + its customer (+ GC customer when present), list the gaps, and compose
 * the email the edge function sends verbatim.
 */

export type OwnerMode = 'homeowner' | 'building_owner'

export interface JobAccountInfo {
  propertyName: string
  address: string
  sitePhone: string
  ownerMode: OwnerMode
  ownerName: string
  ownerPhone: string
  ownerEmail: string
  /** Building-owner mode only. */
  companyName: string
}

export interface JobAccountPrefillArgs {
  jobName: string | null
  jobAddress: string | null
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  customerType: string | null
  /** Embedded GC customer name when the job carries one. */
  gcName: string | null
}

const t = (s: string | null | undefined): string => (s ?? '').trim()

/**
 * Building owner when the job has a GC or the customer is commercial; the GC
 * (when present) is the company and the job customer stays the site contact.
 */
export function prefillJobAccountInfo(a: JobAccountPrefillArgs): JobAccountInfo {
  const buildingOwner = t(a.gcName) !== '' || a.customerType === 'commercial'
  return {
    propertyName: t(a.jobName),
    address: t(a.jobAddress),
    sitePhone: t(a.customerPhone),
    ownerMode: buildingOwner ? 'building_owner' : 'homeowner',
    ownerName: t(a.customerName),
    ownerPhone: t(a.customerPhone),
    ownerEmail: t(a.customerEmail),
    companyName: t(a.gcName) || (a.customerType === 'commercial' ? t(a.customerName) : ''),
  }
}

/** Human labels of the fields still blank (company counts only for building owners). */
export function jobAccountGaps(info: JobAccountInfo): string[] {
  const gaps: string[] = []
  if (!t(info.propertyName)) gaps.push('Property name')
  if (!t(info.address)) gaps.push('Address')
  if (!t(info.sitePhone)) gaps.push('Site phone')
  if (!t(info.ownerName)) gaps.push('Owner name')
  if (!t(info.ownerPhone)) gaps.push('Owner phone')
  if (info.ownerMode === 'building_owner' && !t(info.companyName)) gaps.push('Company name')
  return gaps
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Subject + plain text + simple table HTML for the job-account email.
 * `org` (v2.1608) names who is asking and offers the office number — pulled
 * from the physical-invoice issuer settings (Settings → Templates & testing).
 */
export function composeJobAccountEmail(
  info: JobAccountInfo,
  jobLabel: string,
  senderName: string,
  org?: { companyName?: string; officePhone?: string }
): { subject: string; text: string; html: string } {
  const company = t(org?.companyName)
  const officePhone = t(org?.officePhone)
  const rows: Array<[string, string]> = [
    ['Property', info.propertyName || '—'],
    ['Address', info.address || '—'],
    ['Site phone', info.sitePhone || '—'],
    ...(info.ownerMode === 'building_owner'
      ? ([['Building owner (company)', info.companyName || '—']] as Array<[string, string]>)
      : []),
    [info.ownerMode === 'building_owner' ? 'Owner contact' : 'Homeowner', info.ownerName || '—'],
    ['Owner phone', info.ownerPhone || '—'],
    ...(t(info.ownerEmail) ? ([['Owner email', info.ownerEmail]] as Array<[string, string]>) : []),
  ]
  const subject = `Job account setup — ${jobLabel}`
  const intro = `Please set up a job account for ${company || 'our office'} for the property below. Reply to this email${
    officePhone ? ` or call the office at ${officePhone}` : ''
  } with any questions${senderName ? ` — ${senderName}` : ''}.`
  const text = [subject, '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n')
  const html = [
    `<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; font-size: 14px; color: #111;">`,
    `<p>${esc(intro)}</p>`,
    `<table style="border-collapse: collapse;">`,
    ...rows.map(
      ([k, v]) =>
        `<tr><td style="padding: 4px 16px 4px 0; color: #666;">${esc(k)}</td><td style="padding: 4px 0;"><strong>${esc(v)}</strong></td></tr>`
    ),
    `</table>`,
    `</div>`,
  ].join('')
  return { subject, text, html }
}
