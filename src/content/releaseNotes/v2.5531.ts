import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5531',
  date: '2026-10-14',
  title: 'Lien desk: hover any mark on Deadlines and read its card',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On the Lien desk’s Deadlines tab, resting the pointer on any mark opens a card under it: what the mark is, its date and how many days away, the money owed on the job, and a button for the next move, such as Draft the notice or Record the mailing. The old one-line browser tooltip is gone.',
    'Marks that touch share one card, with a column for each mark in the order they sit. On a GC row, the folded flag’s card lists every job behind its count with each one’s month and money, and its button acts on exactly those jobs.',
    'A card wider than the board scrolls sideways. It opens on keyboard focus too, opens above the row when the list has no room below, and closes with Esc or when the pointer leaves. Pressing a mark still does what it did.',
  ],
}

export default note
