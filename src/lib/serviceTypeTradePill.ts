import type { CSSProperties } from 'react'
import { getBidServiceTypeTag } from '../utils/unifiedJobBidSearch'

const serviceTypeTradePillBoxBase: CSSProperties = {
  display: 'inline-block',
  boxSizing: 'border-box',
  padding: '0.15rem 0.4rem',
  fontSize: '0.6875rem',
  fontWeight: 600,
  lineHeight: 1.2,
  borderRadius: 4,
  fontFamily: 'inherit',
}

/**
 * Uppercase trade pill matching Jobs page Stages board job subline (PLUM / ELEC / HVAC).
 */
export function buildServiceTypeTradePill(
  serviceTypeName: string | null | undefined,
): { label: string; style: CSSProperties } | null {
  const stName = serviceTypeName?.trim()
  if (!stName) return null

  const tagInfo = getBidServiceTypeTag(stName)
  const label = (tagInfo?.tag ?? stName.slice(0, 4)).toUpperCase()
  const borderColor = tagInfo?.color ?? '#d1d5db'

  return {
    label,
    style: {
      ...serviceTypeTradePillBoxBase,
      marginTop: '0.15rem',
      letterSpacing: '0.02em',
      border: `1px solid ${borderColor}`,
      background: tagInfo ? borderColor : '#f3f4f6',
      color: tagInfo ? '#fff' : '#374151',
    },
  }
}
