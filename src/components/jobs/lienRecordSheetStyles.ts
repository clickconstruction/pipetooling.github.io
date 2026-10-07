import type { CSSProperties } from 'react'

/** A field on a phone's record sheet (v2.4414): full width, 48 px tall, and 16 px type, because an iPhone zooms the page on a field whose text is smaller. */
export const recordSheetField: CSSProperties = { display: 'block', width: '100%', minWidth: 0, height: 48, boxSizing: 'border-box', padding: '0 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '1rem', background: 'var(--surface)', color: 'var(--text-base)' }

/** A row to tick on a record sheet: the whole row is the target, 48 px tall. */
export const recordSheetTick: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, boxSizing: 'border-box', padding: '0.35rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', fontSize: '0.9375rem', lineHeight: 1.3, cursor: 'pointer' }

/** The name over a field on a record sheet. */
export const recordSheetLabel: CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }
