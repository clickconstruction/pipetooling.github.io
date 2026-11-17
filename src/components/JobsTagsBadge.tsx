import { useOptionalAuth } from '../hooks/useAuth'
import { useMyNoteTags } from '../hooks/useMyNoteTags'
import { canTagInJobNotes, myTagsView, tagsOfKind } from '../lib/jobs/noteTags'
import { NAV_BADGE_STYLE, navBadgeWords } from '../lib/navBadgeStyle'

/**
 * Jobs in the header (punch list #363): the count on its link, drawn as the Messages count is.
 * It is the reader's own number: the job notes that tagged them and still wait, plus the answers
 * to their own tags they have not seen. Nothing shows at zero or while the read fails.
 *
 * `onMenuButton` is the same pill on the phone's menu button, so it is seen with the menu shut.
 */
export function JobsTagsBadge({ onMenuButton = false }: { onMenuButton?: boolean }) {
  const role = useOptionalAuth()?.role ?? null
  const { tags } = useMyNoteTags(canTagInJobNotes(role))
  // Job notes alone: a task note's tag counts on Checklist (punch list #375).
  const count = tags ? myTagsView(tagsOfKind(tags, 'job')).count : 0
  if (!count) return null
  return (
    <span
      data-jobs-tags-badge
      aria-label={`${count} tagged job ${count === 1 ? 'note waits' : 'notes wait'} on you`}
      style={onMenuButton ? { ...NAV_BADGE_STYLE, top: 0, right: 0 } : NAV_BADGE_STYLE}
    >
      {navBadgeWords(count)}
    </span>
  )
}
