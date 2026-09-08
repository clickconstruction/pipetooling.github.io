/**
 * Shared looks for the Subs tile queues (v2.2963) — the board's table voice,
 * plus the inline form controls the expanded row draws.
 */
import type { CSSProperties } from 'react'

export const th: CSSProperties = { padding: '0.45rem 0.7rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', background: 'var(--bg-subtle)' }
export const td: CSSProperties = { padding: '0.6rem 0.7rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', verticalAlign: 'top' }
export const tdNum: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
export const tdAct: CSSProperties = { ...td, textAlign: 'right', whiteSpace: 'nowrap' }
export const sectionTd: CSSProperties = { padding: '0.35rem 0.7rem', background: 'var(--bg-subtle)', fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }

export const who: CSSProperties = { fontWeight: 600 }
export const where: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.74rem' }
export const muted: CSSProperties = { color: 'var(--text-muted)' }
export const red: CSSProperties = { color: 'var(--text-red-700)', fontWeight: 700 }

export type BtnTone = 'primary' | 'ghost' | 'warn' | 'ok' | 'danger'
export function btn(tone: BtnTone = 'ghost', disabled = false, small = true): CSSProperties {
  const base: CSSProperties = { fontSize: small ? '0.72rem' : '0.8125rem', fontWeight: 600, padding: small ? '3px 9px' : '0.45rem 0.9rem', borderRadius: 5, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', opacity: disabled ? 0.6 : 1 }
  if (tone === 'primary') return { ...base, background: disabled ? '#9ca3af' : '#2563eb', border: 'none', color: 'white' }
  if (tone === 'warn') return { ...base, background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', color: 'var(--text-amber-800)' }
  if (tone === 'ok') return { ...base, background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)', color: 'var(--text-green-700)' }
  if (tone === 'danger') return { ...base, color: 'var(--text-red-700)' }
  return base
}
export const door: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-blue-700)', fontWeight: 600, fontSize: '0.74rem', whiteSpace: 'nowrap' }
export const acts: CSSProperties = { display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }

export type ChipTone = 'red' | 'amber' | 'green' | 'teal' | 'gray'
export function chip(tone: ChipTone): CSSProperties {
  const base: CSSProperties = { display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600, whiteSpace: 'nowrap', border: '1px solid transparent' }
  switch (tone) {
    case 'red':
      return { ...base, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', fontWeight: 700 }
    case 'amber':
      return { ...base, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderColor: 'var(--border-amber)' }
    case 'green':
      return { ...base, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }
    case 'teal':
      return { ...base, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' }
    default:
      return { ...base, background: 'var(--bg-subtle)', color: 'var(--text-muted)', borderColor: 'var(--border)' }
  }
}

/** The expanded row's form: a grid of labelled controls with a send line under a dashed rule. */
export const formBox: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px 12px', alignItems: 'end', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, margin: '0 0 10px' }
export const field: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }
export const fieldWide: CSSProperties = { ...field, gridColumn: 'span 2' }
export const label: CSSProperties = { fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600 }
export const ctl: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '5px 8px', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-base)', width: '100%', minWidth: 0, boxSizing: 'border-box' }
export const ctlMoney: CSSProperties = { ...ctl, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }
export const sendLine: CSSProperties = { gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 6, borderTop: '1px dashed var(--border)', flexWrap: 'wrap' }
export const sendNote: CSSProperties = { marginRight: 'auto', fontSize: '0.74rem', color: 'var(--text-muted)' }
export const problem: CSSProperties = { marginRight: 'auto', fontSize: '0.74rem', color: 'var(--text-amber-800)', fontWeight: 600 }

export const expandedRow: CSSProperties = { background: 'var(--bg-blue-tint)' }
export const handledRow: CSSProperties = { background: 'var(--bg-green-tint)', color: 'var(--text-muted)' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "Sep 8" from YYYY-MM-DD (day math only). */
export function shortDay(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '—'
  const [, m, d] = ymd.split('-').map(Number)
  return `${MONTHS[(m ?? 1) - 1]} ${d}`
}
export function spanLabel(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return start ? `from ${shortDay(start)}` : end ? `by ${shortDay(end)}` : '—'
  return start === end ? shortDay(start) : `${shortDay(start)} – ${shortDay(end)}`
}
export const money = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const telHref = (phone: string | null | undefined): string | null => {
  const digits = (phone ?? '').replace(/[^\d+]/g, '')
  return digits.length >= 7 ? `tel:${digits}` : null
}
