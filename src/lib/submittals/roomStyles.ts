import type { CSSProperties } from 'react'

/** The reviewer page's paper (v2.4187): shared by `pages/SubmittalRoom.tsx` and the office's read-only view. */
export const ROOM_COPPER = '#b0662f'
export const roomCard: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem 0.95rem' }
export const roomLabel: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }
export const roomQuiet: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)' }

export function roomShortDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
