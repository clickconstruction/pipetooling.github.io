import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7276',
  date: '2026-11-14',
  title: 'Materials on site: a box’s name is letters and a number, offered by the app',
  kind: 'feature',
  highlights: [
    'Add a container opens on the next free name on the site: the letters most of its boxes carry, one past the highest number any box ever had. Change it only when the paint on the steel says something else.',
    'A name is one to three letters and a number from 1 to 999, with one letter after the number allowed, like R76 or G24B. It is one of a kind across the whole site, every job of the development, and the database holds the rule too.',
    'Words typed after the name are not refused. R76 TOILETS becomes the name R76, and “Toilets” goes on the where line for now. The next change gives what is inside a line of its own.',
    'The office page asks how a box sits too, and both pages open on the kind you used last. Old names stay as they are until the office tidies them; Edit holds a new name to the same rule.',
  ],
}

export default note
