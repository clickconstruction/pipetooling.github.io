import { useRef, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react'
import { lookAllowsPress, lookIsField, lookKeyPresses } from '../../lib/tasks/taskLook'

/**
 * The box a look at another person's Task Mode is drawn in (punch list #381). Every press inside it is stopped before
 * the press's own code hears it, unless the press only opens or folds something (`lookAllowsPress`). A box to type in
 * never keeps the keyboard. The stop is on the way down to the press, so it also covers a sheet a press would draw
 * elsewhere on the page.
 *
 * Whatever is drawn inside looks as it does for the person whose screen it is. That is the point of the look, and it
 * is why the stop lives here and not in each press.
 */
export function TaskLookGate({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const stop = (e: SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const onPress = (e: SyntheticEvent) => {
    const root = ref.current
    if (!root || !lookAllowsPress(e.target instanceof Element ? e.target : null, root)) stop(e)
  }
  const onKey = (e: KeyboardEvent) => {
    const target = e.target instanceof Element ? e.target : null
    // Tab and Escape still move the person around the page from a box that took the keyboard.
    if (lookIsField(target)) {
      if (e.key !== 'Tab' && e.key !== 'Escape') stop(e)
      return
    }
    if (lookKeyPresses(e.key)) onPress(e)
  }
  return (
    <div
      ref={ref}
      data-task-look
      onClickCapture={onPress}
      onDoubleClickCapture={onPress}
      onKeyDownCapture={onKey}
      onSubmitCapture={stop}
      onChangeCapture={stop}
      onPasteCapture={stop}
      onDropCapture={stop}
      onFocusCapture={(e) => {
        if (lookIsField(e.target) && e.target instanceof HTMLElement) e.target.blur()
      }}
    >
      {children}
    </div>
  )
}
