import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { EmptyState } from '../EmptyState'
import { lienBoardBinsShown, lienBoardDoorWords, type LienBoard as LienBoardModel, type LienBoardArrow, type LienBoardBin, type LienBoardBinKey, type LienBoardChip, type LienBoardLeaderView, type LienBoardPick, type LienBoardTile, type LienBoardTileDestination, type LienBoardUrgency, lienBoardPickWords } from '../../lib/jobs/lienBoard'
import type { LienBoardPrintSide } from '../../lib/jobs/lienBoardPrints'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { LIEN_BOARD_CARD_WIDTH_PX, lienBoardCardHeight, lienBoardCardPlace, type LienBoardCardPlace, type LienBoardChipCard } from '../../lib/jobs/lienBoardChipCard'

/**
 * The Lien desk's Board (the owner's ask of 2026-11-15): the month as one picture at the top of To do, where The
 * lien month strip and Steps of each paper stood until v2.7332. Four tiles, then two columns of bins — the monthly
 * notices on the left, the lien affidavits on the right — every job a chip in the bin of its stage, coloured by how
 * soon its day is; thin grey arrows down each column and one across from Sent to Needs the property facts, drawn
 * from the bins' measured places so they stay attached when chips wrap, the crossing one gone when the columns stack;
 * the busiest bin lit; Held and Missed beside a column only while a job is in one; retainage one line under the notices.
 *
 * The picture and the queue are one screen: a bin's head is a press that narrows the list under the Board to that
 * bin's jobs (`onPick`), and a second press, or *Show every row*, puts the list back. A chip is a press to the right
 * place for its stage when the desk hands `onChip` (PR 3); until then it is a plain chip with its hover words. A chip
 * that stands in both columns for one reason lights in both on hover. The words and the rule are `lienBoard.ts`;
 * nothing here reads or writes.
 *
 * Since v2.7381 a chip pointed at, or reached by the keyboard, shows a card before any press (`cardFor`,
 * `lienBoardChipCard.ts`): the job's name, its address and its customer, then where its paper stands and where the
 * press goes. The card stands under the chip, never takes the pointer, and goes when the pointer leaves or the page
 * moves. A phone has no hover and draws none.
 */

const TONE: Record<LienBoardUrgency, { fg: string; bg: string; border: string }> = {
  day: { fg: 'var(--text-red-700)', bg: 'var(--bg-red-tint)', border: 'var(--text-red-700)' },
  week: { fg: 'var(--text-amber-800)', bg: 'var(--bg-amber-tint)', border: 'var(--text-amber-800)' },
  waiting: { fg: 'var(--text-violet-700)', bg: 'var(--bg-violet-tint)', border: 'var(--text-violet-700)' },
  later: { fg: 'var(--text-700)', bg: 'var(--bg-subtle)', border: 'var(--border-strong)' },
}

const TILE_TONE: Record<LienBoardTile['tone'], string> = {
  red: 'var(--text-red-700)',
  amber: 'var(--text-amber-800)',
  violet: 'var(--text-violet-700)',
  quiet: 'var(--text-700)',
}

/** The lit bin's border: the desk's own blue, a saturated action colour kept literal. */
const LIT = '#2563eb'
const ARROW = 'var(--border-strong)'

/** The columns stand side by side from this width; under it they stack and the crossing arrow is not drawn. */
export const LIEN_BOARD_STACK_UNDER_PX = 760

/** The urgency's one-word legend, for the chip's hover and a screen reader. */
export function lienBoardUrgencyWords(u: LienBoardUrgency): string {
  switch (u) {
    case 'day':
      return 'due within a day'
    case 'week':
      return 'due this week'
    case 'waiting':
      return 'waiting on the leader'
    case 'later':
      return 'later'
  }
}

type Line = { key: string; kind: LienBoardArrow['kind']; d: string }

/**
 * The arrows as SVG paths from the bins' measured boxes, relative to the grid. A down arrow runs from the bottom
 * middle of one bin to the top middle of the next; the crossing one leaves Sent's right edge, runs up the gutter
 * between the two columns (`col:notice` and `col:affidavit` boxes when measured, so a Held or Missed bin beside the
 * notices never has the line behind it) and enters Needs the property facts' left edge. Pure over the measurements.
 */
