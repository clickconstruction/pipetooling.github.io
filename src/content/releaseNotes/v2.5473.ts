import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5473',
  date: '2026-10-13',
  title: 'Messages: see how each file we sent went, and cut our link off',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A message we sent marks each file: sent as the file, as our link to their portal, or as our link to the file.',
    'Our own link says how often it was opened and the time of each open. It never says who.',
    'Cut it off stops our link. The file stays where it is.',
  ],
}

export default note
