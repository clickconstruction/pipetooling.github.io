/**
 * Removing a photo (punch list #443, row 8): the take-back of **Save the photo** on *Card and footer*.
 *
 * A photo could be changed and never taken off. v2.8565 built the press for a developer on a test person alone.
 * Since v2.8586, on the owner's word of 2026-11-25 (*wider*), it is drawn for whoever may change that photo, on any
 * person: the press stands beside **Change the photo**, on the same card, for the same people. This is its rule.
 * Pure, but for `removePersonPhoto`, which reads the person again and then asks the card's own io to write.
 *
 * - The press is drawn wherever the card is, and only where there is a photo.
 * - The row is read again right before the write, so a photo changed or removed meanwhile is the one that counts.
 * - Who may write is the database's own rule: a person clears their own photo and the office a teammate's
 *   (`20261111200000_person_card_facts.sql`). A write it refuses comes back as words, through `cardIo.removePhoto`.
 *
 * Nothing else points at a photo: the card and the footer are drawn from the two columns, and the team's batch of
 * cards holds a person with none as *No photo* until one is saved (`team.ts`, `cardHold`).
 */
import type { CardIo } from './cardIo'

/** What of a person the press reads. */
export interface PhotoRemovePerson {
  photoPath: string | null
}

/** When the press is drawn: on a person who has a photo. Whoever reads the card reads it, as they read Change the photo. */
export function photoRemoveDrawn(person: PhotoRemovePerson): boolean {
  return !!person.photoPath
}

/** Why this person's photo cannot be removed; '' when it can. */
export function photoRemoveProblem(person: PhotoRemovePerson): string {
  return person.photoPath ? '' : 'There is no photo to remove.'
}

/** The confirm window's words. The button names the act. */
export function photoRemoveConfirm(name: string): { title: string; message: string; confirmLabel: string } {
  const who = name.trim()
  return {
    title: who ? `Remove the photo of ${who}?` : 'Remove the photo?',
    message: 'The photo comes off the card and the footer, and its file is deleted. It cannot be brought back. The team’s cards leave this person out until a new photo is saved.',
    confirmLabel: 'Remove the photo',
  }
}

/** What the toast says once it is gone. */
export const PHOTO_REMOVED = 'The photo was removed.'
/** What it says when the account was cleared and the bucket kept the file. */
export const PHOTO_REMOVED_FILE_LEFT = 'The photo came off the card. Its file could not be deleted.'

/**
 * Remove a person's photo. The person is read again here, so a photo changed since the card was opened is the one
 * removed, and one already gone is refused with the reason. Answers whether the file left the bucket as well.
 */
export async function removePersonPhoto(io: Pick<CardIo, 'load' | 'removePhoto'>, userId: string): Promise<{ fileGone: boolean }> {
  const fresh = await io.load(userId)
  const problem = photoRemoveProblem(fresh)
  if (problem || !fresh.photoPath) throw new Error(problem || 'There is no photo to remove.')
  return io.removePhoto(userId, fresh.photoPath)
}