export function lienBoardArrowPaths(arrows: ReadonlyArray<LienBoardArrow>, boxes: Readonly<Record<string, { left: number; top: number; width: number; height: number } | undefined>>, stacked: boolean): Line[] {
  const out: Line[] = []
  for (const a of arrows) {
    const from = boxes[a.from]
    const to = boxes[a.to]
    if (!from || !to) continue
    if (a.kind === 'down') {
      const x1 = from.left + from.width / 2
      const y1 = from.top + from.height
      const x2 = to.left + to.width / 2
      const y2 = to.top
      if (y2 <= y1) continue
      out.push({ key: `${a.from}>${a.to}`, kind: a.kind, d: `M ${x1} ${y1} L ${x2} ${y2 - 1}` })
    } else if (!stacked) {
      const x1 = from.left + from.width
      const y1 = from.top + from.height / 2
      const x2 = to.left
      const y2 = to.top + to.height / 2
      if (x2 <= x1) continue
      const colLeft = boxes['col:notice']
      const colRight = boxes['col:affidavit']
      const gutterFrom = colLeft ? colLeft.left + colLeft.width : x1
      const gutterTo = colRight ? colRight.left : x2
      const xm = gutterTo > gutterFrom ? (gutterFrom + gutterTo) / 2 : (x1 + x2) / 2
      out.push({ key: `${a.from}>${a.to}`, kind: a.kind, d: `M ${x1} ${y1} H ${xm} V ${y2} L ${x2 - 1} ${y2}` })
    }
  }
  return out
}

function Chip({ chip, lit, onChip, onHover, onCard }: { chip: LienBoardChip; lit: boolean; onChip?: (chip: LienBoardChip) => void; onHover: (pairKey: string | null) => void; onCard?: (chip: LienBoardChip, el: HTMLElement | null) => void }) {
  const tone = TONE[chip.urgency]
  // The hover: the job's name, its GC and its money, how soon its day is, the risk, and where the press goes (v2.7333).
  const title = [chip.tip, chip.publicMark ? 'public property, no paper until the property is answered' : lienBoardUrgencyWords(chip.urgency), chip.atRisk ? 'will not make its day as it stands' : '', onChip ? lienBoardDoorWords(chip.destination) : ''].filter(Boolean).join(' · ')
  const style: CSSProperties = { color: tone.fg, background: tone.bg, borderColor: tone.border }
  // Pointed at or focused: the pair lights (a job in both columns), and the card shows when the desk hands one.
  const enter = (el: HTMLElement) => {
    if (chip.pairKey) onHover(chip.pairKey)
    onCard?.(chip, el)
  }
  const leave = () => {
    if (chip.pairKey) onHover(null)
    onCard?.(chip, null)
  }
  const hover = chip.pairKey || onCard ? { onMouseEnter: (e: { currentTarget: HTMLElement }) => enter(e.currentTarget), onMouseLeave: leave, onFocus: (e: { currentTarget: HTMLElement }) => enter(e.currentTarget), onBlur: leave } : {}
  // The card says all the hover's words and more, so the browser's own tip stands down while it is on.
  const tip = onCard ? undefined : title
  const body = (
    <>
      {chip.label}
      {chip.atRisk ? <span aria-hidden="true" data-lien-board-risk style={{ marginLeft: 3, fontWeight: 800 }}>!</span> : null}
      {chip.publicMark ? <span aria-hidden="true" data-lien-board-public-mark style={{ marginLeft: 4, color: 'var(--text-amber-800)', fontWeight: 700 }}>⊘</span> : null}
    </>
  )
  const marks = { 'data-lien-board-chip': chip.jobId, 'data-kind': chip.kind, 'data-urgency': chip.urgency, 'data-at-risk': chip.atRisk ? 'yes' : undefined, 'data-public': chip.publicMark ? 'yes' : undefined, 'data-pair': chip.pairKey ?? undefined, 'data-pair-lit': lit ? 'yes' : undefined }
  if (onChip) {
    return (
      <button type="button" className="lienBoardChip" title={tip} aria-label={`${chip.label}: ${title}`} onClick={() => onChip(chip)} style={style} {...marks} {...hover}>
        {body}
      </button>
    )
  }
  return (
    <span className="lienBoardChip" title={tip} tabIndex={chip.pairKey || onCard ? 0 : undefined} style={style} {...marks} {...hover}>
      {body}
    </span>
  )
}

