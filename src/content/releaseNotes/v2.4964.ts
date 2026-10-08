import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4964',
  date: '2026-10-08',
  title: 'My Time day editor: rejecting a session takes its hours out of payroll in the same step',
  kind: 'fix',
  highlights: [
    'Rejecting a session in the time editor now rejects it and takes its hours out of payroll together, or does neither. Before, a hiccup between the two steps could leave a rejected session’s hours counted.',
    'If you can’t change a session, Reject session now says so instead of closing as if it worked.',
  ],
}

export default note
