import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { lienBoardBinCount, lienBoardBinsShown, lienBoardDoorWords, lienBoardHoldWords, lienBoardUnreadWords, type LienBoard as LienBoardModel, type LienBoardArrow, type LienBoardBin, type LienBoardBinKey, type LienBoardChip, type LienBoardPick, type LienBoardTile, type LienBoardTileDestination, type LienBoardUrgency, lienBoardPickWords } from '../../lib/jobs/lienBoard'
import type { LienBoardPrintSide } from '../../lib/jobs/lienBoardPrints'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { LIEN_BOARD_CARD_WIDTH_PX, lienBoardCardHeight, lienBoardCardPlace, type LienBoardCardPlace, type LienBoardChipCard } from '../../lib/jobs/lienBoardChipCard'

/**
 * The Lien desk's Board (the owner's ask of 2026-11-15): the month as one picture at the top of To do, where The
 * lien month strip and Steps of each paper stood until v2.7332. Four tiles, then two columns of bins — the monthly
 * notices on the left, the lien affidavits on the right — every job a chip in the bin of its stage, coloured by how
 * soon its day is; thin grey arrows down each column and one across from Sent to Waiting on its notice, drawn
 * from the bins' measured places so they stay attached when chips wrap, the crossing one gone when the columns stack;
 * a closed end at each column's foot only while a job is in it; retainage one line under the notices.
 *
 * A closed end at the foot of each column (the owner's pick of 2026-11-18, `lienClosedEnd.ts`): under Sent, *Window
 * closed · no notice*, and under Served, *Lien day passed · not filed*. No arrow runs into either, the bin is dashed
 * and its chips are grey, since nothing there can be rushed. A chip a late notice can still save is amber. Each is
 * drawn only while a job is in it. Missed stood on the heading line from v2.7714 until then.
 *
 * The quiet parts (v2.7714, punch list #383, PR 3). A bin whose own press is live has a blue left edge: *act here*.
 * The blue border on the busiest bin is gone, since it said *most papers* and read as *most urgent*. A bin with no
 * paper folds to one quiet line, its name and count in the muted grey since v2.7845 (`LIEN_BOARD_QUIET_HEAD`). No bin
 * stands beside a column, so every bin has the column's full width.
 *
 * A held paper stands in the bin of the stage it is stopped at (v2.7783, the owner's pick of 2026-11-18). Its chip has
 * a dashed edge and a hold mark, stands after the chips that can move, and keeps its day's colour, so red still means
 * late. The bin's count leaves it out (`lienBoardBinCount`), so the count is the number the bin's press takes. **Held**
 * was a bin on the heading line until then, and *Ready to file* repeated its count in a line under the bin's name.
 *
 * Nothing stands between the tiles and the chart (v2.7708, the owner's pick of 2026-11-17: *Build B but with the action
 * button in the same line as the title of the card it is in instead of at the bottom*). Every batch press stands on
 * the title line of the bin it empties, right of the bin's name and count, with what it leaves out on one line under
 * that. The band that stood there since v2.7334 and v2.7483, the leader's switch and the two prints, is gone, and so
 * is the leader's own view: every viewer reads every bin, and the leader's press stands on his bin's title line.
 *
 * The picture and the queue are one screen: a bin's head is a press that narrows the list under the Board to that
 * bin's jobs (`onPick`), and a second press, or *Show every row*, puts the list back. A chip is a press to the right
 * place for its stage when the desk hands `onChip` (PR 3); until then it is a plain chip with its hover words. A chip
 * that stands in both columns for one reason lights in both on hover: a job with no owner of record, or an affidavit
 * that waits on its notice alone, beside that notice (v2.7457). The words and the rule are `lienBoard.ts`;
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

/** The desk's own blue, a saturated action colour kept literal: the edge of a bin with something to do now, and the pick's clear press. */
const LIT = '#2563eb'
const ARROW = 'var(--border-strong)'

/**
 * The name and the count of a bin that holds no paper and offers no press: the muted grey and a step lighter than a
 * bin's bold, so the bin reads as there and not active. 4.83 to 1 on the light surface and 5.78 to 1 on the dark one.
 */
export const LIEN_BOARD_QUIET_HEAD: CSSProperties = { color: 'var(--text-muted)', fontWeight: 600 }

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
 * between the two columns (`col:notice` and `col:affidavit` boxes when measured) and enters Waiting on its notice's left edge. Pure over the measurements.
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

