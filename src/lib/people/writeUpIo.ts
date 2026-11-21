/**
 * Write someone up (punch list #410): the reads and the writes behind the sheet. The list comes from
 * `write_up_people()`, a send goes through the outbox and lands through `land_person_report`, the writer's own rows are read from `person_reports`
 * under its row rule (an author reads their own), and a take-back goes through `withdraw_person_report`. The columns
 * and the functions are younger than the generated types, hence the cast. The rules are `writeUp.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { keptWriteUps, parseWriteUpList, type KeptWriteUp, type MyWriteUpRow, type WriteUpList } from './writeUp'
import { mintPressId, pressThroughOutbox } from '../offline/pressThroughOutbox'
import { outbox } from '../offline/outboxState'
import { keptPhotos } from '../offline/keptPhotos'
import type { KeptShot } from '../offline/outbox'
import { errorKindOf } from '../../utils/errorHandling'
import { PhotoSendError } from '../photos/jobPhotoNotesIo'
import { WRITE_UP_PHOTO_WORDS, type WriteUpDraftPhoto } from './writeUpPhotos'
import { sendWriteUpPhoto } from './writeUpPhotosIo'

const db = supabase as unknown as SupabaseClient

/** How many of the writer's own write-ups the sheet lists. */
export const MY_WRITE_UPS_CAP = 30

/** How a send ended: landed, kept on the phone for the signal, refused with the server's reason, or failed. */
export type WriteUpSent = { kind: 'landed' } | { kind: 'queued' } | { kind: 'refused'; message: string } | { kind: 'failed'; error: unknown }

export interface WriteUpIo {
  list: () => Promise<WriteUpList>
  mine: (userId: string) => Promise<MyWriteUpRow[]>
  /** Sends through the outbox (punch list #410, PR 4): with no signal the write-up is kept on the phone and sent later. */
  send: (userId: string, fields: Record<string, unknown>, pressedAt: number, photos?: ReadonlyArray<WriteUpDraftPhoto>, byName?: string) => Promise<WriteUpSent>
  /** The writer's write-ups still on the phone. */
  kept: (userId: string) => KeptWriteUp[]
  /** Called when the phone's kept presses change: one landed, one was refused. */
  onKeptChange: (cb: () => void) => () => void
  takeBack: (reportId: string, reason: string) => Promise<void>
}

export async function loadWriteUpList(): Promise<WriteUpList> {
  const { data, error } = await db.rpc('write_up_people')
  if (error) throw error
  return parseWriteUpList(data)
}

export async function loadMyWriteUps(userId: string): Promise<MyWriteUpRow[]> {
  const { data, error } = await db
    .from('person_reports')
    .select('id, subject_person_id, content, status, kind, occurred_date, occurred_time, job_label, created_at, resolution_note, adds_to')
    .eq('author_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MY_WRITE_UPS_CAP)
  if (error) throw error
  return (data ?? []) as MyWriteUpRow[]
}

export async function takeBackWriteUp(reportId: string, reason: string): Promise<void> {
  const { error } = await db.rpc('withdraw_person_report', { p_report_id: reportId, p_reason: reason })
  if (error) throw error
}

/**
 * One send through the outbox. The press id is minted here, since the photos are named by it, and it is kept on every
 * try, so a send lands once. Each photo is sent first. A photo that cannot go for want of signal is kept on the phone,
 * and the whole write-up then waits with it: the replay sends the photos, then lands the write-up.
 */
export async function sendWriteUp(userId: string, fields: Record<string, unknown>, pressedAt: number, photos: ReadonlyArray<WriteUpDraftPhoto> = [], byName = ''): Promise<WriteUpSent> {
  const id = mintPressId()
  const riding: KeptShot[] = []
  let waits = false
  for (const photo of photos) {
    let sent = false
    if (!waits) {
      try {
        await sendWriteUpPhoto({ id: photo.id, pressId: id, blob: photo.blob, byUserId: userId, takenAt: photo.takenAt, width: photo.width, height: photo.height })
        sent = true
      } catch (e) {
        const kind = e instanceof PhotoSendError ? e.kind : errorKindOf(e)
        if (kind !== 'network') return { kind: 'failed', error: e }
      }
    }
    if (!sent) {
      waits = true
      if (!(await keptPhotos.keep(photo.id, photo.blob))) return { kind: 'failed', error: new Error(WRITE_UP_PHOTO_WORDS.notKept) }
    }
    riding.push({ id: photo.id, sent, takenAt: photo.takenAt, bytes: photo.blob.size, originalBytes: photo.originalBytes, width: photo.width, height: photo.height, byName })
  }
  const outcome = await pressThroughOutbox(
    { kind: 'person-report', userId, pressedAt, payload: riding.length > 0 ? { fields, photos: riding } : { fields }, about: '', door: '/dashboard' },
    { id, forceQueue: waits },
  )
  if (outcome.kind === 'landed') return { kind: 'landed' }
  if (outcome.kind === 'queued') return { kind: 'queued' }
  if (outcome.kind === 'refused') return { kind: 'refused', message: outcome.message }
  return { kind: 'failed', error: outcome.error }
}

export const writeUpIo: WriteUpIo = {
  list: loadWriteUpList,
  mine: loadMyWriteUps,
  send: sendWriteUp,
  kept: (userId) => keptWriteUps(outbox.presses(), userId),
  onKeptChange: (cb) => outbox.subscribe(cb),
  takeBack: takeBackWriteUp,
}
