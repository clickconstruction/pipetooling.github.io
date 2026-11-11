/**
 * Cards and footers (punch list #313) — a person's facts for a card, and whether they are ready.
 *
 * The card reads what the app already holds: the name (or the name on the card, when the
 * person has set one, since the account name is a first name for most), the title the email
 * signature uses, the sign-in email, the phone as the mobile, and the company's one office
 * line. The photo is the one thing it has to ask for.
 */
import type { KitPerson, KitPhoto } from './draw'

/** The part of a `users` row the card reads. */
export type KitUserFacts = {
  name: string | null
  card_name?: string | null
  title?: string | null
  email?: string | null
  phone?: string | null
}

/** Where a photo sits in the ring, as kept on the person's row: across, down and zoom. */
export type KitCrop = { fx: number; fy: number; zoom: number }

export const DEFAULT_CROP: KitCrop = { fx: 0.5, fy: 0.4, zoom: 1 }

/** The crop as saved, read back safely: a missing or broken value is the default, and each number is held in range. */
export function readCrop(raw: unknown): KitCrop {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CROP }
  const o = raw as Record<string, unknown>
  const n = (v: unknown, fallback: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback)
  return { fx: n(o.fx, DEFAULT_CROP.fx, 0, 1), fy: n(o.fy, DEFAULT_CROP.fy, 0, 1), zoom: n(o.zoom, DEFAULT_CROP.zoom, 1, 4) }
}

/** The facts a card is drawn from. `photo` is the picture's address and size with its crop, or null. */
export function kitPersonFromUser(user: KitUserFacts, officePhone: string, photo: KitPhoto | null): KitPerson {
  const clean = (s: string | null | undefined) => (s ?? '').trim()
  return {
    name: clean(user.card_name) || clean(user.name),
    title: clean(user.title),
    email: clean(user.email),
    mobile: clean(user.phone),
    office: clean(officePhone),
    photo,
  }
}

/**
 * Why a card or a footer cannot be made for this person yet, or null when it can. A missing
 * mobile or title is not a hold: that line is left off. The words finish "<name> …", as the
 * batch's held list reads them.
 */
export function cardHold(person: KitPerson): 'has no name' | 'has no email' | 'has no photo' | null {
  if (!person.name) return 'has no name'
  if (!person.email) return 'has no email'
  if (!person.photo?.href) return 'has no photo'
  return null
}

/** A name as a file name: lower case, hyphens, nothing a file system minds. */
export function kitFileSlug(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-') || 'someone'
  )
}
