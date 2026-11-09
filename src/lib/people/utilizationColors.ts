/**
 * The band colours the Utilization bars and chips share. Saturated status colours stay literal
 * (CLAUDE.md → theme tokens); the neutral for "nothing recorded" is a token.
 */
import type { UtilizationBand } from './utilization'

export const BAND_FILL: Record<UtilizationBand, string> = {
  over: '#dc2626',
  full: '#16a34a',
  ok: '#2563eb',
  light: '#d97706',
  none: 'var(--border-strong)',
}
