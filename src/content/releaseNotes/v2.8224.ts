import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8224',
  date: '2026-11-21',
  title: 'Punch list: a tick can be read by the others who open the board',
  kind: 'infra',
  highlights: [
    'A tick on a punch list card is becoming a claim. The database now lets everyone who can open the board read who ticked a card.',
    'Each tick carries the name of the person who made it.',
    'Only the person who ticked a card can take their tick off.',
    'Nothing on screen changes yet. The names on the cards come next.',
  ],
}

export default note
