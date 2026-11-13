import type { CSSProperties } from 'react'
import { X } from 'lucide-react'

/**
 * A window's close press (v2.7019 on the Payment forecast window, shared since the billed-money windows took it):
 * the library's X in a 32 px square on the desk and a 44 px press at 640 px and under, with the muted fill on hover
 * and a ring on keyboard focus. The looks are `.windowClose` in `src/index.css`, because hover and focus need a class.
 *
 * `label` is the press's accessible name. It stays *Close* unless the window already names its own, so a test or a
 * screen reader finds the press by the words it had before.
 */
export default function WindowCloseButton({
  onClose,
  label = 'Close',
  style,
}: {
  onClose: () => void
  label?: string
  /** Placement only (a margin that pushes the press to the header's end); the looks stay in the class. */
  style?: CSSProperties
}) {
  return (
    <button type="button" className="windowClose" onClick={onClose} aria-label={label} style={style}>
      <X size={18} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
