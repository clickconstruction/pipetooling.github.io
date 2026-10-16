import type { ReactNode } from 'react'
import type { TrainingColour } from '../../lib/training/trainingState'

const CHIP_TONES: Record<TrainingColour | 'blue' | 'gray', { background: string; color: string }> = {
  red: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' },
  amber: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  green: { background: 'var(--bg-green-100)', color: 'var(--text-green-800)' },
  blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
  gray: { background: 'var(--bg-subtle)', color: 'var(--text-muted)' },
}

/** The small state chip Training draws everywhere (punch list #111): the three colours, plus blue for progress and gray for a fact. */
export function Chip({ tone, children, title }: { tone: TrainingColour | 'blue' | 'gray'; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        padding: '0.1rem 0.6rem',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        ...CHIP_TONES[tone],
      }}
    >
      {children}
    </span>
  )
}
