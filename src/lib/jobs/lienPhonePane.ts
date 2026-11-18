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

/** A sent paper's mail proof, as the fold's bar names it: the block's own chip words and whether the proof is whole. */
export type LienPhoneFootProof = { chip: string; complete: boolean }

/**
 * The bar over the footer: what it says and whether the footer under it shows.
 *
 * A sent paper's footer holds **What went out** (v2.7691), and a tall footer starts folded. Folded, the bar carries the
 * block's own chip (*Mail proof: 1 of 3 on file*), so the proof is named on the one row a phone shows (v2.7715, the
 * live walk of 2026-11-17). Open, the block is on the screen under the bar and the chip would say it twice.
 */
export function lienPhoneFootFold(folded: boolean, proof?: LienPhoneFootProof | null): { words: string; mark: string; expanded: boolean; chip: LienPhoneFootProof | null } {
  return folded ? { words: 'Show the next step', mark: '▴', expanded: false, chip: proof ?? null } : { words: 'Hide the next step', mark: '▾', expanded: true, chip: null }
}

/**
 * The notary's print box over the Affidavits list on a phone (punch list #352, the leftovers): the count and the
 * held papers stay, and one bar folds the print press, the three chips and the county away, about 300 px at the
 * top of the list. It opens folded, since printing a stack for the notary is a computer's work. What the bar says
 * and whether the box under it shows.
 */
export function lienPhonePrintBoxFold(folded: boolean): { words: string; mark: string; expanded: boolean } {
  return folded ? { words: 'Show the print for the notary', mark: '▾', expanded: false } : { words: 'Hide the print for the notary', mark: '▴', expanded: true }
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
