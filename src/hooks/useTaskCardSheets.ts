/**
 * Task cards: the sheets a card opens (punch list #273, PR 4b). One place for the ring's press, the tick that brings the
 * finish, and the photo each sends, shared by the card and Today's Outstanding rows:
 *
 * - the ring on an open card opens the % sheet (a done ring reopens the card);
 * - Set on the % sheet sends the shot taken there as a `progress` photo at that percent, then sets the percent;
 * - Done on the % sheet finishes the card, or opens the finishing sheet when the card asks for a photo;
 * - the tick on the last open Done when… line opens the finishing sheet on a card that asks, else ticks at once;
 * - the finishing sheet's Done sends the `finish` photo (on the line it proves, when a line brought it), posts the typed
 *   reason as a note when there is no photo, then ticks the line or finishes the card the way the tick box did.
 *
 * A send that fails keeps the sheet open with the reason; the percent or the finish is never written without it.
 */
import { createElement, useCallback, useState, type ReactNode } from 'react'
import { TaskFinishSheet } from '../components/checklist/TaskFinishSheet'
import { TaskPercentSheet } from '../components/checklist/TaskPercentSheet'
import { getCurrentUserName } from '../lib/getCurrentUserName'
import { sendTaskPhoto, type TaskPhotoRow } from '../lib/photos/taskPhotosIo'
import { isLastOpenLine, type LineState } from '../lib/taskCriteria'
import { ringState, type RingState } from '../lib/taskProgress'
import type { TaskPhotoKind } from '../lib/taskPhotos'
import { TASK_PHOTO_ADDED_EVENT } from './useTaskPhotos'
import type { TaskShot } from './useTaskShot'
import { formatErrorMessage } from '../utils/errorHandling'

export type TaskCardSheetsInput = {
  instanceId: string
  title: string
  lines: LineState[]
  asksForPhoto: boolean
  isCompleted: boolean
  percentComplete: number | null | undefined
  /** *was 50% Tue 3:12 PM*, for the % sheet. */
  lastMoved?: string | null
  currentUserId: string | null
  onTickLine?: (criterionId: string, ticked: boolean) => void | Promise<void>
  onToggleComplete: () => void | Promise<void>
  onSetPercent?: (percent: number, words: string) => Promise<boolean>
  onPostComment?: (body: string) => Promise<boolean>
  onPhotoAdded?: (row: TaskPhotoRow) => void
}

export type TaskCardSheets = {
  ringPress: () => void
  tickLine: (criterionId: string, ticked: boolean) => Promise<void>
  ring: RingState
  sheets: ReactNode
  error: string | null
}

type Pending = { kind: 'done' } | { kind: 'line'; criterionId: string }

export function useTaskCardSheets(a: TaskCardSheetsInput): TaskCardSheets {
  const [percentOpen, setPercentOpen] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ticked = a.lines.filter((l) => l.checked).length
  const ring = ringState({ completedAt: a.isCompleted ? 'done' : null, percentComplete: a.percentComplete, lines: a.lines.length, ticked })

  const send = useCallback(
    async (shot: TaskShot, kind: TaskPhotoKind, percentAt: number | null, criterionId: string | null): Promise<TaskPhotoRow> => {
      if (!a.currentUserId) throw new Error('Sign in to add a photo.')
      const byName = await getCurrentUserName(a.currentUserId)
      const line = criterionId ? a.lines.find((l) => l.criterion.id === criterionId)?.criterion.body ?? null : null
      const row = await sendTaskPhoto({
        instanceId: a.instanceId,
        blob: shot.blob,
        kind,
        percentAt,
        criterionId,
        lineBody: line,
        byUserId: a.currentUserId,
        byName,
        takenAt: shot.takenAt,
        originalBytes: shot.originalBytes,
        width: shot.width,
        height: shot.height,
      })
      a.onPhotoAdded?.(row)
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(TASK_PHOTO_ADDED_EVENT, { detail: row.id }))
      return row
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.currentUserId, a.instanceId, a.lines, a.onPhotoAdded],
  )

  const ringPress = useCallback(() => {
    if (a.isCompleted) {
      void a.onToggleComplete()
      return
    }
    setError(null)
    setPercentOpen(true)
  }, [a])

  const tickLine = useCallback(
    async (criterionId: string, tickedNow: boolean) => {
      if (tickedNow && a.asksForPhoto && isLastOpenLine(a.lines, criterionId)) {
        setError(null)
        setPending({ kind: 'line', criterionId })
        return
      }
      await a.onTickLine?.(criterionId, tickedNow)
    },
    [a],
  )

  const onSet = useCallback(
    async (percent: number, words: string, shot: TaskShot | null): Promise<boolean> => {
      try {
        if (shot) await send(shot, 'progress', percent, null)
        return a.onSetPercent ? await a.onSetPercent(percent, words) : false
      } catch (e) {
        setError(formatErrorMessage(e, 'The photo did not send.'))
        return false
      }
    },
    [a, send],
  )

  const onPercentDone = useCallback(async () => {
    if (a.asksForPhoto) {
      setPercentOpen(false)
      setPending({ kind: 'done' })
      return
    }
    await a.onToggleComplete()
  }, [a])

  const onFinish = useCallback(
    async (shot: TaskShot | null, reason: string): Promise<boolean> => {
      const p = pending
      if (!p) return false
      try {
        if (shot) await send(shot, 'finish', null, p.kind === 'line' ? p.criterionId : null)
        else if (reason && a.onPostComment) await a.onPostComment(`No finishing photo: ${reason}`)
        if (p.kind === 'line') await a.onTickLine?.(p.criterionId, true)
        else await a.onToggleComplete()
        return true
      } catch (e) {
        setError(formatErrorMessage(e, 'The photo did not send.'))
        return false
      }
    },
    [a, pending, send],
  )

  const sheets = createElement(
    'span',
    { 'data-task-card-sheets': a.instanceId },
    createElement(TaskPercentSheet, {
      open: percentOpen,
      title: a.title,
      state: ring,
      lastMoved: a.lastMoved ?? null,
      onSet,
      onDone: onPercentDone,
      onClose: () => setPercentOpen(false),
      withPhoto: true,
      error,
    }),
    createElement(TaskFinishSheet, {
      open: pending !== null,
      title: a.title,
      lines: pending?.kind === 'line' ? { ticked: ticked + 1, total: a.lines.length } : null,
      onDone: onFinish,
      onClose: () => setPending(null),
      error,
    }),
  )

  return { ringPress, tickLine, ring, sheets, error }
}
