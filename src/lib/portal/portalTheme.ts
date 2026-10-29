/**
 * The paper identity shared by Click's outward-facing money documents — the
 * customer portal statement and the partner statement. One palette, one
 * letterhead, so a customer and a partner are holding the same kind of paper.
 * Single-theme light by design (customer/print surfaces pin light).
 */
export const INK = '#16283c'
export const PAPER = '#f6f3ec'
export const CARD = '#fdfcf9'
export const MUTED = '#5a6b7e'
/**
 * Small print, labels and dates (v2.5981). Was #8a97a6, 2.9:1 on CARD (What everyone sees, punch
 * list #194); now 5.18:1 on CARD, 4.79:1 on PAPER and 4.51:1 on NOTE_BAND, the darkest ground it
 * sits on. Reading at 4.5:1 there leaves it just a step lighter than MUTED.
 */
export const FAINT = '#5e6d7c'
export const HAIR = '#ddd6c8'
/**
 * Copper, the portal's brand accent (v2.6067). Was `b0662f` (written without its hash so the copper
 * sweep leaves this line be): 3.73:1 as words on NOTE_BAND, 3.96:1 on PAPER and 4.39:1 with white
 * on a button (What everyone sees, punch list #199). A step darker along the same hue: 4.57:1 on the
 * band, 4.85:1 on PAPER, 5.24:1 on CARD, 5.38:1 with white. Every file that copies it as a literal
 * moves with `scripts/codemods/copper-sweep.mjs`, and `portalTheme.test.ts` refuses a copy of the
 * old value under src/.
 */
export const COPPER = '#9a5b2b'
/** Quiet band behind note rows on the ledger (a shade deeper than PAPER). */
export const NOTE_BAND = '#f1ece2'
/** Money semantics on paper: muted, never neon. */
export const PAPER_GREEN = '#1f7a3a'
export const PAPER_RED = '#b42318'
export const PORTAL_FONT = `-apple-system, 'Segoe UI', Roboto, sans-serif`

/**
 * A solid portal press (v2.6067): copper with white words when it can be pressed; while it waits
 * (no date picked, nothing typed) the hairline with muted words, 3.78:1, where white on the
 * hairline read 1.45:1. WCAG exempts a waiting control from 4.5:1; the lens's floor is 3:1, and the
 * muted word still says it waits. Tell us, the GC page's Send and the forms' button share it.
 */
export function portalPressFill(on: boolean): { background: string; color: string } {
  return on ? { background: COPPER, color: '#fff' } : { background: HAIR, color: MUTED }
}
