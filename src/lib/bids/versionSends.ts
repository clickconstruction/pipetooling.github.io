/**
 * Per-version sends (v2.2124, Send or Compare F5). A bid VERSION records when it went to the
 * customer and at what ★ value (`bid_version_sends`, append-only; latest row per version = its
 * current send). The bid-level roll-up (`bids.bid_date_sent`, `bids.bid_value`) is what every
 * existing reader uses; these helpers decide what that roll-up should be. Pure — no React, no DB.
 */

export type VersionSendRow = {
  bid_version_id: string
  sent_on: string // YYYY-MM-DD
  value: number | string | null
  is_alternate?: boolean | null
  created_at?: string | null
}

export type LatestSend = { sentOn: string; value: number | null; isAlternate: boolean }

/** Latest send per version: newest `sent_on`, ties broken by newest `created_at`. */
export function latestSendByVersion(rows: ReadonlyArray<VersionSendRow>): Record<string, LatestSend> {
  const out: Record<string, LatestSend & { createdAt: string }> = {}
  for (const r of rows) {
    const createdAt = String(r.created_at ?? '')
    const prev = out[r.bid_version_id]
    const newer = !prev || r.sent_on > prev.sentOn || (r.sent_on === prev.sentOn && createdAt > prev.createdAt)
    if (newer) {
      const v = r.value == null ? null : Number(r.value)
      out[r.bid_version_id] = { sentOn: r.sent_on, value: Number.isFinite(v as number) ? (v as number) : null, isAlternate: !!r.is_alternate, createdAt }
    }
  }
  const clean: Record<string, LatestSend> = {}
  for (const [k, v] of Object.entries(out)) clean[k] = { sentOn: v.sentOn, value: v.value, isAlternate: v.isAlternate }
  return clean
}

/** The bid-level sent date implied by its versions' sends: the latest one (null if none). */
export function latestSentOn(rows: ReadonlyArray<VersionSendRow>): string | null {
  let best: string | null = null
  for (const r of rows) if (!best || r.sent_on > best) best = r.sent_on
  return best
}

/**
 * The bid-level ROLL-UP date under the per-GC model (v2.2407, Option A): the FIRST send —
 * the day the bid left the building. `bids.bid_date_sent` is derived as this (client-side
 * on every send write, and by the `bid_version_sends` sync trigger); null when no sends.
 */
export function firstSentOn(rows: ReadonlyArray<VersionSendRow>): string | null {
  let best: string | null = null
  for (const r of rows) if (!best || r.sent_on < best) best = r.sent_on
  return best
}

export type BoardValueRule = 'base_sum' | 'active_star'
export const BOARD_VALUE_RULES: ReadonlyArray<{ id: BoardValueRule; label: string; help: string }> = [
  { id: 'base_sum', label: 'Sum of the base bids in the letter', help: 'Alternates are listed, not added. What the letter says the job costs.' },
  { id: 'active_star', label: "The active bid's ★ only", help: 'Closest to how it worked before versions had their own value.' },
]
export function parseBoardValueRule(raw: string | null | undefined): BoardValueRule {
  return raw === 'active_star' ? 'active_star' : 'base_sum'
}

/**
 * What the Bid Board should show for a package, given the sections in the letter and the
 * active bid's ★ revenue. `base_sum` = sum of non-alternate sections; `active_star` = the
 * active bid's ★ (falls back to base sum when there is no active revenue). Null when nothing.
 */
export function boardValueForRule(
  rule: BoardValueRule,
  sections: ReadonlyArray<{ isAlternate: boolean; revenueSum: number }>,
  activeStarRevenue: number | null,
): number | null {
  const base = sections.filter((s) => !s.isAlternate).reduce((sum, s) => sum + (Number.isFinite(s.revenueSum) ? s.revenueSum : 0), 0)
  if (rule === 'active_star') return activeStarRevenue != null && activeStarRevenue > 0 ? activeStarRevenue : base > 0 ? base : null
  return sections.length === 0 ? null : base
}

/** Narrow a Cover Letter bundle section list to what the rule needs. */
export function bundleSectionsForBoard<T extends { isAlternate: boolean; revenueSum: number }>(sections: ReadonlyArray<T>): Array<{ isAlternate: boolean; revenueSum: number }> {
  return sections.map((s) => ({ isAlternate: s.isAlternate, revenueSum: s.revenueSum }))
}

/** "sent 7/7 · $279,579" style fragment for chips and rows. */
export function formatSendBadge(send: LatestSend | undefined, opts: { money: (n: number) => string } = { money: (n) => `$${Math.round(n).toLocaleString('en-US')}` }): string | null {
  if (!send) return null
  const [y, m, d] = send.sentOn.split('-')
  const date = m && d ? `${Number(m)}/${Number(d)}` : send.sentOn
  void y
  return send.value != null ? `sent ${date} · ${opts.money(send.value)}` : `sent ${date}`
}
