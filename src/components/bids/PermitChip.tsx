import type { CSSProperties } from 'react'
import type { Chip } from '../../lib/research/bidSitePanel'

/** One chip of the bid's permit lines (punch list #307): a few words on a tint, in the app's tokens. */
const CHIP_TONES: Record<Chip['tone'], CSSProperties> = {
  green: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  amber: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  red: { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
  grey: { background: 'var(--bg-200)', color: 'var(--text-700)' },
  blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
}

export function PermitChip({ chip }: { chip: Chip }) {
  return <span style={{ display: 'inline-block', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', ...CHIP_TONES[chip.tone] }}>{chip.words}</span>
}
