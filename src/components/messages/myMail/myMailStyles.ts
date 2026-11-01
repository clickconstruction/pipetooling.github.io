/**
 * Messages → My email (punch list #230 PR 3): the looks the tab's parts share, in the theme's tokens: a job's chip (a
 * bid amber, a job blue, a tagged conversation green) and the muted small words.
 */
import type { CSSProperties } from 'react'
import type { MyMailJobChip } from '../../../lib/myMail/contract'

/** A job's chip: a bid amber, a job blue, a tagged one green. */
export function chipStyle(chip: Pick<MyMailJobChip, 'kind'> | null, done = false): CSSProperties {
  const [background, color] = done
    ? ['var(--bg-green-tint)', 'var(--text-green-700)']
    : chip?.kind === 'bid'
      ? ['var(--bg-amber-tint)', 'var(--text-amber-800)']
      : ['var(--bg-blue-tint)', 'var(--text-blue-700)']
  return { fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 6, background, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }
}

export const mutedSmall: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.75rem' }

export const oneLine: CSSProperties = { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
