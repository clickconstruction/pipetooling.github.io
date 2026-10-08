import { ownerKind } from './ownerConfirm'
import { DATED_FROM_CREATION_WORDS } from './lienDesk'

/**
 * The Lien desk's four gates as numbered steps (v2.3657). Each gate has a fixed
 * slot — 1 owner, 2 original contractor, 3 property kind, 4 months — so the eye
 * learns where to look, and a tone that says what it does to the send:
 * a `blocker` stops it (the same facts `draftReadiness` refuses on), a `check`
 * is worth a look but lets it go (an unknown property kind only moves the
 * deadline), `ok` is clear.
 */
export type LienGateKey = 'owner' | 'gc' | 'kind' | 'months' | 'billed'
export type LienGateTone = 'ok' | 'blocker' | 'check'

export interface LienGate {
  n: 1 | 2 | 3 | 4 | 5
  key: LienGateKey
  label: string
  /** The answer in a word or two — the name when clear, what is wrong when not. */
  value: string
  tone: LienGateTone
  /** The whole sentence, for the cell's tooltip. */
  title: string
}

export interface LienGateVerdict {
  ready: boolean
  blockers: number
  checks: number
  /** "Can't go out yet" / "Ready to go out". */
  headline: string
  /** "1 blocker · 1 to check" / "1 to check" / "All 4 clear". */
  summary: string
}

export interface LienDeskGatesInput {
  ownerName: string
  ownerMailingAddress: string
  gcName: string
  gcAddress: string
  /** `residential`, any other non-empty kind reads as commercial, blank is unknown. */
  propertyKind: string | null | undefined
  county: string
  /** The work months with approved hours, short form ("Jul"). */
  monthLabels: string[]
  /** How many months the notice names right now — none picked blocks the send. */
  pickedMonthsCount: number
  pendingSessions: number
  /** The job has no approved clock hours: its one month is the month it was created (v2.3747) — the gate says so instead of "Approved hours". */
  datedFromCreation?: boolean
  /** What the job's sent bills still owe — the claim's base (v2.4969). Absent on a reader that has no bills to show. */
  billedOpen?: number
  /** The part of the job no sent bill carries (v2.4969): with nothing owed on the sent bills, a fifth gate holds the send until it is billed. */
  unbilled?: number
  /** How many bills have gone out, for the fifth gate's words. */
  sentBills?: number
}

