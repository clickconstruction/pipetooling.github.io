/**
 * Colours for the sheet rail. Saturated status colours stay literal
 * (CLAUDE.md); the neutrals the component draws with come from the theme.
 */
import type { SheetRail } from './sheetRail'

export const SHEET_RAIL_NOW = '#b5651d'
export const SHEET_RAIL_NOW_HALO = 'rgba(181, 101, 29, 0.24)'
export const SHEET_RAIL_GAP = '#d43b3b'

export function sheetRailLabelColor(tone: SheetRail['tone']): string {
  return tone === 'gap' ? SHEET_RAIL_GAP : tone === 'paid' ? 'var(--text-green-700)' : SHEET_RAIL_NOW
}
