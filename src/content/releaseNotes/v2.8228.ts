import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8228',
  date: '2026-11-21',
  title: 'Legal portal: the law firm is never sent the same email twice',
  kind: 'fix',
  highlights: [
    'The app sends the law firm its emails every five minutes. When two of those rounds ran at the same moment, each could send the same email. A round now marks what it is about to send first, so the other leaves it alone.',
    'An email that fails to send is tried again five minutes later, as before. Nothing is lost when a round stops part way.',
    'The weekly digest is held the same way, so a person gets one digest on their day.',
    'No email reads differently, and who gets which email and when is unchanged.',
  ],
}

export default note
