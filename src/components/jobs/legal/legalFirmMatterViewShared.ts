import type { CSSProperties } from 'react'
import { CARD, COPPER, FAINT, HAIR } from '../../../lib/portal/portalTheme'
import type { LegalEntryRow } from '../../../lib/legal/legalMatters'

/** Constants and styles shared by the firm's matter view (`LegalFirmMatterView.tsx`) and its callers — kept out of the component file so fast refresh stays whole. */

export const FIRM_TABS = ['account', 'paper', 'their_word', 'evidence', 'fees_steps'] as const
export type FirmTab = (typeof FIRM_TABS)[number]
export const FIRM_TAB_LABELS: Record<FirmTab, string> = { account: 'Account', paper: 'Paper', their_word: 'Their word', evidence: 'Evidence', fees_steps: 'Fees & steps' }

/** The slice of a matter the view needs — the portal passes its payload matter, the desk builds one from the sheet. */
export type FirmMatterLike = {
  payerName: string
  noteToFirm: string
  contracts: ReadonlyArray<{ id: string; job_id: string; signedPdfUrl: string | null }>
  entries: ReadonlyArray<LegalEntryRow>
}

export const portalCard: CSSProperties = { background: CARD, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }
export const portalCap: CSSProperties = { fontSize: 11, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.07em' }
export const portalH: CSSProperties = { margin: '16px 0 6px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: FAINT, fontWeight: 700 }
export const portalTh: CSSProperties = { textAlign: 'left', fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: FAINT, borderBottom: `1px solid ${HAIR}`, padding: '5px 8px', fontWeight: 700 }
export const portalTd: CSSProperties = { padding: '7px 8px', borderBottom: `1px solid ${HAIR}`, verticalAlign: 'top', fontSize: 13.5 }
export const portalNum: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
export const portalBtn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 5, border: `1px solid ${COPPER}`, color: COPPER, background: CARD, cursor: 'pointer' }

