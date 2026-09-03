// The tag chip every Banking / Review / Job Summary surface draws for a
// bank-category tag: icon + name in the tag's color family. Colors are the
// six theme families; tints are mixed from the ink so both themes hold.

import type { CSSProperties } from 'react'
import { CATEGORY_TAG_INK, type CategoryTagColor, type CategoryTagRow } from '../../lib/banking/categoryTags'

export function categoryTagChipStyle(color: CategoryTagColor, opts?: { selected?: boolean; muted?: boolean }): CSSProperties {
  const ink = CATEGORY_TAG_INK[color]
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '2px 9px 2px 7px',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    color: `color-mix(in srgb, ${ink} 82%, var(--text-strong))`,
    background: `color-mix(in srgb, ${ink} 12%, var(--surface))`,
    border: `1px solid color-mix(in srgb, ${ink} 38%, var(--surface))`,
    opacity: opts?.muted ? 0.55 : 1,
    boxShadow: opts?.selected ? `0 0 0 2px var(--surface), 0 0 0 4px ${ink}` : undefined,
  }
}

export function CategoryTagChip({
  tag,
  count,
  selected,
  muted,
  onClick,
  title,
}: {
  tag: Pick<CategoryTagRow, 'name' | 'icon' | 'color'>
  /** Optional trailing count ("· 12"). */
  count?: number
  selected?: boolean
  muted?: boolean
  onClick?: () => void
  title?: string
}) {
  const style = categoryTagChipStyle(tag.color, { selected, muted })
  const inner = (
    <>
      <span aria-hidden="true" style={{ fontSize: '0.8rem', lineHeight: 1 }}>{tag.icon}</span>
      {tag.name}
      {count != null && <span style={{ opacity: 0.75, fontWeight: 500 }}>· {count}</span>}
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={selected} title={title} style={{ ...style, cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', fontWeight: 600 }}>
        {inner}
      </button>
    )
  }
  return (
    <span style={style} title={title}>
      {inner}
    </span>
  )
}
