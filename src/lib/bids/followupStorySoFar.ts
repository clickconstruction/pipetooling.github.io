/**
 * "The story so far" (v2.2406, Wendi): the Waiting-to-hear call card shows the
 * full conversation while she dials — this bid's logged contacts (the same
 * `bids_submission_entries` the chase taps, call sessions, and Bid Board notes
 * all write), the letter-send as an anchor event, and the latest word on the
 * builder's other open bids. Pure shaping only; the lens fetches and renders.
 *
 * GC scoping follows the notes popover's rule (`partitionNotesForGc`): a
 * GC-scoped queue row reads that GC's notes plus whole-bid notes; the bid's
 * own-GC row reads whole-bid notes only (another GC's scoped notes belong to
 * that GC's queue row).
 */

export type StorySourceEntry = {
  id: string
  gcCustomerId: string | null
  method: string | null
  text: string
  /** ISO instant (occurred_at). */
  iso: string
  byLine: string | null
}

export type StoryItem = {
  key: string
  kind: 'entry' | 'sent'
  iso: string
  icon: string
  text: string
  byLine: string | null
}

/** Contact-method glyph — mirrors the methods ContactMethodQuickPicks offers. */
export function storyMethodIcon(method: string | null): string {
  const m = (method ?? '').trim().toLowerCase()
  if (m.startsWith('phone') || m.startsWith('call')) return '📞'
  if (m.startsWith('email')) return '✉️'
  if (m.startsWith('text')) return '💬'
  if (m.startsWith('in person') || m.startsWith('meeting')) return '🤝'
  return '📝'
}

/** The popover's visibility rule for one GC's view of a bid's entries. */
export function storyEntryVisible(entry: Pick<StorySourceEntry, 'gcCustomerId'>, gcId: string | null): boolean {
  if (!entry.gcCustomerId) return true
  return gcId != null && entry.gcCustomerId === gcId
}

/**
 * One bid's timeline for one GC row, newest first: visible entries plus the
 * letter-send anchor slotted at its chronological position. `total` counts
 * everything; `items` is capped (pass Infinity to expand).
 */
export function buildBidStory(args: {
  entries: ReadonlyArray<StorySourceEntry>
  gcId: string | null
  sentIso: string | null
  sentValue: number
  cap: number
}): { items: StoryItem[]; total: number } {
  const { entries, gcId, sentIso, sentValue, cap } = args
  const visible = entries
    .filter((e) => storyEntryVisible(e, gcId))
    .map<StoryItem>((e) => ({
      key: `entry-${e.id}`,
      kind: 'entry',
      iso: e.iso,
      icon: storyMethodIcon(e.method),
      text: e.text,
      byLine: e.byLine,
    }))
  if (sentIso) {
    visible.push({
      key: 'sent',
      kind: 'sent',
      iso: sentIso,
      icon: '📤',
      text: sentValue > 0 ? `Letter sent · $${sentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'Letter sent',
      byLine: null,
    })
  }
  visible.sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : a.key.localeCompare(b.key)))
  return { items: cap === Infinity ? visible : visible.slice(0, cap), total: visible.length }
}

export type SiblingSource = {
  rowKey: string
  bidId: string
  title: string
  sentIso: string
}

export type SiblingLine = {
  rowKey: string
  title: string
  kind: 'entry' | 'untouched'
  /** entry: when the latest word landed; untouched: null. */
  iso: string | null
  icon: string | null
  text: string | null
  /** untouched: the sent date the amber line names. */
  sentIso: string
}

/**
 * "With <builder> lately": the latest visible entry on each of the builder's
 * OTHER pending queue rows. Rows with a word sort newest-first; untouched rows
 * follow, oldest send first (the ones most in need of a mention while she has
 * the builder on the phone).
 */
export function buildSiblingLines(
  siblings: ReadonlyArray<SiblingSource>,
  entriesByBid: Readonly<Record<string, ReadonlyArray<StorySourceEntry>>>,
): SiblingLine[] {
  const lines = siblings.map<SiblingLine>((s) => {
    const latest = (entriesByBid[s.bidId] ?? [])
      .filter((e) => storyEntryVisible(e, null))
      .reduce<StorySourceEntry | null>((best, e) => (best == null || e.iso > best.iso ? e : best), null)
    return latest
      ? { rowKey: s.rowKey, title: s.title, kind: 'entry', iso: latest.iso, icon: storyMethodIcon(latest.method), text: latest.text, sentIso: s.sentIso }
      : { rowKey: s.rowKey, title: s.title, kind: 'untouched', iso: null, icon: null, text: null, sentIso: s.sentIso }
  })
  return lines.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'entry' ? -1 : 1
    if (a.kind === 'entry') return (a.iso ?? '') < (b.iso ?? '') ? 1 : -1
    return a.sentIso < b.sentIso ? -1 : 1
  })
}