function Chip({ chip, lit, apart, onChip, onHover, onCard }: { chip: LienBoardChip; lit: boolean; /** The first held chip after the ones that can move: a little air before it. */ apart?: boolean; onChip?: (chip: LienBoardChip) => void; onHover: (pairKey: string | null) => void; onCard?: (chip: LienBoardChip, el: HTMLElement | null) => void }) {
  const tone = TONE[chip.urgency]
  // A chip at a closed end is quiet, dashed and grey. One a late notice can still save is amber.
  const closed = chip.stage === 'missed'
  // The hover: the job's name, its GC and its money, how soon its day is, the risk, and where the press goes (v2.7333).
  const title = [chip.tip, lienBoardHoldWords(chip), lienBoardUnreadWords(chip), closed ? (chip.lateNotice ? 'the notice window closed, a late notice can still go' : chip.kind === 'notice' ? 'the notice window closed' : 'the lien day passed') : chip.publicMark ? 'public property, no paper until the property is answered' : lienBoardUrgencyWords(chip.urgency), chip.atRisk ? 'will not make its day as it stands' : '', onChip ? lienBoardDoorWords(chip.destination) : ''].filter(Boolean).join(' · ')
  // A held chip keeps its day's colour: the hold is its dashed edge and its mark, never a colour of its own. An affidavit nobody has read (v2.7852) is drawn the same way with its own mark. A closed chip is grey with no fill.
  const style: CSSProperties = closed
    ? { color: chip.lateNotice ? 'var(--text-amber-800)' : 'var(--text-muted)', background: 'transparent', borderColor: chip.lateNotice ? 'var(--text-amber-800)' : 'var(--border-strong)', borderStyle: 'dashed', ...(apart ? { marginLeft: 8 } : null) }
    : { color: tone.fg, background: tone.bg, borderColor: tone.border, ...(chip.held || chip.unread ? { borderStyle: 'dashed' } : null), ...(apart ? { marginLeft: 8 } : null) }
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
      {chip.held ? <span aria-hidden="true" data-lien-board-held-mark style={{ marginLeft: 4, fontWeight: 800 }}>‖</span> : null}
      {chip.unread ? <span aria-hidden="true" data-lien-board-unread-mark style={{ marginLeft: 4, fontWeight: 800 }}>○</span> : null}
    </>
  )
  const marks = { 'data-lien-board-chip': chip.jobId, 'data-kind': chip.kind, 'data-urgency': chip.urgency, 'data-closed': closed ? 'yes' : undefined, 'data-late-notice': chip.lateNotice ? 'yes' : undefined, 'data-at-risk': chip.atRisk ? 'yes' : undefined, 'data-public': chip.publicMark ? 'yes' : undefined, 'data-held': chip.held ? 'yes' : undefined, 'data-unread': chip.unread ? 'yes' : undefined, 'data-pair': chip.pairKey ?? undefined, 'data-pair-lit': lit ? 'yes' : undefined }
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

/** A door on a bin's line: its words and what it opens. `marks` are data attributes for the tests. */
export type LienBoardBinDoor = { key: string; label: string; onPress: () => void; dead?: boolean; marks?: Record<string, string> }

/** One line under a bin's title: what its press leaves out, or what it prints with, and the doors to it. */
export type LienBoardBinLine = { key: string; words: string; tone?: 'amber' | 'muted'; doors?: ReadonlyArray<LienBoardBinDoor>; marks?: Record<string, string> }

/**
 * A bin's own press: the act every paper in it shares, on the bin's title line, right of its name and count (v2.7708;
 * it stood under the chips since v2.7497). `filled` is the bin's main act, a print or an approval; without it the press
 * is an outline, a door to a window. `dead` greys it. `whenEmpty` draws a live press in a bin with no chip, for a
 * retainage notice that rides the run and has no chip. `linesOnly` draws the lines without the press, for a phone,
 * where the print stands over the folded bins. `quiet` is a press that nudges someone else, the office's reminder:
 * its bin gets no blue edge, since the act is not the viewer's.
 */
export type LienBoardBinPress = { label: string; onPress: () => void; title?: string; filled?: boolean; dead?: boolean; whenEmpty?: boolean; linesOnly?: boolean; quiet?: boolean; lines?: ReadonlyArray<LienBoardBinLine>; marks?: Record<string, string> }

