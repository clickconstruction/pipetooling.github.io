/**
 * Cards and footers (punch list #313) — the whole team at once.
 *
 * The office opens *Cards and footers for the team* from People → Users. It lists everyone with
 * whether a card can be made for them, makes what is ready, and names who is held with the reason
 * and a door (`CLAUDE.md` → Do what is ready, never all or nothing). A person with no photo, no
 * email or no name is held. A missing mobile or title holds nobody: that line is left off, and
 * the row says so.
 */
import { batchWords, countedLabel, type BatchWords } from '../batchWords'
import type { KitPerson } from './draw'
import { cardHold, kitPersonFromUser, type KitCrop, type KitUserFacts } from './person'

/** One teammate as the team window reads them. */
export type TeamCardRow = { id: string; role: string; facts: KitUserFacts; photoPath: string | null; crop: KitCrop; /** The look the person picked, or null for the default. */ look?: string | null; /** The card size the person picked, or null for the default. */ size?: string | null }

export type TeamCard = {
  id: string
  /** The name as the card will carry it. */
  name: string
  /** The facts, with no photo yet: the photo is fetched when a card is made. */
  person: KitPerson
  photoPath: string | null
  crop: KitCrop
  /** The look the person picked, or null for the company's default. */
  look: string | null
  /** The card size the person picked, or null for the company's default. */
  size: string | null
  /** Why no card can be made, in the chip's words, or null when one can. */
  hold: 'No photo' | 'No email' | 'No name' | null
  /** Lines that will be left off the card, said on the row so nobody is surprised. */
  leftOff: string[]
}

/** The team as rows: who is ready, who is held and why, sorted by name. */
export function teamCards(rows: TeamCardRow[], officePhone: string): TeamCard[] {
  return rows
    .map((row): TeamCard => {
      const person = kitPersonFromUser(row.facts, officePhone, null)
      // the photo itself is fetched later; a path on file is what makes a person ready
      const held = cardHold({ ...person, photo: row.photoPath ? { href: row.photoPath, w: 1, h: 1, fx: 0.5, fy: 0.5, zoom: 1 } : null })
      const hold = held === 'has no photo' ? 'No photo' : held === 'has no email' ? 'No email' : held === 'has no name' ? 'No name' : null
      const leftOff = [...(person.title ? [] : ['No title, line left off']), ...(person.mobile ? [] : ['No mobile, line left off'])]
      return { id: row.id, name: person.name || row.facts.name || '', person, photoPath: row.photoPath, crop: row.crop, look: row.look ?? null, size: row.size ?? null, hold, leftOff }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Everyone ready starts ticked. */
export function defaultTicks(cards: TeamCard[]): Set<string> {
  return new Set(cards.filter((c) => !c.hold).map((c) => c.id))
}

/** The words on the two batch presses: what each will do, with its count, and what it holds. */
export function teamPressWords(cards: TeamCard[], ticked: ReadonlySet<string>): { cards: BatchWords; footers: string; ready: TeamCard[]; held: number } {
  const ready = cards.filter((c) => !c.hold && ticked.has(c.id))
  const held = cards.filter((c) => c.hold).length
  return {
    cards: batchWords({ verb: 'Make', ready: ready.length, held, heldWhy: { one: 'is held', many: 'are held' }, noun: 'card' }),
    footers: countedLabel('Download', ready.length, 'footer'),
    ready,
    held,
  }
}
