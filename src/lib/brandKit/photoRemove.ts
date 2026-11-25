/**
 * Removing a photo (punch list #443, row 8): the take-back of **Save the photo** on *Card and footer*.
 *
 * A photo could be changed and never taken off, so a made-up photo a walk saved on a test person stood on their
 * account, with its file in the bucket. This is the rule for the press that takes it off. Pure, but for
 * `removeTestPersonPhoto`, which runs the rule on a fresh read and then asks the card's own io to write.
 *
 * - The press is drawn for a dev and for nobody else, and only where there is a photo.
 * - Only a test person's photo goes: their name, or the name on their card, starts with ZZ (`isZzTestPerson`,
 *   the rule that already leaves such a person out of the team's batch of cards).
 * - The row is read again right before the write, and the same rule is run on what the database holds.
 *
 * Nothing else points at a photo: the card and the footer are drawn from the two columns, and a test person is in
 * no batch. The database already lets a person clear their own photo and the office a teammate's, so the two gates
 * here are the owner's rule for this press, not the database's.
 */
import type { CardIo } from './cardIo'
import type { KitUserFacts } from './person'
import { isZzTestPerson } from './team'

/** What of a person the press reads. */
export interface PhotoRemovePerson {
  facts: Pick<KitUserFacts, 'name' | 'card_name'>
  photoPath: string | null
}

/** Who is offered the press, and when: a dev, on a person who has a photo. Every other role sees nothing new. */
export function photoRemoveDrawn(role: string | null | undefined, person: Pick<PhotoRemovePerson, 'photoPath'>): boolean {
  return role === 'dev' && !!person.photoPath
}

/** Why this person's photo cannot be removed; '' when it can. */
export function photoRemoveProblem(person: PhotoRemovePerson): string {
  if (!person.photoPath) return 'There is no photo to remove.'
  if (!isZzTestPerson(person.facts)) return 'Only a test person’s photo can be removed. Their name must start with ZZ.'
  return ''
}

/** The confirm window's words. The button names the act. */
export function photoRemoveConfirm(name: string): { title: string; message: string; confirmLabel: string } {
  const who = name.trim()
  return {
    title: who ? `Remove the photo of ${who}?` : 'Remove the photo?',
    message: 'The photo comes off the card and the footer, and its file is deleted. It cannot be brought back.',
    confirmLabel: 'Remove the photo',
  }
}

/** What the toast says once it is gone. */
export const PHOTO_REMOVED = 'The photo was removed.'
/** What it says when the account was cleared and the bucket kept the file. */
export const PHOTO_REMOVED_FILE_LEFT = 'The photo came off the card. Its file could not be deleted.'

/**
 * Remove a test person's photo. The person is read again here and the rule is run on that read, so a name changed
 * since the card was opened is the one that counts. A person who fails the rule is refused with the reason.
 * Answers whether the file left the bucket as well.
 */
export async function removeTestPersonPhoto(io: Pick<CardIo, 'load' | 'removePhoto'>, userId: string): Promise<{ fileGone: boolean }> {
  const fresh = await io.load(userId)
  const problem = photoRemoveProblem(fresh)
  if (problem || !fresh.photoPath) throw new Error(problem || 'There is no photo to remove.')
  return io.removePhoto(userId, fresh.photoPath)
}
