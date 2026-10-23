import type { NeedsYouSeverity } from '../dashboardNeedsYou'

/**
 * The Needs you card's colors by severity (v2.2339; one home since v2.5774 so the Fill them in
 * deck draws the same rail, tint and button as Cards and Walk the list). Saturated status
 * colors stay literal; the neutrals are theme tokens.
 */
export const NEEDS_YOU_RAIL: Record<NeedsYouSeverity, string> = {
  blue: '#3b82f6',
  amber: '#f59e0b',
  gray: 'var(--border-400)',
  red: '#dc2626',
}

export const NEEDS_YOU_ACTION_BG: Record<NeedsYouSeverity, string> = {
  blue: '#1d4ed8',
  amber: '#b45309',
  gray: 'var(--bg-muted)',
  red: '#dc2626',
}

export const NEEDS_YOU_ACTION_FG: Record<NeedsYouSeverity, string> = {
  blue: '#ffffff',
  amber: '#ffffff',
  gray: 'var(--text-700)',
  red: '#ffffff',
}

export const NEEDS_YOU_WALK_TINT: Record<NeedsYouSeverity, { background: string; border: string }> = {
  blue: { background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)' },
  amber: { background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)' },
  gray: { background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)' },
  red: { background: 'var(--bg-orange-tint)', border: '1px solid #fecaca' },
}
