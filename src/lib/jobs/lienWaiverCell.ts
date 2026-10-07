import type { JobLienReleaseRow } from './lienReleaseTracking'
import { isConditionalLienForm, liveLienReleases } from './lienReleaseTracking'
import { lienReleaseStatus } from './lienReleaseLifecycle'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

/**
 * The lien-waiver cell on a bill (v2.4275): one pair per bill — the conditional that goes out
 * with the bill, the unconditional that follows when the payment settles — read from the job's
 * `job_lien_releases` rows whose `invoice_ids` cover the bill. Pure; the Bill tab, GC Review and
 * the GC's room draw it.
 *
 * Each half is one of: none · draft · awaiting (the leader has not signed) · signed (not yet sent)
 * · sent. The cell's `next` is the one move the office owes on this bill, or null.
 */

export type LienWaiverHalfState = 'none' | 'draft' | 'awaiting' | 'signed' | 'sent'

export type LienWaiverHalf = {
  state: LienWaiverHalfState
  /** The release behind the state, when there is one. */
  release: JobLienReleaseRow | null
  /** YYYY-MM-DD of the step the state names: sent, signed, requested, created. */
  ymd: string | null
}

export type LienWaiverCell = {
  conditional: LienWaiverHalf
  unconditional: LienWaiverHalf
  /** The bill's money has settled (the caller's read of payments against the bill). */
  settled: boolean
  /** v2.4330: settled by a check that has not cleared yet — the day it clears; the unconditional waits until then. */
  clearsYmd: string | null
  /** The one move owed on this bill: add the conditional, sign what is minted, send what is signed, add the unconditional once settled — or nothing. */
  next: 'add_conditional' | 'sign' | 'send' | 'add_unconditional' | null
  /** Short words for each half as a chip: "Conditional ✓ Sep 30", "Unconditional · when paid". */
  chips: Array<{ half: 'conditional' | 'unconditional'; text: string; tone: 'green' | 'amber' | 'grey' }>
  /** A waiver on this bill has been started: either half is past "none" (v2.4309). */
  underWay: boolean
  /** The next move continues a waiver already under way: sign it, send it, or the unconditional after a conditional (v2.4309). */
  nextIsOwed: boolean
}


function halfFor(rows: JobLienReleaseRow[]): LienWaiverHalf {
  // The newest row decides; a sent one beats a signed one beats an awaiting one.
  const rank = (r: JobLienReleaseRow) => (r.sent_to_customer_at ? 4 : lienReleaseStatus(r) === 'signed' ? 3 : lienReleaseStatus(r) === 'awaiting_signature' ? 2 : lienReleaseStatus(r) === 'issued' ? 1.5 : 1)
  const best = [...rows].sort((a, b) => rank(b) - rank(a) || b.created_at.localeCompare(a.created_at))[0]
  if (!best) return { state: 'none', release: null, ymd: null }
  // Each stamp is an instant: its day in APP_CALENDAR_TZ, never its UTC date.
  if (best.sent_to_customer_at) return { state: 'sent', release: best, ymd: calendarYmdInAppTzFromIso(best.sent_to_customer_at) }
  const s = lienReleaseStatus(best)
  if (s === 'signed') return { state: 'signed', release: best, ymd: calendarYmdInAppTzFromIso(best.signed_at ?? best.created_at) }
  if (s === 'awaiting_signature') return { state: 'awaiting', release: best, ymd: calendarYmdInAppTzFromIso(best.signature_requested_at ?? best.created_at) }
  if (s === 'issued') return { state: 'awaiting', release: best, ymd: calendarYmdInAppTzFromIso(best.minted_at ?? best.created_at) }
  return { state: 'draft', release: best, ymd: calendarYmdInAppTzFromIso(best.created_at) }
}

