import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type RefObject } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import { isImpersonationSessionActive } from '../lib/impersonationSession'
import { keptPhotos, type KeptPhotosStore } from '../lib/offline/keptPhotos'
import type { KeptTicketPage } from '../lib/offline/outbox'
import { pressThroughOutbox } from '../lib/offline/pressThroughOutbox'
import { newPhotoId } from '../lib/photos/reportPhotos'
import { EXIF_HEAD_BYTES, takenAtFromBytes } from '../lib/photos/photoTakenAt'
import { sendLostSignal } from '../lib/photos/shotTiles'
import { shrinkReportPhoto } from '../lib/photos/shrink'
import { TICKET_PAGE_MIMES, type TicketPressSource, type TicketTakenAtFrom } from '../lib/tickets/ticket'
import { announceTickets } from '../lib/tickets/ticketEvents'
import { TICKET_SEND_ERROR_NAME, sendTicket, type TicketDraft, type TicketPageDraft } from '../lib/tickets/ticketsIo'

/**
 * A counter ticket from the shutter to its Save (punch list #295, PR 2). The camera comes first and the job after, so
 * unlike a job photo's tiles (`useShotTiles`) nothing is sent when a page is taken: the pages wait in this hook, shrunk
 * on the device to the large size so small print reads, until the sheet's Save names the job. Save sends the row, the
 * pages and the landing in one go; a phone with no signal keeps the pages (`keptPhotos`) and the ticket (`counter-ticket`
 * in the outbox), which the replay sends by itself. A PDF goes as it came.
 *
 * Two hidden inputs, since a phone's camera and its file picker are two doors: `cameraInput` carries `capture`, and
 * `filesInput` takes a photo or a PDF the person already has. On a desk both open the file picker.
 */

/** The bucket's cap, 10 MB a file. */
export const TICKET_PAGE_MAX_BYTES = 10 * 1024 * 1024
export const TICKET_MAX_PAGES = 12

export const TICKET_DOOR = '/tally'

export interface TicketShot {
  id: string
  blob: Blob
  mime: string
  /** An object URL for a picture; null for a PDF. */
  previewUrl: string | null
  fileName: string
  originalBytes: number
  width: number
  height: number
  takenAt: string
  takenAtFrom: TicketTakenAtFrom
  source: TicketPressSource
}

export type TicketInputProps = {
  ref: RefObject<HTMLInputElement>
  type: 'file'
  accept: string
  capture?: 'environment'
  multiple: boolean
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  tabIndex: -1
  'aria-hidden': true
  style: CSSProperties
  'data-testid': string
}

export interface TicketSaveInput {
  /** Who is saving, and whose folder the bytes go under. */
  userId: string
  byName: string
  /** Whose ticket it is when the office saves a paper handed in for someone else (PR 4); the saver by default. */
  takenBy?: string
  takenByName?: string
  /** Where the paper came from: the camera, a file on the phone, or the office's desk. */
  source?: TicketPressSource
  write: { job_id: string | null; also_job_ids: string[]; no_one_job: boolean; po_entry_id: string | null }
  total: number | null
  note: string
  /** What the waiting line names the ticket by: the job's label, or *no job yet*. */
  about: string
}

export type TicketSaveOutcome = { kind: 'sent'; ticketId: string } | { kind: 'kept'; ticketId: string }

export interface TicketCaptureIo {
  send?: (t: TicketDraft, pages: readonly TicketPageDraft[], uploaderId: string) => Promise<void>
  kept?: KeptPhotosStore
  press?: typeof pressThroughOutbox
  shrink?: typeof shrinkReportPhoto
  now?: () => number
}

const HIDDEN: CSSProperties = { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }

