/**
 * The flow of a lien paper on a phone (punch list #428, the owner's pick of 2026-11-23: *One screen, pinned line*).
 *
 * The Board's flow is a wide picture: two columns of bins, an arrow down each and one across from *Sent* to *Waiting
 * on its notice*. A phone is one narrow column, so until now its bins stood one over the other behind **Show the bins**,
 * about 2,050 px of them, every job a chip 22 px tall, and the rows a bin leads to were under all of it.
 *
 * A phone now draws the flow as counts. Each stage is one press with its name and its count, so both columns stand
 * side by side on one screen. It has a switch of its own beside the list by day, **By day** and **The flow**. A
 * pressed stage makes its papers the screen and the flow shrinks to one pinned line: the way back, the stage's name
 * and its column's cells with the one a person is in lit. A cell moves along the flow. The way back opens the flow
 * with that stage still lit, and the phone's own Back does the same, since the page keeps the stage in the history
 * entry beside the open row (`lienPhoneJobScreen.ts`, `lienDeskStateWithStage`).
 *
 * Here: the view a phone is on and where it is kept, a stage and its tone from a bin, the pinned line for a picked
 * stage, and the day's one line over the flow. Pure. What a bin holds and what
 * a tile counts are `lienBoard.ts`'s, and nothing here reads or writes the desk.
 */
import { lienBoardBinCount, lienBoardChipLate, type LienBoardBin, type LienBoardBinKey, type LienBoardKind, type LienBoardPick, type LienBoardTile, type LienBoardTileDestination } from './lienBoard'
import { lienBoardDayLabelParts } from './lienBoardPhoneTile'

// ---------- The view ----------

/** What a phone's To do shows under its tabs: the tiles over the list by day, or the flow. */
export type LienFlowView = 'day' | 'flow'

/** The two views in the switch's order, with the words on each press. */
export const LIEN_FLOW_VIEWS: ReadonlyArray<{ view: LienFlowView; label: string }> = [
  { view: 'day', label: 'By day' },
  { view: 'flow', label: 'The flow' },
]

/** Where a phone keeps the view it was last on. One device, one choice: it is how this phone is held, not a person's setting. */
export const LIEN_FLOW_VIEW_STORAGE_KEY = 'pipetooling_lien_desk_phone_view'

type ViewStore = Pick<Storage, 'getItem' | 'setItem'>

/** The view a phone opens on: the list by day the first time, as before, then the view last used. A store that throws reads as the first time. */
export function readLienFlowView(store: ViewStore | null | undefined): LienFlowView {
  try {
    return store?.getItem(LIEN_FLOW_VIEW_STORAGE_KEY) === 'flow' ? 'flow' : 'day'
  } catch {
    return 'day'
  }
}

/** Keeps the view for the next visit. A store that throws (a private window, a full store) is left alone: the view still changes on the screen. */
export function writeLienFlowView(store: ViewStore | null | undefined, view: LienFlowView): void {
  try {
    store?.setItem(LIEN_FLOW_VIEW_STORAGE_KEY, view)
  } catch {
    /* the switch still works for this visit */
  }
}

// ---------- A stage ----------

/** A stage's colour, in the Board's own meanings: red is a day at risk, late or due within a day, amber is this week, violet waits on the leader. */
export type LienFlowTone = 'red' | 'amber' | 'violet' | null

export type LienFlowStage = {
  key: LienBoardBinKey
  /** The bin's own name: *Approved · to sign*. */
  name: string
  /** The papers in it that can move, the bin's own count (`lienBoardBinCount`). */
  count: number
  /** No paper can move here: the press is drawn dashed and muted. */
  empty: boolean
  /** The column's closed end, drawn dashed: nothing there can be rushed. */
  closed: boolean
  tone: LienFlowTone
}

/**
 * A stage from a bin. The tone is the worst of its chips', in the order the Board reads a chip: red while one is at
 * risk, late or due within a day, then amber within the week, then violet while it waits on the leader. A closed end
 * has no tone, as its chips are grey, and neither does a stage whose only papers are held or unread, which its count
 * leaves out.
 */
export function lienFlowStage(bin: LienBoardBin): LienFlowStage {
  const count = lienBoardBinCount(bin)
  const moving = bin.closed ? [] : bin.chips.filter((c) => !c.held && !c.unread)
  const tone: LienFlowTone = moving.some((c) => c.atRisk || c.urgency === 'day' || lienBoardChipLate(c)) ? 'red' : moving.some((c) => c.urgency === 'week') ? 'amber' : moving.some((c) => c.urgency === 'waiting') ? 'violet' : null
  return { key: bin.key, name: bin.label, count, empty: count === 0, closed: bin.closed, tone }
}

