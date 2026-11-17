/**
 * An envelope's line about the properties inside it (v2.7559, punch list #362; the office's report of 2026-11-16).
 *
 * The office looked at an owner's envelope in the notices' run. It listed one job, at a property with six invoices,
 * and she asked why. The envelope was right: the other jobs at that property had their notice sent earlier. Nothing
 * on the envelope said so. This is that sentence: how many notices are in the envelope, and where every other job at
 * the same property stands, with a press to see the property whole.
 *
 * It holds no rule of its own for a paper's state:
 *
 * - the same property is the same property record (`jobs_ledger.customer_address_id`), never a match on typed addresses;
 * - a job's line is the whole-property view's (`lienPropertyNoticeLine`, `lienPropertyAffidavitLine`), fed from the
 *   desk's own queues, so the envelope says what the Board and the property card say;
 * - the counts are that view's tally (`lienPropertyTallies`), in its words: a notice that went is *sent*, by its day.
 *
 * The owner picked the shape on 2026-11-16: one line for the envelope. A contractor's envelope that spans properties
 * gets a single line that totals them, never one line a property.
 *
 * The notices counted beside *in this envelope* are the jobs NOT in it. The lien affidavits are counted for every job
 * at the property, the envelope's own jobs too: no affidavit is ever in this envelope, and the office counts a
 * property's liens whole. One affidavit is left out: a job in the envelope whose affidavit waits on its notice. This
 * envelope is that notice, so the line would count the same wait twice.
 *
 * Pure.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { lienAffidavitOwnerSends, type LienAffidavitNoticeRow } from './lienAffidavitNotices'
import type { LienDeskEntry } from './lienDesk'
import { affidavitGateMissingWord, lienAffidavitGateHeld, type LienAffidavitEntry } from './lienDeskAffidavits'
import { lienPropertyAffidavitLine, lienPropertyNoticeLine, lienPropertyTallies, type LienPropertyAffidavitLine, type LienPropertyNoticeLine } from './lienPropertyPapers'
import { lienPropertyStreet } from './lienRunStreet'

/** One job at a property, as the whole-property view words it. */
export type LienRunPropertyJob = { jobId: string; notice: LienPropertyNoticeLine; affidavit: LienPropertyAffidavitLine }

/** One property record with every job the desk holds at it. `street` is the record's first address line, '' when it has none. */
export type LienRunProperty = { addressId: string; street: string; jobs: LienRunPropertyJob[] }

/** The desk's own read, as narrow as this needs it (`LienDeskData` fits). */
export type LienRunPropertyDesk = {
  jobsById: Readonly<Record<string, { customer_address_id: string | null; gc_customer_id?: string | null } | undefined>>
  addressesById: Readonly<Record<string, { address?: string | null } | undefined>>
  notices: ReadonlyArray<Pick<LienDeskEntry, 'jobId' | 'gcCustomerId' | 'pile' | 'earliestDeadline' | 'item' | 'sentItem'>>
  affidavits: ReadonlyArray<Pick<LienAffidavitEntry, 'jobId' | 'isSub' | 'pile' | 'gates' | 'deadline' | 'item'>>
  filingsByJob: Readonly<Record<string, ReadonlyArray<LienAffidavitNoticeRow> | undefined>>
}

/**
 * Every property the desk holds a job at, by its record's id. A job with no property record is left out: nothing
 * says which property it is at. The desk reads the jobs it has started or that fall inside its lead, so a property's
 * card (which reads By job's wider book) can list a job this does not.
 */
export function lienRunProperties(desk: LienRunPropertyDesk): Map<string, LienRunProperty> {
  const out = new Map<string, LienRunProperty>()
  const noticeOf = new Map(desk.notices.map((e) => [e.jobId, e]))
  const affidavitOf = new Map(desk.affidavits.map((e) => [e.jobId, e]))
  for (const jobId of new Set([...noticeOf.keys(), ...affidavitOf.keys()])) {
    const job = desk.jobsById[jobId]
    const addressId = job?.customer_address_id ?? null
    if (!addressId) continue
    const n = noticeOf.get(jobId) ?? null
    const a = affidavitOf.get(jobId) ?? null
    const sentOn = lienAffidavitOwnerSends(desk.filingsByJob[jobId]).map((s) => s.sentOn)
    const notice = lienPropertyNoticeLine({
      // By job's book's rule (`lienTimelineBookAssemble`): the affidavit's row says it, else whether the job has a GC.
      isSub: a ? a.isSub : Boolean(n?.gcCustomerId ?? job?.gc_customer_id),
      pile: n?.pile ?? null,
      noticed: sentOn.length > 0 || n?.pile === 'sent' || n?.sentItem != null || Boolean(a?.gates.find((g) => g.key === 'notice')?.ok),
      sentOn,
      dueOn: n?.earliestDeadline ?? null,
      printedOn: n?.item?.printed_at ? calendarYmdInAppTzFromIso(n.item.printed_at) : null,
      holdUntil: n?.item?.hold_until ?? null,
    })
    const affidavit = lienPropertyAffidavitLine({
      pile: a?.pile ?? null,
      gateHeld: lienAffidavitGateHeld(a),
      missing: (a?.gates ?? []).filter((g) => !g.ok).map((g) => affidavitGateMissingWord(g.key)),
      deadline: a?.deadline ?? null,
    })
    const at = out.get(addressId) ?? { addressId, street: lienPropertyStreet(desk.addressesById[addressId]?.address), jobs: [] }
    at.jobs.push({ jobId, notice, affidavit })
    out.set(addressId, at)
  }
  return out
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export type LienRunEnvelopePropertyLine = {
  /** *At this property: 1 notice in this envelope · 4 notices sent Oct 14 · 6 lien affidavits ready to file* */
  words: string
  /** One press a property, in the envelope's order: it opens the property whole. */
  presses: Array<{ addressId: string; label: string }>
}

/**
 * The envelope's one line, or null when it has nothing to add: no job inside points at a property record the desk
 * holds, or no other job is at any of its properties. `inside` is the envelope's jobs, one a job (a combined notice
 * hands in each of its jobs).
 */
export function lienRunEnvelopePropertyLine(input: {
  inside: ReadonlyArray<{ jobId: string; propertyId?: string | null }>
  properties: ReadonlyMap<string, LienRunProperty> | null | undefined
}): LienRunEnvelopePropertyLine | null {
  if (!input.properties) return null
  const here: LienRunProperty[] = []
  for (const j of input.inside) {
    const p = j.propertyId ? input.properties.get(j.propertyId) : undefined
    if (p && !here.includes(p)) here.push(p)
  }
  if (here.length === 0) return null
  const ids = new Set(here.map((p) => p.addressId))
  const insideJobs = new Set(input.inside.filter((j) => j.propertyId && ids.has(j.propertyId)).map((j) => j.jobId))
  const all = here.flatMap((p) => p.jobs)
  const others = all.filter((j) => !insideJobs.has(j.jobId))
  if (others.length === 0) return null
  const where = here.length === 1 ? 'At this property' : `At these ${here.length} properties`
  const liens = all.filter((j) => !(insideJobs.has(j.jobId) && j.affidavit.pile === 'needs_notice'))
  const parts = [`${count(insideJobs.size, 'notice', 'notices')} in this envelope`, lienPropertyTallies(others).notices, lienPropertyTallies(liens).affidavits].filter(Boolean)
  return {
    words: `${where}: ${parts.join(' · ')}`,
    presses: here.map((p, i) => ({ addressId: p.addressId, label: here.length === 1 ? 'See the property ›' : `See ${p.street || `property ${i + 1}`} ›` })),
  }
}
