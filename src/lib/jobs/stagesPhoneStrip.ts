import type { CSSProperties } from 'react'

/**
 * The phone Pipeline's head (`JobsStagesPhoneStrip`): the white band that pins the stage chips
 * (Waiting · Working · Ready · Billed · Coll.) and the All / Needs me / Today row under it.
 *
 * The band is a flex item of the phone board's column. It used to bleed past its column with
 * `margin: 0 -0.25rem`, and nothing held it to the column's width, so the chip row's full
 * width could set it: on a phone the band ran past the right edge while the cards under it
 * kept their gutter. Now the band is exactly its column's width, and the chips scroll inside it.
 * Pure styles, so a test can hold the rule without a browser.
 */
export function stagesPhoneBandStyle(top: number): CSSProperties {
  return {
    position: 'sticky',
    top,
    zIndex: 19,
    background: 'var(--surface)',
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    padding: '0.35rem 0 0.4rem',
    borderBottom: '1px solid var(--border)',
  }
}

/**
 * The stage chips: one line that slides sideways inside the band, never wider than it.
 * `contain: inline-size` keeps the row's full width out of every width worked out above it, so no
 * ancestor that sizes to its content (a flex item, a shrink-to-fit box) can be floored by the chips.
 */
export const STAGES_PHONE_CHIP_ROW_STYLE: CSSProperties = {
  display: 'flex',
  contain: 'inline-size',
  gap: '0.35rem',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  overscrollBehaviorX: 'contain',
  minWidth: 0,
  maxWidth: '100%',
  paddingBottom: 2,
}

/** The All / Needs me / Today row: it wraps rather than push the band wider. */
export const STAGES_PHONE_FILTER_ROW_STYLE: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.35rem',
  minWidth: 0,
  marginTop: '0.4rem',
}
