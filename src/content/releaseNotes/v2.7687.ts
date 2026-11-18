import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7687',
  date: '2026-11-17',
  title: 'Lien notices: an assistant can put each envelope’s mail number on a notice already recorded',
  kind: 'infra',
  highlights: [
    'A developer’s assistant can now set the certified mail number of each envelope of a lien notice that is already on record: the owner’s copy and the contractor’s copy each keep their own.',
    'It can also replace a number that was typed on the wrong envelope, or take one off so the desk reads tracking owed.',
    'Before anything is written it shows each copy before and after, and says when a number’s last digit does not check or when two envelopes carry one number.',
    'It never changes the day mailed, emails nobody and issues no release.',
  ],
}

export default note
