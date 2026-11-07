import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6640',
  date: '2026-11-07',
  title: 'A second text inside a tech’s hold lands on the thread: the bio after On my way, an I’m here, an office reply',
  kind: 'fix',
  highlights: [
    'When a tech texts a customer from Job Mode, the customer’s answer is held for that tech until their hour. The next text out on that thread, the bio that follows a first On my way, the I’m here after it, or an office reply before the hour, went out but could not be written to the thread, and the phone said it did not go.',
    'Found on the owner’s live walk of the tech’s bio: the On my way line landed, the bio reached the phone, and the thread showed the line alone. The thread now takes every text, and ending a hold clears the hour with the holder.',
    'Marking an unnamed sender a notice during such a hold had the same fault and is fixed the same way.',
  ],
}

export default note
