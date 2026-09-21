import { ownerKind } from './ownerConfirm'

/**
 * The Lien desk's four gates as numbered steps (v2.3657). Each gate has a fixed
 * slot — 1 owner, 2 original contractor, 3 property kind, 4 months — so the eye
 * learns where to look, and a tone that says what it does to the send:
 * a `blocker` stops it (the same facts `draftReadiness` refuses on), a `check`
 * is worth a look but lets it go (an unknown property kind only moves the
 * deadline), `ok` is clear.
 */
export type LienGateKey = 'owner' | 'gc' | 'kind' | 'months'
export type LienGateTone = 'ok' | 'blocker' | 'check'

export interface LienGate {
  n: 1 | 2 | 3 | 4
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
      ? {
          n: 4,
          key: 'months',
          label: 'Approved hours',
          value: input.monthLabels.join(', ') || '—',
          tone: 'ok',
          title: input.pendingSessions > 0 ? `${input.pendingSessions} ${input.pendingSessions === 1 ? 'session' : 'sessions'} awaiting approval not counted` : 'Work months with approved hours',
        }
      : { n: 4, key: 'months', label: 'Approved hours', value: 'No month picked', tone: 'blocker', title: 'Pick at least one month for the notice to name' }

  const gates = [ownerGate, gcGate, kindGate, monthsGate]
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
  if (source === 'job_override') return 'Set on this job — the property record’s owner is not used here.'
  if (source === 'property_record') return 'From the property record — every job at this property uses it.'
  return ''
}

/** Gate 4, one line per month the notice names: "Jul 2026 · 5.2 approved hours · 1 person · 2 days". */
export function lienGateMonthLine(monthLabel: string, hours: number, crew: string): string {
  const h = hours.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return [`${monthLabel} · ${h} approved ${h === '1' ? 'hour' : 'hours'}`, crew.trim()].filter(Boolean).join(' · ')
}
