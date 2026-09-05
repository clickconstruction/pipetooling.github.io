/**
 * People → Users row needs (v2.2809, owner pick "rail wide / hours + pill narrow"):
 * the one model behind the row's status column. It groups the rail facts, the contract
 * signing light, push and roster state into three subjects — Hours, Paperwork, Account —
 * and gives each a tone, a count, the long text a tooltip or fold-out shows, the verb that
 * clears it, and the Desk section it opens.
 *
 * Two owner decisions live here:
 *  - Hours are a routine queue, not an alarm. They ride beside the needs as
 *    `hoursWaiting` and never color the dot or count toward Needs attention.
 *  - Facts (no push, no login, portal on) show in the fold-out but never in the count.
 */
import type { RailAttention, RailFacts, RailPersonInput } from './deskRailAttention'
import type { ContractSigningTrafficLight } from '../contractSigningRollup'

export type RowNeedSubject = 'paperwork' | 'account'
export type RowNeedTone = 'red' | 'amber' | 'fact'
/** The Desk section a need opens (PR 2 gives sections these anchors). */
export type RowNeedDoor = 'hours' | 'paperwork' | 'access' | 'portal' | 'push'

export type RowNeed = {
  key: string
  subject: RowNeedSubject
  tone: RowNeedTone
  /** Items behind the need; the rail shows it, the pill sums the needs. 0 for facts. */
  count: number
  /** "1 expired · 1 unsent", "no roster row" — the chip text. */
  short: string
  /** The sentence a tooltip or fold-out line shows. */
  long: string
  /** "Send", "Create roster row" — the fold-out button. */
  verb: string
  door: RowNeedDoor
}

export type RowNeeds = {
  /** Clock sessions waiting for approval; 0 when none or no account. */
  hoursWaiting: number
  /** The hours those sessions add up to (for the tooltip). */
  hoursTotal: number
  /** "26 sessions (136.6 h) waiting for approval" or null. */
  hoursLine: string | null
  needs: RowNeed[]
  /** Needs that are not facts — what the pill counts. */
  needCount: number
  /** Worst tone among the counted needs; hours and facts never move it. */
  attention: RailAttention
  /** The counted needs' long lines, for the dot's title. */
  reasons: string[]
}

export type RowNeedsInput = {
  person: RailPersonInput
  facts: RailFacts
  /** The contract signing light for this person's pay name; undefined when the viewer can't see contracts. */
  signingLight?: ContractSigningTrafficLight
  /** Whether push is enabled on the account; only read when `canSeePush`. */
  pushOn?: boolean
  canSeePush?: boolean
}

const FIELD_KINDS = new Set(['sub', 'helper', 'superintendent'])

/** Contract-document facts are keyed `p:<people.id>` when the row carries a person id, else by pay name (v2.2809). */
export function docFactKey(personId: string | null, name: string): string {
  return personId ? `p:${personId}` : name.trim()
}

function lookup(map: Record<string, number>, person: RailPersonInput): number {
  const byId = person.personId ? (map[`p:${person.personId}`] ?? 0) : 0
  const byName = map[person.name.trim()] ?? 0
  return byId + byName
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

export function buildRowNeeds(input: RowNeedsInput): RowNeeds {
  const { person: p, facts: f } = input
  const needs: RowNeed[] = []

  // Paperwork: unsent, expiring, expired contracts and licenses, plus the signing light.
  const unsent = lookup(f.unsentDocsByName, p)
  const expiring = lookup(f.expiringByName, p)
  const expired = lookup(f.expiredByName, p)
  const light = input.signingLight
  const unsigned = light === 'red' && unsent === 0
  if (unsent + expiring + expired > 0 || unsigned) {
    const short: string[] = []
    const long: string[] = []
    if (expired > 0) {
      short.push(`${expired} expired`)
      long.push(`${plural(expired, 'document')} expired.`)
    }
    if (unsent > 0) {
      short.push(`${unsent} unsent`)
      long.push(`${plural(unsent, 'contract')} never sent.`)
    }
    if (expiring > 0) {
      short.push(`${expiring} expiring`)
      long.push(`${plural(expiring, 'document')} expiring within 30 days.`)
    }
    if (unsigned) {
      short.push('unsigned')
      long.push('Contracts sent, none signed yet.')
    } else if (light === 'yellow') long.push('Some contracts signed.')
    else if (light === 'red') long.push('No contracts signed yet.')
    needs.push({
      key: 'paperwork',
      subject: 'paperwork',
      tone: expired > 0 ? 'red' : 'amber',
      count: expired + unsent + expiring + (unsigned ? 1 : 0),
      short: short.join(' · '),
      long: long.join(' '),
      verb: unsent > 0 ? 'Send' : expired > 0 ? 'Renew' : unsigned ? 'Chase signature' : 'Open paperwork',
      door: 'paperwork',
    })
  }

  // Account: the roster gap is a need; login, push and portal state are facts.
  if (p.userId && !p.personId && p.kind !== 'dev' && p.kind !== 'primary') {
    needs.push({
      key: 'no_roster',
      subject: 'account',
      tone: 'amber',
      count: 1,
      short: 'no roster row',
      long: 'Account with no roster row — pay, portal and paperwork have nowhere to attach.',
      verb: 'Create roster row',
      door: 'access',
    })
  }
  if (!p.userId) {
    needs.push({ key: 'no_login', subject: 'account', tone: 'fact', count: 0, short: 'no login', long: 'A roster row with no app account — their portal, paperwork and pay work without one.', verb: 'Invite', door: 'access' })
  }
  if (input.canSeePush && p.userId && input.pushOn === false && FIELD_KINDS.has(p.kind)) {
    needs.push({ key: 'no_push', subject: 'account', tone: 'fact', count: 0, short: 'no push', long: 'Push notifications are not enabled on their phone.', verb: 'How to enable', door: 'push' })
  }
  if (p.personId && p.kind === 'sub' && f.portalOnPersonIds?.has(p.personId)) {
    needs.push({ key: 'portal', subject: 'account', tone: 'fact', count: 0, short: 'portal on', long: 'Their sub portal link is live.', verb: 'Open portal', door: 'portal' })
  }

  // Hours ride beside the needs.
  const pending = p.userId ? f.pendingByUserId[p.userId] : undefined
  const hoursWaiting = pending?.count ?? 0
  const hoursTotal = pending?.hours ?? 0
  const hoursLine = hoursWaiting > 0 ? `${plural(hoursWaiting, 'session')} (${hoursTotal.toFixed(1)} h) waiting for approval` : null

  const counted = needs.filter((n) => n.tone !== 'fact')
  const attention: RailAttention = counted.some((n) => n.tone === 'red') ? 'red' : counted.length > 0 ? 'amber' : 'green'
  return { hoursWaiting, hoursTotal, hoursLine, needs, needCount: counted.length, attention, reasons: counted.map((n) => n.long) }
}

/** The subject a need or the hours cell sits under on the wide rail, in rail order. */
export const ROW_RAIL_SUBJECTS: ReadonlyArray<{ key: 'hours' | RowNeedSubject; label: string; short: string }> = [
  { key: 'hours', label: 'Hours to approve', short: 'Hours' },
  { key: 'paperwork', label: 'Paperwork', short: 'Paper' },
  { key: 'account', label: 'Account', short: 'Acct' },
]
