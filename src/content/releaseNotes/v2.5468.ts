import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5468',
  date: '2026-10-13',
  title: 'Messages: a picture texted to the company number is kept the moment it comes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A picture or a file on a text to the company number is copied into the app the moment it comes, since the phone company’s link does not last.',
    'One that cannot be copied stays on the line marked as not copied, so you still see that a picture came.',
    'On a job set to save every photo, a texted photo then goes to the job’s Drive folder too.',
  ],
}

export default note
