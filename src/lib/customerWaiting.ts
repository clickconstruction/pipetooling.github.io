/**
 * Customer Waiting — the app-wide banner and the Needs You item (v2.3248).
 *
 * One hook (`CustomerWaitingContext`) keeps the open high-priority requests
 * from the inboxes the viewer belongs to; these kernels turn that list into
 * what the banner says and what the Needs You card counts. Three states:
 *
 *   waiting — at least one open high row nobody has called: red, the oldest
 *             leads, "Jane Doe is waiting · 14 min", Call + Open.
 *   called  — every open high row has a call stamp: amber, the most recent
 *             call leads, "Sam called Jane Doe 2:14 pm", Open only.
 *   none    — nothing open and high: no banner, no item.
 */
import { parsePortalRequestPayload } from './portalRequestPayload'
import { describeCalled, describeWait, firstName, portalKindLabel, type RequestInbox, type WaitDescription } from './requestPriority'

export type CustomerWaitingRow = {
  id: string
  inbox: RequestInbox
  title: string
  created_at: string | null
  reference_summary: string | null
  pending_action: string | null
  pending_payload: unknown
  last_called_at: string | null
  last_called_by: { name: string | null } | null
}

export type CustomerWaitingBanner = {
  state: 'waiting' | 'called'
  lead: CustomerWaitingRow
  leadName: string
  /** "asks for a visit" … */
  leadKind: string
  leadPhone: string | null
  /** waiting: the lead's wait; called: null. */
  wait: WaitDescription | null
  /** called: "Sam called Jane Doe 2:14 pm"; waiting: null. */
  calledLine: string | null
  /** The customer's words, cut to `SNIPPET_MAX`. */
  snippet: string | null
  /** Open high rows beyond the lead. */
  others: number
  waitingCount: number
  calledCount: number
}

export const SNIPPET_MAX = 90

function snippetOf(text: string | null): string | null {
  if (!text) return null
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length > SNIPPET_MAX ? `${t.slice(0, SNIPPET_MAX - 1).trimEnd()}…` : t
}

function nameOf(row: CustomerWaitingRow): string {
  return parsePortalRequestPayload(row.pending_payload)?.customerName ?? 'A customer'
}

function ms(iso: string | null): number {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

export function buildCustomerWaitingBanner(
  rows: ReadonlyArray<CustomerWaitingRow>,
  now: Date | number = Date.now(),
  timeZone?: string,
): CustomerWaitingBanner | null {
  if (rows.length === 0) return null
  const uncalled = rows.filter((r) => !r.last_called_at).sort((a, b) => ms(a.created_at) - ms(b.created_at))
  const called = rows.filter((r) => !!r.last_called_at).sort((a, b) => ms(b.last_called_at) - ms(a.last_called_at))
  const state: CustomerWaitingBanner['state'] = uncalled.length > 0 ? 'waiting' : 'called'
  const lead = (state === 'waiting' ? uncalled[0] : called[0])!
  const portal = parsePortalRequestPayload(lead.pending_payload)
  const leadName = nameOf(lead)
  const leadKind = portalKindLabel(portal?.kind ?? (lead.pending_action === 'gc_stage_ask' ? 'gc_stage_ask' : null))
  const who = firstName(lead.last_called_by?.name)
  const calledRaw = state === 'called' ? describeCalled(lead.last_called_at, lead.last_called_by?.name, now, timeZone) : null
  // "Sam called 2:14 pm" → "Sam called Jane Doe 2:14 pm"
  const calledLine = calledRaw ? calledRaw.replace(`${who ?? 'Someone'} called `, `${who ?? 'Someone'} called ${leadName} `) : null
  return {
    state,
    lead,
    leadName,
    leadKind,
    leadPhone: portal?.phone ?? null,
    wait: state === 'waiting' ? describeWait(lead.created_at, now) : null,
    calledLine,
    snippet: snippetOf(portal?.description ?? null),
    others: rows.length - 1,
    waitingCount: uncalled.length,
    calledCount: called.length,
  }
}

/** The Needs You input shape — null when nothing is open and high. */
export type CustomerWaitingSummary = {
  count: number
  /** Rows nobody has called yet. */
  uncalled: number
  /** Whole minutes the oldest uncalled row has waited (0 when all are called). */
  oldestMinutes: number
  leadName: string
}

export function summarizeCustomerWaiting(rows: ReadonlyArray<CustomerWaitingRow>, now: Date | number = Date.now()): CustomerWaitingSummary | null {
  const b = buildCustomerWaitingBanner(rows, now)
  if (!b) return null
  return {
    count: rows.length,
    uncalled: b.waitingCount,
    oldestMinutes: b.wait?.minutes ?? 0,
    leadName: b.leadName,
  }
}

/** Where "Open" lands — Dispatch Mode's Inbox tab for those who have it, else the Dashboard's Teams Inbox card. */
export const DASHBOARD_TEAMS_INBOX_HREF = '/dashboard#dash-teams-inbox'
export const DISPATCH_MODE_INBOX_PATH = '/dispatch-mode/inbox'

export function customerWaitingInboxHref(canUseDispatchMode: boolean): string {
  return canUseDispatchMode ? DISPATCH_MODE_INBOX_PATH : DASHBOARD_TEAMS_INBOX_HREF
}

/** On the inbox page itself the banner collapses to one quiet line. */
export function isInboxRoute(pathname: string): boolean {
  return pathname === DISPATCH_MODE_INBOX_PATH || pathname.startsWith(`${DISPATCH_MODE_INBOX_PATH}/`)
}
