/**
 * Which lines of the procurement log belong together (Grace, 2026-10-02: "it doesn't seem very
 * clear to me what is a part in a greater assembly"). By tag, a fixture sits at the left edge and
 * its parts one step in. An assembly gets a step of its own only when the fixture mixes it with
 * other parts — another assembly, loose takeoff lines, or a part added by hand (BP375's EWC-1 and
 * its Josam carrier); a fixture that is one assembly and nothing else (302 of the 357 priced with
 * one) names it on its own line instead. Nothing in the price book nests an assembly in an
 * assembly, so two steps is the deepest a line goes.
 *
 * Pure: takes one tag's lines in the order the log already gives them (the GC's parts, then the
 * order-only ones) and keeps that order inside each block. Canvas JtoZEiwKP7zbABzXEy7hH8, boards
 * "Procure 5" and "Procure 6 · BP375, every line".
 */

/** What the blocks read off a log line. */
export type TagBlockRow = {
  key: string
  /** A part's line; null on a tag's own line (a row typed as one product, or the line logged before its parts). */
  partKey?: string | null
  /** A line typed on the log itself, with no submittal row behind it. */
  isHand: boolean
  orderOnly?: boolean
  /** The price-book assembly the part came out of; null for a loose takeoff line or a part added by hand. */
  assembly?: string | null
}

/**
 * The connector drawn in one indent column of a line, as a folder tree draws it: `tee` ├ (a
 * sibling follows), `end` └ (the last of its block), `pass` │ (an outer block carries on below),
 * `blank` (nothing). A line at level n carries n of them, outermost first.
 */
export type TagGuide = 'tee' | 'end' | 'pass' | 'blank'

export type TagBlockLine<R extends TagBlockRow> =
  | { kind: 'assembly'; key: string; name: string; keys: string[]; level: 1; guides: TagGuide[] }
  /**
   * `level`: 0 = the fixture's own line, 1 = a part of the fixture, 2 = a part inside one of its
   * assemblies. `orderOnlyStarts`: the first order-only line of its block, with `orderOnlyCount`
   * the order-only lines in that block.
   */
  | { kind: 'line'; row: R; level: 0 | 1 | 2; orderOnlyStarts: boolean; orderOnlyCount: number; guides: TagGuide[] }

export type TagBlock<R extends TagBlockRow> = {
  /** One line and nothing else: it is drawn as the fixture itself, with no heading. */
  single: boolean
  /** The one assembly every part came out of, said on the fixture's heading; null otherwise. */
  from: string | null
  lines: Array<TagBlockLine<R>>
}

function leveled<R extends TagBlockRow>(rows: ReadonlyArray<R>, level: 1 | 2): Array<TagBlockLine<R>> {
  let seenOrderOnly = false
  const count = rows.filter((r) => r.orderOnly).length
  return rows.map((row) => {
    const starts = !!row.orderOnly && !seenOrderOnly
    if (row.orderOnly) seenOrderOnly = true
    return { kind: 'line' as const, row, level, orderOnlyStarts: starts, orderOnlyCount: starts ? count : 0, guides: [] }
  })
}

/** Each line's connectors: in column k, a line at that level below it before anything shallower keeps the column going. */
function withGuides<R extends TagBlockRow>(lines: Array<TagBlockLine<R>>): Array<TagBlockLine<R>> {
  const continues = (from: number, k: number) => {
    for (let j = from + 1; j < lines.length; j++) {
      const lv = lines[j]!.level
      if (lv < k) return false
      if (lv === k) return true
    }
    return false
  }
  return lines.map((l, i) => {
    const guides: TagGuide[] = []
    for (let k = 1; k <= l.level; k++) guides.push(k === l.level ? (continues(i, k) ? 'tee' : 'end') : continues(i, k) ? 'pass' : 'blank')
    return { ...l, guides }
  })
}

/** One tag's lines as blocks: the fixture, its parts, and an assembly's own step when it needs one. */
export function tagBlock<R extends TagBlockRow>(rows: ReadonlyArray<R>): TagBlock<R> {
  if (rows.length === 1 && !rows[0]!.isHand) {
    return { single: true, from: rows[0]!.assembly ?? null, lines: [{ kind: 'line', row: rows[0]!, level: 0, orderOnlyStarts: false, orderOnlyCount: 0, guides: [] }] }
  }
  // A tag's own line (logged before its parts, or a hand line) is the fixture's, so it leads.
  const own = rows.filter((r) => !r.partKey)
  const parts = rows.filter((r) => !!r.partKey)
  const assemblies: string[] = []
  for (const r of parts) if (r.assembly && !assemblies.includes(r.assembly)) assemblies.push(r.assembly)
  const loose = parts.filter((r) => !r.assembly)
  const head = leveled(own, 1).map((l) => ({ ...l, orderOnlyStarts: false, orderOnlyCount: 0 }))
  if (assemblies.length === 1 && loose.length === 0) {
    return { single: false, from: assemblies[0]!, lines: withGuides([...head, ...leveled(parts, 1)]) }
  }
  if (assemblies.length === 0) return { single: false, from: null, lines: withGuides([...head, ...leveled(parts, 1)]) }
  const lines: Array<TagBlockLine<R>> = [...head]
  for (const name of assemblies) {
    const mine = parts.filter((r) => r.assembly === name)
    lines.push({ kind: 'assembly', key: `assembly:${name}`, name, keys: mine.map((r) => r.key), level: 1, guides: [] })
    lines.push(...leveled(mine, 2))
  }
  lines.push(...leveled(loose, 1))
  return { single: false, from: null, lines: withGuides(lines) }
}