/** A press that stands inside one bin, under its chips: its words and what it opens. */
export type LienBoardBinPress = { label: string; onPress: () => void; title?: string }

function Bin({ bin, picked, isMobile, onPick, onChip, pairLit, onHover, onCard, press }: { bin: LienBoardBin; picked: boolean; isMobile: boolean; press?: LienBoardBinPress | null; onPick?: (key: LienBoardBinKey) => void; onChip?: (chip: LienBoardChip) => void; pairLit: string | null; onHover: (pairKey: string | null) => void; onCard?: (chip: LienBoardChip, el: HTMLElement | null) => void }) {
  const n = bin.chips.length
  const head = (
    <>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bin.label}</span>
      <span data-lien-board-count style={{ fontVariantNumeric: 'tabular-nums', color: n ? 'var(--text-strong)' : 'var(--text-muted)', fontWeight: 700 }}>{n}</span>
    </>
  )
  return (
    <div className="lienBoardBin" data-lien-board-bin={bin.key} data-stage={bin.stage} data-lit={bin.lit ? 'yes' : undefined} data-picked={picked ? 'yes' : undefined} data-beside={bin.beside ? 'yes' : undefined} style={{ borderColor: bin.lit ? LIT : 'var(--border)', boxShadow: bin.lit ? `inset 0 0 0 1px ${LIT}` : undefined }}>
      {onPick ? (
        <button type="button" className="lienBoardBinHead" aria-pressed={picked} data-lien-board-bin-head={bin.key} onClick={() => onPick(bin.key)} title={picked ? 'Show every row again' : `Show only the ${n === 1 ? 'row' : 'rows'} in ${bin.label}`} style={{ minHeight: isMobile ? 40 : undefined }}>
          {head}
        </button>
      ) : (
        <div className="lienBoardBinHead" data-lien-board-bin-head={bin.key}>{head}</div>
      )}
      <div className="lienBoardChips" data-lien-board-chips={bin.key}>
        {n === 0 ? <span data-lien-board-empty style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>none</span> : bin.chips.map((c) => <Chip key={`${c.kind}:${c.jobId}`} chip={c} lit={Boolean(c.pairKey) && c.pairKey === pairLit} onChip={onChip} onHover={onHover} onCard={onCard} />)}
      </div>
      {/* The bin's own press (punch list #366): the act every paper in it shares. An outline, so each column's print stays the one filled press. */}
      {press && n > 0 ? (
        <button type="button" data-lien-board-bin-press={bin.key} onClick={press.onPress} title={press.title} style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, margin: '6px 0 2px', padding: isMobile ? '0 12px' : '4px 12px', minHeight: isMobile ? 44 : undefined, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer', justifySelf: 'start' }}>
          {press.label}
        </button>
      ) : null}
    </div>
  )
}

