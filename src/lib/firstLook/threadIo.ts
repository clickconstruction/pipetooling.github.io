/**
 * First look on a thread (punch list #319 PR 1): the reads and writes behind the look's card and the ask. The office
 * team reads `first_looks` and `first_look_files` under their own policy, and signs a file in the private
 * `first-look-files` bucket for an hour to draw it, as it signs a file that came on a line. The ask is
 * `mint_first_look`, which answers the look's code once. The two functions are not in the generated types until
 * their types PR, so they are called untyped, as the rating link's is. One interface, so a smoke hands a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkSupabaseError } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import type { ThreadLook, ThreadLookFile } from './card'
import { FIRST_LOOK_BUCKET, showUsLink } from './look'

/** How long a signed address to a look's file lasts: an hour, so a video keeps playing while the card is open. */
export const LOOK_FILE_SIGNED_SECONDS = 3600

export interface FirstLookThreadIo {
  /** The looks asked on this thread that are not closed, and their finished files. */
  looks(contactId: string): Promise<{ looks: ThreadLook[]; files: ThreadLookFile[] }>
  /** One look and its finished files, by the look's id: for an estimate or a job that remembers it. Null when it is gone. */
  lookById(lookId: string): Promise<{ look: ThreadLook; files: ThreadLookFile[] } | null>
  /** The looks a job was made from, newest first, with their finished files (PR 6). Whoever may see the job's photos reads them. */
  looksOfJob(jobId: string): Promise<{ looks: ThreadLook[]; files: ThreadLookFile[] }>
  /** PR 7: the office asked the people on this task to read the look. */
  askTech(lookId: string, taskId: string): Promise<void>
  /** PR 7: the tech's read of a look, with a note. Written on the person's thread as a team note. */
  answer(lookId: string, read: 'can_price' | 'needs_visit', note: string | null): Promise<void>
  /** Ties a look to the job Book a visit made from it. */
  setJob(lookId: string, jobId: string): Promise<void>
  /** The look an estimate was started from, or null. Null too from a database that has no such column yet. */
  lookOfEstimate(estimateId: string): Promise<string | null>
  /** A signed address for each of a look's files, by its place in the bucket. A file that will not sign is left out. */
  signLookFiles(paths: readonly string[]): Promise<Record<string, string>>
  /** A signed address for each file that came on a line, by its `message_attachments` id. */
  signTexted(ids: readonly string[]): Promise<Record<string, string>>
  /** The ask: makes the look and answers its id and the link the text carries. */
  mint(contactId: string): Promise<{ id: string; link: string }>
  /** Stamps a look looked at, or closes it. */
  stamp(lookId: string, what: 'looked' | 'closed'): Promise<void>
}

const LOOK_BASE = 'id, contact_id, asked_by_name, made_at, expires_at, opened_at, sent_at, looked_at, closed_at, place, words'
const FILE_BASE = 'id, look_id, kind, mime, storage_path, bytes, seconds, finished_at'
/** PR 2's Drive columns. A read that meets a database from before them (the hour between a merge and its push) reads without. */
/** PR 7's columns ride a second step, so a database that has PR 2's and not PR 7's still reads the Drive folder. */
const LOOK_DRIVE = `${LOOK_BASE}, drive_folder_id`
const LOOK_COLUMNS = `${LOOK_DRIVE}, asked_tech_ids, asked_tech_at, tech_read, tech_note, tech_read_name`
const FILE_COLUMNS = `${FILE_BASE}, drive_file_id, fail_why`

/** The look's columns from the fullest set the database has down to the first: each step drops what a later PR added. */
const LOOK_COLUMN_STEPS = () => [LOOK_COLUMNS, LOOK_DRIVE, LOOK_BASE]

/** A column the database does not have yet: Postgres says 42703, and PostgREST says it in words. */
function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  return Boolean(error) && (error?.code === '42703' || /column .* does not exist/i.test(error?.message ?? ''))
}

