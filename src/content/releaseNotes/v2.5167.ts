import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5167',
  date: '2026-10-10',
  title: 'GC mode: the customer’s window, and our contract sent to sign',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A customer’s name on the GC board opens their window: their jobs with us, and our contract on each won job.',
    'Send to sign keeps our contract with the office’s PDF and the price it goes with. Remind them keeps both.',
    'When our price changes after a send, Send the new price sends a new one in its place.',
    'Get started’s contract row opens the send. No email goes until their portal can take a signature.',
  ],
}

export default note
