import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5684',
  date: '2026-10-20',
  title: 'Take an alternate off the letter from the preview',
  kind: 'feature',
  roles: ['estimator', 'assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'Clicking an alternate\'s dashed wording on the Cover Letter preview already opened the wording editor. The editor now also has a "Take off this letter" button.',
    'Pressing it stops offering that alternate — an offered price, a with-and-without alternate, or an in-lieu bid — and the letter repaints without it.',
    'The alternate\'s checkbox in step 1 unticks at the same moment, so bringing it back is one tick. The bid room follows either way.',
    'The button never shows on a base bid, an option, or the Alternates heading — only on lines that are offers.',
  ],
}

export default note
