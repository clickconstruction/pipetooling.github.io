import { useLayoutEffect, useState, type RefObject } from 'react'
import type { LienDoNowRoom } from '../../lib/jobs/lienDoNowFrame'

const UNMEASURED: LienDoNowRoom = { frame: null, board: null, bar: null }

const same = (a: LienDoNowRoom, b: LienDoNowRoom) => a.frame === b.frame && a.board === b.board && a.bar === b.bar

/**
 * The heights of the Lien desk's To do parts, measured (v2.7367, punch list #362, step 1): the frame, the Board
 * and the find box's bar inside it, read before the paint and again whenever the frame or the Board changes
 * size. `lienDoNowFrame` turns them into the frame's mode. Unmeasured (the view is not on screen, the Board has
 * not drawn, or a test's DOM has no layout) every height is null and the desk stays as it was.
 *
 * The mode does not move what is measured: the frame fills the same space either way and the Board is as tall
 * in one as in the other, so a reading never flips the mode back.
 */
export function useLienDoNowRoom(frameRef: RefObject<HTMLElement | null>, active: boolean): LienDoNowRoom {
  const [room, setRoom] = useState<LienDoNowRoom>(UNMEASURED)
  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!active || !frame) {
      setRoom((prev) => (same(prev, UNMEASURED) ? prev : UNMEASURED))
      return
    }
    const board = frame.querySelector<HTMLElement>('[data-lien-board]')
    const measure = () => {
      const bar = frame.querySelector<HTMLElement>('[data-lien-do-now-bar]')
      const next: LienDoNowRoom = { frame: frame.clientHeight || null, board: board?.offsetHeight || null, bar: bar?.offsetHeight || null }
      setRoom((prev) => (same(prev, next) ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(frame)
    if (board) ro.observe(board)
    return () => ro.disconnect()
  }, [frameRef, active])
  return room
}
