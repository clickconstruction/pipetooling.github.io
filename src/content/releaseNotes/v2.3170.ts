import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3170',
  date: '2026-09-08',
  title: 'A supply house\'s contacts are its reps',
  kind: 'feature',
  highlights: [
    'The supply house form no longer has a single Contact Name and Email — those were one person\'s details stapled to the whole house. Who to email now lives only in the Reps list (name, email, label, starred default), which price requests already use.',
    'The house keeps one Main phone: the counter.',
    'Adding a new house: save it first, then add its reps on the same form.',
  ],
}

export default note
