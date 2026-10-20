import type { CSSProperties } from 'react'
import type { ReplyKind } from '../../../../lib/messages/compose'

/** Text blue, Email white, Note yellow: the thread's own colours for each, so the box reads as the line it becomes. */
export const KIND_LOOK: Record<ReplyKind, CSSProperties> = {
  text: { background: 'var(--bg-blue-tint)', borderColor: 'var(--border-blue)', color: 'var(--text-blue-800)' },
  email: { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-base)' },
  note: { background: 'var(--bg-yellow-tint)', borderColor: 'var(--border-amber-soft)', color: 'var(--text-base)' },
}

/** The chosen kind wears the orange ring. */
export const RING: CSSProperties = { boxShadow: '0 0 0 3px var(--border-orange)', borderColor: 'var(--border-orange)', fontWeight: 600 }

/**
 * A text or an email to the job's customer, in the job window: orange is the customer's there (the owner, 2026-10-12).
 * The tint and the bar are cut 10's `customerOut` in Job activity, so the box reads as the line it becomes in the feed.
 */
export const CUSTOMER_LOOK: CSSProperties = {
  background: 'var(--bg-orange-tint)',
  borderColor: 'var(--border-orange)',
  color: 'var(--text-base)',
}

/** Its bar, set after the box's own `border` so the shorthand does not take it away. */
export const CUSTOMER_BAR: CSSProperties = { borderLeft: '3px solid var(--border-orange)' }