function Tile({ tile, isMobile, onTile }: { tile: LienBoardTile; isMobile: boolean; onTile?: (d: LienBoardTileDestination) => void }) {
  const press = tile.destination && onTile ? () => onTile(tile.destination!) : null
  const linePress = !press && tile.lineDestination && onTile ? () => onTile(tile.lineDestination!) : null
  const inner = (
    <>
      <span data-lien-board-tile-figure style={{ fontSize: isMobile ? '1.25rem' : '1.4rem', fontWeight: 800, lineHeight: 1.1, color: TILE_TONE[tile.tone], fontVariantNumeric: 'tabular-nums' }}>{tile.figure}</span>
      <span data-lien-board-tile-label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-700)', lineHeight: 1.25 }}>{tile.label}</span>
      {tile.line ? (
        linePress ? (
          // The red line is a press of its own (v2.7371): the list under the Board shows only the papers it counts.
          <button type="button" className="lienJobDoor" data-lien-board-tile-line data-press="yes" onClick={linePress} title="Show only these rows" style={{ border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', fontSize: '0.72rem', color: 'var(--text-red-700)', lineHeight: 1.3, textAlign: 'left', cursor: 'pointer', borderRadius: 3, textDecoration: 'underline', textUnderlineOffset: 3, minHeight: isMobile ? 32 : undefined }}>
            {tile.line}
          </button>
        ) : (
          <span data-lien-board-tile-line style={{ fontSize: '0.72rem', color: tile.tone === 'red' ? 'var(--text-red-700)' : 'var(--text-muted)', lineHeight: 1.3 }}>{tile.line}</span>
        )
      ) : null}
    </>
  )
  const marks = { 'data-lien-board-tile': tile.key, 'data-tone': tile.tone }
  if (press) {
    return (
      <button type="button" className="lienBoardTile" onClick={press} {...marks}>
        {inner}
      </button>
    )
  }
  return (
    <div className="lienBoardTile" data-static="yes" {...marks}>
      {inner}
    </div>
  )
}

/** The overflow values that cut what leaves a box. */
const CUTS = new Set(['hidden', 'clip', 'auto', 'scroll'])

/** What can show a card under and over `box`: the screen, cut by every box around `el` that cuts its contents from top to bottom. */
function roomAround(el: HTMLElement, box: DOMRect): { roomBelow: number; roomAbove: number } {
  let top = 0
  let bottom = typeof window === 'undefined' ? 0 : window.innerHeight
  for (let up = el.parentElement; up && up !== document.body && up !== document.documentElement; up = up.parentElement) {
    if (!CUTS.has(getComputedStyle(up).overflowY)) continue
    const cut = up.getBoundingClientRect()
    top = Math.max(top, cut.top)
    bottom = Math.min(bottom, cut.bottom)
  }
  return { roomBelow: bottom - box.bottom, roomAbove: box.top - top }
}

/** What the card is placed by: its chip's box in the Board's own box, the Board's width, and the screen left under and over the chip. */
type ChipCardAt = { chip: { left: number; top: number; width: number; height: number }; hostWidth: number; roomBelow: number; roomAbove: number }

const CARD_DAY_TONE: Record<LienBoardUrgency, string> = { day: 'var(--text-red-700)', week: 'var(--text-amber-800)', waiting: 'var(--text-violet-700)', later: 'var(--text-700)' }

/** The card of the chip under the pointer: the job, where it is and whose it is, then its paper's status and where the press goes. */
function ChipCard({ card, at, chipKey }: { card: LienBoardChipCard; at: ChipCardAt; chipKey: string }) {
  // Placed by its real height (v2.7425): drawn hidden where the guess puts it, measured before the paint, then shown
  // where it fits. A guess alone hung the taller cards off the bottom of a short screen.
  const ref = useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    setHeight(ref.current?.offsetHeight ?? 0)
  }, [card])
  const place: LienBoardCardPlace = lienBoardCardPlace({ ...at, cardHeight: height && height > 0 ? height : lienBoardCardHeight(card) })
  const label: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }
  const fact = (name: string, words: string | null, missing: string) => (
    <>
      <span style={label}>{name}</span>
      <span data-lien-board-card-fact={name.toLowerCase()} style={{ minWidth: 0, color: words ? 'var(--text-strong)' : 'var(--text-muted)', overflowWrap: 'anywhere' }}>{words ?? missing}</span>
    </>
  )
  return (
    <div
      ref={ref}
      role="tooltip"
      data-lien-board-chip-card={chipKey}
      data-above={place.above ? 'yes' : undefined}
      data-beside={place.beside ? 'yes' : undefined}
      style={{ position: 'absolute', left: place.left, top: place.top, visibility: height == null ? 'hidden' : 'visible', zIndex: 6, width: `min(${LIEN_BOARD_CARD_WIDTH_PX}px, calc(100vw - 32px))`, boxSizing: 'border-box', pointerEvents: 'none', display: 'grid', gap: 8, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 14px 40px rgba(0,0,0,0.35)', fontSize: '0.8125rem', lineHeight: 1.35, color: 'var(--text-700)', textAlign: 'left' }}
    >
      <div data-lien-board-card-title style={{ fontWeight: 700, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{card.title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '3px 10px', alignItems: 'baseline' }}>
        {fact('Address', card.address, 'No address on the job')}
        {fact('Customer', card.customer, 'No customer on the job')}
        {card.gc ? fact('GC', card.gc, '') : null}
      </div>
      <div data-lien-board-card-status style={{ display: 'grid', gap: 3, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <div>
          <span style={label}>{card.paper}</span>
          <span style={{ marginLeft: 6, fontWeight: 700, color: 'var(--text-strong)' }}>{card.stage}</span>
        </div>
        {card.detail ? <div data-lien-board-card-detail>{card.detail}</div> : null}
        {card.day ? <div data-lien-board-card-day style={{ fontWeight: 600, color: CARD_DAY_TONE[card.urgency] }}>{card.day}</div> : null}
        {card.risk ? <div data-lien-board-card-risk style={{ color: 'var(--text-red-700)' }}>{card.risk}</div> : null}
        {card.left.length > 0 ? (
          <ol data-lien-board-card-left style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 1, color: 'var(--text-strong)' }}>
            {card.left.map((stage) => (
              <li key={stage}>{stage}</li>
            ))}
          </ol>
        ) : null}
        {card.owes ? <div data-lien-board-card-owes style={{ fontVariantNumeric: 'tabular-nums' }}>{card.owes}</div> : null}
        {card.other ? <div data-lien-board-card-other style={{ color: 'var(--text-muted)' }}>{card.other}</div> : null}
      </div>
      <div data-lien-board-card-door style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{card.door}</div>
    </div>
  )
}

export default function LienBoard({
  board,
  isMobile,
  pick,
  shown,
  onPick,
  onTile,
  onChip,
  columnsOnly,
  foot,
  over,
  underAffidavits,
  binPress,
  onLayout,
  leader,
  cardFor,
  prints,
}: {
  board: LienBoardModel
  isMobile: boolean
  /** The bin or stage the list under the Board is narrowed to; null for every row. */
  pick?: LienBoardPick | null
  /** How many rows the list shows under the pick, for the line under the bins. */
  shown?: number
  /** A bin's head pressed: the key, or null for *Show every row*. Absent, the heads are plain. */
  onPick?: (key: LienBoardBinKey | null) => void
  /** A tile pressed, with its door. Absent, the tiles only read. */
  onTile?: (destination: LienBoardTileDestination) => void
  /** A chip pressed (PR 3): the desk opens its destination. Absent, chips are plain. */
  onChip?: (chip: LienBoardChip) => void
  /** Draw the columns side by side whatever the width (a test's hook); normally the width decides. */
  columnsOnly?: boolean
  /** A line under the bins the desk adds (the leader's one press, PR 4). */
  foot?: ReactNode
  /** A line over the bins the desk adds (v2.7443): the jobs on public property still on the lien path, with *Review them ›*. */
  over?: ReactNode
  /** A bin of the desk's own under the affidavit column (v2.7443): *Public jobs · bond claim*. */
  underAffidavits?: ReactNode
  /** A press inside a bin, by the bin's key (punch list #366): *Mail 12 liens’ copies ›* in *Filed · copies to mail*. The leader's own view draws none. */
  binPress?: Partial<Record<LienBoardBinKey, LienBoardBinPress>>
  /** Told when the columns stack or stand side by side, so the desk can make To do one page while the Board is taller than the screen. */
  onLayout?: (stacked: boolean) => void
  /**
   * The leader's Board (v2.7334): with `mine` on, only his two Awaiting Master approval bins stand under the tiles, with one
   * counted press for the lot and what it holds, each held paper a chip to its own door; a toggle shows every bin.
   */
  leader?: { view: LienBoardLeaderView; mine: boolean; onToggleMine: () => void; onApprove: () => void; busy?: boolean }
  /** What a chip says when it is pointed at (v2.7381): the job and where its paper stands. Absent, a chip keeps the browser's one-line tip. */
  cardFor?: (chip: LienBoardChip) => LienBoardChipCard | null
  /**
   * The two prints (v2.7470, punch list #362; `lienBoardPrints.ts`): the whole run for the notices and the batch print for the
   * affidavits, each with what it leaves out and the door to it. Since v2.7483 they stand between the tiles and the columns,
   * each over its own column, so they show on arrival; where the columns stack, and on a phone, they stack. Absent, or on
   * the leader's own bins, none is drawn.
   */
  prints?: { notice: LienBoardPrintSide | null; affidavit: LienBoardPrintSide | null; onPress: (side: LienBoardPrintSide) => void; onLeft: (side: LienBoardPrintSide) => void; onNote: (side: LienBoardPrintSide) => void; busy?: boolean } | null
}) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [stacked, setStacked] = useState<boolean>(isMobile)
  const [lines, setLines] = useState<Line[]>([])
  const [pairLit, setPairLit] = useState<string | null>(null)
  // The card of the chip under the pointer (v2.7381), placed in the Board's own box. A short wait before it goes lets
  // the pointer cross to the next chip without a blink.
  const boardRef = useRef<HTMLElement | null>(null)
  const [cardShown, setCardShown] = useState<{ key: string; card: LienBoardChipCard; at: ChipCardAt } | null>(null)
  const hideTimer = useRef<number | null>(null)
  const cancelHide = () => {
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current)
    hideTimer.current = null
  }
  const onCard = useCallback(
    (chip: LienBoardChip, el: HTMLElement | null) => {
      if (!cardFor) return
      cancelHide()
      const host = boardRef.current
      if (!el || !host) {
        hideTimer.current = window.setTimeout(() => setCardShown(null), 90)
        return
      }
      const card = cardFor(chip)
      if (!card) {
        setCardShown(null)
        return
      }
      const box = el.getBoundingClientRect()
      const origin = host.getBoundingClientRect()
      const at: ChipCardAt = { chip: { left: box.left - origin.left, top: box.top - origin.top, width: box.width, height: box.height }, hostWidth: origin.width, ...roomAround(el, box) }
      setCardShown({ key: `${chip.kind}:${chip.jobId}`, card, at })
    },
    [cardFor],
  )
  // The card is placed once, where the chip stood: when anything scrolls it goes, sooner than point at the wrong chip.
  useEffect(() => {
    if (!cardShown) return
    const gone = () => setCardShown(null)
    window.addEventListener('scroll', gone, true)
    return () => window.removeEventListener('scroll', gone, true)
  }, [cardShown])
  useEffect(() => cancelHide, [])
  // On a phone the bins stand behind one press (2026-11-15): stacked they run a screen and a half, and the tiles
  // already say the day; a pressed bin keeps them open. Session-only.
  const [binsShown, setBinsShown] = useState(false)
  const mine = Boolean(leader?.mine)
  const notices = mine && leader ? leader.view.bins.filter((b) => b.kind === 'notice') : lienBoardBinsShown(board.notices)
  const affidavits = mine && leader ? leader.view.bins.filter((b) => b.kind === 'affidavit') : lienBoardBinsShown(board.affidavits)
  const chipCount = [...board.notices, ...board.affidavits].reduce((n, b) => n + b.chips.length, 0)
  const binsOpen = !isMobile || binsShown || Boolean(pick)
  const layout = columnsOnly ? false : stacked
  useEffect(() => {
    onLayout?.(layout)
  }, [layout, onLayout])

  // The arrows follow the bins: measured after every paint of the grid, and again when it changes size.
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const measure = () => {
      const width = grid.getBoundingClientRect().width
      const nowStacked = columnsOnly ? false : isMobile || (width > 0 && width < LIEN_BOARD_STACK_UNDER_PX)
      setStacked(nowStacked)
      const origin = grid.getBoundingClientRect()
      const boxes: Record<string, { left: number; top: number; width: number; height: number }> = {}
      const box = (el: HTMLElement) => {
        const r = el.getBoundingClientRect()
        return { left: r.left - origin.left, top: r.top - origin.top, width: r.width, height: r.height }
      }
      grid.querySelectorAll<HTMLElement>('[data-lien-board-bin]').forEach((el) => {
        boxes[el.getAttribute('data-lien-board-bin') ?? ''] = box(el)
      })
      grid.querySelectorAll<HTMLElement>('[data-lien-board-column]').forEach((el) => {
        boxes[`col:${el.getAttribute('data-lien-board-column') ?? ''}`] = box(el)
      })
      setLines(lienBoardArrowPaths(board.arrows, boxes, nowStacked))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(grid)
    return () => ro.disconnect()
  }, [board, isMobile, columnsOnly, notices.length, affidavits.length, binsOpen, mine])

  // A phone has no hover: its chips keep their press and draw no card.
  const cardHandler = cardFor && !isMobile ? onCard : undefined
  // The column's own print (v2.7470): one press that names its count, then what it leaves out with its door.
  const lineDoor: CSSProperties = { border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', borderRadius: 3 }
  // It is not one more stage: no arrow leads to it, since the bins are the flow.
  const drawPrints = Boolean(prints && !mine && (prints.notice || prints.affidavit))
  const printFoot = (side: LienBoardPrintSide | null | undefined) => {
    if (!prints || !side || mine) return null
    const off = side.dead || Boolean(prints.busy)
    return (
      <div data-lien-board-print={side.kind} style={{ display: 'grid', gap: 4, justifyItems: 'start', minWidth: 0 }}>
        <button
          type="button"
          data-lien-board-print-press={side.act}
          disabled={off}
          onClick={() => prints.onPress(side)}
          style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: isMobile ? '0 14px' : '6px 14px', minHeight: isMobile ? 44 : undefined, borderRadius: 8, border: 'none', cursor: off ? 'default' : 'pointer', ...(off ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT } : { background: '#2563eb', color: '#fff' }) }}
        >
          {side.label}
        </button>
        {side.left ? (
          <div data-lien-board-print-left style={{ fontSize: '0.78rem', color: 'var(--text-amber-800)', minWidth: 0 }}>
            {side.left.words}
            {' · '}
            <button type="button" className="lienJobDoor" data-lien-board-print-left-door onClick={() => prints.onLeft(side)} style={lineDoor}>{side.left.door} ›</button>
          </div>
        ) : null}
        {side.note ? (
          <div data-lien-board-print-note style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 0 }}>
            {side.note.words}
            {' · '}
            <button type="button" className="lienJobDoor" data-lien-board-print-note-door onClick={() => prints.onNote(side)} style={lineDoor}>{side.note.door} ›</button>
          </div>
        ) : null}
      </div>
    )
  }
  const column = (kind: 'notice' | 'affidavit', title: string, bins: LienBoardBin[], under: ReactNode) => {
    const flow = bins.filter((b) => !b.beside)
    const beside = bins.filter((b) => b.beside)
    return (
      <div data-lien-board-column={kind} style={{ display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: kind === 'notice' ? 'var(--text-blue-700)' : 'var(--text-red-700)' }}>{title}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: beside.length && !layout ? 'minmax(0, 1fr) minmax(0, 0.55fr)' : '1fr', gap: '0 12px', alignItems: 'start' }}>
          <div data-lien-board-flow={kind} style={{ display: 'grid', gap: 22 }}>
            {flow.map((b) => <Bin key={b.key} bin={b} picked={Boolean(pick?.bins.includes(b.key))} isMobile={isMobile} onPick={onPick} onChip={onChip} pairLit={pairLit} onHover={setPairLit} onCard={cardHandler} press={mine ? null : binPress?.[b.key]} />)}
          </div>
          {beside.length ? (
            <div data-lien-board-beside={kind} style={{ display: 'grid', gap: 10, alignContent: 'start', marginTop: layout ? 10 : 0 }}>
              {beside.map((b) => <Bin key={b.key} bin={b} picked={Boolean(pick?.bins.includes(b.key))} isMobile={isMobile} onPick={onPick} onChip={onChip} pairLit={pairLit} onHover={setPairLit} onCard={cardHandler} />)}
            </div>
          ) : null}
        </div>
        {under}
      </div>
    )
  }

  const retainage = board.retainageLine ? <div data-lien-board-retainage style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '2px 4px' }}>{board.retainageLine}</div> : null
  const pickWords = pick ? lienBoardPickWords(pick, shown ?? 0) : null

  return (
    <section ref={boardRef} aria-label="The Board" data-lien-board data-lien-board-layout={layout ? 'stacked' : 'columns'} style={{ position: 'relative', display: 'grid', gap: isMobile ? 10 : 12, padding: isMobile ? '0.6rem 0.75rem 0.4rem' : '0.75rem 1.25rem 0.5rem' }}>
      <div data-lien-board-tiles style={{ display: 'grid', gridTemplateColumns: isMobile || layout ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {/* The third tile's press opened the run. With the notices' print drawn right under the tiles it would be the same door twice, so there the tile only reads. */}
        {board.tiles.map((t) => <Tile key={t.key} tile={t.key === 'in_mail' && drawPrints && prints?.notice ? { ...t, destination: null } : t} isMobile={isMobile} onTile={onTile} />)}
      </div>
      {leader ? (
        <div data-lien-board-leader-bar style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{mine ? 'Only the bins that wait on you.' : 'Every bin.'}</span>
          <button type="button" data-lien-board-mine aria-pressed={mine} onClick={leader.onToggleMine} style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '2px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', minHeight: isMobile ? 40 : undefined }}>
            {mine ? 'Every bin' : 'Only my bins'}
          </button>
        </div>
      ) : null}
      {/* The two prints, between the tiles and the columns (v2.7483; they stood at each column's foot in v2.7470, 780 px and
          890 px down a 768 px window). Each stands over its own column, the notices' on the left, so they show on arrival.
          Where the columns stack, and on a phone, the two stack too. */}
      {drawPrints ? (
        <div data-lien-board-prints data-layout={isMobile || layout ? 'stacked' : 'columns'} style={{ display: 'grid', gridTemplateColumns: isMobile || layout ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', columnGap: 56, rowGap: 10, alignItems: 'start' }}>
          {printFoot(prints?.notice) ?? (isMobile || layout ? null : <span aria-hidden="true" />)}
          {printFoot(prints?.affidavit)}
        </div>
      ) : null}
      {over}
      {board.empty ? (
        <div data-lien-board-empty-board style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '0.4rem 0' }}>
          Nothing is on the desk. Every lien paper is sent, filed or waiting on its day.
        </div>
      ) : null}
      {isMobile && !board.empty ? (
        <button type="button" data-lien-board-fold aria-expanded={binsOpen} onClick={() => setBinsShown((v) => !v)} disabled={Boolean(pick)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, padding: '0 0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', font: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)', cursor: pick ? 'default' : 'pointer', textAlign: 'left' }}>
          <span style={{ flex: 1 }}>{binsOpen ? 'Hide the bins' : `Show the bins · ${chipCount}`}</span>
          <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>{binsOpen ? '▴' : '▾'}</span>
        </button>
      ) : null}
      <div ref={gridRef} data-lien-board-grid style={{ position: 'relative', display: binsOpen ? 'grid' : 'none', gridTemplateColumns: layout ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', columnGap: 56, rowGap: 22, alignItems: 'start' }}>
        <svg aria-hidden="true" data-lien-board-arrows style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
          <defs>
            <marker id="lienBoardArrowHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0.5 L 8 4 L 0 7.5" fill="none" stroke={ARROW} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          {lines.map((l) => <path key={l.key} data-lien-board-arrow={l.key} data-kind={l.kind} d={l.d} fill="none" stroke={ARROW} strokeWidth="1.3" strokeDasharray={l.kind === 'cross' ? '4 3' : undefined} markerEnd="url(#lienBoardArrowHead)" />)}
        </svg>
        {column('notice', 'Monthly notices', notices, retainage)}
        {column('affidavit', 'Lien affidavits', affidavits, underAffidavits ?? null)}
      </div>
      {leader && mine ? (
        <div data-lien-board-leader style={{ display: 'grid', gap: 6, padding: '2px 0' }}>
          {leader.view.chips.length === 0 && leader.view.held.length === 0 ? <EmptyState compact main="Nothing waits on you." /> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" data-lien-board-approve disabled={leader.view.press.dead || leader.busy} onClick={leader.onApprove} style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: '6px 14px', borderRadius: 7, border: 'none', background: leader.view.press.dead || leader.busy ? 'var(--bg-muted)' : LIT, color: leader.view.press.dead || leader.busy ? 'var(--text-muted)' : '#fff', cursor: leader.view.press.dead || leader.busy ? 'default' : 'pointer', minHeight: isMobile ? 40 : undefined }}>
              {leader.busy ? 'Approving…' : leader.view.press.button}
            </button>
            {leader.view.press.foot ? <span data-lien-board-approve-foot style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{leader.view.press.foot}</span> : null}
          </div>
          {leader.view.held.length ? (
            <div data-lien-board-held style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {leader.view.held.map((h) => (
                <span key={`${h.chip.kind}:${h.chip.jobId}`} data-lien-board-held-row={h.chip.jobId} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Chip chip={h.chip} lit={false} onChip={onChip} onHover={setPairLit} onCard={cardHandler} />
                  {h.reason}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {pickWords && onPick ? (
        <div data-lien-board-pick style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8125rem', color: 'var(--text-700)', padding: '2px 0' }}>
          <span data-lien-board-pick-words style={{ fontWeight: 600 }}>{pickWords.head}</span>
          <button type="button" onClick={() => onPick(null)} data-lien-board-pick-clear style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '2px 10px', borderRadius: 999, border: `1px solid ${LIT}`, background: 'var(--surface)', color: LIT, cursor: 'pointer', minHeight: isMobile ? 32 : undefined }}>
            {pickWords.clear}
          </button>
        </div>
      ) : null}
      {foot}
      {cardShown ? <ChipCard key={cardShown.key} card={cardShown.card} at={cardShown.at} chipKey={cardShown.key} /> : null}
    </section>
  )
}
