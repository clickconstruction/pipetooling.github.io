import type { ReactNode } from 'react'
import type { SearchableSelectOption } from '../SearchableSelect'

/** One height for every one-line entry field and picker in the New project windows (the owner, 2026-10-04: "Each of the entry fields can be the same height"). */
export const FIELD_HEIGHT_PX = 36

/**
 * GC mode design spike: the rows of the New project pickers (`GcNewProjectPickers.tsx`), kept in a
 * file of their own so the pickers file exports only components.
 */

/** A picker row: the name in bold, what it is in a muted line under it. */
export function pickerRow(name: string, under?: string): ReactNode {
  return (
    <span style={{ display: 'grid', gap: '0.05rem', minWidth: 0 }}>
      <strong style={{ fontWeight: 600 }}>{name}</strong>
      {under && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{under}</span>}
    </span>
  )
}

/** The closed picker's face: the name, and what it is after a dot. */
export function pickerFace(name: string, after?: string): ReactNode {
  return (
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      <strong style={{ fontWeight: 600 }}>{name}</strong>
      {after && <span style={{ color: 'var(--text-muted)' }}> · {after}</span>}
    </span>
  )
}

/** A group heading in a picker's list. */
export function pickerGroup(id: string, label: string): SearchableSelectOption {
  return { kind: 'separator', id, label }
}
