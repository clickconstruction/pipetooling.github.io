import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6934',
  date: '2026-11-11',
  title: 'Bill Customer asks how a bill is paid when the customer has two in kind arrangements',
  kind: 'fix',
  highlights: [
    'Bill Customer used to ask nothing when a customer had more than one in kind arrangement. It opened as an ordinary bill for money.',
    'It now asks the same question as for one arrangement. Nothing can be sent or recorded until it is answered.',
    'Pick In kind and the window opens the customer’s page, where you put the job on the right arrangement. Pick With money and the bill goes out as usual.',
  ],
}

export default note
