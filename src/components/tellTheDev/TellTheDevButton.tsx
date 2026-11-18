/**
 * Tell the dev (punch list #380): the small wrench a header or a window's title row carries. It
 * asks; the root, mounted once in the shell, reads the page and draws the box. In a file of its
 * own so the shared window can draw it without importing the root, which draws that window.
 */
import type { CSSProperties } from 'react'
import { Wrench } from 'lucide-react'
import type { NoteDoor } from '../../lib/tellTheDev/noteContext'
import { requestTellTheDev } from '../../lib/tellTheDev/openBox'

export function TellTheDevButton({ door, size = 20, style }: { door: NoteDoor; size?: number; style?: CSSProperties }) {
  return (
    <button
      type="button"
      title="Tell the dev about this page"
      aria-label="Tell the dev"
      aria-haspopup="dialog"
      onClick={(e) => {
        // A press in a window's title row is not a press on that window.
        e.stopPropagation()
        requestTellTheDev({ door })
      }}
      style={{ display: 'inline-flex', alignItems: 'center', padding: '0.5rem', color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, ...style }}
    >
      <Wrench size={size} strokeWidth={2.25} aria-hidden />
    </button>
  )
}
