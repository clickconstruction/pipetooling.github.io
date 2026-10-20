import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5503',
  date: '2026-10-13',
  title: 'Messages: the app’s own emails fold in a thread, with when they were opened and paid',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Emails the app sends on its own, such as reminders and bills, show in a thread as the app.',
    'Two or more in a row fold into one line with how many and their days. A press opens them in place.',
    'Under an email we sent, small print says the address it went from, when it was opened and when its bill was paid.',
  ],
}

export default note
