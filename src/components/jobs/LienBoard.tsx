import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { lienBoardBinsShown, lienBoardDoorWords, type LienBoard as LienBoardModel, type LienBoardArrow, type LienBoardBin, type LienBoardBinKey, type LienBoardChip, type LienBoardPick, type LienBoardTile, type LienBoardTileDestination, type LienBoardUrgency, lienBoardPickWords } from '../../lib/jobs/lienBoard'

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

function Chip({ chip, lit, onChip, onHover }: { chip: LienBoardChip; lit: boolean; onChip?: (chip: LienBoardChip) => void; onHover: (pairKey: string | null) => void }) {
  const tone = TONE[chip.urgency]
  // The hover: the job's name, its GC and its money, how soon its day is, the risk, and where the press goes (v2.7333).
  const title = [chip.tip, lienBoardUrgencyWords(chip.urgency), chip.atRisk ? 'will not make its day as it stands' : '', onChip ? lienBoardDoorWords(chip.destination) : ''].filter(Boolean).join(' · ')
  const style: CSSProperties = { color: tone.fg, background: tone.bg, borderColor: tone.border }
  const hover = chip.pairKey ? { onMouseEnter: () => onHover(chip.pairKey), onMouseLeave: () => onHover(null), onFocus: () => onHover(chip.pairKey), onBlur: () => onHover(null) } : {}
  const body = (
    <>
      {chip.label}
      {chip.atRisk ? <span aria-hidden="true" data-lien-board-risk style={{ marginLeft: 3, fontWeight: 800 }}>!</span> : null}
    </>
  )
  const marks = { 'data-lien-board-chip': chip.jobId, 'data-kind': chip.kind, 'data-urgency': chip.urgency, 'data-at-risk': chip.atRisk ? 'yes' : undefined, 'data-pair': chip.pairKey ?? undefined, 'data-pair-lit': lit ? 'yes' : undefined }
  if (onChip) {
    return (
      <button type="button" className="lienBoardChip" title={title} aria-label={`${chip.label}: ${title}`} onClick={() => onChip(chip)} style={style} {...marks} {...hover}>
        {body}
      </button>
    )
  }
  return (
    <span className="lienBoardChip" title={title} tabIndex={chip.pairKey ? 0 : undefined} style={style} {...marks} {...hover}>
      {body}
    </span>
  )
}

function Bin({ bin, picked, isMobile, onPick, onChip, pairLit, onHover }: { bin: LienBoardBin; picked: boolean; isMobile: boolean; onPick?: (key: LienBoardBinKey) => void; onChip?: (chip: LienBoardChip) => void; pairLit: string | null; onHover: (pairKey: string | null) => void }) {
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
        {n === 0 ? <span data-lien-board-empty style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>none</span> : bin.chips.map((c) => <Chip key={`${c.kind}:${c.jobId}`} chip={c} lit={Boolean(c.pairKey) && c.pairKey === pairLit} onChip={onChip} onHover={onHover} />)}
      </div>
    </div>
  )
}

function Tile({ tile, isMobile, onTile }: { tile: LienBoardTile; isMobile: boolean; onTile?: (d: LienBoardTileDestination) => void }) {
  const press = tile.destination && onTile ? () => onTile(tile.destination!) : null
  const inner = (
    <>
      <span data-lien-board-tile-figure style={{ fontSize: isMobile ? '1.25rem' : '1.4rem', fontWeight: 800, lineHeight: 1.1, color: TILE_TONE[tile.tone], fontVariantNumeric: 'tabular-nums' }}>{tile.figure}</span>
      <span data-lien-board-tile-label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-700)', lineHeight: 1.25 }}>{tile.label}</span>
      {tile.line ? <span data-lien-board-tile-line style={{ fontSize: '0.72rem', color: tile.tone === 'red' ? 'var(--text-red-700)' : 'var(--text-muted)', lineHeight: 1.3 }}>{tile.line}</span> : null}
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
  onLayout,
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
  /** Told when the columns stack or stand side by side, so the desk can make To do one page while the Board is taller than the screen. */
  onLayout?: (stacked: boolean) => void
}) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [stacked, setStacked] = useState<boolean>(isMobile)
  const [lines, setLines] = useState<Line[]>([])
  const [pairLit, setPairLit] = useState<string | null>(null)
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

  const column = (kind: 'notice' | 'affidavit', title: string, bins: LienBoardBin[], under: ReactNode) => {
    const flow = bins.filter((b) => !b.beside)
    const beside = bins.filter((b) => b.beside)
    return (
      <div data-lien-board-column={kind} style={{ display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: kind === 'notice' ? 'var(--text-blue-700)' : 'var(--text-red-700)' }}>{title}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: beside.length && !layout ? 'minmax(0, 1fr) minmax(0, 0.55fr)' : '1fr', gap: '0 12px', alignItems: 'start' }}>
          <div data-lien-board-flow={kind} style={{ display: 'grid', gap: 22 }}>
            {flow.map((b) => <Bin key={b.key} bin={b} picked={Boolean(pick?.bins.includes(b.key))} isMobile={isMobile} onPick={onPick} onChip={onChip} pairLit={pairLit} onHover={setPairLit} />)}
          </div>
          {beside.length ? (
            <div data-lien-board-beside={kind} style={{ display: 'grid', gap: 10, alignContent: 'start', marginTop: layout ? 10 : 0 }}>
              {beside.map((b) => <Bin key={b.key} bin={b} picked={Boolean(pick?.bins.includes(b.key))} isMobile={isMobile} onPick={onPick} onChip={onChip} pairLit={pairLit} onHover={setPairLit} />)}
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
    <section aria-label="The Board" data-lien-board data-lien-board-layout={layout ? 'stacked' : 'columns'} style={{ display: 'grid', gap: isMobile ? 10 : 12, padding: isMobile ? '0.6rem 0.75rem 0.4rem' : '0.75rem 1.25rem 0.5rem' }}>
      <div data-lien-board-tiles style={{ display: 'grid', gridTemplateColumns: isMobile || layout ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        {board.tiles.map((t) => <Tile key={t.key} tile={t} isMobile={isMobile} onTile={onTile} />)}
      </div>
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
        {column('affidavit', 'Lien affidavits', affidavits, null)}
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
    </section>
  )
}
