/**
 * Bills also go to (v2.3358) — who gets a COPY of a bill, beyond the party
 * it is addressed to. Who pays (v2.3345) decides the addressee; this kernel
 * decides the copy list and remembers it:
 *
 *   - a customer contact person flagged `gets_bill_copies` is pre-ticked on
 *     every bill sent to that customer (an AP clerk, a spouse, a PM);
 *   - the job flag `bill_copy_other_party` pre-ticks "Copy <the other
 *     party>" — the GC on a customer-pays job, the customer on a GC-pays job;
 *   - a one-off address typed in Bill Customer rides once.
 *
 * `buildCopyEmails` is the single builder both channels call: lowercased,
 * deduped, never the primary address, capped at `BILL_COPY_MAX` (the
 * physical-invoice edge function refuses more). Pure; tested in
 * `billCopyRecipients.test.ts`.
 */

export const BILL_COPY_MAX = 10

export type BillCopyContact = {
  id: string
  name: string
  email: string
  /** `customer_contact_persons.gets_bill_copies` */
  getsBillCopies: boolean
}

export type BillCopyOtherParty = {
  name: string
  email: string
  role: 'customer' | 'gc'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isPlausibleEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim())
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/** The contact ids Bill Customer ticks on open: flagged contacts that have an email. */
export function defaultCopyContactIds(contacts: ReadonlyArray<BillCopyContact>): Set<string> {
  const out = new Set<string>()
  for (const c of contacts) {
    if (c.getsBillCopies && isPlausibleEmail(c.email)) out.add(c.id)
  }
  return out
}

/** Whether "Copy <the other party>" starts ticked: the job says so and the party has an address. */
export function defaultCopyOtherParty(job: { bill_copy_other_party?: boolean | null } | null | undefined, otherParty: BillCopyOtherParty | null): boolean {
  return job?.bill_copy_other_party === true && otherParty != null && isPlausibleEmail(otherParty.email)
}

/**
 * The copy list a bill goes out with. A typed bill-to recipient (someone else,
 * v2.1084) never carries the customer's people — only the one-off the office
 * typed deliberately — mirroring the physical-invoice rule since v2.940.
 */
export function buildCopyEmails(args: {
  primaryEmail: string
  contacts: ReadonlyArray<BillCopyContact>
  tickedContactIds: ReadonlySet<string>
  otherParty: BillCopyOtherParty | null
  copyOtherParty: boolean
  oneOffEmail: string
  /** True when the bill addresses a typed recipient (tenant) rather than a customers row. */
  billToOverride: boolean
}): string[] {
  const primary = norm(args.primaryEmail)
  const out: string[] = []
  const push = (raw: string) => {
    const e = norm(raw)
    if (!e || !isPlausibleEmail(e) || e === primary || out.includes(e)) return
    out.push(e)
  }
  if (!args.billToOverride) {
    for (const c of args.contacts) {
      if (args.tickedContactIds.has(c.id)) push(c.email)
    }
    if (args.copyOtherParty && args.otherParty) push(args.otherParty.email)
  }
  push(args.oneOffEmail)
  return out.slice(0, BILL_COPY_MAX)
}

/**
 * Collapsed "Bills also go to" wording on Edit Job: the flagged contacts by
 * name, then the other party when the job copies them. Null when nobody.
 */
export function billsAlsoGoToSummary(args: {
  contacts: ReadonlyArray<BillCopyContact>
  otherParty: { name: string; role: 'customer' | 'gc' } | null
  copyOtherParty: boolean
}): string | null {
  const names: string[] = []
  for (const c of args.contacts) {
    if (c.getsBillCopies && isPlausibleEmail(c.email)) names.push(c.name.trim() || c.email.trim())
  }
  if (args.copyOtherParty && args.otherParty) {
    const who = args.otherParty.name.trim() || (args.otherParty.role === 'gc' ? 'the GC' : 'the customer')
    names.push(args.otherParty.role === 'gc' ? `${who} (GC)` : who)
  }
  return names.length ? names.join(' · ') : null
}

/** Parse a `copy_emails` column value (text[] or null) into a clean list. */
export function parseCopyEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const v of raw) {
    if (typeof v !== 'string') continue
    const e = norm(v)
    if (e && isPlausibleEmail(e) && !out.includes(e)) out.push(e)
  }
  return out.slice(0, BILL_COPY_MAX)
}
