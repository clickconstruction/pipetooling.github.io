import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4151',
  date: '2026-09-29',
  title: 'Pipeline: the owner-sees chip stays with the customer’s name',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a job whose customer has a long name, the name wraps and the 🌐 and “owner sees $0” chip now follow its last word, instead of floating off to the right beside a two-line block.',
  ],
}

export default note
