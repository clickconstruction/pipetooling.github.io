/**
 * One rule for a bid's sent date (journey-map Tier-2 #20 / J13-F2 / J13-F5 — decision 8).
 *
 *   **`sentAt` = the earliest successful send to a GC via any lane** — a send-ledger row
 *   (`bid_version_sends`, versioned bids), the bid room's first link send, or a hand stamp
 *   (version-less bids). A later lane never moves a recorded date; only the explicit
 *   re-stamp button ("Mark sent today" on a bid that already has a date, confirmed) replaces it.
 *
 * Before this module the two shapes of bid had two rules and three writers: versioned bids
 * derived `min(sent_on)` server-side while the Cover Letter client wrote `cur < today ? cur : today`
 * and the Edit-Bid panel wrote `firstSentOn(rows)`; version-less bids were stamped `today`
 * unconditionally by the Cover Letter button AND by the bid room's first send — so minting a
 * room link on a hand-marked bid silently moved its date (J13-F2). Every writer now asks here.
 *
 * Pure — no React, no Supabase. Dates are `YYYY-MM-DD` strings (string order = date order).
 */

import { firstSentOn, type VersionSendRow } from './versionSends'

/** Which door recorded the send — rides on `ui_nav_clicks` as `bid_sent` / `#lane=<lane>` (see `bidSentTelemetry.ts`). */
export type BidSentLane = 'ledger' | 'room' | 'hand'

export const BID_SENT_DATE_RULE =
  'sentAt = the earliest successful send to a GC via any lane (send-ledger row, bid-room first send, hand stamp); a later lane never moves a recorded date — only the explicit re-stamp does.'

/** The earliest of the given dates, ignoring blanks. Null when nothing was sent. */
export function earliestSentDate(dates: ReadonlyArray<string | null | undefined>): string | null {
  let best: string | null = null
  for (const d of dates) {
    const s = (d ?? '').slice(0, 10)
    if (!s) continue
    if (best == null || s < best) best = s
  }
  return best
}

/**
 * Versioned bids: the roll-up after any ledger write (insert, date edit, un-send). The ledger
 * IS the send record, so the date is the earliest row and null once the last row goes — the
 * same rule the `sync_bid_date_sent_from_sends` trigger enforces server-side. A legacy hand
 * date that predates every row is folded in (the bid did leave the building then); with no
 * rows left nothing is kept — un-sending the last GC returns the bid to Unsent / Working.
 */
export function sentDateAfterLedgerWrite(rows: ReadonlyArray<VersionSendRow>, currentDateSent: string | null = null): string | null {
  const fromRows = firstSentOn(rows)
  if (fromRows == null) return null
  return earliestSentDate([fromRows, currentDateSent])
}

export type LaneStampResult = {
  /** What `bids.bid_date_sent` should read after this lane's send. */
  next: string | null
  /** False when the recorded date already satisfies the rule — the caller skips the UPDATE. */
  write: boolean
}

/**
 * A lane just sent on `stampDate` (today, normally). With no date on record the lane's date
 * becomes the record; with one on record the earlier of the two stands — so a room link sent
 * after a hand stamp changes nothing, and a hand stamp typed after a room send keeps the room's
 * earlier day. `explicit: true` is the re-stamp button: the user asked for THIS date, so it wins.
 */
export function sentDateAfterLaneStamp(
  currentDateSent: string | null,
  stampDate: string,
  opts: { explicit?: boolean } = {},
): LaneStampResult {
  const cur = (currentDateSent ?? '').slice(0, 10) || null
  const stamp = stampDate.slice(0, 10)
  if (opts.explicit) return { next: stamp, write: cur !== stamp }
  if (cur == null) return { next: stamp, write: true }
  const next = earliestSentDate([cur, stamp])
  return { next, write: next !== cur }
}

/** The re-stamp confirm's sentence — the one place the "move the date" act is worded. */
export function restampConfirmMessage(currentDateSent: string, today: string): string {
  const fmt = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.slice(0, 10))
    return m ? `${Number(m[2])}/${Number(m[3])}` : iso
  }
  return `This bid is already marked sent ${fmt(currentDateSent)}. Move its sent date to today (${fmt(today)})? The board, the Followup lenses and the weekly sent counts all read this date.`
}
