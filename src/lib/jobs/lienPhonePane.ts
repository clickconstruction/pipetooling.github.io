/**
 * An open notice, affidavit or retainage notice on a phone's Lien desk (punch list #352, PR 6).
 *
 * A computer shows the list and the open paper side by side under the desk's header. A phone shows one or the
 * other, and it used to keep the whole header over the paper: both rows of tabs, 173 px, then five pinned section
 * titles and a footer of 130 to 357 px. The paper had 58 to 285 px of a 579 px panel, and an open affidavit had no
 * way back to its list at all.
 *
 * Here: while a paper is open the header is one row, its way back named for the list it returns to, and the footer
 * can be folded to one bar so the paper has the screen. Pure: which paper is open and what the two presses say.
 */
export type LienPhonePaneKind = 'notice' | 'affidavit' | 'retainage'

export type LienPhonePaneOpen = {
  kind: LienPhonePaneKind
  /** The way back's words, after the arrow: the list it returns to. */
  back: string
  backLabel: string
}

const BACK: Record<LienPhonePaneKind, { back: string; backLabel: string }> = {
  notice: { back: 'Notices', backLabel: 'Back to the notices' },
  affidavit: { back: 'Affidavits', backLabel: 'Back to the affidavits' },
  retainage: { back: 'Retainage', backLabel: 'Back to the retainage notices' },
}

/**
 * The paper that is the whole desk right now, or null: one column, the list put away, a kind of paper that has a
 * pane, and a paper picked in it. The grid and the two other views have no pane.
 */
export function lienPhonePaneOpen(i: { oneColumn: boolean; listShown: boolean; kind: string; picked: Readonly<Record<LienPhonePaneKind, boolean>> }): LienPhonePaneOpen | null {
  if (!i.oneColumn || i.listShown) return null
  if (i.kind !== 'notice' && i.kind !== 'affidavit' && i.kind !== 'retainage') return null
  if (!i.picked[i.kind]) return null
  return { kind: i.kind, ...BACK[i.kind] }
}

/** The bar over the footer: what it says and whether the footer under it shows. */
export function lienPhoneFootFold(folded: boolean): { words: string; mark: string; expanded: boolean } {
  return folded ? { words: 'Show the next step', mark: '▴', expanded: false } : { words: 'Hide the next step', mark: '▾', expanded: true }
}

/** The least room the paper should open with, in px: under this the footer starts folded. */
export const LIEN_PHONE_PAPER_MIN_PX = 140

/**
 * Whether a paper opens with its footer folded: when the footer is so tall that the paper would show through less
 * than `LIEN_PHONE_PAPER_MIN_PX`. A sent notice's footer is 395 px of a 579 px panel, which left the paper 76 px.
 * Heights the page could not read yet (all zero) fold nothing.
 */
export function lienPhoneFootStartsFolded(px: { panel: number; header: number; bar: number; footer: number }): boolean {
  if (px.footer <= 0 || px.panel <= 0) return false
  return px.panel - px.header - px.bar - px.footer < LIEN_PHONE_PAPER_MIN_PX
}
