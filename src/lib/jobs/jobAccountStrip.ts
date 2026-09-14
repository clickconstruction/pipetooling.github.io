/**
 * Job accounts at the counter, PR 2 (v2.3424): the **Job accounts strip** on
 * every job card the field opens — Ferguson ✓ · Reece — requested · Moore ·
 * none yet — and the one-tap ask that sends the office an errand.
 *
 * Pure: grouping the `list_job_account_strip` RPC rows per job, the chip
 * states and words, the sentence to say at the counter, and the dispatch
 * request's payload / title / close note (mirrors findPropertyOwnerDispatchRequest).
 */

import type { JobAccountStatus } from '../materials/jobSupplyHouseAccounts'

/** One row of `list_job_account_strip`. */
export interface JobAccountStripRow {
  job_id: string
  supply_house_id: string
  house_name: string
  policy: string | null
  account_id: string | null
  status: string | null
  account_ref: string | null
  opened_via: string | null
  opened_at: string | null
  requested_at: string | null
  requested_from_counter: boolean | null
  account_note: string | null
  rep_contact_id: string | null
  rep_name: string | null
  rep_phone: string | null
}

export type JobAccountStripState = JobAccountStatus | 'none'

export interface JobAccountStripRep {
  id: string
  name: string
  phone: string | null
}

export interface JobAccountStripEntry {
  houseId: string
  houseName: string
  /** The house's policy (expects · optional · none). */
  policy: string
  state: JobAccountStripState
  accountId: string | null
  accountRef: string
  openedVia: string | null
  openedAt: string | null
  requestedAt: string | null
  requestedFromCounter: boolean
  note: string
  rep: JobAccountStripRep | null
}

function stateOf(status: string | null): JobAccountStripState {
  return status === 'open' || status === 'requested' || status === 'not_needed' ? status : 'none'
}

const STATE_ORDER: Record<JobAccountStripState, number> = { open: 0, requested: 1, none: 2, not_needed: 3 }

/** Rows → entries per job. Within a job: open first, then requested, then none, then not needed; ties by house name. */
export function groupJobAccountStrip(rows: JobAccountStripRow[]): Map<string, JobAccountStripEntry[]> {
  const out = new Map<string, JobAccountStripEntry[]>()
  for (const r of rows) {
    const entry: JobAccountStripEntry = {
      houseId: r.supply_house_id,
      houseName: r.house_name,
      policy: r.policy ?? 'optional',
      state: stateOf(r.status),
      accountId: r.account_id,
      accountRef: (r.account_ref ?? '').trim(),
      openedVia: r.opened_via,
      openedAt: r.opened_at,
      requestedAt: r.requested_at,
      requestedFromCounter: Boolean(r.requested_from_counter),
      note: (r.account_note ?? '').trim(),
      rep: r.rep_contact_id && r.rep_name ? { id: r.rep_contact_id, name: r.rep_name, phone: (r.rep_phone ?? '').trim() || null } : null,
    }
    const list = out.get(r.job_id) ?? []
    list.push(entry)
    out.set(r.job_id, list)
  }
  for (const list of out.values()) {
    list.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.houseName.localeCompare(b.houseName))
  }
  return out
}

/** The chip's words after the house name: "✓", "requested", "none yet", "not needed". */
export function stripStateWord(state: JobAccountStripState): string {
  switch (state) {
    case 'open': return '✓'
    case 'requested': return 'requested'
    case 'none': return 'none yet'
    case 'not_needed': return 'not needed'
  }
}

/** One line: "Ferguson ✓ · Reece requested · Moore none yet". Empty when there is nothing to say. */
export function stripSummary(entries: JobAccountStripEntry[]): string {
  return entries.map((e) => `${e.houseName} ${stripStateWord(e.state)}`).join(' · ')
}

export function stripHasOpen(entries: JobAccountStripEntry[]): boolean {
  return entries.some((e) => e.state === 'open')
}

/** Houses the field may still ask about: expecting houses with no account, and requested ones (to add a house to the ask). */
export function askableEntries(entries: JobAccountStripEntry[]): JobAccountStripEntry[] {
  return entries.filter((e) => e.state === 'none' || e.state === 'requested')
}

/** What to say at the counter. The house keys the account on the property, the counter needs the company and the address. */
export function counterSentence(args: { companyName: string | null | undefined; address: string | null | undefined; accountRef?: string | null }): string {
  const company = (args.companyName ?? '').trim() || 'our company'
  const address = (args.address ?? '').trim()
  const ref = (args.accountRef ?? '').trim()
  const parts = [company]
  if (address) parts.push(`job account for ${address}`)
  else parts.push('job account for this property')
  if (ref) parts.push(`ref ${ref}`)
  return parts.join(' · ')
}

/** `tel:` href from a display phone; null when there are no digits. */
export function telHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^\d+]/g, '')
  return digits.length >= 7 ? `tel:${digits}` : null
}

// ---------- the PO moment (PR 3): the line under the supply house pick ----------

export type PoMomentTone = 'amber' | 'teal' | 'muted'

export interface PoMomentLine {
  tone: PoMomentTone
  text: string
  /** Which actions the line offers. */
  canCall: boolean
  canMarkOpened: boolean
  canSendPacket: boolean
  canNotNeeded: boolean
}

