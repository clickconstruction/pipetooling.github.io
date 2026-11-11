/** The pill a Materials press wears (`components/materials/MaterialsPress.tsx` draws its glyph). */
import type { CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../deadPress'

/** The pill. `height` is 30 beside the strip's tabs and 32 beside the desk's filter chips, so each sits level with its row. */
export const materialsPressStyle = (height = 30): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', minHeight: height, padding: '0 0.7rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', flex: '0 0 auto', whiteSpace: 'nowrap' })

/** A press with nothing to act on: the grey pair every dead press wears. */
export const materialsPressDead: CSSProperties = { background: DEAD_PRESS_FILL, borderColor: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' }
