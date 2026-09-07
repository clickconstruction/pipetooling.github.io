import type { CSSProperties } from 'react'
import type { TeamCell } from '../../../lib/teamBoard'

/** Chip tone → tokens. Saturated bar colours stay literal on purpose (status colours); everything else is a theme token. */
export type TeamTone = 'ok' | 'warn' | 'miss' | 'office' | 'sub'

export const TONE: Record<TeamTone, { bg: string; edge: string; ink: string; bar: string; dashed?: boolean }> = {
  ok: { bg: 'var(--bg-green-tint)', edge: 'var(--border-green)', ink: 'var(--text-green-800)', bar: '#22c55e' },
  warn: { bg: 'var(--bg-amber-tint)', edge: 'var(--border-amber-soft)', ink: 'var(--text-amber-700)', bar: '#f59e0b' },
  miss: { bg: 'transparent', edge: 'var(--border-red)', ink: 'var(--text-red-700)', bar: '#ef4444', dashed: true },
  office: { bg: 'var(--bg-muted)', edge: 'var(--border)', ink: 'var(--text-muted)', bar: 'var(--text-faint-300)' },
  sub: { bg: 'var(--bg-violet-100)', edge: 'var(--bg-violet-200)', ink: 'var(--text-violet-700)', bar: '#8b5cf6' },
}

export function toneForCell(c: TeamCell): TeamTone {
  if (c.kind === 'ok') return c.over ? 'warn' : 'ok'
  if (c.kind === 'unplanned' || c.kind === 'unlinked') return 'warn'
  if (c.kind === 'miss') return 'miss'
  return 'office'
}

export function chipStyle(tone: TeamTone): CSSProperties {
  const t = TONE[tone]
  return {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    columnGap: '0.4rem',
    alignItems: 'baseline',
    padding: '0.25rem 0.45rem 0.3rem',
    borderRadius: 6,
    border: `1px ${t.dashed ? 'dashed' : 'solid'} ${t.edge}`,
    background: t.bg,
    color: t.ink,
    fontSize: '0.8125rem',
  }
}

export const pill = (tone: TeamTone): CSSProperties => {
  const t = TONE[tone]
  return { display: 'inline-block', padding: '0.1rem 0.45rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, whiteSpace: 'nowrap', border: `1px ${t.dashed ? 'dashed' : 'solid'} ${t.edge}`, background: t.bg, color: t.ink }
}

export const smallButton: CSSProperties = { fontSize: '0.6875rem', padding: '0.12rem 0.45rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', whiteSpace: 'nowrap' }
export const smallPrimaryButton: CSSProperties = { ...smallButton, borderColor: 'var(--text-link)', color: 'var(--text-link)' }
export const barTrack: CSSProperties = { height: 5, borderRadius: 3, background: 'var(--bg-200)', overflow: 'hidden' }