function shortDay(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * The words under the supply house pick when a PO code is about to be minted
 * (v2.3426). Null when the house neither expects an account nor has a row —
 * nothing to say. Never a block: the code still mints.
 */
export function poMomentLine(entry: JobAccountStripEntry | null | undefined, jobLabel: string): PoMomentLine | null {
  if (!entry) return null
  const rep = entry.rep ? `${entry.rep.name} opens them${entry.rep.phone ? `: ${entry.rep.phone}` : ''}.` : 'No job-accounts rep on file for this house.'
  switch (entry.state) {
    case 'none':
      return {
        tone: 'amber',
        text: `No job account at ${entry.houseName} for ${jobLabel} yet. ${entry.houseName} expects one per property. ${rep}`,
        canCall: Boolean(entry.rep?.phone),
        canMarkOpened: true,
        canSendPacket: true,
        canNotNeeded: true,
      }
    case 'requested': {
      const when = shortDay(entry.requestedAt)
      return {
        tone: 'amber',
        text: `${entry.houseName} job account asked for${when ? ` ${when}` : ''}${entry.requestedFromCounter ? ' from the counter' : ''} — not open yet. ${rep}`,
        canCall: Boolean(entry.rep?.phone),
        canMarkOpened: true,
        canSendPacket: true,
        canNotNeeded: true,
      }
    }
    case 'open': {
      const bits = [`${entry.houseName} job account open`]
      if (entry.accountRef) bits.push(`ref ${entry.accountRef}`)
      const when = shortDay(entry.openedAt)
      bits.push(`${when ? `${when} · ` : ''}${entry.openedVia === 'phone' ? 'by phone' : entry.openedVia === 'packet' ? 'with the packet' : entry.openedVia === 'counter' ? 'at the counter' : 'opened'}`)
      if (entry.rep) bits.push(`rep ${entry.rep.name}`)
      return { tone: 'teal', text: bits.join(' · '), canCall: false, canMarkOpened: false, canSendPacket: false, canNotNeeded: false }
    }
    case 'not_needed':
      return {
        tone: 'muted',
        text: `${entry.houseName} job account not needed${entry.note ? ` · ${entry.note}` : ''}.`,
        canCall: false,
        canMarkOpened: true,
        canSendPacket: false,
        canNotNeeded: false,
      }
  }
}

// ---------- the errand: dispatch_requests pending_action 'open_job_account' ----------

export const OPEN_JOB_ACCOUNT_ACTION = 'open_job_account'

export type RequestedJobAccountHouse = { id: string; name: string; repName: string | null; repPhone: string | null; repContactId?: string | null }

/** A type alias (not an interface) so it stays assignable to the `Json` column type. */
export type OpenJobAccountPayload = {
  supply_houses: RequestedJobAccountHouse[]
  from_counter: boolean
  note: string
}

export function buildOpenJobAccountPayload(args: {
  houses: readonly RequestedJobAccountHouse[]
  fromCounter: boolean
  note: string
}): OpenJobAccountPayload | null {
  const houses = args.houses
    .map((h) => ({ id: h.id.trim(), name: h.name.trim(), repName: (h.repName ?? '').trim() || null, repPhone: (h.repPhone ?? '').trim() || null, repContactId: (h.repContactId ?? '').trim() || null }))
    .filter((h) => h.id && h.name)
  if (houses.length === 0) return null
  return { supply_houses: houses, from_counter: Boolean(args.fromCounter), note: args.note.trim().slice(0, 500) }
}

/** Inverse of buildOpenJobAccountPayload — tolerant of missing / foreign payloads. */
export function parseOpenJobAccountPayload(payload: unknown): OpenJobAccountPayload {
  const empty: OpenJobAccountPayload = { supply_houses: [], from_counter: false, note: '' }
  if (!payload || typeof payload !== 'object') return empty
  const p = payload as { supply_houses?: unknown; from_counter?: unknown; note?: unknown }
  const houses: RequestedJobAccountHouse[] = []
  if (Array.isArray(p.supply_houses)) {
    for (const item of p.supply_houses) {
      if (!item || typeof item !== 'object') continue
      const h = item as { id?: unknown; name?: unknown; repName?: unknown; repPhone?: unknown; repContactId?: unknown }
      const id = typeof h.id === 'string' ? h.id.trim() : ''
      const name = typeof h.name === 'string' ? h.name.trim() : ''
      if (!id || !name) continue
      houses.push({
        id,
        name,
        repName: typeof h.repName === 'string' && h.repName.trim() ? h.repName.trim() : null,
        repPhone: typeof h.repPhone === 'string' && h.repPhone.trim() ? h.repPhone.trim() : null,
        repContactId: typeof h.repContactId === 'string' && h.repContactId.trim() ? h.repContactId.trim() : null,
      })
    }
  }
  return { supply_houses: houses, from_counter: p.from_counter === true, note: typeof p.note === 'string' ? p.note.trim() : '' }
}

/** The request title the inbox card reads: names the houses, says when the tech is standing at the counter. */
export function openJobAccountRequestTitle(jobLabel: string, houses: readonly RequestedJobAccountHouse[], fromCounter: boolean): string {
  const names = houses.map((h) => h.name.trim()).filter(Boolean)
  const at = names.length > 0 ? names.join(', ') : 'the supply house'
  return fromCounter
    ? `Open a job account at ${at} for ${jobLabel} — asked from the counter, buying now`
    : `Open a job account at ${at} for ${jobLabel}`
}

/** The close note when the office marks it open or not needed from the errand (also the push body). */
export function openJobAccountCloseNote(houseName: string, outcome: 'open' | 'not_needed', accountRef: string): string {
  if (outcome === 'not_needed') return `${houseName} job account not needed — see the job.`
  const ref = accountRef.trim()
  return ref ? `${houseName} job account open · ref ${ref}` : `${houseName} job account open.`
}
