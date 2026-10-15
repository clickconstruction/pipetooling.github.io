/**
 * Messages, cut 5's wait line (v2.5538): what the Text tab and the send window draw while Send texts reads off. For the
 * owner or a dev, who can flip the switch (`canSwitchTexts`), the page's name is a link to it (`TEXTS_WAIT_HREF`), so
 * the switch is one press from the box that waits on it, and the words say it is the first card and nothing else there
 * is needed first. Anyone else reads who turns it on (`TEXTS_WAIT_OTHERS`). The words are `replyIo.ts`'s.
 */
import { Link } from 'react-router-dom'
import { useOptionalAuth } from '../../../../hooks/useAuth'
import { TEXTS_WAIT_HREF, TEXTS_WAIT_OTHERS, TEXTS_WAIT_PARTS } from '../../../../lib/messages/replyIo'
import { canSwitchTexts } from '../../../../lib/quo/textsSwitch'

export function TextsWaitLine() {
  const role = useOptionalAuth()?.role
  if (!canSwitchTexts(role)) return <>{TEXTS_WAIT_OTHERS}</>
  return (
    <>
      {TEXTS_WAIT_PARTS.before}
      <Link to={TEXTS_WAIT_HREF} data-texts-wait-link style={{ color: 'inherit', fontWeight: 600 }}>
        {TEXTS_WAIT_PARTS.link}
      </Link>
      {TEXTS_WAIT_PARTS.after}
    </>
  )
}
