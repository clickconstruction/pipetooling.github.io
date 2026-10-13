import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5440',
  date: '2026-10-13',
  title: 'Messages: the owner turns texts on from Settings',
  kind: 'feature',
  roles: ['dev', 'master_technician'],
  highlights: [
    'Settings → Phone and texts has a Send texts switch for the owner and a dev. It asks before it turns texts on.',
    'While it is off, a text in a thread’s send window waits and its Send stays off. Email still goes.',
    'The app still answers a HELP text and confirms a stop while texts are off. The carriers expect both.',
  ],
}

export default note