/** A picture's kind as the bucket takes it; anything else is refused before it is read. */
function pageMimeOf(file: File): string | null {
  const m = (file.type || '').toLowerCase()
  if (m === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'application/pdf'
  if (m.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) return 'image/jpeg'
  return null
}

export function useTicketCapture(io: TicketCaptureIo = {}) {
  const [pages, setPages] = useState<TicketShot[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<string | null>(null)
  const pagesRef = useRef<TicketShot[]>([])
  pagesRef.current = pages
  const ioRef = useRef(io)
  ioRef.current = io

  // The object URLs go when the hook does.
  useEffect(() => () => pagesRef.current.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl)), [])

  const take = useCallback(async (files: File[], source: TicketPressSource) => {
    const now = (ioRef.current.now ?? Date.now)()
    const shrink = ioRef.current.shrink ?? shrinkReportPhoto
    const replacing = replaceRef.current
    replaceRef.current = null
    setError(null)
    setBusy(true)
    try {
      const shots: TicketShot[] = []
      for (const file of files) {
        const mime = pageMimeOf(file)
        if (!mime) {
          setError(`${file.name || 'That file'} is not a photo or a PDF.`)
          continue
        }
        if (mime === 'application/pdf') {
          if (file.size > TICKET_PAGE_MAX_BYTES) {
            setError('That PDF is over 10 MB.')
            continue
          }
          shots.push({ id: newPhotoId(), blob: file, mime, previewUrl: null, fileName: file.name, originalBytes: file.size, width: 0, height: 0, takenAt: new Date(now).toISOString(), takenAtFrom: 'none', source })
          continue
        }
        // The picture's own time is read before the shrink, which drops it. The camera's shot is the press itself.
        let takenAt = new Date(now).toISOString()
        let takenAtFrom: TicketTakenAtFrom = source === 'camera' ? 'press' : 'none'
        if (source !== 'camera') {
          try {
            const own = takenAtFromBytes(await file.slice(0, EXIF_HEAD_BYTES).arrayBuffer(), now)
            if (own.fromFile) {
              takenAt = own.iso
              takenAtFrom = 'photo'
            }
          } catch {
            // a file that does not read keeps no time of its own
          }
        }
        const shot = await shrink(file, 'large')
        if (shot.blob.size > TICKET_PAGE_MAX_BYTES) {
          setError('That photo is over 10 MB even after the shrink.')
          continue
        }
        const outMime = TICKET_PAGE_MIMES.includes(shot.blob.type) ? shot.blob.type : 'image/jpeg'
        shots.push({ id: newPhotoId(), blob: shot.blob, mime: outMime, previewUrl: URL.createObjectURL(shot.blob), fileName: file.name, originalBytes: file.size, width: shot.width, height: shot.height, takenAt, takenAtFrom, source })
      }
      if (shots.length === 0) return
      setPages((cur) => {
        if (replacing) {
          const old = cur.find((p) => p.id === replacing)
          if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl)
          return cur.map((p) => (p.id === replacing ? shots[0]! : p))
        }
        return [...cur, ...shots].slice(0, TICKET_MAX_PAGES)
      })
    } catch (e) {
      setError(formatErrorMessage(e, 'The photo did not read.'))
    } finally {
      setBusy(false)
    }
  }, [])

  const onPick = (source: TicketPressSource) => (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length > 0) void take(files, source)
  }

  const cameraInput: TicketInputProps = { ref: cameraRef, type: 'file', accept: 'image/*', capture: 'environment', multiple: false, onChange: onPick('camera'), tabIndex: -1, 'aria-hidden': true, style: HIDDEN, 'data-testid': 'ticket-camera-input' }
  const filesInput: TicketInputProps = { ref: filesRef, type: 'file', accept: 'image/*,application/pdf', multiple: true, onChange: onPick('file'), tabIndex: -1, 'aria-hidden': true, style: HIDDEN, 'data-testid': 'ticket-files-input' }

  /** The camera, for a first page or another one. */
  const openCamera = useCallback(() => {
    replaceRef.current = null
    cameraRef.current?.click()
  }, [])
  /** A photo or a PDF the person already has. */
  const openFiles = useCallback(() => {
    replaceRef.current = null
    filesRef.current?.click()
  }, [])
  /** The camera again, and the new shot takes this page's place. */
  const retake = useCallback((pageId: string) => {
    replaceRef.current = pageId
    cameraRef.current?.click()
  }, [])
  const removePage = useCallback((pageId: string) => {
    setPages((cur) => {
      const old = cur.find((p) => p.id === pageId)
      if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl)
      return cur.filter((p) => p.id !== pageId)
    })
  }, [])
  /** The sheet closed without its Save: nothing was sent, so nothing is taken back. */
  const discard = useCallback(() => {
    pagesRef.current.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
    setPages([])
    setError(null)
  }, [])

  /**
   * Save: the ticket's time is its first page's, and it knows when it was taken when any page does. Sent with the
   * signal up; kept on the phone when the send is lost to the signal. Any other failure throws with its reason and the
   * sheet stays as it was.
   */
  const save = useCallback(async (input: TicketSaveInput): Promise<TicketSaveOutcome> => {
    const shots = pagesRef.current
    if (shots.length === 0) throw new Error('Take a photo of the ticket first.')
    const timed = shots.find((p) => p.takenAtFrom === 'press') ?? shots.find((p) => p.takenAtFrom === 'photo') ?? shots[0]!
    const takenBy = input.takenBy ?? input.userId
    // The press's own door: a ticket that waits on the phone is never a receipt link's.
    const source: TicketPressSource = input.source ?? shots[0]!.source
    const draft: TicketDraft = {
      id: newPhotoId(),
      takenBy,
      takenByName: input.takenByName ?? input.byName,
      takenAt: timed.takenAt,
      takenAtFrom: input.source === 'office' ? 'none' : timed.takenAtFrom,
      source,
      jobId: input.write.job_id,
      alsoJobIds: input.write.also_job_ids,
      noOneJob: input.write.no_one_job,
      poEntryId: input.write.po_entry_id,
      total: input.total,
      note: input.note,
    }
    const pageDrafts: TicketPageDraft[] = shots.map((p, i) => ({ id: p.id, pageNo: i + 1, blob: p.blob, mime: p.mime, originalBytes: p.originalBytes, width: p.width, height: p.height, takenAt: p.takenAt }))
    setBusy(true)
    setError(null)
    try {
      try {
        await (ioRef.current.send ?? sendTicket)(draft, pageDrafts, input.userId)
        announceTickets([draft.id])
        discard()
        return { kind: 'sent', ticketId: draft.id }
      } catch (e) {
        // Lost to the signal: keep the bytes and the facts, and the replay sends them when it is back.
        // The office's scan for someone else never queues: the desk has a signal, and a kept press sends as its presser.
        if (!sendLostSignal(e, TICKET_SEND_ERROR_NAME) || isImpersonationSessionActive() || takenBy !== input.userId) throw e
        const store = ioRef.current.kept ?? keptPhotos
        const held = await Promise.all(pageDrafts.map((p) => store.keep(p.id, p.blob)))
        if (held.some((ok) => !ok)) {
          void store.drop(pageDrafts.map((p) => p.id))
          throw e
        }
        const photos: KeptTicketPage[] = pageDrafts.map((p) => ({ id: p.id, sent: false, pageNo: p.pageNo, mime: p.mime, takenAt: p.takenAt, bytes: p.blob.size, originalBytes: p.originalBytes, width: p.width, height: p.height, byName: input.byName }))
        const outcome = await (ioRef.current.press ?? pressThroughOutbox)(
          {
            kind: 'counter-ticket',
            userId: input.userId,
            pressedAt: Date.now(),
            payload: { ticketId: draft.id, takenAt: draft.takenAt, takenAtFrom: draft.takenAtFrom, source, jobId: draft.jobId, alsoJobIds: draft.alsoJobIds, noOneJob: draft.noOneJob, poEntryId: draft.poEntryId, total: draft.total, note: draft.note, byName: input.byName, photos },
            about: input.about,
            door: TICKET_DOOR,
          },
          { forceQueue: true },
        )
        if (outcome.kind !== 'queued') {
          void store.drop(pageDrafts.map((p) => p.id))
          throw e
        }
        discard()
        return { kind: 'kept', ticketId: draft.id }
      }
    } catch (e) {
      const words = formatErrorMessage(e, 'The ticket did not save.')
      setError(words)
      throw new Error(words)
    } finally {
      setBusy(false)
    }
  }, [discard])

  return { pages, busy, error, cameraInput, filesInput, openCamera, openFiles, retake, removePage, discard, save }
}

export type TicketCapture = ReturnType<typeof useTicketCapture>
