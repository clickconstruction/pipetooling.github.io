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
 *
 * With no signal (v2.6628, the pattern of v2.6370): a shot whose send is lost to the signal is kept on the phone, its
 * bytes in the outbox's store and its facts on a `task-photo` press, so it goes to the card when the signal is back
 * (the replay sends the row, the landing ties it to its line, the strip hears it). The sheet's tile then reads *Kept on
 * the phone* and the percent or the finish is tried as it is today; a refusal, or a phone with nowhere to keep the
 * bytes, shows its reason as before. An impersonation keeps nothing, as no press of its does.
 */
import { createElement, useCallback, useState, type ReactNode } from 'react'
import { TaskFinishSheet } from '../components/checklist/TaskFinishSheet'
import { TaskPercentSheet } from '../components/checklist/TaskPercentSheet'
import { getCurrentUserName } from '../lib/getCurrentUserName'
import { isImpersonationSessionActive } from '../lib/impersonationSession'
import { keptPhotos } from '../lib/offline/keptPhotos'
import type { KeptTaskPhoto } from '../lib/offline/outbox'
import { pressThroughOutbox } from '../lib/offline/pressThroughOutbox'
import { sendLostSignal } from '../lib/photos/shotTiles'
import { sendTaskPhoto, type TaskPhotoRow } from '../lib/photos/taskPhotosIo'
import { isLastOpenLine, type LineState } from '../lib/taskCriteria'
import { ringState, type RingState } from '../lib/taskProgress'
import { announceTaskPhotos, type TaskPhotoKind } from '../lib/taskPhotos'
import type { TaskShot } from './useTaskShot'
import { formatErrorMessage } from '../utils/errorHandling'

import type { SheetPressOutcome } from '../lib/taskSheetPress'

export type { SheetPressOutcome } from '../lib/taskSheetPress'

/** The name `sendTaskPhoto` throws its failures under; its `network` kind is the phone with no signal. */
const SEND_ERROR_NAME = 'PhotoSendError'

/** Where a kept press's Fix opens: Checklist → Today, where the card is. */
export const TASK_PHOTO_DOOR = '/checklist'

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

/** What a send came to: the row, live; or the shot kept on the phone for the outbox. */
type SendOutcome = { kind: 'sent'; row: TaskPhotoRow } | { kind: 'kept' }

/** The press's facts for a shot kept with no signal: what `sendTaskPhoto` would have written, under the shot's own id. */
export function keptTaskPhotoOf(shot: TaskShot, a: { kind: TaskPhotoKind; percentAt: number | null; criterionId: string | null; lineBody: string | null; byName: string }): KeptTaskPhoto {
  return { id: shot.id, sent: false, kind: a.kind, percentAt: a.percentAt, criterionId: a.criterionId, lineBody: a.lineBody, takenAt: shot.takenAt, bytes: shot.blob.size, originalBytes: shot.originalBytes, width: shot.width, height: shot.height, byName: a.byName }
}

export function useTaskCardSheets(a: TaskCardSheetsInput): TaskCardSheets {
  const [percentOpen, setPercentOpen] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ticked = a.lines.filter((l) => l.checked).length
  const ring = ringState({ completedAt: a.isCompleted ? 'done' : null, percentComplete: a.percentComplete, lines: a.lines.length, ticked })

  const send = useCallback(
    async (shot: TaskShot, kind: TaskPhotoKind, percentAt: number | null, criterionId: string | null): Promise<SendOutcome> => {
      if (!a.currentUserId) throw new Error('Sign in to add a photo.')
      const userId = a.currentUserId
      const line = criterionId ? a.lines.find((l) => l.criterion.id === criterionId)?.criterion.body ?? null : null
      let byName = ''
      try {
        byName = await getCurrentUserName(userId)
      } catch {
        // the name read is one more request a dead signal loses; the send below says so and the kept row carries no name
      }
      try {
        const row = await sendTaskPhoto({
          id: shot.id,
          instanceId: a.instanceId,
          blob: shot.blob,
          kind,
          percentAt,
          criterionId,
          lineBody: line,
          byUserId: userId,
          byName,
          takenAt: shot.takenAt,
          originalBytes: shot.originalBytes,
          width: shot.width,
          height: shot.height,
        })
        a.onPhotoAdded?.(row)
        announceTaskPhotos([row.id])
        return { kind: 'sent', row }
      } catch (e) {
        // Lost to the signal: keep the bytes and the facts, and the replay sends them when it is back (v2.6628).
        if (!sendLostSignal(e, SEND_ERROR_NAME) || isImpersonationSessionActive()) throw e
        const held = await keptPhotos.keep(shot.id, shot.blob)
        if (!held) throw e
        const photo = keptTaskPhotoOf(shot, { kind, percentAt, criterionId, lineBody: line, byName })
        const outcome = await pressThroughOutbox({ kind: 'task-photo', userId, pressedAt: Date.now(), payload: { instanceId: a.instanceId, photos: [photo] }, about: a.title, door: TASK_PHOTO_DOOR }, { forceQueue: true })
        if (outcome.kind !== 'queued') {
          void keptPhotos.drop([shot.id])
          throw e
        }
        return { kind: 'kept' }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.currentUserId, a.instanceId, a.lines, a.onPhotoAdded, a.title],
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
    async (percent: number, words: string, shot: TaskShot | null): Promise<SheetPressOutcome> => {
      let shotKept = false
      try {
        if (shot) shotKept = (await send(shot, 'progress', percent, null)).kind === 'kept'
        const ok = a.onSetPercent ? await a.onSetPercent(percent, words) : false
        return { ok, shotKept }
      } catch (e) {
        setError(formatErrorMessage(e, 'The photo did not send.'))
        return { ok: false, shotKept }
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
    async (shot: TaskShot | null, reason: string): Promise<SheetPressOutcome> => {
      const p = pending
      if (!p) return { ok: false }
      let shotKept = false
      try {
        if (shot) shotKept = (await send(shot, 'finish', null, p.kind === 'line' ? p.criterionId : null)).kind === 'kept'
        else if (reason && a.onPostComment) await a.onPostComment(`No finishing photo: ${reason}`)
        if (p.kind === 'line') await a.onTickLine?.(p.criterionId, true)
        else await a.onToggleComplete()
        return { ok: true, shotKept }
      } catch (e) {
        setError(formatErrorMessage(e, 'The photo did not send.'))
        return { ok: false, shotKept }
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
