import type { CSSProperties } from 'react'

/** A box on the notice pane. */
export const lienBoxStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 9, padding: '0.6rem 0.75rem', display: 'grid', gap: '0.35rem', background: 'var(--surface)' }
// A page of the paper cannot narrow past its own letterhead, so in a pane too narrow for it the page slides inside its frame (v2.7446) and never drags the pane.
export const lienPaperStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '1.1rem 1.4rem', overflowX: 'auto' }
export const lienLinkBtnStyle: CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: 0, whiteSpace: 'nowrap' }
/** How far into the pane the gates scroll away and the one-line strip takes over (v2.3522). */
export const LIEN_STRIP_COLLAPSE_PX = 72

/**
 * The strip that pins to the top of a notice once its gates scroll away (v2.3522), and how its chips fit it (v2.8538,
 * punch list #415, loose ends 4 and 6).
 *
 * At a desk the strip wraps, as it always did, and a chip too long for it wraps inside its own shape. A chip could not
 * wrap, so the path's next step on a missed notice, a whole sentence, ran 152 px past the pane and slid it sideways.
 *
 * On a phone the strip is one line that slides sideways, 44 px tall, where it wrapped to three lines and pinned 81 px.
 * Each chip keeps its 18 px look and takes a 44 px touch area (`.lienDeskStrip[data-phone]` in `index.css`), where the
 * touch area was the chip. The job's name is cut at two fifths of the line, so the first chip is always on the screen.
 * Diane's picks of 2026-11-24 from the pictures: C for the phone, and wrap for a chip too long at a desk.
 */
export const LIEN_STRIP_PHONE_H = 44
const STRIP_BASE: CSSProperties = { position: 'sticky', top: 0, zIndex: 2, margin: '0 -1.1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: '0 8px 14px -12px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', fontSize: '0.8125rem' }
export function lienStripStyle(phone: boolean): CSSProperties {
  return phone
    ? // The line's own 44 px sits over its 1 px rule. The room at the right keeps the last press clear of the fade.
      { ...STRIP_BASE, flexWrap: 'nowrap', gap: '0 0.7rem', padding: '0 2rem 0 1.1rem', boxSizing: 'border-box', height: LIEN_STRIP_PHONE_H + 1, overflowX: 'auto', overflowY: 'hidden', whiteSpace: 'nowrap' }
    : { ...STRIP_BASE, flexWrap: 'wrap', gap: '0.3rem 0.7rem', padding: '0.45rem 1.1rem' }
}
/** The job's name at the head of the strip: whole at a desk, cut with an ellipsis on a phone's one line. */
export function lienStripLabelStyle(phone: boolean): CSSProperties {
  return phone ? { flex: 'none', maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}
}
/** How a chip fits its strip: it wraps inside its shape at a desk, and keeps its one line on a phone's sliding line. */
export function lienStripChipFit(phone: boolean): CSSProperties {
  return phone ? { flex: 'none' } : { whiteSpace: 'normal', maxWidth: '100%', minWidth: 0, textAlign: 'left' }
}
