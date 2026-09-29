/**
 * The Pipeline's deep links (pure): the `?param=` doors other surfaces use to land on the
 * board with something open — the Dashboard's cards, the round and forecast emails, Bids →
 * Customer review — and what each one strips from the URL once consumed, so a refresh or
 * Back does not re-open it. Eight effects in `JobsStagesTab` parsed these by hand (Stage-A
 * sweep II, v2.3865); this is the one table. `hooks/useStagesDeepLinkParams` applies it
 * (consume-once, `replace` navigation, the `rtb` window arm — map quirk 2).
 */

export type StagesDeepLinkKey = 'followups' | 'gcReview' | 'gcNotice' | 'lienDesk' | 'round' | 'chase' | 'forecast' | 'rtb'

/** The params each door consumes — stripped together, so a door's whole address leaves the URL at once. */
export const STAGES_DEEP_LINK_PARAMS: Record<StagesDeepLinkKey, readonly string[]> = {
  followups: ['followups'],
  gcReview: ['gcReview'],
  gcNotice: ['gcnotice'],
  lienDesk: ['liendesk', 'liendeskJob', 'liendeskPile', 'kind'],
  round: ['round', 'gc'],
  chase: ['chase'],
  forecast: ['forecast'],
  rtb: ['rtb'],
}

export type StagesLienDeskLink = { jobId: string | null; kind: 'notice' | 'affidavit' | 'timeline'; pile: 'missed' | null }

export type StagesDeepLinks = {
  /** `?followups=1` (v2.1720): the follow-up deck. */
  followups: boolean
  /** `?gcReview=1` (v2.1984): GC Review. */
  gcReview: boolean
  /** `?gcnotice=<customer id>` (v2.3470): Put a GC on notice for that GC. */
  gcNoticeGcId: string | null
  /** `?liendesk=1` (+ `liendeskJob`, `kind`, `liendeskPile`) (v2.3405): the Lien desk on a job, pane and pile. */
  lienDesk: StagesLienDeskLink | null
  /** `?round=1` (+ `gc`) (v2.2771): GC Review straight into the round overlay. */
  round: { gcId: string | null } | null
  /** `?chase=1` (v2.2025): payment follow-up call mode. */
  chase: boolean
  /** `?forecast=1` (v2.2226): the Payment forecast modal. */
  forecast: boolean
  /** `?rtb=1`: scroll the Ready to Bill header into view once the board holds still. */
  rtb: boolean
}

export function parseStagesDeepLinks(search: URLSearchParams): StagesDeepLinks {
  const flag = (k: string) => search.get(k) === '1'
  const kindParam = search.get('kind')
  return {
    followups: flag('followups'),
    gcReview: flag('gcReview'),
    gcNoticeGcId: search.get('gcnotice') || null,
    lienDesk: flag('liendesk')
      ? {
          jobId: search.get('liendeskJob'),
          kind: kindParam === 'affidavit' ? 'affidavit' : kindParam === 'timeline' ? 'timeline' : 'notice',
          pile: search.get('liendeskPile') === 'missed' ? 'missed' : null,
        }
      : null,
    round: flag('round') ? { gcId: search.get('gc') || null } : null,
    chase: flag('chase'),
    forecast: flag('forecast'),
    rtb: flag('rtb'),
  }
}

/** The search string with one door's params removed and every other param kept — what the consuming effect navigates to. */
export function stripStagesDeepLink(search: URLSearchParams, key: StagesDeepLinkKey): string {
  const p = new URLSearchParams(search)
  for (const name of STAGES_DEEP_LINK_PARAMS[key]) p.delete(name)
  return p.toString()
}