export function buildLienDeskGates(input: LienDeskGatesInput): { gates: LienGate[]; verdict: LienGateVerdict } {
  const owner = input.ownerName.trim()
  const mailing = input.ownerMailingAddress.trim()
  const gcName = input.gcName.trim()
  const kind = (input.propertyKind ?? '').trim()
  const county = input.county.trim()
  const isPublic = owner !== '' && ownerKind(owner) === 'public'

  const ownerGate: LienGate =
    !owner
      ? { n: 1, key: 'owner', label: 'Owner of record', value: 'Missing', tone: 'blocker', title: 'No owner of record with a mailing address on the property record' }
      : !mailing
        ? { n: 1, key: 'owner', label: 'Owner of record', value: 'No mailing address', tone: 'blocker', title: `Owner of record with a mailing address — ${owner} (mailing address missing)` }
        : isPublic
          ? { n: 1, key: 'owner', label: 'Owner of record', value: 'Public property', tone: 'blocker', title: `${owner} — a mechanic's lien does not attach to public property` }
          : { n: 1, key: 'owner', label: 'Owner of record', value: owner, tone: 'ok', title: `Owner of record with a mailing address — ${owner}, ${mailing}` }

  const gcGate: LienGate = gcName
    ? { n: 2, key: 'gc', label: 'Original contractor', value: gcName, tone: 'ok', title: `Original contractor: ${gcName}${input.gcAddress.trim() ? `, ${input.gcAddress.trim()}` : ' — no address on the customer'}` }
    : { n: 2, key: 'gc', label: 'Original contractor', value: 'No GC on the job', tone: 'blocker', title: 'Set the GC on the job' }

  const kindWord = kind === 'residential' ? 'Residential' : kind ? 'Commercial' : ''
  const kindGate: LienGate = kindWord
    ? { n: 3, key: 'kind', label: 'Property kind', value: county ? `${kindWord} · ${county}` : kindWord, tone: 'ok', title: kind === 'residential' ? 'Residential — the 2nd-month clock' : 'Commercial' }
    : { n: 3, key: 'kind', label: 'Property kind', value: 'Unknown', tone: 'check', title: 'Unknown — commercial dates shown; a residential property is a month earlier' }

  const monthsGate: LienGate =
    input.pickedMonthsCount > 0
      ? input.datedFromCreation
        ? {
            n: 4,
            key: 'months',
            label: 'Dated from creation',
            value: input.monthLabels.join(', ') || '—',
            tone: 'ok',
            title: `No clock hours on this job — its month is the month it was created (${DATED_FROM_CREATION_WORDS})`,
          }
        : {
            n: 4,
            key: 'months',
            label: 'Approved hours',
            value: input.monthLabels.join(', ') || '—',
            tone: 'ok',
            title: input.pendingSessions > 0 ? `${input.pendingSessions} ${input.pendingSessions === 1 ? 'session' : 'sessions'} awaiting approval not counted` : 'Work months with approved hours',
          }
      : { n: 4, key: 'months', label: input.datedFromCreation ? 'Dated from creation' : 'Approved hours', value: 'No month picked', tone: 'blocker', title: 'Pick at least one month for the notice to name' }

  // The fifth gate (v2.4969) is drawn only when it blocks: nothing owed on the sent bills while money is still on the
  // job — work not yet billed, or a bill still at Ready to Bill. A notice claims what is billed, so the send waits.
  const nothingBilled = input.billedOpen != null && input.billedOpen <= 0.005 && (input.unbilled ?? 0) > 0.005
  const billedGate: LienGate | null = nothingBilled
    ? { n: 5, key: 'billed', label: 'Nothing billed', value: 'Bill the work first', tone: 'blocker', title: (input.sentBills ?? 0) === 0 ? 'No bill has gone out on this job — a notice claims what is billed' : 'The sent bills are paid; what is left on the job is not billed yet' }
    : null
  const gates = billedGate ? [ownerGate, gcGate, kindGate, monthsGate, billedGate] : [ownerGate, gcGate, kindGate, monthsGate]
  const blockers = gates.filter((g) => g.tone === 'blocker').length
  const checks = gates.filter((g) => g.tone === 'check').length
  const parts = [blockers ? `${blockers} ${blockers === 1 ? 'blocker' : 'blockers'}` : '', checks ? `${checks} to check` : ''].filter(Boolean)
  return {
    gates,
    verdict: {
      ready: blockers === 0,
      blockers,
      checks,
      headline: blockers === 0 ? 'Ready to go out' : "Can't go out yet",
      summary: parts.length ? parts.join(' · ') : `All ${gates.length} clear`,
    },
  }
}

/** The mark a gate carries beside its value: ✓ clear, ✗ stops the send, ! worth a look. */
export function lienGateMark(tone: LienGateTone): string {
  return tone === 'ok' ? '✓' : tone === 'blocker' ? '✗' : '!'
}

/**
 * Every gate has a section under the row (v2.3670), so a clear gate says the fact the
 * notice will use. These are the sentences those sections carry.
 */

/** Gate 3: which clock the kind puts every month's deadline on — or the caveat while it is unknown. */
export function propertyKindClockWords(propertyKind: string | null | undefined, county: string): string {
  const kind = (propertyKind ?? '').trim()
  const where = county.trim() ? ` · ${county.trim()} County` : ''
  if (kind === 'residential') return `Residential${where} — each month's notice is due by the 15th of the 2nd month after the work.`
  if (kind) return `Commercial${where} — each month's notice is due by the 15th of the 3rd month after the work.`
  return 'Commercial dates shown; a residential property is a month earlier.'
}

/** Gate 1, owner on file: where the name came from, so a job-level override is never mistaken for the record. */
export function ownerSourceWords(source: 'job_override' | 'property_record' | 'none'): string {
  if (source === 'job_override') return 'Set on this job · the property record’s owner is not used here.'
  if (source === 'property_record') return 'From the property record · every job here uses it.'
  return ''
}

/** Gate 3's one line (v2.4718): "Residential · Bexar County", or "Not set" while the kind is blank. */
export function propertyKindLine(propertyKind: string | null | undefined, county: string): string {
  const kind = (propertyKind ?? '').trim()
  const where = county.trim() ? ` · ${county.trim()} County` : ''
  if (!kind) return `Not set${where}`
  return `${kind === 'residential' ? 'Residential' : 'Commercial'}${where}`
}

/** The rule the kind sets, short, for the muted line under gate 3. */
export function propertyKindRuleWords(propertyKind: string | null | undefined): string {
  const kind = (propertyKind ?? '').trim()
  if (kind === 'residential') return 'Notice due the 15th of the 2nd month after the work'
  if (kind) return 'Notice due the 15th of the 3rd month after the work'
  return 'Commercial dates shown; a residential property is a month earlier'
}

