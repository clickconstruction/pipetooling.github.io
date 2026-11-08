import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6706',
  date: '2026-11-08',
  title: 'Job Mode names every job on a superintendent’s day',
  kind: 'fix',
  highlights: [
    'A superintendent’s first visit to a job they had not clocked onto yet showed a blank job number and no name or address in Job Mode. It now shows the job’s number, name and address, so On my way has somewhere to go.',
    'My Schedule and My day name the same visits too, where they used to say only Job.',
    'The Customer line on such a job used to say Loading… for good. It now says the contact shows once you clock in there.',
  ],
}

export default note
