/**
 * The rows that stand on an earlier revision (2026-10-02). "Rev N+1 from the rows sent back"
 * carries only those rows: the approved rows stay on the revision the GC approved them on, and
 * the room asks about the new draft alone. The procurement log must still list them — they are
 * released, and the orders typed on their lines have to stay in sight. Before this the log read
 * the newest revision's rows only, so a resubmit took every approved row off it.
 *
 * The rule: the newest revision that holds a tag speaks for it. A tag on the first revision given
 * belongs to it; otherwise to the newest earlier revision that asked about it, and the row stands
 * only when it was approved there (a row sent back and dropped, or never called, was not released).
 * The caller hands the revisions over newest first. A revision the GC never read (a superseded
 * draft) asked about nothing, so its rows with no call claim no tag — but a call entered on it by
 * hand is a real approval, and that row stands. Pure; the tab and the room page do the reading.
 */
export type StandingRow<T> = { row: T; rev: number }

export type StandingRevision<T> = {
  rev: number
  rows: ReadonlyArray<T>
  /** The GC read this revision (shared or reviewed, or it is the newest): its rows speak for their tags, called or not. Default true. */
  asked?: boolean
}

export function rowsThatStand<T extends { tag: string }>(revisions: ReadonlyArray<StandingRevision<T>>, approved: (row: T) => boolean): StandingRow<T>[] {
  const seen = new Set<string>()
  const out: StandingRow<T>[] = []
  revisions.forEach((r, i) => {
    const asked = i === 0 || r.asked !== false
    const held = new Set<string>()
    for (const row of r.rows) {
      const tag = row.tag.trim()
      if (!tag) continue
      const ok = approved(row)
      if (asked || ok) held.add(tag)
      if (i === 0 || seen.has(tag) || !ok) continue
      out.push({ row, rev: r.rev })
    }
    for (const t of held) seen.add(t)
  })
  return out
}

/** The GC read the revision: shared or reviewed. A superseded draft was never read. */
export function revisionWasRead(status: string | null | undefined): boolean {
  return status === 'shared' || status === 'reviewed'
}
