import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4229',
  date: '2026-09-30',
  title: 'Help: the submittal guide in plain words',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The guide "build a submittal package" is rewritten the way the Submittals page and its walkthrough now read: one idea per sentence, none over twenty words, no dashes or brackets gluing ideas together.',
    'Every button and chip keeps its exact name, every example is kept word for word, and a trade word gets a plain word beside it the first time: a revision is one version of the submittal, the room is the page where the GC reads your rows.',
    'Nothing on the page changes. Open Help and search "submittal" to read it.',
  ],
}

export default note
