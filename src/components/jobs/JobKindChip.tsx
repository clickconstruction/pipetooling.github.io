import type { CSSProperties } from 'react'
import { jobKindChip, type JobKindChipTone, type JobKindRead } from '../../lib/jobs/jobKind'

/**
 * The job's kind as a chip (punch list #238): blue *Project*, green *Service call*, amber *Kind not
 * set* until the office presses one. In the job window's header beside the name and on the
 * Pipeline's rows after the number chip. The hover text is the kernel's reason, so a row explains
 * why it reads as it does. Pure draw; the read comes in.
 */
const TONES: Readonly<Record<JobKindChipTone, CSSProperties>> = {
  project: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)' },
  service: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  unset: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
}

export default function JobKindChip({ read, size = 'md', style }: { read: JobKindRead; size?: 'sm' | 'md'; style?: CSSProperties }) {
  const chip = jobKindChip(read)
  return (
    <span
      data-testid="job-kind-chip"
      data-kind={read.kind ?? 'unset'}
      title={chip.title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: size === 'sm' ? '0 7px' : '0.1rem 0.5rem',
        height: size === 'sm' ? 16 : undefined,
        borderRadius: 999,
        fontSize: size === 'sm' ? '0.64rem' : '0.75rem',
        fontWeight: 700,
        lineHeight: size === 'sm' ? 1 : undefined,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        ...TONES[chip.tone],
        ...style,
      }}
    >
      {chip.label}
    </span>
  )
}
