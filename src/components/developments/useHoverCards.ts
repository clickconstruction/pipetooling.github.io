/**
 * The hover-card mechanics the head's count tiles and the *not in it* line's chips share (punch list
 * #208, design spike): a beat before a card shows and a beat after the pointer leaves, so the pointer
 * can cross into the card and press a row; a press pins the card until Escape or a press elsewhere,
 * and a second press on the same trigger lets go; on a phone nothing hovers and the press is the only
 * way in. `wrapRef` goes on the element that holds the triggers, their cards and the phone's sheet, so
 * a press inside any of them is not "elsewhere".
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick'

const LEAVE_MS = 260
const ENTER_MS = 120

export function useHoverCards<K extends string>(phone: boolean) {
  const [open, setOpen] = useState<K | null>(null)
  const [pinned, setPinned] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const enterTimer = useRef<number | null>(null)
  const leaveTimer = useRef<number | null>(null)
  const clearTimers = useCallback(() => {
    if (enterTimer.current) window.clearTimeout(enterTimer.current)
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    enterTimer.current = null
    leaveTimer.current = null
  }, [])
  const close = useCallback(() => {
    clearTimers()
    setOpen(null)
    setPinned(false)
  }, [clearTimers])
  // A press elsewhere, or Escape, closes.
  useCloseOnOutsideClick(wrapRef, open !== null, close)
  useEffect(() => clearTimers, [clearTimers])

  // Hover: a beat before the card shows, a beat after the pointer leaves, nothing while pinned or on a phone.
  const hover = (key: K) => {
    if (phone || pinned) return
    clearTimers()
    enterTimer.current = window.setTimeout(() => setOpen(key), ENTER_MS)
  }
  const leave = () => {
    if (phone || pinned) return
    clearTimers()
    leaveTimer.current = window.setTimeout(() => setOpen(null), LEAVE_MS)
  }
  const stay = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
    leaveTimer.current = null
  }
  // A press pins the card (and on a phone is the only way in); a second press on the same trigger lets go.
  const press = (key: K) => {
    clearTimers()
    if (open === key && pinned) {
      close()
      return
    }
    setOpen(key)
    setPinned(true)
  }
  // A row or foot pressed: the card closes, then the door opens.
  const act = (fn: () => void) => {
    close()
    fn()
  }
  return { open, pinned, wrapRef, hover, leave, stay, press, act, close }
}
