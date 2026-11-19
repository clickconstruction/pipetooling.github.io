/**
 * A filed lien affidavit's row as its cover letter reads it (punch list #366): the fields the filing keeps, the
 * county, the recording number and the day filed. The letter states what was filed, never the job as it stands
 * today. The copy behind the letter is the clerk's stamped scan (`lienStampedCopy.ts`) and reads none of this.
 *
 * Null when the row is not a filed affidavit. A filed affidavit that keeps no fields (recorded by hand, or filed by
 * counsel) reads with every field blank since v2.7916: its stamped copy still prints, with no letter in front
 * (`lienServeLetterDrawable`). Pure.
 */
import type { LienAffidavitFields } from '../jobsDocuments/lienFilingDocuments'
import type { LienServeFacts } from '../jobsDocuments/lienServedCopy'
import type { JobLienFilingRow } from './lienDeadlines'

export type LienServeFiling = Pick<JobLienFilingRow, 'kind' | 'fields' | 'county' | 'recording_number' | 'filed_at' | 'voided_at'>

const text = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '')

/** The stored fields with every string the builders read made a string, so a row saved before a field existed draws its blank. */
function storedFields(raw: unknown): LienAffidavitFields | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const fields: LienAffidavitFields = {
    county: text(o.county),
    claimantPersonName: text(o.claimantPersonName),
    claimantCompany: text(o.claimantCompany),
    claimantAddress: text(o.claimantAddress),
    legalDescription: text(o.legalDescription),
    propertyAddress: text(o.propertyAddress),
    contractedWithName: text(o.contractedWithName),
    workDescription: text(o.workDescription),
    workStart: text(o.workStart),
    workEnd: text(o.workEnd),
    ownerName: text(o.ownerName),
    ownerAddress: text(o.ownerAddress),
    originalContractorName: text(o.originalContractorName),
    originalContractorAddress: text(o.originalContractorAddress),
    contractAmount: text(o.contractAmount),
    paidAmount: text(o.paidAmount),
    unpaidAmount: text(o.unpaidAmount),
    includeNoticesSworn: o.includeNoticesSworn === true,
  }
  if (o.form === 'short') fields.form = 'short'
  if (typeof o.isSub === 'boolean') fields.isSub = o.isSub
  if (typeof o.homestead === 'boolean') fields.homestead = o.homestead
  for (const key of ['claimantPhysicalAddress', 'signingCounty', 'contractedWithAddress', 'workMonthsWords', 'noticesSentWords'] as const) {
    if (typeof o[key] === 'string') fields[key] = o[key]
  }
  return fields
}

/**
 * The facts for one filing. `isSub` is the job's own answer today; the filing's stored answer wins when it has one,
 * since the paper on file is what the copy is of. `phone` is the company's, for the letter's call line. `to` is where
 * each envelope goes today (the property record's owner, the GC's customer record).
 */
export function lienServeFactsFromFiling(f: LienServeFiling | null | undefined, ctx: { isSub: boolean; letterYmd: string; phone: string; to?: LienServeFacts['to'] }): LienServeFacts | null {
  if (!f || f.kind !== 'affidavit' || f.voided_at || !f.filed_at) return null
  const fields = storedFields(f.fields) ?? storedFields({})
  if (!fields) return null
  return {
    fields,
    isSub: typeof fields.isSub === 'boolean' ? fields.isSub : ctx.isSub,
    county: (f.county ?? '').trim(),
    recordingNumber: (f.recording_number ?? '').trim(),
    filedYmd: (f.filed_at ?? '').trim().slice(0, 10),
    letterYmd: ctx.letterYmd,
    phone: ctx.phone.trim(),
    ...(ctx.to ? { to: ctx.to } : {}),
  }
}
