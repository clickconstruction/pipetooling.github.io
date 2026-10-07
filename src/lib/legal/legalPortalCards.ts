/**
 * The firm's portal on a narrow screen (v2.4808, the owner's ask after a look at the portal on a phone).
 *
 * Every matter table and the Lien grid fold into cards when their own box is too narrow for a
 * record's columns: each row a card, each cell its column's name beside the value. The CSS is
 * `.legalCardTable` in `src/index.css`, a container query on `.legalCardWrap`, so a phone and an
 * iPad's narrow main column fold alike. Small type reads 12px on a phone through one variable the
 * phone query sets on the portal page (`--legal-small`); the office desk's preview keeps the
 * desktop sizes.
 *
 * Pure: what a cell tells the card CSS, the palette the cards read, the Lien grid's missing facts.
 */
import type { CSSProperties } from 'react'
import { FAINT, HAIR } from '../portal/portalTheme'

/** A cell with nothing in it drops out of its card: an absent PDF, an Undo the firm cannot press. A `—` stays, since it says none on file. */
export function cardCellEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === false || (typeof value === 'string' && value.trim() === '')
}

/** Small type on the firm's portal: the desktop size, 12px on a phone, where the phone query sets `--legal-small` on `.legalPortalPage`. */
export function portalSmall(px: number): string {
  return `var(--legal-small, ${px}px)`
}

/** The portal palette the card CSS reads, set inline on each card wrapper so the colors stay in portalTheme. */
export const LEGAL_CARD_VARS = { '--legal-card-hair': HAIR, '--legal-card-label': FAINT } as CSSProperties

/** The Lien grid's facts the office may not have entered yet, in column order, as one card line names them. */
export const LIEN_CARD_FACT_WORDS = {
  owner: 'owner of record',
  lastOnSite: 'last day on site',
  affidavit: 'affidavit date',
  bond: 'payment bond',
  paidOut: 'paid out to the GC',
  reserved: '10 % reserved',
  contractCompleted: 'contract completion',
} as const

export type LienCardFact = keyof typeof LIEN_CARD_FACT_WORDS

/**
 * On a Lien grid card, the facts not entered yet read as one line instead of a `?` row each:
 * *Not entered yet: payment bond, paid out to the GC.* Null when every fact is in.
 */
export function lienCardMissingLine(cell: Readonly<Record<LienCardFact, string>>): string | null {
  const missing = (Object.keys(LIEN_CARD_FACT_WORDS) as LienCardFact[]).filter((k) => !cell[k].trim()).map((k) => LIEN_CARD_FACT_WORDS[k])
  return missing.length ? `Not entered yet: ${missing.join(', ')}.` : null
}