function shortDate(ymd: string | null): string {
  if (!ymd) return ''
  const d = new Date(`${ymd}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * How the chips read — calm (the Bill tab v2.4309, GC Review v2.4317): a bill with no waiver started
 * stays grey ("Conditional · not added", "Unconditional · when paid" / "not added") and only a waiver
 * under way turns amber, so amber always means a step is owed on one you started. 3 of 43 billed GC
 * jobs had ever had a waiver when the owner asked for it; the old amber "Conditional · none — send
 * it" on every GC bill went unread.
 */
export function lienWaiverCellForBill(
  releases: ReadonlyArray<JobLienReleaseRow>,
  invoiceId: string,
  settled: boolean,
  /** v2.4330: `billCheckClearsYmd` — a check on the bill still clearing; null when none is. */
  clearsYmd: string | null = null,
): LienWaiverCell {
  const clearing = settled && clearsYmd != null
  const mine = liveLienReleases([...releases]).filter((r) => (r.invoice_ids ?? []).includes(invoiceId))
  const conditional = halfFor(mine.filter((r) => isConditionalLienForm(r.form_type)))
  const unconditional = halfFor(mine.filter((r) => !isConditionalLienForm(r.form_type)))

  const underWay = conditional.state !== 'none' || unconditional.state !== 'none'
  let next: LienWaiverCell['next'] = null
  const pending = [unconditional, conditional].find((h) => h.state === 'awaiting' || h.state === 'signed')
  if (pending?.state === 'awaiting') next = 'sign'
  else if (pending?.state === 'signed') next = 'send'
  else if (settled && unconditional.state === 'none') next = clearing ? null : 'add_unconditional'
  else if (!settled && conditional.state === 'none' && unconditional.state === 'none') next = 'add_conditional'

  const chipFor = (half: 'conditional' | 'unconditional', h: LienWaiverHalf): LienWaiverCell['chips'][number] => {
    const label = half === 'conditional' ? 'Conditional' : 'Unconditional'
    switch (h.state) {
      case 'sent':
        return { half, text: `${label} ✓ sent ${shortDate(h.ymd)}`, tone: 'green' }
      case 'signed':
        return { half, text: `${label} ✓ signed · send it`, tone: 'amber' }
      case 'awaiting':
        return { half, text: `${label} · awaiting signature`, tone: 'amber' }
      case 'draft':
        return { half, text: `${label} · draft`, tone: 'grey' }
      case 'none':
        if (half === 'conditional') return { half, text: 'Conditional · not added', tone: 'grey' }
        if (!settled) return { half, text: 'Unconditional · when paid', tone: 'grey' }
        if (clearing) return { half, text: `Unconditional · waits for the check · clears ${shortDate(clearsYmd)}`, tone: 'grey' }
        return underWay ? { half, text: 'Unconditional owed · settled', tone: 'amber' } : { half, text: 'Unconditional · not added', tone: 'grey' }
    }
  }
  return {
    conditional,
    unconditional,
    settled,
    clearsYmd: clearing ? clearsYmd : null,
    next,
    chips: [chipFor('conditional', conditional), chipFor('unconditional', unconditional)],
    underWay,
    nextIsOwed: next === 'sign' || next === 'send' || (next === 'add_unconditional' && underWay),
  }
}

/**
 * The bill's money has settled: it is marked paid, or the payments applied to it reach its
 * amount (to the cent). v2.4318: a bill marked paid counts even when its payments carry no
 * `invoice_id` (job 251: both paid bills read "when paid" and offered the conditional).
 */
export function billSettled(invoice: { id: string; amount: number | null; status?: string | null }, payments: ReadonlyArray<{ invoice_id: string | null; amount: number | null }>): boolean {
  if (invoice.status === 'paid') return true
  const amount = Number(invoice.amount ?? 0)
  if (amount <= 0) return false
  const applied = payments.filter((p) => p.invoice_id === invoice.id).reduce((s, p) => s + Number(p.amount ?? 0), 0)
  return applied >= amount - 0.005
}
