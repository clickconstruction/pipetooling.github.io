import type { CSSProperties } from 'react'

/** Mobile-only: tight white badge behind dispatch person labels so the sticky column can stay transparent. */
export const scheduleDispatchMobileNamePill: CSSProperties = {
  display: 'inline-block',
  background: '#fff',
  padding: '2px 8px',
  borderRadius: 6,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
}