export function supabaseFirstLookThreadIo(client: unknown = supabase): FirstLookThreadIo {
  const db = client as SupabaseClient
  return {
    async looks(contactId) {
      const readLooks = (columns: string) => db.from('first_looks').select(columns).eq('contact_id', contactId).is('closed_at', null).order('made_at', { ascending: false }).limit(20)
      let looks = await readLooks(LOOK_COLUMNS)
      for (const columns of LOOK_COLUMN_STEPS().slice(1)) if (isMissingColumn(looks.error)) looks = await readLooks(columns)
      checkSupabaseError(looks, 'read the looks')
      const rows = (looks.data ?? []) as unknown as ThreadLook[]
      if (!rows.length) return { looks: [], files: [] }
      const readFiles = (columns: string) =>
        db
          .from('first_look_files')
          .select(columns)
          .in('look_id', rows.map((l) => l.id))
          .not('finished_at', 'is', null)
          .is('removed_at', null)
          .order('finished_at', { ascending: true })
      let files = await readFiles(FILE_COLUMNS)
      if (isMissingColumn(files.error)) files = await readFiles(FILE_BASE)
      checkSupabaseError(files, 'read what came in')
      return { looks: rows, files: (files.data ?? []) as unknown as ThreadLookFile[] }
    },
    async lookById(lookId) {
      const readLook = (columns: string) => db.from('first_looks').select(columns).eq('id', lookId).maybeSingle()
      let look = await readLook(LOOK_COLUMNS)
      for (const columns of LOOK_COLUMN_STEPS().slice(1)) if (isMissingColumn(look.error)) look = await readLook(columns)
      checkSupabaseError(look, 'read the look')
      if (!look.data) return null
      const readFiles = (columns: string) => db.from('first_look_files').select(columns).eq('look_id', lookId).not('finished_at', 'is', null).is('removed_at', null).order('finished_at', { ascending: true })
      let files = await readFiles(FILE_COLUMNS)
      if (isMissingColumn(files.error)) files = await readFiles(FILE_BASE)
      checkSupabaseError(files, 'read what came in')
      return { look: look.data as unknown as ThreadLook, files: (files.data ?? []) as unknown as ThreadLookFile[] }
    },
    async looksOfJob(jobId) {
      const readLooks = (columns: string) => db.from('first_looks').select(columns).eq('job_id', jobId).order('made_at', { ascending: false }).limit(5)
      let looks = await readLooks(LOOK_COLUMNS)
      if (isMissingColumn(looks.error)) looks = await readLooks(LOOK_DRIVE)
      // A database from before `job_id` has no look for any job.
      if (isMissingColumn(looks.error)) return { looks: [], files: [] }
      checkSupabaseError(looks, 'read the job’s look')
      const rows = (looks.data ?? []) as unknown as ThreadLook[]
      if (!rows.length) return { looks: [], files: [] }
      const files = await db
        .from('first_look_files')
        .select(FILE_COLUMNS)
        .in('look_id', rows.map((l) => l.id))
        .not('finished_at', 'is', null)
        .is('removed_at', null)
        .order('finished_at', { ascending: true })
      checkSupabaseError(files, 'read what the customer sent')
      return { looks: rows, files: (files.data ?? []) as unknown as ThreadLookFile[] }
    },
    async askTech(lookId, taskId) {
      const result = await db.rpc('ask_tech_first_look', { p_look_id: lookId, p_item_id: taskId })
      checkSupabaseError(result, 'ask the tech')
    },
    async answer(lookId, read, note) {
      const result = await db.rpc('answer_first_look', { p_look_id: lookId, p_read: read, p_note: note })
      checkSupabaseError(result, 'send your answer')
    },
    async setJob(lookId, jobId) {
      const result = await db.rpc('set_first_look_job', { p_look_id: lookId, p_job_id: jobId })
      checkSupabaseError(result, 'tie the look to the job')
    },
    async lookOfEstimate(estimateId) {
      const row = await db.from('estimates').select('first_look_id').eq('id', estimateId).maybeSingle()
      if (row.error) return null
      const id = (row.data as { first_look_id?: string | null } | null)?.first_look_id
      return typeof id === 'string' && id ? id : null
    },
    async signLookFiles(paths) {
      if (!paths.length) return {}
      const signed = await db.storage.from(FIRST_LOOK_BUCKET).createSignedUrls([...paths], LOOK_FILE_SIGNED_SECONDS)
      if (signed.error) throw signed.error
      const out: Record<string, string> = {}
      for (const s of signed.data ?? []) if (s.path && s.signedUrl && !s.error) out[s.path] = s.signedUrl
      return out
    },
    async signTexted(ids) {
      if (!ids.length) return {}
      const rows = await db.from('message_attachments').select('id, bucket_path').in('id', [...ids])
      checkSupabaseError(rows, 'read the files they texted')
      const byPath = new Map<string, string>()
      for (const r of (rows.data ?? []) as Array<{ id: string; bucket_path: string | null }>) if (r.bucket_path) byPath.set(r.bucket_path, r.id)
      if (!byPath.size) return {}
      const signed = await db.storage.from('message-attachments').createSignedUrls([...byPath.keys()], LOOK_FILE_SIGNED_SECONDS)
      if (signed.error) throw signed.error
      const out: Record<string, string> = {}
      for (const s of signed.data ?? []) {
        const id = s.path ? byPath.get(s.path) : undefined
        if (id && s.signedUrl && !s.error) out[id] = s.signedUrl
      }
      return out
    },
    async mint(contactId) {
      const result = await db.rpc('mint_first_look', { p_contact_id: contactId })
      checkSupabaseError(result, 'make the link for their photos')
      const data = (result.data ?? {}) as { ok?: boolean; id?: string; code?: string }
      const code = typeof data.code === 'string' ? data.code.trim() : ''
      if (!data.ok || !data.id || !code) throw new Error('The link for their photos was not made.')
      return { id: data.id, link: showUsLink(code) }
    },
    async stamp(lookId, what) {
      const result = await db.rpc('stamp_first_look', { p_look_id: lookId, p_what: what })
      checkSupabaseError(result, what === 'closed' ? 'close the look' : 'mark the look seen')
    },
  }
}
