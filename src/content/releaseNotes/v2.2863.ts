import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2863',
  date: '2026-09-05',
  title: 'Robots: one command starts an authenticated robot session on any machine',
  kind: 'infra',
  highlights: [
    'Starting a robot work session used to require hand-exporting the twin key in exactly the right way before launch — now a launcher script reads the saved key file and starts the session ready to work.',
    'The harness guide now explains the bootstrap: keep the key in one file per machine, revoke it from Settings → Digital twins to cut that machine off.',
  ],
}

export default note
