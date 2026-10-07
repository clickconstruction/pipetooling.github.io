/**
 * Property per job (punch list #85, item 6). A legal packet's "Property record"
 * used to be every `customer_addresses` row of the payer — on a GC-paid job,
 * the GC's office addresses, not the project — and the lien clock ran every job
 * from the first of them. This kernel resolves each job's own property by the
 * lien paper's rule (`resolveLienProperty`):
 *
 *   1. the record the job names (`jobs_ledger.customer_address_id`), whichever
 *      customer it belongs to, else a record of the payer whose address is the
 *      job's address exactly (said as `matched`), else the job's own address
 *      with nothing known (`job_address`) — legal identity is never guessed;
 *   2. the job's `job_property_owners` override wins for the owner block.
 *
 * Jobs at one property with one owner share a line, labelled with every job.
 * Pure: no React, no supabase. The office hook and the firm's function feed it
 * the same rows, so the desk and the firm agree.
 */
import { customerAddressLienGaps, normalizeAddressForMatch, resolveLienProperty, type CustomerAddressRow, type JobPropertyOwnerLike } from '../jobs/lienProperty'

/** A job's owner override as the packet carries it — the firm's function sends no owner email. */
export type LegalJobOwnerRow = { job_id: string; owner_mode: string | null; owner_name: string | null; company_name: string | null; mailing_address: string | null }

/** Where a job's property came from: the record the job names, an exact address match on the payer's records, or only the job's address. */
export type LegalPropertySource = 'linked' | 'matched' | 'job_address'

export type LegalPropertyLine = {
  /** Stable per property and owner: the record id, else the job's normalized address. */
  key: string
  address: string
  county: string
  /** The justice precinct on the record (v2.4771), '' until the court map names it; the note when it sits on a line. */
  precinct: string
  precinctNote: string
  owner: string
  legalDescription: string
  parcelId: string
  propertyKind: string
  homestead: boolean
  lienReady: boolean
  /** What a lien affidavit still needs — empty means lien-ready. */
  gaps: string[]
  source: LegalPropertySource
  /** Which record supplied the owner: the job's override or the property record. */
  ownerSource: 'job_override' | 'property_record' | 'none'
  /** The jobs that stand on this property, in the account's job order. */
  jobIds: string[]
  jobLabels: string[]
}

export type LegalPropertyJobLike = { id: string; job_address: string | null; customer_address_id?: string | null }

export const NO_PROPERTY_RECORD_GAP = 'a property record linked to the job'

export function resolveLegalJobProperties(
  jobs: ReadonlyArray<LegalPropertyJobLike>,
  opts: {
    labelOf: (jobId: string) => string
    /** The records the jobs name, fetched by id (any customer's). */
    jobAddresses: ReadonlyArray<CustomerAddressRow>
    /** The payer's own records, for an exact address match when a job names none. */
    payerAddresses: ReadonlyArray<CustomerAddressRow>
    owners: ReadonlyArray<LegalJobOwnerRow>
  },
): { byJob: Map<string, LegalPropertyLine>; properties: LegalPropertyLine[] } {
  const byId = new Map<string, CustomerAddressRow>()
  for (const a of [...opts.payerAddresses, ...opts.jobAddresses]) if (a?.id) byId.set(a.id, a)
  const ownerOf = new Map(opts.owners.map((o) => [o.job_id, o] as const))
  const lines = new Map<string, LegalPropertyLine>()
  const byJob = new Map<string, LegalPropertyLine>()
  for (const j of jobs) {
    const linked = j.customer_address_id ? (byId.get(j.customer_address_id) ?? null) : null
    const jobKey = normalizeAddressForMatch(j.job_address ?? '')
    const matched = linked ? null : (jobKey ? (opts.payerAddresses.find((a) => normalizeAddressForMatch(a.address) === jobKey) ?? null) : null)
    const row = linked ?? matched
    const source: LegalPropertySource = linked ? 'linked' : matched ? 'matched' : 'job_address'
    const override = (ownerOf.get(j.id) ?? null) as JobPropertyOwnerLike
    const r = resolveLienProperty(row, override)
    const owner = [r.owner.ownerCompany, r.owner.ownerName].filter(Boolean).join(' · ')
    const recordGaps = customerAddressLienGaps({ county: r.county, legal_description: r.legalDescription, owner_name: r.owner.ownerName, owner_company: r.owner.ownerCompany, owner_mailing_address: r.owner.mailingAddress })
    const gaps = row ? recordGaps : [NO_PROPERTY_RECORD_GAP, ...recordGaps]
    const key = `${row ? `a:${row.id}` : `j:${jobKey || j.id}`}|${owner.toLowerCase()}`
    let line = lines.get(key)
    if (!line) {
      line = {
        key,
        address: (row?.address ?? j.job_address ?? '').trim(),
        county: r.county,
        precinct: ((row as { jp_precinct?: string | null } | null)?.jp_precinct ?? '').trim(),
        precinctNote: ((row as { jp_precinct_note?: string | null } | null)?.jp_precinct_note ?? '').trim(),
        owner,
        legalDescription: r.legalDescription,
        parcelId: (row?.parcel_id ?? '').trim(),
        propertyKind: r.propertyKind,
        homestead: r.homestead,
        lienReady: gaps.length === 0,
        gaps,
        source,
        ownerSource: r.owner.source,
        jobIds: [],
        jobLabels: [],
      }
      lines.set(key, line)
    }
    line.jobIds.push(j.id)
    line.jobLabels.push(opts.labelOf(j.id))
    byJob.set(j.id, line)
  }
  return { byJob, properties: [...lines.values()] }
}

/** The kind in the firm's words: `residential`, `non-residential`, or '' when unknown. */
export function propertyKindWords(kind: string | null | undefined): string {
  return kind === 'residential' ? 'residential' : kind ? 'non-residential' : ''
}

/**
 * An unknown kind runs the later (commercial) calendar, as the lien timeline does; every reader says
 * so beside the kind, so nobody takes the dates for a residential job's (a month earlier).
 */
export const PROPERTY_KIND_UNKNOWN_WORDS = 'kind unknown · commercial dates shown (a residential property is a month earlier)'

/** The kind cell: `residential`, `non-residential`, or the unknown words. */
export function propertyKindCell(kind: string | null | undefined): string {
  return propertyKindWords(kind) || PROPERTY_KIND_UNKNOWN_WORDS
}

/** Where the record came from, said beside the address: '' for a linked record. */
export function propertySourceNote(source: LegalPropertySource): string {
  return source === 'job_address' ? 'no property record linked' : source === 'matched' ? 'matched by address, not linked' : ''
}