/** What the other kind would do to the dates — said while the chooser is open, since every deadline on the job moves with it. */
export function propertyKindSwitchWarning(propertyKind: string | null | undefined): string {
  const kind = (propertyKind ?? '').trim()
  if (kind === 'residential') return 'Commercial makes each notice due the 15th of the 3rd month after the work, and the affidavit a month later. Every date on the job moves.'
  if (kind) return 'Residential makes each notice due the 15th of the 2nd month after the work, and the affidavit a month earlier. Every date on the job moves.'
  return 'Residential makes each notice due the 15th of the 2nd month after the work; commercial the 3rd. Every date on the job follows the pick.'
}

/** "shared with 273, 866, 1009, 858" — the jobs on the same property record, which follow a change here. */
export function sharedWithWords(labels: ReadonlyArray<string>): string {
  return labels.length ? `shared with ${labels.join(', ')}` : ''
}

/** Gate 4, one line per month the notice names: "Jul 2026 · 5.2 approved hours · 1 person · 2 days". */
export function lienGateMonthLine(monthLabel: string, hours: number, crew: string): string {
  const h = hours.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return [`${monthLabel} · ${h} approved ${h === '1' ? 'hour' : 'hours'}`, crew.trim()].filter(Boolean).join(' · ')
}

/**
 * The draft footer's words while a notice cannot go (v2.4797, the owner: *explain in one
 * sentence — don't send yet, you need to do XYZ first*). Two short sentences in plain words:
 * the stop, then the one thing to do, named the way the gate's own button names it.
 */
export function lienFootBlockedSentence(gate: Pick<LienGate, 'key' | 'value' | 'label' | 'n'> | null, pickedMonths: number): string {
  const stop = "Don't send yet."
  if (!gate) return pickedMonths === 0 ? `${stop} Pick at least one month first.` : `${stop} Clear what the gates show first.`
  const v = gate.value.toLowerCase()
  if (gate.key === 'owner') {
    if (v === 'missing') return `${stop} Enter the owner of record and a mailing address on the property record first.`
    if (v === 'no mailing address') return `${stop} Add the owner's mailing address on the property record first.`
    if (v === 'public property') return `${stop} This is public property, so no lien notice can go. Ask the attorney about the payment bond.`
  }
  if (gate.key === 'gc') return `${stop} Set the GC on the job first.`
  if (gate.key === 'months') return `${stop} Pick at least one month first.`
  if (gate.key === 'kind') return `${stop} Set the property kind on the property record first.`
  if (gate.key === 'billed') return `${stop} Bill the work first. A notice claims what is billed.`
  return `${stop} Clear gate ${gate.n}, ${gate.label.toLowerCase()}, first.`
}

/**
 * The stop window's red chip under the blocked stop (v2.4806): the gate in three or four words —
 * *owner of record missing*, *no mailing address*, *no GC on the job*, *no month picked*.
 */
export function lienGateShortWords(gate: Pick<LienGate, 'key' | 'value' | 'label'>): string {
  const v = gate.value.toLowerCase()
  if (gate.key === 'owner') return v === 'missing' ? 'owner of record missing' : v === 'no mailing address' ? 'owner has no mailing address' : v === 'public property' ? 'public property' : `${gate.label.toLowerCase()} ${v}`
  if (gate.key === 'gc') return 'no GC on the job'
  if (gate.key === 'months') return 'no month picked'
  if (gate.key === 'kind') return 'property kind unknown'
  if (gate.key === 'billed') return 'nothing billed'
  return `${gate.label.toLowerCase()} ${v}`
}

/** The affidavit's hold line (v2.4806), the notice's sentence's sibling: *Don't file yet.* then the one thing to do first. */
export function lienAffidavitFootBlockedSentence(gate: { key: 'owner' | 'legal' | 'notice' | 'homestead'; label: string } | null): string {
  const stop = "Don't file yet."
  if (!gate) return `${stop} Clear what the gates show first.`
  if (gate.key === 'owner') return `${stop} Enter the owner of record and a mailing address on the property record first.`
  if (gate.key === 'legal') return `${stop} Add the county and the legal description on the property record first.`
  if (gate.key === 'notice') return `${stop} Send the § 53.056 notice first. A late one counts while this window is open.`
  return `${stop} Talk to your attorney first. A homestead lien needs a recorded pre-work contract signed by both spouses (§ 53.254).`
}

/** The affidavit's red chip words (v2.4806). */
export function lienAffidavitGateShortWords(gate: { key: 'owner' | 'legal' | 'notice' | 'homestead' }): string {
  return gate.key === 'owner' ? 'owner of record missing' : gate.key === 'legal' ? 'county or legal description missing' : gate.key === 'notice' ? 'no § 53.056 notice on the job' : 'homestead'
}
