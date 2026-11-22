/**
 * The Lien desk's stacked pile titles, shared by its three By paper lists (v2.4672; shared since the owner's ask of 2026-11-15).
 *
 * Monthly notices, Lien affidavits and Retainage notices each list their jobs in piles. Every pile with rows gets one
 * title: a sticky bar with the pile's name and its count at the right. On a computer the titles passed stack at the
 * top and the titles ahead wait at the bottom, so the list reads as a table of contents; on a phone one title pins,
 * the pile being read. The title of the pile in view is lit, and a press on a title scrolls the list to its pile.
 *
 * Where a title sits and when a pile counts as reached is the rule in `src/lib/jobs/lienPhoneLists.ts`. This file is
 * the wiring the three lists share — the scroller's ref, the lit pile, the press and the scroll handler — and the
 * title's markup, so the behavior is one code path, not three copies.
 */
import { useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type MutableRefObject, type ReactNode } from 'react'
import { thumbInLine } from '../../lib/phonePress'
import { lienPileHeadPlace, lienPileReached, lienPileScrollTop } from '../../lib/jobs/lienPhoneLists'
import { lienFindPileCount } from '../../lib/jobs/lienDeskFind'
import { LIEN_PHONE_PILE_PRESS } from './lienDeskRowStyles'

export type LienPileHeads<P extends string> = {
  /** The list's scroller: `position: relative` and `overflow: auto`, so each pile's `offsetTop` is measured against it. */
  listRef: MutableRefObject<HTMLDivElement | null>
  /** The pile whose title is lit: the one the scroll reached, or the first shown before any scroll. */
  lit: P | null
  /** The scroller's `onScroll`: lights the title of the last pile whose rows the scroll has reached. */
  onScroll: () => void
  /** A press on pile `i`'s title: scrolls its first row right under the titles that sit over it, and lights it. */
  scrollToPile: (p: P, i: number) => void
}

/** The wiring of one list's pile titles. `shown` is the piles with rows, in order, and `phone` the layout. */
export function useLienPileHeads<P extends string>(shown: ReadonlyArray<P>, phone: boolean): LienPileHeads<P> {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [lit, setLit] = useState<P | null>(null)
  const scrollToPile = (p: P, i: number) => {
    const host = listRef.current
    const rows = host?.querySelector<HTMLElement>(`[data-lien-pile-rows="${p}"]`)
    if (!host || !rows) return
    const top = lienPileScrollTop(rows.offsetTop, i, phone)
    if (typeof host.scrollTo === 'function') host.scrollTo({ top, behavior: 'smooth' })
    else host.scrollTop = top
    setLit(p)
  }
  const onScroll = () => {
    const host = listRef.current
    if (!host) return
    let on: P | null = null
    shown.forEach((p, i) => {
      const rows = host.querySelector<HTMLElement>(`[data-lien-pile-rows="${p}"]`)
      if (rows && lienPileReached(rows.offsetTop, host.scrollTop, i, phone)) on = p
    })
    setLit(on)
  }
  const litShown = lit != null && shown.includes(lit) ? lit : shown[0] ?? null
  return { listRef, lit: litShown, onScroll, scrollToPile }
}

/** The count a title shows: a find's `matched of total` (`lienFindPileCount`), else the desk's count for the pile, else its rows. */
export function lienPileHeadCount(rows: number, total: number, counted: number | undefined, finding: boolean): string {
  if (finding) return lienFindPileCount(rows, total, true)
  return String(counted ?? rows)
}

export const LIEN_PILE_HEAD_GO = 'Go to this pile'
/** The way back on a narrowed list's title. Two words since v2.7434, so *To send for Master approval* and a two-digit count hold one line beside it; the hover and a screen reader get the whole act. */
export const LIEN_PILE_SHOW_EVERY = 'every pile'
export const LIEN_PILE_SHOW_EVERY_TITLE = 'Show every pile'

type LienPileHeadProps<P extends string> = {
  pile: P
  label: string
  /** The count's words, from `lienPileHeadCount`. */
  count: string
  /** The title's place among the `n` shown. */
  i: number
  n: number
  phone: boolean
  /** Whether this is the pile in view. */
  on: boolean
  /** A find left this pile with no match: the title stays, greyed. */
  empty?: boolean
  onPress: () => void
  /** The list is narrowed to one pile: the title offers the way back. */
  onShowEvery?: (() => void) | null
  /** The pile's own presses (the run, the deliveries lens), drawn after the title. */
  children?: ReactNode
}

/** One pile's sticky title. The rows it heads follow in a sibling `[data-lien-pile-rows=<pile>]`. */
export function LienPileHead<P extends string>({ pile, label, count, i, n, phone, on, empty, onPress, onShowEvery, children }: LienPileHeadProps<P>) {
  return (
    <div className="lienPileHead" data-lien-pile-head={pile} data-on={on ? 'yes' : 'no'} data-empty={empty ? 'yes' : undefined} style={{ ...lienPileHeadPlace(i, n, phone), ...(phone ? { fontSize: '0.75rem' } : null), opacity: empty ? 0.55 : undefined }}>
      <button type="button" className="lienPileHeadBtn" onClick={onPress} title={LIEN_PILE_HEAD_GO}>
        {label}
        <span className="n" data-lien-pile-count={pile}>{count}</span>
      </button>
      {children}
      {onShowEvery ? (
        <button type="button" data-lien-pile-all onClick={onShowEvery} title={LIEN_PILE_SHOW_EVERY_TITLE} aria-label={LIEN_PILE_SHOW_EVERY_TITLE} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.62rem', fontWeight: 600, letterSpacing: 0, textTransform: 'none', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap', ...(phone ? { fontSize: '0.8125rem', minHeight: 40 } : null) }}>
          {LIEN_PILE_SHOW_EVERY}
        </button>
      ) : null}
    </div>
  )
}

/** What a pile's title has inside its two edges on a phone: `LIEN_PILE_HEAD_H_PHONE` less the hairline over it and the one under. */
const PHONE_PILE_HEAD_INNER = 38

/** The phone's press around the pill: no look of its own, a thumb tall, and the title bar left as tall as it was. */
const PHONE_PILE_PRESS_BOX: CSSProperties = { flex: 'none', display: 'inline-flex', alignItems: 'center', ...thumbInLine(PHONE_PILE_HEAD_INNER), border: 'none', background: 'none', padding: 0, font: 'inherit', letterSpacing: 0, textTransform: 'none', cursor: 'pointer' }

/**
 * A press inside a pile's title: *Print and mail 14* on Approved · to print, the deliveries lens on Sent. On a
 * computer it is the small pill it was, the button itself wearing `look`. On a phone the phone walk of 2026-11-21 read
 * the pill at 30 px, so there the button is a thumb's 44 px and the pill is drawn inside it at the size it had: the
 * bar reads the same and stays its 40 px, since a taller pinned title takes rows from the list (punch list #352).
 */
export function LienPilePress({ phone, look, children, ...rest }: { phone: boolean; /** The pill: its fill, its edge and its words' size at a desk. */ look: CSSProperties } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'type'>) {
  if (!phone) {
    return (
      <button type="button" {...rest} style={look}>
        {children}
      </button>
    )
  }
  return (
    <button type="button" {...rest} style={PHONE_PILE_PRESS_BOX}>
      <span data-lien-pile-press-pill style={{ ...look, ...LIEN_PHONE_PILE_PRESS, display: 'inline-flex', alignItems: 'center', cursor: 'inherit' }}>{children}</span>
    </button>
  )
}
