/**
 * A sub job set up as if we worked for the owner (punch list #166, v2.5840). The lien clock treats a
 * job as a subcontract only when the job has a GC/Builder (`payerForJob` → `viaGc`). Job 891 was set
 * up with the GC as its customer and no GC: the desk called Click the original contractor, no
 * § 53.056 notice was tracked and the job form hid the retainage box — for months. The rule here
 * says *probably a subcontract* when the job has no GC, the property record names an owner of record,
 * that owner is not the customer (a loose name match), and one more signal holds (the owner's call of
 * 2026-10-25: the second signal stays, so a homeowner whose house is held by a trust or an LLC is not
 * caught): the customer is commercial, pays as a GC by default, or is the GC on another job. The
 * office's answer *ours with the owner* (`jobs_ledger.owner_contract_confirmed_at`) silences it. Pure.
 */

export type SuspectedSubJobInput = {
  /** `jobs_ledger.gc_customer_id` is set — the job already reads as a subcontract. */
  hasGc: boolean
  /** The customer slot's name. */
  customerName: string
  /** The owner of record from the property record or the job's override; '' when none. */
  ownerOfRecord: string
  /** `customers.customer_type`: 'commercial' | 'residential' | ''. */
  customerType: string
  /** `customers.gc_pays_by_default`. */
  gcPaysByDefault: boolean
  /** The customer is named as the GC on some other job. */
  customerIsGcElsewhere: boolean
  /** The office confirmed this job is ours with the owner. */
  ownerContractConfirmed: boolean
}

export type SuspectedSubJob =
  | { suspected: false; why: 'has_gc' | 'confirmed' | 'no_owner' | 'owner_is_customer' | 'no_second_signal' }
  | { suspected: true; owner: string; customer: string; signals: string[] }

const SUFFIXES = new Set(['llc', 'inc', 'ltd', 'lp', 'llp', 'pllc', 'co', 'corp', 'corporation', 'company', 'the', 'and', 'of', 'trust', 'family', 'holdings', 'group', 'assoc', 'associates', 'properties', 'enterprises', 'partners', 'partnership', 'dba'])

/** The words that name a party, lower case, with punctuation and the business suffixes gone. */
export function partyNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !SUFFIXES.has(w))
}

/**
 * A loose match: the same party when one name's words all sit inside the other's (*Jordan Example* ·
 * *Jordan Example Family Trust*), or when they share their first two words. Never a match on nothing.
 */
export function partyNamesMatch(a: string, b: string): boolean {
  const ta = partyNameTokens(a)
  const tb = partyNameTokens(b)
  if (ta.length === 0 || tb.length === 0) return false
  const within = (x: string[], y: string[]) => x.every((w) => y.includes(w))
  if (within(ta, tb) || within(tb, ta)) return true
  return ta.length >= 2 && tb.length >= 2 && ta[0] === tb[0] && ta[1] === tb[1]
}

export function suspectedSubJob(input: SuspectedSubJobInput): SuspectedSubJob {
  if (input.hasGc) return { suspected: false, why: 'has_gc' }
  if (input.ownerContractConfirmed) return { suspected: false, why: 'confirmed' }
  const owner = input.ownerOfRecord.trim()
  const customer = input.customerName.trim()
  if (!owner || !customer) return { suspected: false, why: 'no_owner' }
  if (partyNamesMatch(owner, customer)) return { suspected: false, why: 'owner_is_customer' }
  const signals: string[] = []
  if (input.customerType === 'commercial') signals.push('the customer is commercial')
  if (input.gcPaysByDefault) signals.push('the customer pays as a GC by default')
  if (input.customerIsGcElsewhere) signals.push('the customer is the GC on another job')
  if (signals.length === 0) return { suspected: false, why: 'no_second_signal' }
  return { suspected: true, owner, customer, signals }
}

/** The desk's note: *Probably a subcontract on 891: the owner of record (Take 5 Properties) is not Burd & Assoc., and the customer is commercial.* */
export function suspectedSubJobLabel(jobLabel: string, s: Extract<SuspectedSubJob, { suspected: true }>): string {
  return `Probably a subcontract on ${jobLabel}: the owner of record (${s.owner}) is not ${s.customer}, and ${s.signals[0]}`
}

export const SUSPECTED_SUB_JOB_DETAIL = 'With no GC on the job the desk reads Click as the original contractor: no § 53.056 monthly notice is tracked, the Paper tab says none is due, and the job form hides the retainage the GC holds. Set the GC moves the customer into the GC slot in one press (the bills then go to the GC). Ours with the owner keeps the job as it is and puts this note away.'

/** The toast after Set the GC. */
export function setGcDoneWords(customer: string, jobLabel: string): string {
  return `${customer} is now the GC on ${jobLabel}. The customer slot cleared, the bills go to the GC, and the monthly notices are tracked from here.`
}
