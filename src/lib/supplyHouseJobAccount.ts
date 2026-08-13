/**
 * "Share with supply house" job-account packet (v2.1605; owner rework v2.1609).
 *
 * Supply houses setting up a job account need: the property (name, address,
 * site phone), the GENERAL CONTRACTOR on the job, and — critically — the
 * PROPERTY OWNER: homeowner, or building owner with company name, plus the
 * owner's MAILING ADDRESS (lien-notice material). The GC is NOT the owner on
 * GC-routed jobs, so the owner section only prefills when we truly know the
 * owner (residential customer with no GC = the customer; commercial customer
 * with no GC = the customer as building owner; a previously saved
 * job_property_owners row always wins). Sending is HARD-BLOCKED until the
 * owner is known (owner-mode-appropriate name/company + mailing address).
 */

export type OwnerMode = 'homeowner' | 'building_owner'

export interface JobAccountInfo {
  propertyName: string
  address: string
  sitePhone: string
  /** General contractor block — from the job; empty strings when the job has no GC. */
  gcCompany: string
  gcPhone: string
  gcEmail: string
  ownerMode: OwnerMode
  /** Homeowner name, or the building owner's contact person (optional for building owners). */
  ownerName: string
  /** Building-owner mode only. */
  companyName: string
  /** The owner's mailing address — required to send (lien notices go here). */
  mailingAddress: string
  ownerEmail: string
}

export interface JobAccountPrefillArgs {
  jobName: string | null
  jobAddress: string | null
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  customerAddress: string | null
  customerType: string | null
  /** The job's GC customer row, when one is linked. */
  gc: { name: string | null; phone: string | null; email: string | null } | null
  /** Previously saved owner info for this job (job_property_owners) — always wins. */
  savedOwner: {
    owner_mode: string
    owner_name: string
    company_name: string
    mailing_address: string
    owner_email: string
  } | null
}

const t = (s: string | null | undefined): string => (s ?? '').trim()

export function prefillJobAccountInfo(a: JobAccountPrefillArgs): JobAccountInfo {
  const hasGc = a.gc != null && t(a.gc.name) !== ''
  const base = {
    propertyName: t(a.jobName),
    address: t(a.jobAddress),
    sitePhone: t(a.customerPhone),
    gcCompany: hasGc ? t(a.gc!.name) : '',
    gcPhone: hasGc ? t(a.gc!.phone) : '',
    gcEmail: hasGc ? t(a.gc!.email) : '',
  }
  if (a.savedOwner) {
    return {
      ...base,
      ownerMode: a.savedOwner.owner_mode === 'building_owner' ? 'building_owner' : 'homeowner',
      ownerName: t(a.savedOwner.owner_name),
      companyName: t(a.savedOwner.company_name),
      mailingAddress: t(a.savedOwner.mailing_address),
      ownerEmail: t(a.savedOwner.owner_email),
    }
  }
  if (hasGc) {
    // GC-routed job: the GC is NOT the owner — start the owner section blank.
    return { ...base, ownerMode: 'building_owner', ownerName: '', companyName: '', mailingAddress: '', ownerEmail: '' }
  }
  if (a.customerType === 'commercial') {
    // No GC and a commercial customer: the customer IS the building owner.
    return {
      ...base,
      ownerMode: 'building_owner',
      ownerName: '',
      companyName: t(a.customerName),
      mailingAddress: t(a.customerAddress),
      ownerEmail: t(a.customerEmail),
    }
  }
  // Residential, no GC: the customer is the homeowner.
  return {
    ...base,
    ownerMode: 'homeowner',
    ownerName: t(a.customerName),
    companyName: '',
    mailingAddress: t(a.customerAddress),
    ownerEmail: t(a.customerEmail),
  }
}

/** Human labels of the OWNER fields still blank — exactly what blocks sending. */
export function jobAccountOwnerGaps(info: JobAccountInfo): string[] {
  const gaps: string[] = []
  if (info.ownerMode === 'building_owner') {
    if (!t(info.companyName)) gaps.push('Owner company')
  } else if (!t(info.ownerName)) {
    gaps.push('Owner name')
  }
  if (!t(info.mailingAddress)) gaps.push('Owner mailing address')
  return gaps
}

/** Send is blocked until the owner is known (v2.1609 — owner call, no escape hatch). */
export function jobAccountSendBlocked(info: JobAccountInfo): boolean {
  return jobAccountOwnerGaps(info).length > 0
}

/** Non-blocking gaps for the footer (property/site fields). */
export function jobAccountSoftGaps(info: JobAccountInfo): string[] {
  const gaps: string[] = []
  if (!t(info.propertyName)) gaps.push('Property name')
  if (!t(info.address)) gaps.push('Address')
  if (!t(info.sitePhone)) gaps.push('Site phone')
  return gaps
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Subject + plain text + sectioned table HTML: Property · General contractor · Property owner. */
export function composeJobAccountEmail(
  info: JobAccountInfo,
  jobLabel: string,
  senderName: string,
  org?: { companyName?: string; officePhone?: string }
): { subject: string; text: string; html: string } {
  const company = t(org?.companyName)
  const officePhone = t(org?.officePhone)
  const sections: Array<{ title: string; rows: Array<[string, string]> }> = [
    {
      title: 'Property',
      rows: [
        ['Name', info.propertyName || '—'],
        ['Address', info.address || '—'],
        ['Site phone', info.sitePhone || '—'],
      ],
    },
    ...(t(info.gcCompany)
      ? [
          {
            title: 'General contractor',
            rows: [
              ['Company', info.gcCompany] as [string, string],
              ...(t(info.gcPhone) ? ([['Phone', info.gcPhone]] as Array<[string, string]>) : []),
              ...(t(info.gcEmail) ? ([['Email', info.gcEmail]] as Array<[string, string]>) : []),
            ],
          },
        ]
      : []),
    {
      title: 'Property owner',
      rows: [
        ...(info.ownerMode === 'building_owner'
          ? ([['Building owner (company)', info.companyName || '—']] as Array<[string, string]>)
          : []),
        ...(info.ownerMode === 'building_owner'
          ? t(info.ownerName)
            ? ([['Contact', info.ownerName]] as Array<[string, string]>)
            : []
          : ([['Homeowner', info.ownerName || '—']] as Array<[string, string]>)),
        ['Mailing address', info.mailingAddress || '—'],
        ...(t(info.ownerEmail) ? ([['Email', info.ownerEmail]] as Array<[string, string]>) : []),
      ],
    },
  ]
  const subject = `Job account setup — ${jobLabel}`
  const intro = `Please set up a job account for ${company || 'our office'} for the property below. Reply to this email${
    officePhone ? ` or call the office at ${officePhone}` : ''
  } with any questions${senderName ? ` — ${senderName}` : ''}.`
  const text = [
    subject,
    '',
    intro,
    ...sections.flatMap((s) => ['', `${s.title}:`, ...s.rows.map(([k, v]) => `  ${k}: ${v}`)]),
  ].join('\n')
  const html = [
    `<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; font-size: 14px; color: #111;">`,
    `<p>${esc(intro)}</p>`,
    ...sections.flatMap((s) => [
      `<p style="margin: 14px 0 4px; font-weight: 600;">${esc(s.title)}</p>`,
      `<table style="border-collapse: collapse;">`,
      ...s.rows.map(
        ([k, v]) =>
          `<tr><td style="padding: 3px 16px 3px 0; color: #666;">${esc(k)}</td><td style="padding: 3px 0;"><strong>${esc(v)}</strong></td></tr>`
      ),
      `</table>`,
    ]),
    `</div>`,
  ].join('')
  return { subject, text, html }
}
