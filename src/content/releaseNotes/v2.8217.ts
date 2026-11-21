import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8217',
  date: '2026-11-21',
  title: 'Sub papers: the subject names the number, the payment record reads Got it, and an old line goes',
  kind: 'fix',
  highlights: [
    'A sheet’s first work statement went out under a subject with no number, beside a file that had one. The subject now names the same number as the file.',
    'A payment record made in the office always said Not marked yet. It now says the day the sub pressed Got it on their page, on the screen and on the PDF.',
    'When the marks cannot be read, a line under the payment record says so.',
    'The green or red line from the last press stayed while you switched papers. It now goes when you pick another paper or turn to the send step.',
  ],
}

export default note
