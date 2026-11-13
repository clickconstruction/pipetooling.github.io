import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7106',
  date: '2026-11-12',
  title: 'An HR file numbers its own evidence and its own open items',
  kind: 'feature',
  highlights: [
    'Every new piece of evidence on an HR file now gets its number from the file itself. Two people adding evidence at the same moment get two different numbers.',
    'Older evidence keeps its title as typed. A new number starts past the highest one an old title already carries.',
    'A case can keep its open items and its log as rows, each item numbered by the file. This is the groundwork. The list on the HR tab comes in a later release.',
    'Numbering the older evidence from its titles is a press a dev makes per person. It never guesses: two records with the same number are reported and left alone.',
  ],
}

export default note
