import type { CSSProperties, RefObject } from 'react'
import { LIEN_PHONE_TAB as PHONE_TAB } from '../../lib/jobs/lienPhoneLists'
import { LIEN_DESK_HINT, type LienDeskFirstTab } from '../../lib/jobs/lienDeskTitleBar'
import { LIEN_FILL as FILL } from './lienDeskButtonStyles'

/** The desk's six views; By paper stands for the three papers' lists. */
export type LienDeskKind = 'next' | 'notice' | 'affidavit' | 'retainage' | 'timeline' | 'calendar'

/**
 * The Lien desk's four view tabs: To do, By date, By paper, By job (punch list #82; its own file since v2.7586, out of
 * `LienDesk.tsx` as it stood). On a computer the first tab carries the page's name and the count (v2.7465) and its
 * press is the title's. The row scrolls sideways on a phone; the desk keeps the scroller (`useScrollEdgeFade`) so
 * it can bring the picked tab into view.
 */
export function LienDeskViewTabs({ kindTabs, isMobile, kind, paperShown, firstTab, onTitle, onPick }: { kindTabs: { ref: RefObject<HTMLDivElement>; onScroll: () => void; style: CSSProperties }; isMobile: boolean; kind: LienDeskKind; paperShown: boolean; firstTab: LienDeskFirstTab; /** The title's press: To do, with the Board brought into view. */ onTitle: () => void; onPick: (view: 'next' | 'calendar' | 'paper' | 'timeline') => void }) {
  return (
    <div ref={kindTabs.ref} onScroll={kindTabs.onScroll} role="tablist" aria-label="View" data-lien-desk-kinds style={{ display: isMobile ? 'flex' : 'inline-flex', ...(isMobile ? { width: '100%' } : null), maxWidth: '100%', minWidth: 0, border: '1px solid var(--border-strong)', borderRadius: isMobile ? 9 : 7, overflowX: 'auto', overflowY: 'hidden', ...kindTabs.style }}>
      {(['next', 'calendar', 'paper', 'timeline'] as const).map((v) => {
        const on = v === 'paper' ? paperShown : kind === v
        if (v === 'next' && firstTab.titled) {
          // The page's name as the first tab (v2.7465): a little larger and heavier than the other three, filled when To do is the view and in the heading's own colour when it is not, so the page keeps its name on every view. Its line is the other tabs' own (1.17rem, their 0.78rem at 1.5), so the row stays in step with the doors beside it (`headDoor`). The press is the title's: To do, and the Board brought back into view, on To do too.
          return (
            <button key={v} type="button" role="tab" aria-selected={on} data-lien-desk-view={v} data-lien-desk-title onClick={onTitle} className="lienDeskKindTab" style={{ flexShrink: 0, whiteSpace: 'nowrap', border: 'none', background: on ? FILL.primary : 'var(--surface)', color: on ? '#fff' : 'var(--text-base)', fontSize: '0.9rem', lineHeight: '1.17rem', fontWeight: 700, cursor: 'pointer' }} title={`To do, at the Board. ${LIEN_DESK_HINT}`}>
              <span aria-hidden="true">⏱ </span>{firstTab.words}
            </button>
          )
        }
        return (
          <button key={v} type="button" role="tab" aria-selected={on} data-lien-desk-view={v} onClick={() => onPick(v)} className="lienDeskKindTab" style={{ flexShrink: 0, whiteSpace: 'nowrap', border: 'none', background: on ? FILL.primary : 'var(--surface)', color: on ? '#fff' : 'var(--text-700)', fontSize: isMobile ? '0.875rem' : '0.78rem', fontWeight: 600, cursor: 'pointer', ...(isMobile ? PHONE_TAB : null) }} title={v === 'paper' ? 'Every monthly notice, lien affidavit and retainage notice by its state' : v === 'timeline' ? 'Every billed job with money open and a lien month — the whole path, sorted by the next date; Print the grid for counsel' : undefined}>
            {v === 'next' ? firstTab.words : v === 'calendar' ? 'By date' : v === 'paper' ? 'By paper' : 'By job'}
          </button>
        )
      })}
    </div>
  )
}

/**
 * By paper's second row: Monthly notices, Lien affidavits, Retainage notices, each with its count once the desk
 * has data (v2.3817; out of `LienDesk.tsx` as it stood). A count is null until then.
 */
export function LienDeskPaperTabs({ isMobile, kind, toolsOnTitleLine, noticeCount, affCount, retCount, onPick }: { isMobile: boolean; kind: LienDeskKind; /** The tools end the title line (v2.7213): this row keeps the line's height. */ toolsOnTitleLine: boolean; noticeCount: number | null; affCount: number | null; retCount: number | null; onPick: (kind: 'notice' | 'affidavit' | 'retainage') => void }) {
  return (
    <div role="tablist" aria-label="Kind of paper" data-lien-desk-paper-kinds style={{ display: isMobile ? 'flex' : 'inline-flex', ...(isMobile ? { width: '100%' } : null), ...(toolsOnTitleLine ? { marginBlock: 2 } : null), maxWidth: '100%', minWidth: 0, border: '1px solid var(--border)', borderRadius: isMobile ? 9 : 7, overflowX: 'auto', overflowY: 'hidden' }}>
      {(['notice', 'affidavit', 'retainage'] as const).map((k) => (
        <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => onPick(k)} className="lienDeskKindTab" style={{ flexShrink: 0, whiteSpace: 'nowrap', border: 'none', background: kind === k ? 'var(--bg-blue-tint)' : 'var(--surface)', color: kind === k ? 'var(--text-blue-700)' : 'var(--text-700)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', ...(isMobile ? PHONE_TAB : null) }} title={k === 'notice' ? 'The § 53.056 notice — one for every unpaid month of work on a job with a GC' : k === 'affidavit' ? 'The § 53.052 affidavit, which is the lien itself — one per job' : 'The § 53.057 notice of claim for unpaid retainage — one per job, 30 days after our contract on it ends'}>
          {k === 'notice' ? `Monthly notices${noticeCount != null ? ` · ${noticeCount}` : ''}` : k === 'affidavit' ? `Lien affidavits${affCount != null ? ` · ${affCount}` : ''}` : `Retainage notices${retCount != null ? ` · ${retCount}` : ''}`}
        </button>
      ))}
    </div>
  )
}
