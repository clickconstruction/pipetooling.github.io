import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5447',
  date: '2026-10-13',
  title: 'Messages: a file sent as our own link opens on our page',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A file the office sends as our own link opens on our page first, then goes straight to the file.',
    'A plan opens in Drive’s own viewer. Anything else opens in the browser, and the team-only half of Drive stays private.',
    'Each open is counted, and a link the office turned off says so.',
  ],
}

export default note