/** A column's stages, in the Board's order. */
export function lienFlowStages(bins: ReadonlyArray<LienBoardBin>): LienFlowStage[] {
  return bins.map(lienFlowStage)
}

/** The two columns' names, as the Board heads them. */
export const LIEN_FLOW_COLUMN_NAME: Record<LienBoardKind, string> = { notice: 'Monthly notices', affidavit: 'Lien affidavits' }

// ---------- The picked stage ----------

/**
 * The one stage the list is narrowed to, when the pick is a stage of the flow: exactly one bin, and not the day
 * tile's red line or the leader's papers, which narrow the list from a tile and keep the line under the tiles.
 */
export function lienFlowPickedStage(pick: Pick<LienBoardPick, 'bins' | 'line' | 'words'> | null | undefined): LienBoardBinKey | null {
  if (!pick || pick.line || pick.words || pick.bins.length !== 1) return null
  return pick.bins[0] ?? null
}

export type LienFlowRailCell = { key: LienBoardBinKey; name: string; count: number; lit: boolean; empty: boolean }

export type LienFlowRail = {
  kind: LienBoardKind
  /** *Monthly notices, stage 4 of 8*: one plain sentence, so a comma and no dot between its parts. */
  where: string
  /** *Approved · to sign*. */
  name: string
  count: number
  /** The column's stages as cells, the picked one lit. */
  cells: LienFlowRailCell[]
}

/** The pinned line for a picked stage; null when neither column holds it. */
export function lienFlowRail(columns: { notice: ReadonlyArray<LienBoardBin>; affidavit: ReadonlyArray<LienBoardBin> }, picked: LienBoardBinKey | null | undefined): LienFlowRail | null {
  if (!picked) return null
  for (const kind of ['notice', 'affidavit'] as const) {
    const stages = lienFlowStages(columns[kind])
    const at = stages.findIndex((s) => s.key === picked)
    if (at < 0) continue
    const stage = stages[at]!
    return {
      kind,
      where: `${LIEN_FLOW_COLUMN_NAME[kind]}, stage ${at + 1} of ${stages.length}`,
      name: stage.name,
      count: stage.count,
      cells: stages.map((s) => ({ key: s.key, name: s.name, count: s.count, lit: s.key === picked, empty: s.empty })),
    }
  }
  return null
}

// ---------- The day's line ----------

export type LienFlowDayLine = {
  /** The day tile's count. */
  figure: string
  /** *by Dec 15*, the tile's label without its parts. */
  words: string
  /** Whether the count is red, as on its tile. */
  red: boolean
  /** The tile's own red line, *3 are past their day.*; null with nothing late or at risk. */
  line: string | null
  /** Where the line's press goes: the papers it counts. Null when the line is words alone. */
  lineDestination: LienBoardTileDestination | null
}

/** The day's tile as one line over the flow, where the four tiles stand down; null when the Board has no day tile. */
export function lienFlowDayLine(tiles: ReadonlyArray<LienBoardTile>): LienFlowDayLine | null {
  const tile = tiles.find((t) => t.key === 'by_day')
  if (!tile) return null
  return { figure: tile.figure, words: lienBoardDayLabelParts(tile.label).day, red: tile.tone === 'red', line: tile.line, lineDestination: tile.line ? (tile.lineDestination ?? null) : null }
}

// ---------- The arrow across ----------

type Box = { left: number; top: number; width: number; height: number }

/**
 * The one arrow across the flow, from *Sent* on the left to *Waiting on its notice* on the right, as an SVG path over
 * the two columns: out of the first stage's right edge, along the middle of the gutter, and into the second stage's
 * left edge. The boxes are measured from the flow's own corner. Null while either stage is not drawn or the two do
 * not stand side by side. The Board draws the same arrow between its bins (`lienBoardArrowPaths`).
 */
export function lienFlowCrossPath(from: Box | null | undefined, to: Box | null | undefined): string | null {
  if (!from || !to) return null
  const x1 = from.left + from.width
  const x2 = to.left
  if (x2 <= x1) return null
  const y1 = from.top + from.height / 2
  const y2 = to.top + to.height / 2
  const xm = (x1 + x2) / 2
  return `M ${x1} ${y1} H ${xm} V ${y2} L ${x2 - 1} ${y2}`
}
