/**
 * Cards and footers (punch list #313) — the card's reads and writes.
 *
 * It reads the person's row for the facts a card is drawn from, and the photo from the private
 * bucket `person-photos`, where a person's folder is their own id. It reads through the untyped
 * client on purpose: the three columns (`card_name`, `photo_path`, `photo_crop`,
 * `20261111200000_person_card_facts.sql`) are newer than the generated types, and before that
 * migration is pushed the read falls back to the columns that were always there and says the
 * card is not on yet (`columnsOn: false`).
 *
 * Who may write is the database's call: a person their own row and folder, the office anyone's.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { readCrop, type KitCrop, type KitUserFacts } from './person'
import type { TeamCardRow } from './team'

export const PERSON_PHOTOS_BUCKET = 'person-photos'

export type CardLoad = {
  facts: KitUserFacts
  photoPath: string | null
  crop: KitCrop
  /** False until the migration is pushed: the card then shows a line and no fields. */
  columnsOn: boolean
}

export type CardPhoto = { href: string; w: number; h: number }

export interface CardIo {
  load(userId: string): Promise<CardLoad>
  /** The photo at `path`, as data with its size, so it can be drawn into a file. */
  photo(path: string): Promise<CardPhoto>
  /** Uploads a new photo into the person's folder, points their row at it with its crop, and removes the old one. Returns the new path. */
  savePhoto(userId: string, blob: Blob, crop: KitCrop, oldPath: string | null): Promise<string>
  saveCrop(userId: string, crop: KitCrop): Promise<void>
  saveFacts(userId: string, facts: { card_name: string; title: string }): Promise<void>
}

/** The team window's reads: everyone a card can be made for, and one person's photo. */
export interface TeamCardIo {
  team(): Promise<TeamCardRow[]>
  photo(path: string): Promise<CardPhoto>
}

/** A picture's data and size, read in the browser. */
export function readPicture(blob: Blob): Promise<CardPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('The picture could not be read.'))
    reader.onload = () => {
      const href = String(reader.result)
      const img = new Image()
      img.onload = () => resolve({ href, w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => reject(new Error('The picture could not be read.'))
      img.src = href
    }
    reader.readAsDataURL(blob)
  })
}

/** The name a new photo is kept under: the person's own folder, a new name each time so no screen shows a stale one. */
export function photoPathFor(userId: string, now: number, type: string): string {
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
  return `${userId}/photo-${now}.${ext}`
}

/** Typed as plain strings on purpose: the client cannot parse columns its generated types do not know yet. */
const SELECTS: string[] = ['name, email, phone, title, card_name, photo_path, photo_crop', 'name, email, phone, title']

export function supabaseCardIo(client: unknown = supabase): CardIo {
  const db = client as SupabaseClient
  return {
    async load(userId) {
      for (const [i, columns] of SELECTS.entries()) {
        const read = await db.from('users').select(columns).eq('id', userId).maybeSingle()
        if (read.error && i < SELECTS.length - 1) continue
        checkSupabaseError(read, 'read the card')
        const row = (read.data ?? {}) as unknown as Record<string, unknown>
        const text = (v: unknown) => (typeof v === 'string' ? v : null)
        return {
          facts: { name: text(row.name), card_name: text(row.card_name), title: text(row.title), email: text(row.email), phone: text(row.phone) },
          photoPath: text(row.photo_path),
          crop: readCrop(row.photo_crop),
          columnsOn: i === 0,
        }
      }
      throw new Error('The card could not be read.')
    },
    async photo(path) {
      const { data, error } = await db.storage.from(PERSON_PHOTOS_BUCKET).download(path)
      if (error || !data) throw error ?? new Error('The photo could not be read.')
      return readPicture(data)
    },
    async savePhoto(userId, blob, crop, oldPath) {
      const path = photoPathFor(userId, Date.now(), blob.type)
      const up = await db.storage.from(PERSON_PHOTOS_BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg' })
      if (up.error) throw up.error
      const saved = await db.from('users').update({ photo_path: path, photo_crop: crop }).eq('id', userId).select('id')
      if (saved.error || !saved.data?.length) {
        // the row refused, so the picture is taken back out
        await db.storage.from(PERSON_PHOTOS_BUCKET).remove([path]).catch(() => undefined)
        checkSupabaseError(saved, 'save the photo')
        throw new Error('The photo was not saved. You may not have leave to change this account.')
      }
      if (oldPath && oldPath !== path) await db.storage.from(PERSON_PHOTOS_BUCKET).remove([oldPath]).catch(() => undefined)
      return path
    },
    async saveCrop(userId, crop) {
      const saved = await db.from('users').update({ photo_crop: crop }).eq('id', userId).select('id')
      checkSupabaseError(saved, 'save the photo')
      if (!saved.data?.length) throw new Error('The photo was not saved. You may not have leave to change this account.')
    },
    async saveFacts(userId, facts) {
      const saved = await db.from('users').update({ card_name: facts.card_name.trim() || null, title: facts.title.trim() || null }).eq('id', userId).select('id')
      checkSupabaseError(saved, 'save the card')
      if (!saved.data?.length) throw new Error('The card was not saved. You may not have leave to change this account.')
    },
  }
}

const TEAM_COLUMNS: string = 'id, name, email, phone, title, card_name, photo_path, photo_crop, role, archived_at, is_sample, is_digital_twin, is_walk_tester'

/** Everyone on the company's card: every login that is not archived, not a sample, a twin or a walk tester, and not a subcontractor. */
export function supabaseTeamCardIo(client: unknown = supabase): TeamCardIo {
  const db = client as SupabaseClient
  const one = supabaseCardIo(client)
  return {
    async team() {
      const read = await db.from('users').select(TEAM_COLUMNS).is('archived_at', null)
      checkSupabaseError(read, 'read the team')
      const text = (v: unknown) => (typeof v === 'string' ? v : null)
      return ((read.data ?? []) as unknown as Record<string, unknown>[])
        .filter((r) => !r.is_sample && !r.is_digital_twin && !r.is_walk_tester && r.role !== 'subcontractor')
        .map((r) => ({
          id: String(r.id),
          role: String(r.role ?? ''),
          facts: { name: text(r.name), card_name: text(r.card_name), title: text(r.title), email: text(r.email), phone: text(r.phone) },
          photoPath: text(r.photo_path),
          crop: readCrop(r.photo_crop),
        }))
    },
    photo: one.photo,
  }
}
