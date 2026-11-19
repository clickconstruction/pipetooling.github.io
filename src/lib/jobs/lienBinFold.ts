import { pluralNoun } from '../batchWords'

/**
 * The fold on the Board's two boxes under the lien affidavits, *Public jobs · bond claim* and *Off the lien path*
 * (punch list #390, part 1; the owner's pick of #383's option B). Each box opens as one line: its name, how many jobs
 * and how much they owe, and a press that opens it. The words are here so both boxes read alike.
 *
 * Pure. It reads the bins `lienPublicProperty.ts` and `lienOffPathBin.ts` build and changes neither, so the edge
 * functions' copy of the first stays as it is. `LienBinFoldHeader` draws the line.
 */

/** What the fold reads of a bin: either box's `count`, `totalWords` and rows, a row's chip when it has one. */
export type LienBinFoldInput = { count: number; totalWords: string; rows: ReadonlyArray<{ jobId: string; chip?: string | null }> }

export type LienBinFoldLine = {
  /** "2 jobs · $9,400 unpaid": the count in words before the bin's money, since a folded box has no rows to count. */
  words: string
  /** "1 to get the bond": the rows whose chip a folded box hides, counted in the chip's own words; null when no row has one. */
  ask: string | null
}

/** The line a box's header reads, folded or open. The ask is drawn on a folded box only, where the chips are hidden. */
export function lienBinFoldLine(bin: LienBinFoldInput): LienBinFoldLine {
  const chips = new Map<string, number>()
  for (const r of bin.rows) {
    const chip = (r.chip ?? '').trim()
    if (chip) chips.set(chip, (chips.get(chip) ?? 0) + 1)
  }
  return {
    words: `${bin.count} ${pluralNoun('job', bin.count)} · ${bin.totalWords}`,
    ask: chips.size ? [...chips].map(([chip, n]) => `${n} to ${chip}`).join(' · ') : null,
  }
}

export type LienBinFoldPress = { label: 'Show' | 'Hide'; mark: '▾' | '▴' }

/** The press at the line's right end: *Show ▾* on a folded box, *Hide ▴* on an open one. */
export function lienBinFoldPress(open: boolean): LienBinFoldPress {
  return open ? { label: 'Hide', mark: '▴' } : { label: 'Show', mark: '▾' }
}
