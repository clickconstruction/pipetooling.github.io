import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5311',
  date: '2026-10-12',
  title: 'Messages: choose who gets a new message, in Settings → Phone and texts',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Settings has a new Phone and texts tab. Who gets a new message shows who gets a text, call or email first.',
    'Whoever answered the person last gets it. Otherwise it goes to the seat for who they are.',
    'The owner or a dev picks the person for customers, trade partners and architects. The office reads the seats.',
  ],
}

export default note
