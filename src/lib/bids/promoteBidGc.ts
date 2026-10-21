/**
 * Promote a GC on a bid (punch list #136, Wendi's report): the pure pieces behind the ×
 * on the ★ Bid's-GC card and "make bid's GC" on alternate cards — when the × shows, who
 * is recommended to step up, and what the confirm says. The swap itself is the
 * `promote_bid_gc` RPC (migration 20261020100000), which re-keys the departing GC's sent
 * versions, per-GC state and rooms so history never re-badges onto the new GC.
 * Pure — no React, no DB.
 */

export type PromoteAlternate = {
  customerId: string
  name: string
  /** bid_gc_recipients.source — 'version' = has its own packet on the bid. */
  source: 'manual' | 'version'
}

/** The ★ card offers × only while another GC is on the bid — a bid keeps a GC. */
export function canTakeOffBidGc(alternates: ReadonlyArray<PromoteAlternate>): boolean {
  return alternates.length > 0
}

/**
 * Who the confirm preselects: the own-packet GC with the latest send, else the first
 * own-packet GC, else the first alternate. `latestSendByGc` maps customer id → latest
 * sent_on (YYYY-MM-DD) across that GC's versions; missing = never sent.
 */
export function recommendedSuccessor(
  alternates: ReadonlyArray<PromoteAlternate>,
  latestSendByGc: Readonly<Record<string, string>> = {},
): string | null {
  if (alternates.length === 0) return null
  const packets = alternates.filter((a) => a.source === 'version')
  const sent = packets
    .filter((a) => latestSendByGc[a.customerId])
    .sort((a, b) => (latestSendByGc[b.customerId]! < latestSendByGc[a.customerId]! ? -1 : 1))
  return (sent[0] ?? packets[0] ?? alternates[0]!).customerId
}

/**
 * Latest send per GC from the version rows + per-version latest sends the Edit tab
 * already loads. A version with `customer_id` null belongs to the bid's own GC and is
 * skipped — the alternates are the explicit keys.
 */
export function latestSendByGcFromVersions(
  versions: ReadonlyArray<{ id: string; customer_id?: string | null }>,
  latestSendByVersion: Readonly<Record<string, { sentOn: string }>>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of versions) {
    const gc = v.customer_id ?? null
    if (!gc) continue
    const send = latestSendByVersion[v.id]
    if (!send) continue
    if (!out[gc] || send.sentOn > out[gc]!) out[gc] = send.sentOn
  }
  return out
}

export type PromoteConfirmMode = 'remove' | 'promote'

export type PromoteConfirmCopy = {
  title: string
  body: string
  confirmLabel: string
  /** The quieter second button; null when the departing GC can't stay (legacy builder). */
  keepLabel: string | null
  /** Above the radio list, only when the remove confirm must ask who steps up. */
  pickPrompt: string | null
}

/**
 * The confirm's words. `remove` is the × on the ★ card (departing GC off the bid,
 * "keep as an alternate" one click away); `promote` is the alternate card's door
 * (departing GC stays). `successorName` is the preselected pick in remove mode.
 */
export function promoteConfirmCopy(opts: {
  mode: PromoteConfirmMode
  oldName: string
  /** False when the current primary is a legacy builder label, not a customer. */
  oldIsCustomer: boolean
  successorName: string
  alternateCount: number
}): PromoteConfirmCopy {
  const { mode, oldName, oldIsCustomer, successorName, alternateCount } = opts
  if (mode === 'promote') {
    return {
      title: `Make ${successorName} the bid's GC?`,
      body: oldIsCustomer
        ? `The letter, the board and Followup run in their name. ${oldName} stays on the bid as an alternate, and letters, notes and dates each stay with the GC they belong to.`
        : `The letter, the board and Followup run in their name. Letters, notes and dates each stay with the GC they belong to.`,
      confirmLabel: `Make bid's GC`,
      keepLabel: null,
      pickPrompt: null,
    }
  }
  return {
    title: `Take ${oldName} off this bid?`,
    body:
      alternateCount > 1
        ? `The GC you pick becomes the bid's GC — the letter, the board and Followup run in their name. Letters, notes and dates each stay with the GC they belong to, and the bid's notes record the handoff.`
        : `${successorName} becomes the bid's GC — the letter, the board and Followup run in their name. Letters, notes and dates each stay with the GC they belong to, and the bid's notes record the handoff.`,
    confirmLabel: `Take off — ${successorName} leads`,
    keepLabel: oldIsCustomer ? 'Keep as an alternate instead' : null,
    pickPrompt: alternateCount > 1 ? 'Who runs the bid now?' : null,
  }
}
