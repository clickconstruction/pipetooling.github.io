/**
 * Tell the dev (punch list #380): the small wrench a header or a window's title row carries. It
 * asks; the root, mounted once in the shell, reads the page and draws the box. In a file of its
 * own so the shared window can draw it without importing the root, which draws that window.
 */
import type { CSSProperties } from 'react'
import { Wrench } from 'lucide-react'
import type { NoteDoor } from '../../lib/tellTheDev/noteContext'
import { requestTellTheDev } from '../../lib/tellTheDev/openBox'
import { useUnreadDevAnswers } from '../../hooks/useUnreadDevAnswers'

/** The dot a wrench wears while an answer to one of this person's notes is unread. */
export function AnswerDot({ ring }: { ring: string }) {
  return <span aria-hidden style={{ position: 'absolute', top: 3, right: 3, width: 10, height: 10, borderRadius: 999, background: '#22c55e', border: `2px solid ${ring}`, boxSizing: 'border-box' }} />
}

export function TellTheDevButton({ door, size = 20, style, withDot = false }: { door: NoteDoor; size?: number; style?: CSSProperties; withDot?: boolean }) {
  const unread = useUnreadDevAnswers()
  const dot = withDot && unread > 0
  return (
    <button
      type="button"
      title={dot ? 'The dev answered your note' : 'Tell the dev about this page'}
      aria-label={dot ? 'Tell the dev. An answer is waiting.' : 'Tell the dev'}
      aria-haspopup="dialog"
      onClick={(e) => {
        // A press in a window's title row is not a press on that window.
        e.stopPropagation()
        requestTellTheDev({ door })
      }}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', padding: '0.5rem', color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, ...style }}
    >
      <Wrench size={size} strokeWidth={2.25} aria-hidden />
      {dot ? <AnswerDot ring="var(--surface)" /> : null}
    </button>
  )
}