const LINE_DOOR: CSSProperties = { border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', borderRadius: 3 }

function Bin({ bin, picked, isMobile, onPick, onChip, pairLit, onHover, onCard, press }: { bin: LienBoardBin; picked: boolean; isMobile: boolean; press?: LienBoardBinPress | null; onPick?: (key: LienBoardBinKey) => void; onChip?: (chip: LienBoardChip) => void; pairLit: string | null; onHover: (pairKey: string | null) => void; onCard?: (chip: LienBoardChip, el: HTMLElement | null) => void }) {
  // What the bin counts is what can move (v2.7783): a held paper stands here with its mark and is left out, so the count is the press's own number.
  const n = lienBoardBinCount(bin)
  const all = bin.chips.length
  // The press shows while the bin holds a paper that can move, or in an empty bin when it is live and says so (`whenEmpty`).
  const act = press && (n > 0 || (press.whenEmpty && !press.dead)) ? press : null
  const lines = act?.lines ?? []
  // Something to do now (v2.7714): the bin's own press is live, and the act is the viewer's.
  const edge = Boolean(act && !act.dead && !act.quiet)
  // A bin with no paper and no press folds to one quiet line.
  const folded = all === 0 && !act
  // A folded bin's name and count go quiet with its edge (v2.7845), from the one flag, so the dashed edge and the grey name cannot disagree.
  const quiet = folded ? LIEN_BOARD_QUIET_HEAD : null
  const head = (
    <>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bin.label}</span>
      <span data-lien-board-count style={{ fontVariantNumeric: 'tabular-nums', color: n ? 'var(--text-strong)' : 'var(--text-muted)', fontWeight: 700, ...quiet }}>{n}</span>
    </>
  )
  // The head keeps its name whole: where the press has no room beside it, the press wraps under the name.
  const headStyle: CSSProperties = { flex: '1 1 auto', width: 'auto', minHeight: isMobile ? 40 : undefined, ...quiet }
  const chips = bin.chips.map((c, i) => <Chip key={`${c.kind}:${c.jobId}`} chip={c} apart={Boolean(c.held || c.unread) && i === n && n > 0} lit={Boolean(c.pairKey) && c.pairKey === pairLit} onChip={onChip} onHover={onHover} onCard={onCard} />)
  return (
    <div className="lienBoardBin" data-lien-board-bin={bin.key} data-stage={bin.stage} data-act={edge ? 'yes' : undefined} data-folded={folded ? 'yes' : undefined} data-picked={picked ? 'yes' : undefined} data-closed={bin.closed ? 'yes' : undefined} style={{ ...(edge ? { borderLeft: `3px solid ${LIT}`, paddingLeft: 7 } : null), ...(folded ? { borderStyle: 'dashed', background: 'transparent', padding: isMobile ? '2px 9px' : '4px 9px' } : null) }}>
      <div data-lien-board-bin-title={bin.key} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', minWidth: 0 }}>
        {onPick ? (
          <button type="button" className="lienBoardBinHead" aria-pressed={picked} data-lien-board-bin-head={bin.key} onClick={() => onPick(bin.key)} title={picked ? 'Show every row again' : `Show only the ${all === 1 ? 'row' : 'rows'} in ${bin.label}`} style={headStyle}>
            {head}
          </button>
        ) : (
          <div className="lienBoardBinHead" data-lien-board-bin-head={bin.key} style={headStyle}>{head}</div>
        )}
        {/* The bin's own press, on its title line (punch list #383): the act every paper in it shares. */}
        {act && !act.linesOnly ? (
          <button
            type="button"
            data-lien-board-bin-press={bin.key}
            {...act.marks}
            disabled={Boolean(act.dead)}
            onClick={act.onPress}
            title={act.title}
            style={{
              flex: '0 0 auto',
              font: 'inherit',
              fontSize: '0.76rem',
              fontWeight: 600,
              lineHeight: 1.3,
              padding: isMobile ? '0 12px' : '3px 10px',
              minHeight: isMobile ? 44 : undefined,
              borderRadius: 7,
              cursor: act.dead ? 'default' : 'pointer',
              ...(act.dead ? { border: '1px solid transparent', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT } : act.filled ? { border: '1px solid #2563eb', background: '#2563eb', color: '#fff' } : { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)' }),
            }}
          >
            {act.label}
          </button>
        ) : null}
      </div>
      {lines.map((line) => (
        <div key={line.key} data-lien-board-bin-line={line.key} {...line.marks} style={{ fontSize: '0.76rem', lineHeight: 1.35, color: line.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)', minWidth: 0 }}>
          {line.words}
          {(line.doors ?? []).map((door) => (
            <span key={door.key}>
              {' · '}
              <button type="button" className="lienJobDoor" data-lien-board-bin-door={door.key} {...door.marks} disabled={Boolean(door.dead)} onClick={door.onPress} style={{ ...LINE_DOOR, ...(door.dead ? { color: 'var(--text-muted)', cursor: 'default' } : null), minHeight: isMobile ? 32 : undefined }}>
                {door.label}
              </button>
            </span>
          ))}
        </div>
      ))}
      {folded ? null : (
        <div className="lienBoardChips" data-lien-board-chips={bin.key}>
          {all === 0 ? <span data-lien-board-empty style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>none</span> : chips}
        </div>
      )}
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
  /** A press on a bin's title line, by the bin's key: *Print 12 liens’ copies ›* or *Enter mail numbers · 12 ›* on *Filed · copies to mail* (punch list #366, by stage since v2.7798), *Enter mail numbers · 6* on *Approved · to mail*, the leader's *Approve 2 affidavits* on his *Awaiting Master approval*, on *Approved · to sign* (v2.7712) the office's reminder or the leader's *Sign 7 notices ›*, and *Send 5 for approval ›* on the affidavits' *To send for Master approval* (v2.7714). */
  binPress?: Partial<Record<LienBoardBinKey, LienBoardBinPress>>
  /** Told when the columns stack or stand side by side, so the desk can make To do one page while the Board is taller than the screen. */
  onLayout?: (stacked: boolean) => void
  /** What a chip says when it is pointed at (v2.7381): the job and where its paper stands. Absent, a chip keeps the browser's one-line tip. */
  cardFor?: (chip: LienBoardChip) => LienBoardChipCard | null
  /**
   * The two prints (v2.7470, punch list #362; `lienBoardPrints.ts`): the whole run for the notices and the batch print for the
   * affidavits, each with what it leaves out and the door to it. Since v2.7708 each stands on the title line of the bin it
   * empties (`side.bin`), its lines under that. The notices' print has no line since v2.7712: what waits on a signature
   * stands in its own bin. The affidavits' print has none for a held paper since v2.7783: its chip stands in the bin with
   * a hold mark. A paper on the earlier form keeps its line. The affidavits' print says what it prints with only when that is not the usual stack, and
   * `onNote` puts the usual pages back (`lienBoardStackNote`). A phone keeps its bins folded, so there the two stand in one row over the
   * fold, in their short words, and an opened bin draws the lines alone. Absent, none is drawn.
   */
  prints?: {
    notice: LienBoardPrintSide | null
    affidavit: LienBoardPrintSide | null
    onPress: (side: LienBoardPrintSide) => void
    onLeft: (side: LienBoardPrintSide) => void
    onNote: (side: LienBoardPrintSide) => void
    busy?: boolean
  } | null
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
  const notices = lienBoardBinsShown(board.notices)
  const affidavits = lienBoardBinsShown(board.affidavits)
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
  }, [board, isMobile, columnsOnly, notices.length, affidavits.length, binsOpen])

  // A phone has no hover: its chips keep their press and draw no card.
  const cardHandler = cardFor && !isMobile ? onCard : undefined
  // Each print as its bin's press (v2.7470; on the bin's title line since v2.7708): one press that names its count, then
  // what it leaves out with its door. A phone draws the press over the folded bins and the lines in the bin.
  const printSides = prints ? [prints.notice, prints.affidavit].filter((side): side is LienBoardPrintSide => Boolean(side)) : []
  const printPress = (side: LienBoardPrintSide): LienBoardBinPress => {
    const lines: LienBoardBinLine[] = []
    if (side.left) lines.push({ key: 'left', words: side.left.words, tone: 'amber', marks: { 'data-lien-board-print-left': side.kind }, doors: [{ key: 'left', label: `${side.left.door} ›`, onPress: () => prints?.onLeft(side), marks: { 'data-lien-board-print-left-door': side.kind } }] })
    if (side.note) lines.push({ key: 'note', words: side.note.words, tone: 'muted', marks: { 'data-lien-board-print-note': side.kind }, doors: [{ key: 'note', label: `${side.note.door} ›`, onPress: () => prints?.onNote(side), marks: { 'data-lien-board-print-note-door': side.kind } }] })
    return { label: side.label, onPress: () => prints?.onPress(side), filled: true, dead: side.dead || Boolean(prints?.busy), whenEmpty: true, linesOnly: isMobile, lines, marks: { 'data-lien-board-print-press': side.act } }
  }
  const presses: Partial<Record<LienBoardBinKey, LienBoardBinPress>> = { ...binPress }
  for (const side of printSides) presses[side.bin] = printPress(side)
  // A phone's row over the fold: the two prints in their short words, side by side.
  const phonePrints = isMobile && printSides.length > 0
  const column = (kind: 'notice' | 'affidavit', title: string, bins: LienBoardBin[], under: ReactNode) => {
    const flow = bins.filter((b) => !b.closed)
    const closed = bins.filter((b) => b.closed)
    return (
      <div data-lien-board-column={kind} style={{ display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
        {/* No bin stands on the heading line: Held is drawn where its paper stopped (v2.7783) and Missed is the closed end at the column's foot. */}
        <div data-lien-board-heading={kind} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 10px', minHeight: 24 }}>
          <h3 style={{ margin: 0, flex: '1 1 auto', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: kind === 'notice' ? 'var(--text-blue-700)' : 'var(--text-red-700)' }}>{title}</h3>
        </div>
        <div data-lien-board-flow={kind} style={{ display: 'grid', gap: 22 }}>
          {flow.map((b) => <Bin key={b.key} bin={b} picked={Boolean(pick?.bins.includes(b.key))} isMobile={isMobile} onPick={onPick} onChip={onChip} pairLit={pairLit} onHover={setPairLit} onCard={cardHandler} press={presses[b.key]} />)}
        </div>
        {/* The closed end, at the foot and apart from the flow: no arrow runs into it. */}
        {closed.length > 0 ? (
          <div data-lien-board-closed={kind} style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            {closed.map((b) => <Bin key={b.key} bin={b} picked={Boolean(pick?.bins.includes(b.key))} isMobile={isMobile} onPick={onPick} onChip={onChip} pairLit={pairLit} onHover={setPairLit} onCard={cardHandler} press={presses[b.key]} />)}
          </div>
        ) : null}
        {under}
      </div>
    )
  }

  const retainage = board.retainageLine ? <div data-lien-board-retainage style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '2px 4px' }}>{board.retainageLine}</div> : null
  const pickWords = pick ? lienBoardPickWords(pick, shown ?? 0) : null

  return (
    <section ref={boardRef} aria-label="The Board" data-lien-board data-lien-board-layout={layout ? 'stacked' : 'columns'} style={{ position: 'relative', display: 'grid', gap: isMobile ? 10 : 12, padding: isMobile ? '0.6rem 0.75rem 0.4rem' : '0.75rem 1.25rem 0.5rem' }}>
      <div data-lien-board-tiles style={{ display: 'grid', gridTemplateColumns: isMobile || layout ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {/* The third tile's press opens the run. On a phone the notices' print stands right under the tiles, the same door twice, so there the tile only reads. */}
        {board.tiles.map((t) => <Tile key={t.key} tile={t.key === 'in_mail' && phonePrints && prints?.notice ? { ...t, destination: null } : t} isMobile={isMobile} onTile={onTile} />)}
      </div>
      {/* A phone keeps its bins folded, so its two prints stand here in one row (v2.7708; stacked, with their lines, since v2.7483). */}
      {/* The row is a grid of equal columns, one a press, so the two share it on every phone: as a wrapping flex row they needed 337 px of a 375 px phone's 335 and the second fell under the first. A press too narrow for its words wraps them inside itself. */}
      {phonePrints ? (
        <div data-lien-board-prints data-layout="row" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, printSides.length)}, minmax(0, 1fr))`, gap: 8, alignItems: 'stretch' }}>
          {printSides.map((side) => {
            const off = side.dead || Boolean(prints?.busy)
            return (
              <button key={side.kind} type="button" data-lien-board-print-press={side.act} disabled={off} onClick={() => prints?.onPress(side)} style={{ minWidth: 0, font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.2, padding: '4px 6px', minHeight: 44, borderRadius: 8, border: 'none', cursor: off ? 'default' : 'pointer', ...(off ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT } : { background: '#2563eb', color: '#fff' }) }}>
                {side.short.label}
              </button>
            )
          })}
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
