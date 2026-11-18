import type { CSSProperties } from 'react'
import { useOptionalAuth } from '../hooks/useAuth'
import { useMyNoteTags } from '../hooks/useMyNoteTags'
import { canTagInJobNotes, myTagsView, tagsOfKind, type TagKinds } from '../lib/jobs/noteTags'
import { NAV_BADGE_STYLE, navBadgeWords } from '../lib/navBadgeStyle'

/**
 * Checklist in the header (punch list #375): the count on its link, drawn as the Jobs count is.
 * It is the reader's own number: the task notes that tagged them and still wait, plus the answers
 * to their own task tags they have not seen. Nothing shows at zero or while the read fails.
 *
 * `kinds` is `both` in Task Mode, where Checklist is the only page and holds job tags too.
 * `style` moves the pill, for the icon link and the phone's menu.
 */
export function ChecklistTagsBadge({ kinds = 'task', style }: { kinds?: TagKinds; style?: CSSProperties }) {
  const role = useOptionalAuth()?.role ?? null
  const { tags } = useMyNoteTags(canTagInJobNotes(role))
  const count = tags ? myTagsView(tagsOfKind(tags, kinds)).count : 0
  if (!count) return null
  return (
    <span
      data-checklist-tags-badge
      aria-label={`${count} tagged ${kinds === 'task' ? 'task ' : ''}${count === 1 ? 'note waits' : 'notes wait'} on you`}
      style={style ? { ...NAV_BADGE_STYLE, ...style } : NAV_BADGE_STYLE}
    >
      {navBadgeWords(count)}
    </span>
  )
}
