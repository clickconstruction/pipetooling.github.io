import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { lienDoNowBarStuck } from '../../lib/jobs/lienDoNowFrame'
import { LIEN_DO_NOW_UP_WORDS, type LienDoNowBarPart } from '../../lib/jobs/lienDoNowBar'
import type { LienBoardTile, LienBoardTileDestination } from '../../lib/jobs/lienBoard'

/**
 * The find box's line on the Lien desk's To do, as a bar that pins (v2.7367, punch list #362, step 1).
 *
 * Where To do scrolls as one page (`lienDoNowFrame`), the Board leaves the screen as the list comes up. This bar
 * holds the find box (`children`) and stays at the top of the scroller once it gets there. Pinned, it says the
 * Board's numbers beside the find, each with its tile's press, or what a pressed bin narrowed the list to with
 * *Show every row*, and it carries the way back, *↑ The Board*. Until it pins it is the find box alone, as before,
 * and where the Board stays put (`pins` off) it never changes.
 *
 * The words are the kernels' (`lienDoNowBar.ts`, `lienBoardPickWords`); nothing here reads or writes.
 */

const PART_TONE: Record<LienBoardTile['tone'], string> = {
  red: 'var(--text-red-700)',
  amber: 'var(--text-amber-800)',
  violet: 'var(--text-violet-700)',
  quiet: 'var(--text-700)',
}

const quiet: CSSProperties = { font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' }

export default function LienDoNowBar({
  pins,
  scrollerRef,
  parts,
  onPart,
  pick,
  onClearPick,
  children,
}: {
  /** To do is one page on a computer, so the bar pins; off, it is the find box alone. */
  pins: boolean
  /** The one thing that scrolls: the To do frame. */
  scrollerRef: RefObject<HTMLElement | null>
  /** The Board's counts, in the tiles' words. */
  parts: ReadonlyArray<LienDoNowBarPart>
  /** A count with a door, pressed. */
  onPart: (destination: LienBoardTileDestination) => void
  /** What the list is narrowed to, and the words that put it back; null while every row shows. */
  pick: { head: string; clear: string } | null
  onClearPick: () => void
  /** The find box. */
  children: ReactNode
}) {
  const barRef = useRef<HTMLDivElement | null>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!pins || !scroller) {
      setStuck(false)
      return
    }
    const read = () => {
      const bar = barRef.current
      if (!bar) return
      setStuck(lienDoNowBarStuck({ barTop: bar.getBoundingClientRect().top, scrollerTop: scroller.getBoundingClientRect().top, scrollTop: scroller.scrollTop }))
    }
    read()
    scroller.addEventListener('scroll', read, { passive: true })
    return () => scroller.removeEventListener('scroll', read)
  }, [pins, scrollerRef])

  const up = () => {
    const scroller = scrollerRef.current
    if (!scroller) return
    if (typeof scroller.scrollTo === 'function') scroller.scrollTo({ top: 0, behavior: 'smooth' })
    else scroller.scrollTop = 0
  }

  return (
    <div
      ref={barRef}
      data-lien-do-now-bar
      data-pins={pins ? 'yes' : 'no'}
      data-stuck={stuck ? 'yes' : 'no'}
      style={{ display: 'flex', alignItems: 'stretch', minWidth: 0, ...(pins ? { position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface)' } : null), ...(stuck ? { boxShadow: '0 6px 10px -8px var(--border-strong)' } : null) }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>{children}</div>
      {stuck ? (
        <div data-lien-do-now-bar-extras style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, padding: '0 1.25rem 0 0.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          {pick ? (
            <>
              <span data-lien-do-now-bar-pick style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{pick.head}</span>
              <button type="button" data-lien-do-now-bar-clear onClick={onClearPick} style={{ ...quiet, borderColor: '#2563eb', color: 'var(--text-link)' }}>
                {pick.clear}
              </button>
            </>
          ) : (
            <span data-lien-do-now-bar-parts style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {parts.map((p, i) => {
                const destination = p.destination
                const words = (
                  <span style={{ fontWeight: 600, color: PART_TONE[p.tone], fontVariantNumeric: 'tabular-nums' }}>{p.words}</span>
                )
                return (
                  <span key={p.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {i > 0 ? <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>·</span> : null}
                    {destination ? (
                      <button type="button" className="lienJobDoor" data-lien-do-now-bar-part={p.key} onClick={() => onPart(destination)} style={{ border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', cursor: 'pointer', borderRadius: 3 }}>
                        {words}
                      </button>
                    ) : (
                      <span data-lien-do-now-bar-part={p.key}>{words}</span>
                    )}
                  </span>
                )
              })}
            </span>
          )}
          <button type="button" data-lien-do-now-bar-up onClick={up} style={quiet}>
            {LIEN_DO_NOW_UP_WORDS}
          </button>
        </div>
      ) : null}
    </div>
  )
}
